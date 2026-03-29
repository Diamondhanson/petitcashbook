-- Cashier role, human-readable request reference_code, RPC hardening, cashier read access to float + cashbook history

-- -----------------------------------------------------------------------------
-- 0. If profiles.role uses enum public.user_role, add label 'cashier' first.
--    Otherwise CHECK / casts fail with: invalid input value for enum user_role: "cashier"
--    (Skip silently when role is plain TEXT — no user_role type.)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'role'
      AND udt_name = 'user_role'
  ) THEN
    BEGIN
      ALTER TYPE public.user_role ADD VALUE 'cashier';
    EXCEPTION
      WHEN duplicate_object THEN
        NULL;
    END;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 1. profiles.role: add cashier (TEXT + CHECK setups only; no-op if enum-only)
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('employee', 'manager', 'accountant', 'admin', 'cashier'));

-- -----------------------------------------------------------------------------
-- 2. requests.reference_code (unique, human-friendly)
-- -----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.petty_cash_request_ref_seq
  START WITH 100001
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;

ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS reference_code TEXT;

-- Backfill existing rows (deterministic order)
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS rn
  FROM public.requests
  WHERE reference_code IS NULL
)
UPDATE public.requests r
SET reference_code = 'PC-' || lpad((100000 + o.rn)::bigint::text, 6, '0')
FROM ordered o
WHERE r.id = o.id;

ALTER TABLE public.requests
  ALTER COLUMN reference_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS requests_reference_code_key ON public.requests (reference_code);

