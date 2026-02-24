-- =============================================================================
-- Add User Feature - Database Setup
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- =============================================================================

-- 1. Add employee_id column for 5-digit user codes
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS employee_id INTEGER UNIQUE;

-- 2. Function to get next employee ID (admin only)
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
GRANT EXECUTE ON FUNCTION public.get_next_employee_id() TO service_role;
