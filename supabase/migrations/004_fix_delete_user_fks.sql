-- Fix "Database error deleting user" - allow user deletion.
-- Run 004a first, then 004b. Or run Step 1 and Step 2 separately below.
-- Stop the app during migration to avoid locks and timeouts.

-- STEP 1: requester_id (run this block only first)
ALTER TABLE public.requests DROP CONSTRAINT IF EXISTS requests_requester_id_fkey;
ALTER TABLE public.requests ALTER COLUMN requester_id DROP NOT NULL;
ALTER TABLE public.requests
  ADD CONSTRAINT requests_requester_id_fkey
  FOREIGN KEY (requester_id) REFERENCES public.profiles(id) ON DELETE SET NULL
  NOT VALID;

-- STEP 2: manager_id (run after Step 1 completes)
ALTER TABLE public.requests DROP CONSTRAINT IF EXISTS requests_manager_id_fkey;
ALTER TABLE public.requests
  ADD CONSTRAINT requests_manager_id_fkey
  FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE SET NULL
  NOT VALID;