CREATE OR REPLACE FUNCTION public.set_request_reference_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.reference_code IS NULL OR NEW.reference_code = '' THEN
    NEW.reference_code := 'PC-' || lpad(nextval('public.petty_cash_request_ref_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_set_request_reference_code ON public.requests;
CREATE TRIGGER tr_set_request_reference_code
  BEFORE INSERT ON public.requests
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_request_reference_code();

-- Align sequence so the next generated code follows backfilled max (PC-NNNNNN)
SELECT setval(
  'public.petty_cash_request_ref_seq',
  COALESCE(
    (
      SELECT MAX(SUBSTRING(reference_code FROM 4)::bigint)
      FROM public.requests
      WHERE reference_code ~ '^PC-[0-9]+$'
    ),
    100000
  ),
  true
);

-- -----------------------------------------------------------------------------
-- 3. get_cash_float: allow cashier to read balance
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_cash_float()
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
  bal NUMERIC;
BEGIN
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role NOT IN ('admin', 'accountant', 'cashier') THEN
    RAISE EXCEPTION 'Forbidden: admin, accountant, or cashier role required';
  END IF;
  SELECT current_balance INTO bal FROM public.cash_float WHERE id = 1;
  RETURN COALESCE(bal, 0);
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. Cash book history RPCs: admin or cashier (read-only lists)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_float_topups()
RETURNS TABLE (
  id UUID,
  amount_added NUMERIC,
  balance_after NUMERIC,
  created_at TIMESTAMPTZ,
  performer_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
BEGIN
  SELECT p.role INTO caller_role FROM public.profiles p WHERE p.id = auth.uid();
  IF caller_role IS NULL OR caller_role NOT IN ('admin', 'cashier') THEN
    RAISE EXCEPTION 'Forbidden: admin or cashier role required';
  END IF;

  RETURN QUERY
  SELECT
    l.id,
    l.amount_added,
    l.balance_after,
    l.created_at,
    pf.full_name::TEXT
  FROM public.float_topup_log l
  LEFT JOIN public.profiles pf ON pf.id = l.performed_by
  ORDER BY l.created_at DESC;
END;
$$;

-- Return row shape changed vs 008 (reference_code column); REPLACE is not allowed — drop first.
DROP FUNCTION IF EXISTS public.list_admin_closed_requests();

CREATE OR REPLACE FUNCTION public.list_admin_closed_requests()
RETURNS TABLE (
  id UUID,
  reference_code TEXT,
  status TEXT,
  amount NUMERIC,
  purpose TEXT,
  category TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ,
  requester_name TEXT,
  manager_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
BEGIN
  SELECT p.role INTO caller_role FROM public.profiles p WHERE p.id = auth.uid();
  IF caller_role IS NULL OR caller_role NOT IN ('admin', 'cashier') THEN
    RAISE EXCEPTION 'Forbidden: admin or cashier role required';
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.reference_code::TEXT,
    r.status::TEXT,
    r.amount,
    r.purpose,
    r.category,
    r.rejection_reason,
    r.created_at,
    rq.full_name::TEXT,
    mq.full_name::TEXT
  FROM public.requests r
  LEFT JOIN public.profiles rq ON rq.id = r.requester_id
  LEFT JOIN public.profiles mq ON mq.id = r.manager_id
  WHERE r.status IN ('disbursed', 'rejected')
  ORDER BY r.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_admin_closed_requests() TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. update_user_role: include cashier in valid_roles
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_user_role(target_user_id UUID, new_role TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
  valid_roles TEXT[] := ARRAY['employee', 'manager', 'accountant', 'admin', 'cashier'];
BEGIN
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role != 'admin' THEN
    RAISE EXCEPTION 'Forbidden: admin role required';
  END IF;
  IF new_role IS NULL OR NOT (new_role = ANY(valid_roles)) THEN
    RAISE EXCEPTION 'new_role must be one of: %, %, %, %, %', valid_roles[1], valid_roles[2], valid_roles[3], valid_roles[4], valid_roles[5];
  END IF;
  UPDATE public.profiles
  SET role = new_role, updated_at = now()
  WHERE id = target_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  RETURN jsonb_build_object('id', target_user_id, 'role', new_role);
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. update_requests_status: role and state guards
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'update_requests_status'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS public.update_requests_status(%s)', r.args);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.update_requests_status(
  p_request_id UUID,
  p_status TEXT,
  p_manager_id UUID DEFAULT NULL,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS SETOF public.requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id UUID := auth.uid();
  caller_role TEXT;
  cur_status TEXT;
  out_row public.requests;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO caller_role FROM public.profiles WHERE id = caller_id;
  IF caller_role IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  SELECT r.status INTO cur_status FROM public.requests r WHERE r.id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF p_status IN ('approved', 'rejected') THEN
    IF caller_role NOT IN ('manager', 'admin') THEN
      RAISE EXCEPTION 'Forbidden: manager or admin required for approval or rejection';
    END IF;
    IF cur_status NOT IN ('pending', 'clarification_requested') THEN
      RAISE EXCEPTION 'Request is not pending clarification or approval';
    END IF;
    IF p_manager_id IS NULL OR p_manager_id != caller_id THEN
      RAISE EXCEPTION 'manager_id must match the signed-in user';
    END IF;

    UPDATE public.requests r
    SET
      status = p_status,
      manager_id = COALESCE(p_manager_id, r.manager_id),
      rejection_reason = CASE
        WHEN p_status = 'rejected' THEN COALESCE(p_rejection_reason, r.rejection_reason)
        ELSE r.rejection_reason
      END
    WHERE r.id = p_request_id
      AND r.status IN ('pending', 'clarification_requested')
    RETURNING * INTO out_row;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Request not found or invalid state for this action';
    END IF;
    RETURN NEXT out_row;
    RETURN;

  ELSIF p_status = 'disbursed' THEN
    IF caller_role NOT IN ('cashier', 'admin') THEN
      RAISE EXCEPTION 'Forbidden: cashier or admin required to mark paid out';
    END IF;
    IF cur_status != 'approved' THEN
      RAISE EXCEPTION 'Only approved requests can be marked paid out';
    END IF;

    UPDATE public.requests r
    SET status = p_status
    WHERE r.id = p_request_id
      AND r.status = 'approved'
    RETURNING * INTO out_row;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Request not found or invalid state for this action';
    END IF;
    RETURN NEXT out_row;
    RETURN;
  END IF;

  RAISE EXCEPTION 'Invalid status: %', p_status;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_requests_status(UUID, TEXT, UUID, TEXT) TO authenticated;
