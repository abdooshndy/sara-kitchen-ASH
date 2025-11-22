# ملف تهيئة منصة مطبخ سارة (Static + Backend لاحقًا)

الواجهة الحالية HTML/CSS/JS فقط (تشتغل على GitHub Pages)،
والربط مع Supabase / WhatsApp / Email / AI هيكون من خلال Backend أو Functions لاحقًا.

---

## 1. إعدادات Supabase

من لوحة Supabase (Settings → API) هنحتاج:

- `SUPABASE_URL`  
  رابط المشروع، مثال:  
  `https://punytspxcyesaddpsygp.supabase.co`

- `SUPABASE_ANON_KEY`  
  الـ anon / publishable key (مسموح استخدامه في المتصفح).

- `SUPABASE_SERVICE_ROLE_KEY`  
  الـ Service Role أو Secret Key  
  (من Legacy API Keys → service_role أو من الـ Secret Keys الجديدة).  
  **ده يستخدم فقط في الباك إند، ممنوع يتكتب في كود المتصفح.**

### مثال ملف .env للباك إند

```env
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
