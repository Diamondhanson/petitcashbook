-- Run this in Supabase SQL Editor to verify update_requests_status and triggers.
-- 1) List all overloads of update_requests_status and whether body contains "WHERE"
SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS args,
  CASE WHEN pg_get_functiondef(p.oid) LIKE '%WHERE%' THEN 'yes' ELSE 'NO' END AS has_where_in_body
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.proname = 'update_requests_status';

-- 2) List triggers on public.requests (if any trigger does UPDATE without WHERE, that can cause the error)
SELECT tgname, pg_get_triggerdef(oid, true) AS definition
FROM pg_trigger
WHERE tgrelid = 'public.requests'::regclass AND NOT tgisinternal;
