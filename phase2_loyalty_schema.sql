-- Phase 2: Customer Loyalty & Addresses Schema

-- 1. Update profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS loyalty_points INTEGER DEFAULT 0;

-- 2. Create Customer Addresses table
CREATE TABLE IF NOT EXISTS public.customer_addresses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    address_text TEXT NOT NULL,
    label TEXT DEFAULT 'المنزل', -- Home, Work, etc.
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Update Orders table to link to users
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 4. RLS Policies for Addresses

ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own addresses" ON public.customer_addresses
FOR ALL USING (auth.uid() = user_id);

-- 5. Function to calculate loyalty points on order completion
CREATE OR REPLACE FUNCTION public.calculate_loyalty_points()
RETURNS TRIGGER AS $$
BEGIN
  -- Only calculate if status changed to DELIVERED and user_id exists
  IF NEW.status = 'DELIVERED' AND OLD.status != 'DELIVERED' AND NEW.user_id IS NOT NULL THEN
    -- Calculate points: 1 point for every 10 currency units (e.g. 150 EGP = 15 points)
    UPDATE public.profiles
    SET loyalty_points = loyalty_points + FLOOR(NEW.total_amount / 10)
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Trigger for loyalty points
DROP TRIGGER IF EXISTS on_order_delivered_loyalty ON public.orders;
CREATE TRIGGER on_order_delivered_loyalty
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.calculate_loyalty_points();

-- 7. Update Orders RLS to allow users to see their own orders
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
CREATE POLICY "Users can view their own orders" ON public.orders
FOR SELECT USING (
  auth.uid() = user_id OR 
  auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'kitchen', 'driver'))
);

-- Allow users to insert orders linked to themselves
DROP POLICY IF EXISTS "Users can insert their own orders" ON public.orders;
CREATE POLICY "Users can insert their own orders" ON public.orders
FOR INSERT WITH CHECK (
  (auth.uid() = user_id) OR (user_id IS NULL) -- Allow guest orders (user_id NULL) or authenticated orders
);
