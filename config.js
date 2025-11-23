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
    url: "https://kpbhczaodejxcxxscvlz.supabase.co",
    anonKey: "sb_publishable_dAupSNcu9bsA3nhuyAUFKw_dc7Tb4cD"
  },

  // إعدادات الذكاء الاصطناعي (OpenAI)
  // مهم: apiKey الحقيقي ما يتحطش هنا لو المشروع على GitHub Public
  ai: {
    provider: "OPENAI",
    model: "gpt-4.1-mini",
    apiKey: null // المفتاح بيتخزّن في الباك إند مش هنا
  },

  // إعدادات تيليجرام (Telegram Notifications)
  telegram: {
    botToken: "YOUR_BOT_TOKEN_HERE", // استبدله بالتوكن الخاص بالبوت
    chatIds: ["YOUR_CHAT_ID_HERE"] // استبدله بمعرفات الشات (الأدمن والطباخين)
  }
};
