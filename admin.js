// admin.js
// منطق لوحة تحكم الأدمن (طلبات + منتجات)

(function () {
    const CONFIG = window.APP_CONFIG || {};
    let supabaseClient = null;

    function initSupabase() {
        if (supabaseClient) return supabaseClient;
        if (window.getSupabaseClient) {
            supabaseClient = window.getSupabaseClient();
            return supabaseClient;
        }
        if (!window.supabase) return null;
        supabaseClient = window.supabase.createClient(
            CONFIG.supabase.url,
            CONFIG.supabase.anonKey
        );
        return supabaseClient;
    }

    // ============================
    // 1. التحقق من الصلاحيات
    // ============================
    async function checkAuth() {
        if (window.AuthGuard) {
            await window.AuthGuard.requireRole(['admin']);
        }
        const client = initSupabase();
        if (!client) return;

        const { data: { session } } = await client.auth.getSession();
        const currentPage = document.body.dataset.page;

        if (currentPage === "admin-login" && session) {
            window.location.href = "admin-dashboard.html";
            return;
        }

        if (currentPage === "admin-dashboard" && !session) {
            window.location.href = "admin-login.html";
            return;
        }

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
    // 2. تسجيل الدخول
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
            const { error } = await client.auth.signInWithPassword({ email, password });

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

        // زر الخروج
        const logoutBtn = document.getElementById("admin-logout-btn");
        if (logoutBtn) {
            logoutBtn.addEventListener("click", async () => {
                await client.auth.signOut();
            });
        }

        // إعداد التبويبات (Tabs)
        setupTabs();

        // تحميل البيانات الأولية
        await loadStats(client);
        await loadOrders(client);
        await loadProducts(client);

        // إعداد مودال المنتجات
        setupProductModal(client);
    }

    // ============================
    // 3.5 الإحصائيات (جديد)
    // ============================
    async function loadStats(client) {
        const ordersEl = document.getElementById("admin-metric-orders-today");
        const salesEl = document.getElementById("admin-metric-sales-today");
        if (!ordersEl || !salesEl) return;

        try {
            // تاريخ اليوم (بداية اليوم)
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayISO = today.toISOString();

            const { data: orders, error } = await client
                .from("orders")
                .select("total_amount, status")
                .gte("created_at", todayISO)
                .neq("status", "CANCELLED"); // استبعاد الملغي

            if (error) throw error;

            const count = orders.length;
            const totalSales = orders.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0);

            ordersEl.textContent = count;
            salesEl.textContent = `${totalSales.toFixed(2)} ج.م`;

        } catch (err) {
            console.error("Error loading stats:", err);
            ordersEl.textContent = "-";
            salesEl.textContent = "-";
        }
    }

    function setupTabs() {
        const tabs = document.querySelectorAll('.tab-btn');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // إزالة التنشيط من الكل
                document.querySelectorAll('.tab-btn').forEach(t => {
                    t.classList.remove('active');
                    t.style.borderBottom = '3px solid transparent';
                });
                document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');

                // تنشيط التبويب المختار
                tab.classList.add('active');
                // tab.style.borderBottom = '3px solid #e67e22'; // لون برتقالي (اختياري)
                const targetId = tab.dataset.target;
                document.getElementById(targetId).style.display = 'block';
            });
        });
    }

    // ============================
    // 4. إدارة الطلبات
    // ============================
    async function loadOrders(client) {
        const container = document.getElementById("admin-orders-container");
        if (!container) return;

        container.innerHTML = '<p class="loading">جاري تحميل الطلبات...</p>';

        try {
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

        const select = div.querySelector(".status-select");
        select.addEventListener("change", async (e) => {
            await updateOrderStatus(client, order.id, e.target.value);
        });

        const detailsBtn = div.querySelector(".view-details-btn");
        detailsBtn.addEventListener("click", () => {
            openOrderDetails(client, order);
        });

        return div;
    }

    async function updateOrderStatus(client, orderId, newStatus) {
        try {
            const { error } = await client.from("orders").update({ status: newStatus }).eq("id", orderId);
            if (error) throw error;
            showToast(`تم تحديث الحالة إلى ${newStatus}`, "success");
        } catch (err) {
            console.error("Error updating status:", err);
            showToast("فشل تحديث الحالة", "error");
        }
    }

    // ============================
    // 5. إدارة المنتجات (جديد)
    // ============================
    async function loadProducts(client) {
        const container = document.getElementById("admin-products-container");
        if (!container) return;

        container.innerHTML = '<p class="loading">جاري تحميل المنتجات...</p>';

        try {
            const { data: products, error } = await client
                .from("products")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;

            container.innerHTML = "";
            if (!products || !products.length) {
                container.innerHTML = '<p>لا توجد منتجات. أضف منتجك الأول!</p>';
                return;
            }

            products.forEach((product) => {
                const card = createProductCard(product, client);
                container.appendChild(card);
            });
        } catch (err) {
            console.error("Error loading products:", err);
            container.innerHTML = '<p class="error">حدث خطأ أثناء تحميل المنتجات.</p>';
        }
    }

    function createProductCard(product, client) {
        const div = document.createElement("div");
        div.className = "admin-order-card"; // نعيد استخدام نفس الستايل

        const statusBadge = product.is_available
            ? '<span class="status-badge" style="background-color: #27ae60">متاح</span>'
            : '<span class="status-badge" style="background-color: #c0392b">غير متاح</span>';

        div.innerHTML = `
            <div class="order-header">
                <h3>${product.name}</h3>
                ${statusBadge}
            </div>
            <div class="order-details">
                <p><strong>السعر:</strong> ${product.price} ج.م</p>
                <p><strong>التصنيف:</strong> ${product.category || 'غير مصنف'}</p>
                <p><strong>الوصف:</strong> ${product.description || '-'}</p>
            </div>
            <div class="order-actions">
                <button class="btn btn-sm btn-primary edit-product-btn">تعديل ✏️</button>
                <button class="btn btn-sm btn-danger delete-product-btn">حذف 🗑️</button>
            </div>
        `;

        // زر التعديل
        div.querySelector('.edit-product-btn').addEventListener('click', () => {
            openProductModal(product);
        });

        // زر الحذف
        div.querySelector('.delete-product-btn').addEventListener('click', async () => {
            if (confirm(`هل أنت متأكد من حذف "${product.name}"؟`)) {
                await deleteProduct(client, product.id);
            }
        });

        return div;
    }

    async function deleteProduct(client, productId) {
        try {
            const { error } = await client.from('products').delete().eq('id', productId);
            if (error) throw error;
            showToast("تم حذف المنتج بنجاح", "success");
            loadProducts(client); // إعادة تحميل القائمة
        } catch (err) {
            console.error("Error deleting product:", err);
            showToast("فشل حذف المنتج", "error");
        }
    }

    // ============================
    // 6. مودال المنتجات (إضافة/تعديل)
    // ============================
    function setupProductModal(client) {
        const modal = document.getElementById("product-modal");
        const closeBtn = document.getElementById("close-product-modal-btn");
        const addBtn = document.getElementById("add-product-btn");
        const form = document.getElementById("product-form");

        if (!modal || !form) return;

        // فتح المودال للإضافة
        if (addBtn) {
            addBtn.addEventListener("click", () => {
                openProductModal(null); // null means new product
            });
        }

        // إغلاق المودال
        closeBtn.addEventListener("click", () => modal.classList.remove("is-open"));
        modal.addEventListener("click", (e) => {
            if (e.target === modal) modal.classList.remove("is-open");
        });

        // معالجة الفورم
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const id = document.getElementById("product-id").value;
            const name = document.getElementById("product-name").value;
            const price = document.getElementById("product-price").value;
            const category = document.getElementById("product-category").value;
            const desc = document.getElementById("product-desc").value;
            const isAvailable = document.getElementById("product-available").checked;

            const productData = {
                name,
                price: Number(price),
                category,
                description: desc,
                is_available: isAvailable
            };

            try {
                if (id) {
                    // تحديث
                    const { error } = await client.from("products").update(productData).eq("id", id);
                    if (error) throw error;
                    showToast("تم تحديث المنتج بنجاح", "success");
                } else {
                    // إضافة جديد
                    const { error } = await client.from("products").insert(productData);
                    if (error) throw error;
                    showToast("تم إضافة المنتج بنجاح", "success");
                }
                modal.classList.remove("is-open");
                loadProducts(client); // تحديث القائمة
            } catch (err) {
                console.error("Error saving product:", err);
                showToast("حدث خطأ أثناء الحفظ", "error");
            }
        });
    }

    function openProductModal(product) {
        const modal = document.getElementById("product-modal");
        const title = document.getElementById("product-modal-title");

        // تعبئة الحقول
        document.getElementById("product-id").value = product ? product.id : "";
        document.getElementById("product-name").value = product ? product.name : "";
        document.getElementById("product-price").value = product ? product.price : "";
        document.getElementById("product-category").value = product ? product.category : "محاشي";
        document.getElementById("product-desc").value = product ? product.description || "" : "";
        document.getElementById("product-available").checked = product ? product.is_available : true;

        title.textContent = product ? "تعديل منتج" : "إضافة منتج جديد";
        modal.classList.add("is-open");
    }

    // ============================
    // 7. تفاصيل الطلب (Modal)
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
                html += '<li class="modal-item-row">لا توجد أصناف مسجلة.</li>';
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

        closeBtn.addEventListener("click", () => modal.classList.remove("is-open"));
        modal.addEventListener("click", (e) => {
            if (e.target === modal) modal.classList.remove("is-open");
        });
    }

    // ============================
    // 8. التشغيل عند التحميل
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
