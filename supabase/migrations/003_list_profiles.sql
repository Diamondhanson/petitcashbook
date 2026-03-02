-- Standalone migration: list_profiles and update_user_role RPCs
-- Safe to run even if 002 partially failed
-- Use if profiles table has no updated_at (update_user_role updates role only)

-- 1. list_profiles RPC (admin only) - returns profiles with email from auth.users
CREATE OR REPLACE FUNCTION public.list_profiles()
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  role TEXT,
  email TEXT,
  raw_user_meta_data JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
BEGIN
  SELECT p.role INTO caller_role FROM public.profiles p WHERE p.id = auth.uid();
  IF caller_role != 'admin' THEN
    RAISE EXCEPTION 'Forbidden: admin role required';
  END IF;
  RETURN QUERY
  SELECT
    p.id::uuid,
    p.full_name::text,
    p.role::text,
    u.email::text,
    COALESCE(u.raw_user_meta_data::jsonb, '{}'::jsonb)
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  ORDER BY p.full_name NULLS LAST, p.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_profiles() TO authenticated;

-- 2. update_user_role RPC (admin only) - only updates role (no updated_at)
CREATE OR REPLACE FUNCTION public.update_user_role(target_user_id UUID, new_role TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
  valid_roles TEXT[] := ARRAY['employee', 'manager', 'accountant', 'admin'];
BEGIN
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role != 'admin' THEN
    RAISE EXCEPTION 'Forbidden: admin role required';
  END IF;
  IF new_role IS NULL OR NOT (new_role = ANY(valid_roles)) THEN
    RAISE EXCEPTION 'new_role must be one of: %, %, %, %', valid_roles[1], valid_roles[2], valid_roles[3], valid_roles[4];
  END IF;
  UPDATE public.profiles
  SET role = new_role
  WHERE id = target_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  RETURN jsonb_build_object('id', target_user_id, 'role', new_role);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_user_role(UUID, TEXT) TO authenticated;
