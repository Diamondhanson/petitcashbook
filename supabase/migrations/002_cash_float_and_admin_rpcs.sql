-- Cash float table and admin RPCs for accountant/admin UI
-- Run in Supabase SQL Editor if migrations are not applied

-- 1. Cash float table (single row)
CREATE TABLE IF NOT EXISTS public.cash_float (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  current_balance NUMERIC NOT NULL DEFAULT 0 CHECK (current_balance >= 0),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.cash_float ENABLE ROW LEVEL SECURITY;

-- Single row
INSERT INTO public.cash_float (id, current_balance)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

-- RLS: only admin/accountant can read via RPC
CREATE POLICY "block_direct_access" ON public.cash_float
  FOR ALL USING (false);

-- 2. get_cash_float RPC (admin and accountant)
CREATE OR REPLACE FUNCTION public.get_cash_float()
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
  bal NUMERIC;
BEGIN
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role NOT IN ('admin', 'accountant') THEN
    RAISE EXCEPTION 'Forbidden: admin or accountant role required';
  END IF;
  SELECT current_balance INTO bal FROM public.cash_float WHERE id = 1;
  RETURN COALESCE(bal, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cash_float() TO authenticated;

-- 3. update_cash_float RPC (admin only)
CREATE OR REPLACE FUNCTION public.update_cash_float(amount_add NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role TEXT;
  new_bal NUMERIC;
BEGIN
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role != 'admin' THEN
    RAISE EXCEPTION 'Forbidden: admin role required';
  END IF;
  IF amount_add IS NULL OR amount_add <= 0 THEN
    RAISE EXCEPTION 'amount_add must be positive';
  END IF;
  UPDATE public.cash_float
  SET current_balance = current_balance + amount_add, updated_at = now()
  WHERE id = 1
  RETURNING current_balance INTO new_bal;
  RETURN jsonb_build_object('current_balance', new_bal);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_cash_float(NUMERIC) TO authenticated;

-- 4. list_profiles RPC (admin only) - returns profiles with email from auth.users
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
    p.id,
    p.full_name,
    p.role,
    u.email::TEXT,
    u.raw_user_meta_data
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  ORDER BY p.full_name NULLS LAST, p.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_profiles() TO authenticated;

-- 5. update_user_role RPC (admin only)
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
  SET role = new_role, updated_at = now()
  WHERE id = target_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  RETURN jsonb_build_object('id', target_user_id, 'role', new_role);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_user_role(UUID, TEXT) TO authenticated;
