-- Step 1 of 2: Fix requester_id FK for user deletion.
-- Run this file alone in Supabase SQL Editor. Stop the app first to reduce locks.
ALTER TABLE public.requests DROP CONSTRAINT IF EXISTS requests_requester_id_fkey;
ALTER TABLE public.requests ALTER COLUMN requester_id DROP NOT NULL;
ALTER TABLE public.requests
  ADD CONSTRAINT requests_requester_id_fkey
  FOREIGN KEY (requester_id) REFERENCES public.profiles(id) ON DELETE SET NULL
  NOT VALID;
