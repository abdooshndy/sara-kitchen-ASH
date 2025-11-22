// config.example.js
// نموذج لملف الإعدادات. قم بنسخ هذا الملف إلى config.js وتعديل البيانات.

window.APP_CONFIG = {
    appName: "مطبخ سارة للأكل البيتي",

    currency: {
        code: "EGP",
        label: "ج.م"
    },

    orderCodePrefix: "S",

    contact: {
        phone: "96550534441",
        displayPhone: "96550534441"
    },

    // إعدادات Supabase
    supabase: {
        url: "YOUR_SUPABASE_URL_HERE",
        anonKey: "YOUR_SUPABASE_ANON_KEY_HERE"
    },

    ai: {
        provider: "GEMINI",
        model: "gemini-1.5-flash",
        apiKey: null // المفتاح يتم إدارته في Supabase Edge Functions
    }
};
