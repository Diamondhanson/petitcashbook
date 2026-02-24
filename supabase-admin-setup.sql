-- =============================================================================
-- Petit Cash Book - Admin User Setup
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- =============================================================================

-- 1. Ensure pgcrypto is enabled (for password hashing)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Ensure profiles table exists with role column
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('employee', 'manager', 'accountant', 'admin')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile (drop first if re-running)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- 3. Trigger: auto-create profile when a new user is created in auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'employee'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. ==========================================================================
-- METHOD A (RECOMMENDED): Create admin via Supabase Dashboard, then run this
-- ==========================================================================
-- In Supabase Dashboard: Authentication > Users > Add user
--   - Email: admin@yourcompany.com
--   - Password: (choose a strong password)
--
-- After creating the user, copy their UUID from the Users table, then run:
--
-- UPDATE public.profiles
-- SET role = 'admin', full_name = 'Administrator'
-- WHERE id = 'PASTE-THE-USER-UUID-HERE';

-- 5. ==========================================================================
-- METHOD B: Create admin user entirely via SQL
-- Replace email and password before running
-- ==========================================================================
DO $$
DECLARE
  new_user_id UUID;
  user_email TEXT := 'admin@petitcashbook.com';  -- CHANGE THIS
  user_password TEXT := 'ChangeThisPassword123!';  -- CHANGE THIS
  user_full_name TEXT := 'Administrator';
  instance_id UUID;
BEGIN
  SELECT id INTO instance_id FROM auth.instances LIMIT 1;

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    COALESCE(instance_id, '00000000-0000-0000-0000-000000000000'),
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    user_email,
    crypt(user_password, gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', user_full_name),
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  RETURNING id INTO new_user_id;

  INSERT INTO public.profiles (id, full_name, role)
  VALUES (new_user_id, user_full_name, 'admin')
  ON CONFLICT (id) DO UPDATE SET role = 'admin', full_name = user_full_name;
END $$;

-- 6. ==========================================================================
-- FIX: If you get "Database error querying schema" when signing in
-- (Often caused by NULL token columns in auth.users for SQL-created users)
-- Run this, replacing with your admin's email:
-- ==========================================================================
-- UPDATE auth.users
-- SET confirmation_token = COALESCE(confirmation_token, ''),
--     email_change = COALESCE(email_change, ''),
--     email_change_token_new = COALESCE(email_change_token_new, ''),
--     recovery_token = COALESCE(recovery_token, '')
-- WHERE email = 'admin@yourcompany.com';

-- 7. ==========================================================================
-- Add employee_id for 5-digit user codes (required for Add User feature)
-- ==========================================================================
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS employee_id INTEGER UNIQUE;

CREATE OR REPLACE FUNCTION public.get_next_employee_id()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
  next_id INTEGER;
BEGIN
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role IS NULL OR caller_role != 'admin' THEN
    RAISE EXCEPTION 'Forbidden: admin role required';
  END IF;

  SELECT COALESCE(MAX(employee_id), 9999) + 1 INTO next_id
  FROM public.profiles
  WHERE employee_id IS NOT NULL;

  RETURN next_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_next_employee_id() TO authenticated;
