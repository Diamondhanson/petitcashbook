# User Management - Troubleshooting

## If User Management shows "No users" but users exist in the database

### 1. Check that `list_profiles` RPC exists

Run in Supabase SQL Editor:

```sql
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'list_profiles';
```

If no row is returned, run `supabase/migrations/003_list_profiles.sql` in the SQL Editor.

### 2. Verify data in profiles and auth.users

Run in Supabase SQL Editor:

```sql
-- Row counts
SELECT 'profiles' AS tbl, COUNT(*) AS cnt FROM public.profiles
UNION ALL
SELECT 'auth.users', COUNT(*) FROM auth.users;

-- Profiles without matching auth.users (won't appear in list)
SELECT p.id, p.full_name, p.role
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.id
WHERE u.id IS NULL;
```

`list_profiles` returns only rows where both `profiles` and `auth.users` have matching `id`. Profiles without a corresponding `auth.users` row will not appear in User Management.
