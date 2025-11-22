// auth-customer.js
// إدارة مصادقة العملاء (تسجيل، دخول، خروج)

(function () {
    const EMAIL_DOMAIN = "sara-kitchen.app"; // دومين وهمي

    // دوال المساعدة الداخلية
    function getClient() {
        if (window.getSupabaseClient) return window.getSupabaseClient();
        // Fallback
        const CONFIG = window.APP_CONFIG || {};
        return window.supabase.createClient(CONFIG.supabase.url, CONFIG.supabase.anonKey);
    }

    function phoneToEmail(phone) {
        // تنظيف الرقم وإضافة الدومين
        const cleanPhone = phone.replace(/\D/g, '');
        return `${cleanPhone}@${EMAIL_DOMAIN}`;
    }

    // الكائن الرئيسي للمصادقة
    window.CustomerAuth = {
        // تسجيل حساب جديد
        register: async function (name, phone, password, address) {
            const client = getClient();
            const email = phoneToEmail(phone);

            // 1. إنشاء المستخدم
            const { data: authData, error: authError } = await client.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        full_name: name,
                        phone: phone,
                        role: "customer"
                    }
                }
            });

            if (authError) throw authError;

            // 2. إذا تم التسجيل بنجاح وكان هناك عنوان، نحفظه
            if (authData.user && address) {
                const { error: addrError } = await client
                    .from('customer_addresses')
                    .insert({
                        user_id: authData.user.id,
                        address_text: address,
                        label: 'المنزل', // افتراضي
                        is_default: true
                    });

                if (addrError) console.warn("Failed to save address:", addrError);
            }

            return authData;
        },

        // تسجيل الدخول
        login: async function (phone, password) {
            const client = getClient();
            const email = phoneToEmail(phone);

            const { data, error } = await client.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) throw error;

            // جلب دور المستخدم
            const { data: profile, error: profileError } = await client
                .from('profiles')
                .select('role')
                .eq('id', data.user.id)
                .single();

            if (profileError) {
                console.warn("Could not fetch user role:", profileError);
            }

            return { ...data, role: profile?.role || 'customer' };
        },

        // تسجيل الخروج
        logout: async function () {
            const client = getClient();
            await client.auth.signOut();
            window.location.href = "index.html";
        },

        // التحقق من الجلسة الحالية
        checkSession: async function () {
            const client = getClient();
            const { data: { session } } = await client.auth.getSession();
            return session;
        }
    };

    // تهيئة النماذج عند تحميل الصفحة
    document.addEventListener("DOMContentLoaded", () => {
        setupRegisterForm();
        setupLoginForm();
    });

    function setupRegisterForm() {
        const form = document.getElementById("register-form");
        if (!form) return;

        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const btn = form.querySelector("button[type='submit']");
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = "جاري الإنشاء...";

            const phone = document.getElementById("reg-phone").value.trim();
            const password = document.getElementById("reg-password").value;
            const name = document.getElementById("reg-name").value.trim();
            const address = document.getElementById("reg-address").value.trim();

            try {
                await CustomerAuth.register(name, phone, password, address);
                if (window.showToast) showToast("تم إنشاء الحساب بنجاح! 🎉", "success");
                setTimeout(() => window.location.href = "index.html", 1500);
            } catch (err) {
                console.error(err);
                let msg = "حدث خطأ أثناء التسجيل.";
                if (err.message.includes("already registered")) msg = "رقم الهاتف مسجل مسبقاً.";
                if (window.showToast) showToast(msg, "error");
                else alert(msg);
                btn.disabled = false;
                btn.textContent = originalText;
            }
        });
    }

    function setupLoginForm() {
        const form = document.getElementById("login-form");
        if (!form) return;

        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const btn = form.querySelector("button[type='submit']");
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = "جاري الدخول...";

            const phone = document.getElementById("login-phone").value.trim();
            const password = document.getElementById("login-password").value;

            try {
                const result = await CustomerAuth.login(phone, password);
                if (window.showToast) showToast("تم تسجيل الدخول بنجاح 👋", "success");

                // التوجيه حسب الدور
                setTimeout(() => {
                    if (result.role === 'admin') {
                        window.location.href = 'admin-dashboard.html';
                    } else if (result.role === 'driver') {
                        window.location.href = 'driver-dashboard.html';
                    } else {
                        window.location.href = 'index.html';
                    }
                }, 1000);
            } catch (err) {
                console.error(err);
                let msg = "بيانات الدخول غير صحيحة.";
                if (window.showToast) showToast(msg, "error");
                else alert(msg);
                btn.disabled = false;
                btn.textContent = originalText;
            }
        });
    }

})();
