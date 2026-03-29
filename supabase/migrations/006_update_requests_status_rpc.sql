-- RPC to update request status with explicit WHERE (satisfies pg-safeupdate).
-- Use this instead of direct table UPDATE to avoid "UPDATE requires a WHERE clause".
-- requests table has: id, requester_id, amount, purpose, category, status, receipt_url, manager_id, rejection_reason, created_at (no manager_comment).

-- Drop every overload of update_requests_status (any signature) so no old version remains.
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
BEGIN
  -- Require authenticated user (RLS is bypassed by DEFINER; enforce auth).
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Single-row update with explicit WHERE so pg-safeupdate allows it.
  RETURN QUERY
  UPDATE public.requests r
  SET
    status = p_status,
    manager_id = COALESCE(p_manager_id, r.manager_id),
    rejection_reason = COALESCE(p_rejection_reason, r.rejection_reason)
  WHERE r.id = p_request_id
  RETURNING *;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_requests_status(UUID, TEXT, UUID, TEXT) TO authenticated;
