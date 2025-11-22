// my-orders.js
// منطق صفحة طلباتي

(function () {
    const CONFIG = window.APP_CONFIG || {};
    let supabaseClient = null;

    function initSupabase() {
        if (supabaseClient) return supabaseClient;
        if (!window.supabase) return null;
        supabaseClient = window.supabase.createClient(
            CONFIG.supabase.url,
            CONFIG.supabase.anonKey
        );
        return supabaseClient;
    }

    function setupMyOrders() {
        const form = document.getElementById("my-orders-form");
        if (!form) return;

        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const phoneInput = document.getElementById("customer-phone");
            const phone = phoneInput.value.trim();

            if (!phone) {
                showToast("برجاء إدخال رقم الموبايل", "error");
                return;
            }

            const client = initSupabase();
            if (!client) {
                showToast("خطأ في الاتصال بقاعدة البيانات", "error");
                return;
            }

            await loadCustomerOrders(client, phone);
        });
    }

    async function loadCustomerOrders(client, phone) {
        const container = document.getElementById("my-orders-container");
        container.innerHTML = '<p class="loading">جاري البحث عن الطلبات...</p>';

        try {
            const { data: orders, error } = await client
                .from("orders")
                .select("*")
                .eq("customer_phone", phone)
                .order("created_at", { ascending: false });

            if (error) throw error;

            container.innerHTML = "";
            if (!orders || !orders.length) {
                container.innerHTML = '<p class="info-text" style="text-align:center; width:100%;">لا توجد طلبات مسجلة لهذا الرقم.</p>';
                return;
            }

            orders.forEach((order) => {
                const card = createOrderCard(order);
                container.appendChild(card);
            });

        } catch (err) {
            console.error("Error loading orders:", err);
            container.innerHTML = '<p class="error">حدث خطأ أثناء تحميل الطلبات.</p>';
            showToast("حدث خطأ أثناء تحميل الطلبات", "error");
        }
    }

    function createOrderCard(order) {
        const div = document.createElement("div");
        div.className = "admin-order-card"; // Reuse admin card style

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
        <p><strong>العنوان:</strong> ${order.customer_address}</p>
        <p><strong>الإجمالي:</strong> ${order.total_amount} ج.م</p>
        <p><strong>التاريخ:</strong> ${new Date(order.created_at).toLocaleString('ar-EG')}</p>
        ${order.notes ? `<p><strong>ملاحظات:</strong> ${order.notes}</p>` : ''}
      </div>
    `;

        return div;
    }

    document.addEventListener("DOMContentLoaded", () => {
        setupMyOrders();
    });
})();
