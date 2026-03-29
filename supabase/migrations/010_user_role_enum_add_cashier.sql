-- One-off fix if migration 009 failed with:
--   ERROR: invalid input value for enum user_role: "cashier"
--
-- Your database uses enum public.user_role for profiles.role. Run this once in the
-- SQL Editor, then re-run the rest of 009 (from section 1 onward) if it did not complete.

DO $fix$
BEGIN
  ALTER TYPE public.user_role ADD VALUE 'cashier';
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END $fix$;
