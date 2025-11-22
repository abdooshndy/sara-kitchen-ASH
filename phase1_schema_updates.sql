-- Phase 1 Schema Updates: Core Ordering Experience

-- 1. Add Scheduling columns to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS is_asap BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMP WITH TIME ZONE;

-- 2. Add Tags column to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- 3. Create Product Options table (e.g., Size, Spiciness, Add-ons)
CREATE TABLE IF NOT EXISTS public.product_options (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g., "Spiciness Level", "Extra Sauce"
    type TEXT NOT NULL CHECK (type IN ('SINGLE', 'MULTIPLE')), -- SINGLE (Radio), MULTIPLE (Checkbox)
    is_required BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create Product Option Values table (The actual choices)
CREATE TABLE IF NOT EXISTS public.product_option_values (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    option_id UUID REFERENCES public.product_options(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g., "Mild", "Spicy", "Garlic Dip"
    price_adjustment DECIMAL(10, 2) DEFAULT 0.00, -- Extra cost if any
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create Order Item Options table (To store selected options for an order item)
CREATE TABLE IF NOT EXISTS public.order_item_options (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_item_id UUID REFERENCES public.order_items(id) ON DELETE CASCADE,
    option_name TEXT NOT NULL, -- Store name to preserve history even if option is deleted
    value_name TEXT NOT NULL,
    price_adjustment DECIMAL(10, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. RLS Policies for new tables

-- product_options
ALTER TABLE public.product_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read product_options" ON public.product_options FOR SELECT USING (true);
CREATE POLICY "Admin manage product_options" ON public.product_options FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- product_option_values
ALTER TABLE public.product_option_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read product_option_values" ON public.product_option_values FOR SELECT USING (true);
CREATE POLICY "Admin manage product_option_values" ON public.product_option_values FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- order_item_options
ALTER TABLE public.order_item_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read their own order options" ON public.order_item_options FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.orders o ON oi.order_id = o.id
    WHERE oi.id = order_item_options.order_item_id
    AND (o.customer_id = auth.uid() OR auth.role() = 'service_role')
  )
);
CREATE POLICY "Users can insert their own order options" ON public.order_item_options FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.orders o ON oi.order_id = o.id
    WHERE oi.id = order_item_options.order_item_id
    AND (o.customer_id = auth.uid() OR auth.role() = 'service_role' OR auth.uid() IS NULL) 
  )
);
-- Allow admins/staff to read all
CREATE POLICY "Staff read all order options" ON public.order_item_options FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'kitchen', 'driver'))
);

-- 7. Insert some sample data for testing (Optional but helpful)
-- Add tags to some products
UPDATE public.products SET tags = ARRAY['الأكثر مبيعاً', 'حار'] WHERE name LIKE '%محشي%';
UPDATE public.products SET tags = ARRAY['نباتي'] WHERE name LIKE '%سلطة%';
