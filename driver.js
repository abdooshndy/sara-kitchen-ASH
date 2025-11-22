// driver.js
// منطق لوحة تحكم المندوب

(function () {
    const CONFIG = window.APP_CONFIG || {};
    let supabaseClient = null;

    function initSupabase() {
        if (supabaseClient) return supabaseClient;

        // استخدام Utils إن كان متاحاً
        if (window.getSupabaseClient) {
            supabaseClient = window.getSupabaseClient();
            return supabaseClient;
        }

        // Fallback
        if (!window.supabase) return null;
        supabaseClient = window.supabase.createClient(
            CONFIG.supabase.url,
            CONFIG.supabase.anonKey
        );
        return supabaseClient;
    }

    // ============================
    // 1. التحقق من الصلاحيات (Auth)
    // ============================
    async function checkAuth() {
        if (window.AuthGuard) {
            await window.AuthGuard.requireRole(['driver', 'admin']);
        }
        const client = initSupabase();
        if (!client) return;

        const {
            data: { session }
        } = await client.auth.getSession();

        const currentPage = document.body.dataset.page;

        if (currentPage === "driver-login" && session) {
            window.location.href = "driver-dashboard.html";
            return;
        }

        if (currentPage === "driver-dashboard" && !session) {
            window.location.href = "driver-login.html";
            return;
        }

        client.auth.onAuthStateChange((event, session) => {
            if (event === "SIGNED_IN" && currentPage === "driver-login") {
                window.location.href = "driver-dashboard.html";
            }
            if (event === "SIGNED_OUT" && currentPage === "driver-dashboard") {
                window.location.href = "driver-login.html";
            }
        });
    }

    // ============================
    // 2. تسجيل الدخول (Login)
    // ============================
    function setupLogin() {
        const form = document.getElementById("driver-login-form");
        if (!form) return;

        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = document.getElementById("driver-email").value;
            const password = document.getElementById("driver-password").value;
            const errorEl = document.getElementById("driver-login-error");
            const btn = form.querySelector("button");

            if (!email || !password) {
                errorEl.textContent = "الرجاء إدخال البريد الإلكتروني وكلمة المرور";
                return;
            }

            btn.disabled = true;
            btn.textContent = "جاري الدخول...";
            errorEl.textContent = "";

            const client = initSupabase();
            const { data, error } = await client.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                console.error("Login error:", error);
                errorEl.textContent = "فشل الدخول: تأكد من البيانات.";
                btn.disabled = false;
                btn.textContent = "دخول";
            } else {
                showToast("تم تسجيل الدخول بنجاح", "success");
            }
        });
    }

    // ============================
    // 3. لوحة التحكم (Dashboard)
    // ============================
    async function initDashboard() {
        const client = initSupabase();
        if (!client) return;

        const logoutBtn = document.getElementById("driver-logout-btn");
        if (logoutBtn) {
            logoutBtn.addEventListener("click", async () => {
                await client.auth.signOut();
            });
        }

        await loadDriverOrders(client);

        // اشتراك Realtime
        const channel = client
            .channel('driver-orders')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'orders' },
                (payload) => {
                    // إذا تغيرت الحالة إلى PREPARING أو WITH_DRIVER، نحدث القائمة
                    if (['PREPARING', 'WITH_DRIVER'].includes(payload.new.status)) {
                        console.log('Order updated!', payload);
                        if (window.showToast) showToast("تم تحديث قائمة الطلبات 🔔", "info");
                        loadDriverOrders(client);
                    }
                }
            )
            .subscribe();

        // تحديث تلقائي كل 30 ثانية (كاحتياط)
        setInterval(() => loadDriverOrders(client), 30000);
    }

    async function loadDriverOrders(client) {
        const container = document.getElementById("driver-orders-container");
        if (!container) return;

        container.innerHTML = '<p class="loading">جاري تحميل الطلبات...</p>';

        try {
            // المندوب بيشوف الطلبات اللي حالتها "مع المندوب" أو "جاري التحضير" (عشان يجهز نفسه)
            // في نظام متكامل، المفروض يشوف الطلبات المسندة ليه هو بس (driver_id)
            // بس للتبسيط هنا هنعرض كل الطلبات اللي محتاجة توصيل
            const { data: orders, error } = await client
                .from("orders")
                .select("*")
                .in("status", ["PREPARING", "WITH_DRIVER"])
                .order("created_at", { ascending: false });

            if (error) throw error;

            container.innerHTML = "";
            if (!orders || !orders.length) {
                container.innerHTML = '<p>لا توجد طلبات للتوصيل حالياً.</p>';
                return;
            }

            orders.forEach((order) => {
                const card = createDriverOrderCard(order, client);
                container.appendChild(card);
            });
        } catch (err) {
            console.error("Error loading orders:", err);
            container.innerHTML = '<p class="error">حدث خطأ أثناء تحميل الطلبات.</p>';
        }
    }

    function createDriverOrderCard(order, client) {
        const div = document.createElement("div");
        div.className = "driver-order-card";

        // رابط خرائط جوجل
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.customer_address)}`;

        div.innerHTML = `
      <div class="order-header">
        <h3>طلب #${order.order_code}</h3>
        <span class="status-badge">${order.status}</span>
      </div>
      <div class="order-details">
        <p><strong>العميل:</strong> ${order.customer_name}</p>
        <p><strong>العنوان:</strong> ${order.customer_address} 
           <a href="${mapsUrl}" target="_blank" class="btn btn-sm btn-outline" style="margin-right:5px; text-decoration:none;">📍 الخريطة</a>
        </p>
        <p><strong>الموبايل:</strong> <a href="tel:${order.customer_phone}">${order.customer_phone}</a></p>
        <p><strong>المطلوب:</strong> ${order.total_amount} ج.م</p>
        ${order.is_asap ? '<p style="color:red; font-weight:bold;">⚡ مستعجل</p>' : ''}
        ${order.scheduled_for ? `<p style="color:blue;">📅 ${new Date(order.scheduled_for).toLocaleTimeString('ar-EG')}</p>` : ''}
      </div>
      <div class="order-actions">
        ${order.status === "WITH_DRIVER"
                ? `<button class="btn btn-primary mark-delivered-btn" data-id="${order.id}">تم التسليم ✅</button>`
                : `<span class="info-text">في انتظار استلام الطلب من المطبخ</span>`
            }
      </div>
    `;

        const btn = div.querySelector(".mark-delivered-btn");
        if (btn) {
            btn.addEventListener("click", async () => {
                if (confirm("هل أنت متأكد أنك سلمت الطلب واستلمت المبلغ؟")) {
                    await updateOrderStatus(client, order.id, "DELIVERED");
                    div.remove();
                }
            });
        }

        return div;
    }

    async function updateOrderStatus(client, orderId, newStatus) {
        try {
            const { error } = await client
                .from("orders")
                .update({ status: newStatus })
                .eq("id", orderId);

            if (error) throw error;
            showToast(`تم تحديث الحالة إلى ${newStatus}`, "success");
        } catch (err) {
            console.error("Error updating status:", err);
            showToast("فشل تحديث الحالة", "error");
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        checkAuth();
        const page = document.body.dataset.page;
        if (page === "driver-login") {
            setupLogin();
        } else if (page === "driver-dashboard") {
            initDashboard();
        }
    });
})();
