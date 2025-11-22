// admin.js
// منطق لوحة تحكم الأدمن

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
            await window.AuthGuard.requireRole(['admin']);
        }
        const client = initSupabase();
        if (!client) return;

        const {
            data: { session }
        } = await client.auth.getSession();

        const currentPage = document.body.dataset.page;

        // لو احنا في صفحة اللوجين ومعانا سيشن، وديه للداشبورد
        if (currentPage === "admin-login" && session) {
            window.location.href = "admin-dashboard.html";
            return;
        }

        // لو احنا في الداشبورد ومعناش سيشن، وديه للوجين
        if (currentPage === "admin-dashboard" && !session) {
            window.location.href = "admin-login.html";
            return;
        }

        // استمع لتغيرات الحالة
        client.auth.onAuthStateChange((event, session) => {
            if (event === "SIGNED_IN" && currentPage === "admin-login") {
                window.location.href = "admin-dashboard.html";
            }
            if (event === "SIGNED_OUT" && currentPage === "admin-dashboard") {
                window.location.href = "admin-login.html";
            }
        });
    }

    // ============================
    // 2. تسجيل الدخول (Login)
    // ============================
    function setupLogin() {
        const form = document.getElementById("admin-login-form");
        if (!form) return;

        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = document.getElementById("admin-email").value;
            const password = document.getElementById("admin-password").value;
            const errorEl = document.getElementById("admin-login-error");
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
                // التوجيه هيحصل تلقائي من checkAuth
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

        // زر الخروج
        const logoutBtn = document.getElementById("admin-logout-btn");
        if (logoutBtn) {
            logoutBtn.addEventListener("click", async () => {
                await client.auth.signOut();
            });
        }

        await loadOrders(client);
    }

    async function loadOrders(client) {
        const container = document.getElementById("admin-orders-container");
        if (!container) return;

        container.innerHTML = '<p class="loading">جاري تحميل الطلبات...</p>';

        try {
            // جلب الطلبات مرتبة بالأحدث
            const { data: orders, error } = await client
                .from("orders")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;

            container.innerHTML = "";
            if (!orders || !orders.length) {
                container.innerHTML = '<p>لا توجد طلبات حالياً.</p>';
                return;
            }

            orders.forEach((order) => {
                const card = createOrderCard(order, client);
                container.appendChild(card);
            });
        } catch (err) {
            console.error("Error loading orders:", err);
            container.innerHTML = '<p class="error">حدث خطأ أثناء تحميل الطلبات.</p>';
        }
    }

    function createOrderCard(order, client) {
        const div = document.createElement("div");
        div.className = "admin-order-card";

        // تحديد لون الحالة
        let statusColor = "#7f8c8d";
        if (order.status === "PENDING") statusColor = "#f39c12";
        if (order.status === "PREPARING") statusColor = "#3498db";
        if (order.status === "WITH_DRIVER") statusColor = "#9b59b6";
        if (order.status === "DELIVERED") statusColor = "#27ae60";
        if (order.status === "CANCELLED") statusColor = "#c0392b";

        div.innerHTML = `
      <div class="order-header">
        <h3>طلب #${order.order_code}</h3>
        <span class="status-badge" style="background-color: ${statusColor}">${order.status}</span>
      </div>
      <div class="order-details">
        <p><strong>العميل:</strong> ${order.customer_name} (${order.customer_phone})</p>
        <p><strong>العنوان:</strong> ${order.customer_address}</p>
        <p><strong>الإجمالي:</strong> ${order.total_amount} ج.م</p>
        <p><strong>التاريخ:</strong> ${new Date(order.created_at).toLocaleString('ar-EG')}</p>
      </div>
      <div class="order-actions">
        <select class="status-select" data-id="${order.id}">
          <option value="PENDING" ${order.status === 'PENDING' ? 'selected' : ''}>قيد الانتظار</option>
          <option value="PREPARING" ${order.status === 'PREPARING' ? 'selected' : ''}>جاري التحضير</option>
          <option value="WITH_DRIVER" ${order.status === 'WITH_DRIVER' ? 'selected' : ''}>مع المندوب</option>
          <option value="DELIVERED" ${order.status === 'DELIVERED' ? 'selected' : ''}>تم التسليم</option>
          <option value="CANCELLED" ${order.status === 'CANCELLED' ? 'selected' : ''}>ملغي</option>
        </select>
        <button class="btn btn-sm btn-outline view-details-btn" data-id="${order.id}">التفاصيل</button>
      </div>
    `;

        // تفعيل تغيير الحالة
        // تفعيل تغيير الحالة
        const select = div.querySelector(".status-select");
        select.addEventListener("change", async (e) => {
            const newStatus = e.target.value;
            await updateOrderStatus(client, order.id, newStatus);
        });

        // تفعيل زر التفاصيل
        const detailsBtn = div.querySelector(".view-details-btn");
        detailsBtn.addEventListener("click", () => {
            openOrderDetails(client, order);
        });

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

    // ============================
    // 4. تفاصيل الطلب (Modal)
    // ============================
    async function openOrderDetails(client, order) {
        const modal = document.getElementById("order-details-modal");
        const modalBody = document.getElementById("modal-body");
        if (!modal || !modalBody) return;

        modalBody.innerHTML = '<p class="loading">جاري تحميل التفاصيل...</p>';
        modal.classList.add("is-open");

        try {
            const { data: items, error } = await client
                .from("order_items")
                .select("*")
                .eq("order_id", order.id);

            if (error) throw error;

            let html = `
                <div style="margin-bottom: 1rem; background: #f9f9f9; padding: 1rem; border-radius: 8px;">
                    <p><strong>رقم الطلب:</strong> ${order.order_code}</p>
                    <p><strong>العميل:</strong> ${order.customer_name}</p>
                    <p><strong>ملاحظات:</strong> ${order.notes || "لا يوجد"}</p>
                </div>
                <h3>الأصناف:</h3>
                <ul class="modal-items-list">
            `;

            if (items && items.length) {
                items.forEach(item => {
                    const total = Number(item.unit_price) * Number(item.quantity);
                    html += `
                        <li class="modal-item-row">
                            <span>${item.quantity}x ${item.name || "صنف"}</span>
                            <span>${total.toFixed(2)} ج.م</span>
                        </li>
                    `;
                });
            } else {
                html += '<li class="modal-item-row">لا توجد أصناف مسجلة لهذا الطلب.</li>';
            }

            html += `</ul>
                <div style="margin-top: 1rem; text-align: left; font-weight: bold; font-size: 1.1rem;">
                    الإجمالي: ${order.total_amount} ج.م
                </div>
            `;

            modalBody.innerHTML = html;

        } catch (err) {
            console.error("Error fetching details:", err);
            modalBody.innerHTML = '<p class="error">حدث خطأ أثناء تحميل التفاصيل.</p>';
        }
    }

    function setupModalClose() {
        const modal = document.getElementById("order-details-modal");
        const closeBtn = document.getElementById("close-modal-btn");
        if (!modal || !closeBtn) return;

        closeBtn.addEventListener("click", () => {
            modal.classList.remove("is-open");
        });

        modal.addEventListener("click", (e) => {
            if (e.target === modal) {
                modal.classList.remove("is-open");
            }
        });
    }

    // ============================
    // 5. التشغيل عند التحميل
    // ============================
    document.addEventListener("DOMContentLoaded", () => {
        checkAuth();
        setupModalClose();
        const page = document.body.dataset.page;
        if (page === "admin-login") {
            setupLogin();
        } else if (page === "admin-dashboard") {
            initDashboard();
        }
    });
})();
