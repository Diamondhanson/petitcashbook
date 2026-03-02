-- Run this first to see actual constraint names on requests table.
-- If names differ from requests_requester_id_fkey / requests_manager_id_fkey,
-- use the names shown here when running 004_fix_delete_user_fks.sql.
SELECT conname, conrelid::regclass AS table_name, confrelid::regclass AS references_table
FROM pg_constraint
WHERE conrelid = 'public.requests'::regclass
  AND contype = 'f';
