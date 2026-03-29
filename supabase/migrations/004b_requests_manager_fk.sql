-- Step 2 of 2: Fix manager_id FK for user deletion.
-- Run after 004a completes. Stop the app first to reduce locks.
ALTER TABLE public.requests DROP CONSTRAINT IF EXISTS requests_manager_id_fkey;
ALTER TABLE public.requests
  ADD CONSTRAINT requests_manager_id_fkey
  FOREIGN KEY (manager_id) REFERENCES public.profiles(id) ON DELETE SET NULL
  NOT VALID;
