-- Phase 3: Inventory Management
-- 1. Add stock_quantity to products
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 100; -- قيمة افتراضية

-- 2. Function to deduct stock
CREATE OR REPLACE FUNCTION public.deduct_stock_on_order()
RETURNS TRIGGER AS $$
BEGIN
  -- لكل صنف في الطلب، نخصم الكمية من المنتج
  -- ملاحظة: هذا التريجر يعمل على order_items
  UPDATE public.products
  SET stock_quantity = stock_quantity - NEW.quantity
  WHERE id = NEW.product_id;
  
  -- إذا وصلت الكمية لصفر أو أقل، نجعله غير متاح
  UPDATE public.products
  SET is_available = false
  WHERE id = NEW.product_id AND stock_quantity <= 0;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger on order_items insertion
DROP TRIGGER IF EXISTS tr_deduct_stock ON public.order_items;

CREATE TRIGGER tr_deduct_stock
AFTER INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.deduct_stock_on_order();
