-- supabase_setup.sql
-- ملف إعداد قاعدة البيانات (SQL)
-- قم بتشغيل هذا الملف في Supabase SQL Editor

-- ==========================================
-- 1. Enable UUID Extension
-- ==========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 2. Create Profiles Table (RBAC & Loyalty)
-- ==========================================
CREATE TYPE user_role AS ENUM ('admin', 'cook', 'driver', 'customer');

CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  role user_role DEFAULT 'customer',
  full_name TEXT,
  phone TEXT UNIQUE,
  address TEXT,
  points INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
-- Admin can view and edit all profiles
CREATE POLICY "Admins can do everything on profiles" 
ON profiles FOR ALL 
USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));

-- Users can view and edit their own profile
CREATE POLICY "Users can view own profile" 
ON profiles FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
ON profiles FOR UPDATE 
USING (auth.uid() = id);

-- ==========================================
-- 3. Orders & Items Tables (Existing + Updates)
-- ==========================================
-- (Assuming orders table exists, if not we create it. 
-- If it exists, we ensure RLS is enabled)

-- ... (Keeping existing order structure logic if needed, but focusing on RLS updates)

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- RLS for Orders
-- Admin: All access
CREATE POLICY "Admins full access orders" 
ON orders FOR ALL 
USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));

-- Cook: View Pending/Preparing, Update to With Driver
CREATE POLICY "Cooks view active orders" 
ON orders FOR SELECT 
USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role = 'cook') 
  AND status IN ('PENDING', 'PREPARING')
);

CREATE POLICY "Cooks update orders" 
ON orders FOR UPDATE 
USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'cook'));

-- Driver: View With Driver, Update to Delivered
CREATE POLICY "Drivers view assigned orders" 
ON orders FOR SELECT 
USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role = 'driver') 
  AND status IN ('WITH_DRIVER', 'DELIVERED')
);

CREATE POLICY "Drivers update orders" 
ON orders FOR UPDATE 
USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'driver'));

-- Customer: View own orders
CREATE POLICY "Customers view own orders" 
ON orders FOR SELECT 
USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role = 'customer') 
  AND customer_phone = (SELECT phone FROM profiles WHERE id = auth.uid())
);

-- Public: Insert (for anonymous checkout if we still allow it, 
-- but now we prefer logged in. We keep insert open for now)
CREATE POLICY "Public insert orders" 
ON orders FOR INSERT 
WITH CHECK (true);

-- ==========================================
-- 4. Triggers & Functions
-- ==========================================

-- A) Auto-create profile on Signup
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, phone, address)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    COALESCE((new.raw_user_meta_data->>'role')::user_role, 'customer'),
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'address'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- B) Order Code Generation (Existing)
CREATE OR REPLACE FUNCTION generate_order_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  prefix text;
  next_val integer;
BEGIN
  -- 1. Get prefix
  SELECT value INTO prefix FROM settings WHERE key = 'order_prefix';
  IF prefix IS NULL THEN prefix := 'S'; END IF;

  -- 2. Increment and get next value atomically
  UPDATE settings 
  SET value = (value::int + 1)::text 
  WHERE key = 'next_order_number' 
  RETURNING value::int INTO next_val;

  -- If row doesn't exist, insert default
  IF next_val IS NULL THEN
    INSERT INTO settings (key, value) VALUES ('next_order_number', '2');
    next_val := 2;
  END IF;

  RETURN prefix || next_val::text;
END;
$$;

-- 3. إعدادات الأدمن (اختياري)
-- يمكن إنشاء جدول للأدمنز لو حابب تديرهم من الداتابيز، أو تعتمد على Supabase Auth Users.
