-- Request timeline and clarification_requested status
-- Run in Supabase SQL Editor

-- 1. Add clarification_requested to requests.status CHECK
ALTER TABLE public.requests
  DROP CONSTRAINT IF EXISTS requests_status_check;

ALTER TABLE public.requests
  ADD CONSTRAINT requests_status_check
  CHECK (status IN ('pending', 'clarification_requested', 'approved', 'rejected', 'disbursed'));

-- 2. Create request_timeline table
CREATE TABLE IF NOT EXISTS public.request_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'clarification_requested',
    'clarification_provided',
    'approved',
    'rejected'
  )),
  performed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS request_timeline_request_id_idx
  ON public.request_timeline(request_id);

CREATE INDEX IF NOT EXISTS request_timeline_created_at_idx
  ON public.request_timeline(created_at);

ALTER TABLE public.request_timeline ENABLE ROW LEVEL SECURITY;

-- RLS: requester and manager can read; manager can insert clarification_requested; requester can insert clarification_provided
-- Managers can insert approved/rejected via updateRequestStatus (or we handle that in app with service logic)
DROP POLICY IF EXISTS "requester_read_timeline" ON public.request_timeline;
CREATE POLICY "requester_read_timeline"
  ON public.request_timeline FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.id = request_id AND r.requester_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "manager_read_timeline" ON public.request_timeline;
CREATE POLICY "manager_read_timeline"
  ON public.request_timeline FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('manager', 'admin')
    )
  );

-- Manager can insert clarification_requested; requester can insert clarification_provided
-- We allow insert if user is manager/admin (for clarification_requested) or requester (for clarification_provided)
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
  );
