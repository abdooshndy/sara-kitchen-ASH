// auth-guard.js
// حماية الصفحات بناءً على الصلاحيات (RBAC)

(function () {
    const CONFIG = window.APP_CONFIG || {};

    // تصدير الدالة للعالم الخارجي
    window.AuthGuard = {
        requireRole: async function (allowedRoles = []) {
            if (!window.supabase) {
                console.error("Supabase client not found.");
                return;
            }

            const client = window.supabase.createClient(
                CONFIG.supabase.url,
                CONFIG.supabase.anonKey
            );

            // 1. التحقق من الجلسة
            const { data: { session } } = await client.auth.getSession();

            if (!session) {
                redirectToLogin();
                return;
            }

            // 2. جلب بيانات البروفايل لمعرفة الدور
            const { data: profile, error } = await client
                .from("profiles")
                .select("role")
                .eq("id", session.user.id)
                .single();

            if (error || !profile) {
                console.error("Error fetching profile:", error);
                // لو مفيش بروفايل، ممكن يكون يوزر قديم أو فيه مشكلة
                // هنخرجه للأمان
                await client.auth.signOut();
                redirectToLogin();
                return;
            }

            // 3. التحقق من الصلاحية
            if (!allowedRoles.includes(profile.role)) {
                console.warn(`User role ${profile.role} is not allowed. Required: ${allowedRoles.join(", ")}`);
                redirectToUnauthorized();
            }
        }
    };

    function redirectToLogin() {
        // توجيه ذكي حسب الصفحة الحالية
        const path = window.location.pathname;
        if (path.includes("admin")) {
            window.location.href = "admin-login.html";
        } else if (path.includes("driver")) {
            window.location.href = "driver-login.html";
        } else if (path.includes("kitchen")) {
            window.location.href = "admin-login.html"; // الطباخ يدخل من صفحة الأدمن أو صفحة خاصة
        } else {
            window.location.href = "customer-login.html";
        }
    }

    function redirectToUnauthorized() {
        document.body.innerHTML = `
            <div style="text-align: center; padding: 50px; font-family: sans-serif;">
                <h1 style="color: #c0392b;">غير مصرح لك بالدخول 🚫</h1>
                <p>ليس لديك الصلاحيات الكافية لعرض هذه الصفحة.</p>
                <a href="index.html" style="color: #2980b9;">العودة للرئيسية</a>
            </div>
        `;
    }
})();
