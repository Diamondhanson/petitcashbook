-- Admin petty cash book: log float top-ups and RPCs to read history (disbursed/rejected requests + top-ups)

-- 1. Append-only log for cash float top-ups (written by update_cash_float)
CREATE TABLE IF NOT EXISTS public.float_topup_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount_added NUMERIC NOT NULL CHECK (amount_added > 0),
  balance_after NUMERIC NOT NULL CHECK (balance_after >= 0),
  performed_by UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS float_topup_log_created_at_idx
  ON public.float_topup_log (created_at DESC);

ALTER TABLE public.float_topup_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "block_float_topup_log_direct" ON public.float_topup_log;
CREATE POLICY "block_float_topup_log_direct"
  ON public.float_topup_log
  FOR ALL
  USING (false);

-- 2. Record each top-up when balance is updated
CREATE OR REPLACE FUNCTION public.update_cash_float(amount_add NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
  new_bal NUMERIC;
BEGIN
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role != 'admin' THEN
    RAISE EXCEPTION 'Forbidden: admin role required';
  END IF;
  IF amount_add IS NULL OR amount_add <= 0 THEN
    RAISE EXCEPTION 'amount_add must be positive';
  END IF;
  UPDATE public.cash_float
  SET current_balance = current_balance + amount_add, updated_at = now()
  WHERE id = 1
  RETURNING current_balance INTO new_bal;

  INSERT INTO public.float_topup_log (amount_added, balance_after, performed_by)
  VALUES (amount_add, new_bal, auth.uid());

  RETURN jsonb_build_object('current_balance', new_bal);
END;
$$;

-- 3. Admin: list float top-ups (newest first)
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
  IF caller_role IS NULL OR caller_role != 'admin' THEN
    RAISE EXCEPTION 'Forbidden: admin role required';
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

GRANT EXECUTE ON FUNCTION public.list_float_topups() TO authenticated;

-- 4. Admin: disbursed and rejected requests (newest by created_at first)
CREATE OR REPLACE FUNCTION public.list_admin_closed_requests()
RETURNS TABLE (
  id UUID,
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
  IF caller_role IS NULL OR caller_role != 'admin' THEN
    RAISE EXCEPTION 'Forbidden: admin role required';
  END IF;

  RETURN QUERY
  SELECT
    r.id,
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
