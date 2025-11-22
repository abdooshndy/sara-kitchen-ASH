-- supabase_security_fixes.sql
-- إصلاحات الأمان وسياسات Row Level Security
-- قم بتشغيل هذا الملف في Supabase SQL Editor بعد supabase_setup.sql

-- ==========================================
-- 1. حماية جدول Products (للقراءة فقط للجميع)
-- ==========================================

-- التأكد من تفعيل RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- السماح للجميع بقراءة المنتجات
DROP POLICY IF EXISTS "Anyone can view products" ON products;
CREATE POLICY "Anyone can view products" 
ON products FOR SELECT 
TO anon, authenticated
USING (true);

-- الأدمن فقط يمكنه التعديل
DROP POLICY IF EXISTS "Only admins can manage products" ON products;
CREATE POLICY "Only admins can manage products" 
ON products FOR ALL 
USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
);

-- ==========================================
-- 2. حماية جدول Categories
-- ==========================================

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- السماح للجميع بقراءة التصنيفات
DROP POLICY IF EXISTS "Anyone can view categories" ON categories;
CREATE POLICY "Anyone can view categories" 
ON categories FOR SELECT 
TO anon, authenticated
USING (true);

-- الأدمن فقط يمكنه التعديل
DROP POLICY IF EXISTS "Only admins can manage categories" ON categories;
CREATE POLICY "Only admins can manage categories" 
ON categories FOR ALL 
USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
);

-- ==========================================
-- 3. حماية جدول Offers
-- ==========================================

ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

-- السماح للجميع بقراءة العروض
DROP POLICY IF EXISTS "Anyone can view offers" ON offers;
CREATE POLICY "Anyone can view offers" 
ON offers FOR SELECT 
TO anon, authenticated
USING (true);

-- الأدمن فقط يمكنه التعديل
DROP POLICY IF EXISTS "Only admins can manage offers" ON offers;
CREATE POLICY "Only admins can manage offers" 
ON offers FOR ALL 
USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
);

-- ==========================================
-- 4. حماية جدول Settings (خطير جداً!)
-- ==========================================

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- السماح للجميع بقراءة الإعدادات العامة
DROP POLICY IF EXISTS "Anyone can view settings" ON settings;
CREATE POLICY "Anyone can view settings" 
ON settings FOR SELECT 
TO anon, authenticated
USING (true);

-- الأدمن فقط يمكنه التعديل
DROP POLICY IF EXISTS "Only admins can update settings" ON settings;
CREATE POLICY "Only admins can update settings" 
ON settings FOR UPDATE 
USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
);

-- الأدمن فقط يمكنه الإدراج
DROP POLICY IF EXISTS "Only admins can insert settings" ON settings;
CREATE POLICY "Only admins can insert settings" 
ON settings FOR INSERT 
WITH CHECK (
  auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
);

-- ==========================================
-- 5. حماية جدول Customers
-- ==========================================

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- الأدمن يمكنه رؤية كل العملاء
DROP POLICY IF EXISTS "Admins can view all customers" ON customers;
CREATE POLICY "Admins can view all customers" 
ON customers FOR SELECT 
USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
);

-- العملاء يمكنهم رؤية بياناتهم فقط (بناءً على رقم الهاتف)
DROP POLICY IF EXISTS "Customers can view own data" ON customers;
CREATE POLICY "Customers can view own data" 
ON customers FOR SELECT 
USING (
  phone = (SELECT phone FROM profiles WHERE id = auth.uid())
);

-- السماح بإنشاء عميل جديد عند الطلب (INSERT)
-- هذا ضروري لعملية الطلب
DROP POLICY IF EXISTS "Allow customer creation on order" ON customers;
CREATE POLICY "Allow customer creation on order" 
ON customers FOR INSERT 
WITH CHECK (true);

-- السماح بتحديث بيانات العميل
DROP POLICY IF EXISTS "Customers can update own data" ON customers;
CREATE POLICY "Customers can update own data" 
ON customers FOR UPDATE 
USING (
  phone = (SELECT phone FROM profiles WHERE id = auth.uid())
  OR auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
);

-- ==========================================
-- 6. تحسين سياسة إدراج الطلبات
-- ==========================================

-- حذف السياسة القديمة التي تسمح للجميع
DROP POLICY IF EXISTS "Public insert orders" ON orders;

-- سياسة جديدة: السماح للمستخدمين المصادقين فقط
-- أو المستخدمين غير المسجلين لكن بشروط
CREATE POLICY "Authenticated users can create orders" 
ON orders FOR INSERT 
WITH CHECK (
  -- إما مستخدم مسجل
  (auth.uid() IS NOT NULL)
  -- أو نسمح بالطلب بدون تسجيل (Guest checkout)
  -- لكن نتأكد أن البيانات الأساسية موجودة
  OR (
    customer_name IS NOT NULL 
    AND customer_phone IS NOT NULL 
    AND customer_address IS NOT NULL
  )
);

-- ==========================================
-- 7. حماية order_items من التلاعب
-- ==========================================

-- منع التعديل المباشر على order_items
-- فقط الإدراج عند إنشاء الطلب
DROP POLICY IF EXISTS "Allow order items creation" ON order_items;
CREATE POLICY "Allow order items creation" 
ON order_items FOR INSERT 
WITH CHECK (true);

