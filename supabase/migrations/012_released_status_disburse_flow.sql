-- Two-step payout: approved -> released (accountant/admin) -> disbursed (cashier/admin, float decrements)

-- 1. requests.status: add released
ALTER TABLE public.requests
  DROP CONSTRAINT IF EXISTS requests_status_check;

ALTER TABLE public.requests
  ADD CONSTRAINT requests_status_check
  CHECK (status IN (
    'pending',
    'clarification_requested',
    'approved',
    'released',
    'rejected',
    'disbursed'
  ));

-- 2. request_timeline.event_type: released, disbursed
ALTER TABLE public.request_timeline
  DROP CONSTRAINT IF EXISTS request_timeline_event_type_check;

ALTER TABLE public.request_timeline
  ADD CONSTRAINT request_timeline_event_type_check
  CHECK (event_type IN (
    'clarification_requested',
    'clarification_provided',
    'approved',
    'rejected',
    'released',
    'disbursed'
  ));

-- 3. Broader read access for finance/cash roles (timeline)
DROP POLICY IF EXISTS "manager_read_timeline" ON public.request_timeline;
CREATE POLICY "staff_read_timeline"
  ON public.request_timeline FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('manager', 'admin', 'accountant', 'cashier')
    )
  );

-- 4. Inserts: released (accountant/admin), disbursed (cashier/admin)
DROP POLICY IF EXISTS "insert_timeline" ON public.request_timeline;
CREATE POLICY "insert_timeline"
  ON public.request_timeline FOR INSERT
  WITH CHECK (
    (event_type = 'clarification_requested' AND performed_by = auth.uid() AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('manager', 'admin')
    ))
    OR
    (event_type = 'clarification_provided' AND performed_by = auth.uid() AND EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.id = request_id AND r.requester_id = auth.uid()
    ))
    OR
    (event_type IN ('approved', 'rejected') AND performed_by = auth.uid() AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('manager', 'admin')
    ))
    OR
    (event_type = 'released' AND performed_by = auth.uid() AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('accountant', 'admin')
    ))
    OR
    (event_type = 'disbursed' AND performed_by = auth.uid() AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('cashier', 'admin')
    ))
  );

-- 5. Replace update_requests_status
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

  ELSIF p_status = 'released' THEN
    IF caller_role NOT IN ('accountant', 'admin') THEN
      RAISE EXCEPTION 'Forbidden: accountant or admin required to disburse';
    END IF;
    IF cur_status != 'approved' THEN
      RAISE EXCEPTION 'Only approved requests can be released for payout';
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

  ELSIF p_status = 'disbursed' THEN
    IF caller_role NOT IN ('cashier', 'admin') THEN
      RAISE EXCEPTION 'Forbidden: cashier or admin required to mark paid out';
    END IF;
    IF cur_status != 'released' THEN
      RAISE EXCEPTION 'Only released requests can be marked paid out';
    END IF;

    UPDATE public.requests r
    SET status = p_status
    WHERE r.id = p_request_id
      AND r.status = 'released'
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
