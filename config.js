// config.js
// ملف تهيئة عام لمنصّة "مطبخ سارة للأكل البيتي"
// يتم تحميله قبل app.js في كل صفحة علشان الإعدادات تبقى متاحة عالميًا

window.APP_CONFIG = {
  // معلومات عامة عن المنصّة
  appName: "مطبخ سارة للأكل البيتي",

  currency: {
    code: "EGP",   // الكود الداخلي
    label: "ج.م"   // اللي هيظهر للعميل
  },

  // شكل رقم الطلب
  // S1, S2, S3 ... الخ
  orderCodePrefix: "S",

  // بيانات التواصل العامة اللي هتظهر للزوار
  contact: {
    phone: "96550534441",     // رقم الموبايل/الواتساب اللي هيظهر حاليًا
    displayPhone: "96550534441" // تقدري تكتبي الشكل اللي تحبيّه للعرض + مسافات لو حابة
  },

  // إعدادات Supabase (ينفع تستخدم في الفرونت)
  supabase: {
    url: "https://punytspxcyesaddpsygp.supabase.co",
    anonKey: "sb_publishable_RO3lw5VJ0H3WXCgoI7qV-A_XuvC-dNP"
  },

  // إعدادات الذكاء الاصطناعي (OpenAI)
  // مهم: apiKey الحقيقي ما يتحطش هنا لو المشروع على GitHub Public
  ai: {
    provider: "OPENAI",
    model: "gpt-4.1-mini",
    apiKey: null // المفتاح بيتخزّن في الباك إند مش هنا
  }
};