-- منع الحذف والتعديل إلا من الأدمن
DROP POLICY IF EXISTS "Only admins can modify order items" ON order_items;
CREATE POLICY "Only admins can modify order items" 
ON order_items FOR ALL 
USING (
  auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
);

-- ==========================================
-- 8. دالة للتحقق من صحة الطلب (Validation)
-- ==========================================

-- دالة للتحقق من أن إجمالي الطلب يطابق مجموع الأصناف
CREATE OR REPLACE FUNCTION validate_order_total(
  order_id_param UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  calculated_total DECIMAL;
  order_total DECIMAL;
BEGIN
  -- حساب الإجمالي من order_items
  SELECT COALESCE(SUM(quantity * unit_price), 0)
  INTO calculated_total
  FROM order_items
  WHERE order_id = order_id_param;
  
  -- جلب الإجمالي المحفوظ في الطلب (بدون رسوم التوصيل)
  SELECT subtotal
  INTO order_total
  FROM orders
  WHERE id = order_id_param;
  
  -- التحقق من التطابق (مع هامش خطأ صغير للكسور العشرية)
  RETURN ABS(calculated_total - order_total) < 0.01;
END;
$$;

-- ==========================================
-- 9. Trigger للتحقق من الطلبات عند الإنشاء
-- ==========================================

-- ملاحظة: هذا اختياري حالياً لأنه قد يتطلب تعديلات على الكود
-- يمكن تفعيله لاحقاً بعد التأكد من توافق الكود

/*
CREATE OR REPLACE FUNCTION check_order_before_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- التحقق من وجود البيانات الأساسية
  IF NEW.customer_name IS NULL OR 
     NEW.customer_phone IS NULL OR 
     NEW.customer_address IS NULL THEN
    RAISE EXCEPTION 'بيانات العميل غير مكتملة';
  END IF;
  
  -- التحقق من أن المبلغ موجب
  IF NEW.total_amount <= 0 THEN
    RAISE EXCEPTION 'المبلغ الإجمالي يجب أن يكون أكبر من صفر';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_order_before_insert ON orders;
CREATE TRIGGER validate_order_before_insert
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION check_order_before_insert();
*/

-- ==========================================
-- 10. إنشاء View للإحصائيات (للأدمن فقط)
-- ==========================================

DROP VIEW IF EXISTS admin_statistics;
CREATE VIEW admin_statistics AS
SELECT 
  COUNT(*) FILTER (WHERE status = 'PENDING') as pending_orders,
  COUNT(*) FILTER (WHERE status = 'PREPARING') as preparing_orders,
  COUNT(*) FILTER (WHERE status = 'WITH_DRIVER') as delivering_orders,
  COUNT(*) FILTER (WHERE status = 'DELIVERED') as delivered_orders,
  COUNT(*) FILTER (WHERE status = 'CANCELLED') as cancelled_orders,
  SUM(total_amount) FILTER (WHERE status = 'DELIVERED') as total_revenue,
  COUNT(DISTINCT customer_phone) as total_customers,
  COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) as today_orders
FROM orders;

-- منح الوصول للـ View للأدمن فقط
GRANT SELECT ON admin_statistics TO authenticated;

ALTER VIEW admin_statistics SET (security_invoker = on);

-- ==========================================
-- 11. تحديث دالة generate_order_code لتكون أكثر أماناً
-- ==========================================

-- تحديث الدالة الموجودة لتكون أكثر قوة
CREATE OR REPLACE FUNCTION generate_order_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  prefix text;
  next_val integer;
  new_code text;
  max_attempts integer := 10;
  attempt integer := 0;
BEGIN
  LOOP
    -- 1. Get prefix
    SELECT value INTO prefix FROM settings WHERE key = 'order_prefix';
    IF prefix IS NULL THEN prefix := 'S'; END IF;

    -- 2. Increment and get next value atomically
    UPDATE settings 
    SET value = (COALESCE(value::int, 0) + 1)::text 
    WHERE key = 'next_order_number' 
    RETURNING value::int INTO next_val;

    -- If row doesn't exist, insert default
    IF next_val IS NULL THEN
      INSERT INTO settings (key, value) 
      VALUES ('next_order_number', '1001')
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
      RETURNING value::int INTO next_val;
    END IF;

    new_code := prefix || next_val::text;
    
    -- تحقق من أن الكود غير مستخدم
    IF NOT EXISTS (SELECT 1 FROM orders WHERE order_code = new_code) THEN
      RETURN new_code;
    END IF;
    
    -- إذا كان مستخدماً، حاول مرة أخرى
    attempt := attempt + 1;
    IF attempt >= max_attempts THEN
      RAISE EXCEPTION 'فشل في توليد رقم طلب فريد بعد % محاولات', max_attempts;
    END IF;
  END LOOP;
END;
$$;

-- ==========================================
-- تعليمات مهمة
-- ==========================================

-- بعد تشغيل هذا السكريبت:
-- 1. تأكد من اختبار جميع الوظائف (تسجيل، طلب، عرض)
-- 2. راقب الـ logs في Supabase للتأكد من عدم وجود أخطاء RLS
-- 3. اختبر من متصفح مختلف (Incognito) للتأكد من عمل السياسات
-- 4. تحديث الكود في app.js لاستخدام generate_order_code() من قاعدة البيانات

COMMIT;
