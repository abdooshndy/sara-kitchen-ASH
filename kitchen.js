// kitchen.js
// منطق لوحة المطبخ (Cook Dashboard)

(function () {
    const CONFIG = window.APP_CONFIG || {};
    let supabaseClient = null;
    let lastOrderCount = 0; // لتتبع الطلبات الجديدة
    const audioAlert = new Audio('alert.mp3'); // ملف الصوت

    function initSupabase() {
        if (supabaseClient) return supabaseClient;
        if (window.getSupabaseClient) {
            supabaseClient = window.getSupabaseClient();
            return supabaseClient;
        }
        if (!window.supabase) return null;
        supabaseClient = window.supabase.createClient(CONFIG.supabase.url, CONFIG.supabase.anonKey);
        return supabaseClient;
    }

    // ============================
    // 1. التحقق من الصلاحيات
    // ============================
    async function checkAuth() {
        if (window.AuthGuard) {
            await window.AuthGuard.requireRole(['cook', 'admin']);
        }
    }

    // ============================
    // 2. لوحة التحكم (Dashboard)
    // ============================
    async function initDashboard() {
        const client = initSupabase();
        if (!client) return;

        // زر الخروج
        const logoutBtn = document.getElementById("kitchen-logout-btn");
        if (logoutBtn) {
            logoutBtn.addEventListener("click", async () => {
                await client.auth.signOut();
                window.location.href = "admin-login.html";
            });
        }

        setupModalClose();

        // تحميل أولي
        await loadKitchenOrders(client);

        // اشتراك Realtime
        const channel = client
            .channel('kitchen-orders')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'orders' },
                (payload) => {
                    console.log('New order received!', payload);
                    playAlert();
                    if (window.showToast) showToast("طلب جديد وصل! 🔔", "info");
                    loadKitchenOrders(client);
                }
            )
            .subscribe();

        // تحديث تلقائي كل 30 ثانية (كاحتياط)
        setInterval(() => loadKitchenOrders(client), 30000);
    }

    async function loadKitchenOrders(client) {
        const container = document.getElementById("kitchen-orders-container");
        const pendingMetric = document.getElementById("kitchen-metric-pending");
        const preparingMetric = document.getElementById("kitchen-metric-preparing");

        if (!container) return;

        // لا نمسح المحتوى بالكامل لتجنب الوميض، سنحدثه فقط عند الحاجة
        // لكن للتبسيط هنا سنعيد البناء

        try {
            const { data: orders, error } = await client
                .from("orders")
                .select("*")
                .in("status", ["PENDING", "PREPARING"])
                .order("created_at", { ascending: true });

            if (error) throw error;

            // منطق التنبيه الصوتي
            const currentCount = orders.length;
            if (currentCount > lastOrderCount && lastOrderCount !== 0) {
                // طلب جديد وصل!
                playAlert();
                if (window.showToast) showToast("طلب جديد وصل! 🔔", "info");
            }
            lastOrderCount = currentCount;

            // تحديث العدادات
            let pendingCount = 0;
            let preparingCount = 0;
            orders.forEach(o => {
                if (o.status === 'PENDING') pendingCount++;
                if (o.status === 'PREPARING') preparingCount++;
            });
            if (pendingMetric) pendingMetric.textContent = pendingCount;
            if (preparingMetric) preparingMetric.textContent = preparingCount;

            container.innerHTML = "";
            if (!orders || !orders.length) {
                container.innerHTML = '<p>لا توجد طلبات جديدة حالياً.</p>';
                return;
            }

            orders.forEach((order) => {
                const card = createKitchenOrderCard(order, client);
                container.appendChild(card);
            });
        } catch (err) {
            console.error("Error loading orders:", err);
            // لا تظهر رسالة خطأ للمستخدم كل مرة عشان التحديث التلقائي
        }
    }

    function playAlert() {
        audioAlert.play().catch(e => console.log("Audio play failed (needs interaction):", e));
    }

    function createKitchenOrderCard(order, client) {
        const div = document.createElement("div");
        div.className = "admin-order-card";

        let statusColor = "#f39c12"; // Pending
        if (order.status === "PREPARING") statusColor = "#3498db";

        div.innerHTML = `
      <div class="order-header">
        <h3>طلب #${order.order_code}</h3>
        <span class="status-badge" style="background-color: ${statusColor}">${order.status}</span>
      </div>
      <div class="order-details">
        <p><strong>العميل:</strong> ${order.customer_name}</p>
        <p><strong>ملاحظات:</strong> ${order.notes || "لا يوجد"}</p>
        <p><strong>الوقت:</strong> ${new Date(order.created_at).toLocaleTimeString('ar-EG')}</p>
        ${order.is_asap ? '<p style="color:red; font-weight:bold;">⚡ مستعجل (ASAP)</p>' : ''}
        ${order.scheduled_for ? `<p style="color:blue; font-weight:bold;">📅 موعد: ${new Date(order.scheduled_for).toLocaleString('ar-EG')}</p>` : ''}
      </div>
      <div class="order-actions">
        ${order.status === 'PENDING'
                ? `<button class="btn btn-sm btn-primary start-cooking-btn" data-id="${order.id}">بدء التحضير 🍳</button>`
                : `<button class="btn btn-sm btn-success finish-cooking-btn" data-id="${order.id}">جاهز للتوصيل 🛵</button>`
            }
        <button class="btn btn-sm btn-secondary print-order-btn" data-id="${order.id}">طباعة 🖨️</button>
        <button class="btn btn-sm btn-outline view-details-btn" data-id="${order.id}">التفاصيل</button>
      </div>
    `;

        // زر بدء التحضير
        const startBtn = div.querySelector(".start-cooking-btn");
        if (startBtn) {
            startBtn.addEventListener("click", async () => {
                await updateOrderStatus(client, order.id, "PREPARING");
                loadKitchenOrders(client);
            });
        }

        // زر إنهاء التحضير
        const finishBtn = div.querySelector(".finish-cooking-btn");
        if (finishBtn) {
            finishBtn.addEventListener("click", async () => {
                if (confirm("هل أنت متأكد أن الطلب جاهز ومغلف للمندوب؟")) {
                    await updateOrderStatus(client, order.id, "WITH_DRIVER");
                    loadKitchenOrders(client);
                }
            });
        }

        // زر الطباعة
        const printBtn = div.querySelector(".print-order-btn");
        if (printBtn) {
            printBtn.addEventListener("click", () => {
                printOrder(client, order);
            });
        }

        // زر التفاصيل
        const detailsBtn = div.querySelector(".view-details-btn");
        if (detailsBtn) {
            detailsBtn.addEventListener("click", () => {
                openOrderDetails(client, order);
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

            // إرسال إشعار للسائق إذا أصبحت الحالة "مع المندوب"
            if (newStatus === "WITH_DRIVER") {
                console.log("[Kitchen] Status changed to WITH_DRIVER. Fetching full order details...");
                const { data: fullOrder } = await client.from('orders').select('*').eq('id', orderId).single();
                if (fullOrder) {
                    console.log("[Kitchen] Full order fetched:", fullOrder);
                    await sendDriverNotification(fullOrder);
                } else {
                    console.error("[Kitchen] Failed to fetch full order details.");
                }
            }

        } catch (err) {
            console.error("Error updating status:", err);
            showToast("فشل تحديث الحالة", "error");
        }
    }

    // ============================
    // دوال مساعدة للإشعارات
    // ============================
    function formatPrice(amount) {
        return new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' }).format(amount);
    }

    async function sendDriverNotification(order) {
        console.log("[Kitchen] Starting sendDriverNotification for order:", order.id);
        let telegramConfig = CONFIG.telegram;
        try {
            const client = initSupabase();
            if (client) {
                const { data: setting } = await client.from('system_settings').select('value').eq('key', 'telegram_config').single();
                if (setting && setting.value) telegramConfig = setting.value;
            }
        } catch (e) { console.error("[Kitchen] Error fetching config:", e); }

        if (!telegramConfig || !telegramConfig.botToken || !telegramConfig.chatIds) {
            console.error("[Kitchen] Missing Telegram config:", telegramConfig);
            return;
        }

        const { botToken, chatIds } = telegramConfig;
        console.log("[Kitchen] Loaded Chat IDs:", chatIds);

        let message = `🚗 *طلب جاهز للتوصيل!* (#${order.order_code})\n\n`;
        message += `👤 *العميل:* ${order.customer_name}\n`;
        message += `📱 *الهاتف:* ${order.customer_phone}\n`;
        message += `📍 *العنوان:* ${order.customer_address}\n`;

        // رابط Google Maps - يتم إنشاءه دائماً من العنوان
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.customer_address)}`;
        message += `🗺 [فتح الموقع على خرائط جوجل](${mapsUrl})\n`;

        message += `\n💰 *المطلوب تحصيله:* ${formatPrice(order.total_amount)}\n`;
        if (order.notes) message += `📝 *ملاحظات:* ${order.notes}\n`;
        message += `\n✅ الرجاء تأكيد الاستلام من المطبخ.`;

        if (Array.isArray(chatIds)) {
            chatIds.forEach(async (chat) => {
                let id = typeof chat === 'string' ? chat : chat.id;
                let role = typeof chat === 'string' ? 'admin' : (chat.role || 'admin');

                console.log(`[Kitchen] Checking chat ${id} with role ${role}`);

                if (role === 'driver' || role === 'admin') {
                    console.log(`[Kitchen] Sending to ${role} (${id})...`);
                    try {
                        const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                chat_id: id,
                                text: message,
                                parse_mode: 'Markdown'
                            })
                        });
                        const json = await res.json();
                        console.log(`[Kitchen] Send result for ${id}:`, json);
                    } catch (err) { console.error(`[Kitchen] Failed to send to ${id}`, err); }
                } else {
                    console.log(`[Kitchen] Skipping ${id} (Role: ${role})`);
                }
            });
        }
    }

    // دالة الطباعة
    async function printOrder(client, order) {
        // جلب الأصناف للطباعة
        const { data: items } = await client
            .from("order_items")
            .select("*")
            .eq("order_id", order.id);

        const printWindow = window.open('', '', 'height=600,width=400');

        let itemsHtml = '';
        if (items) {
            items.forEach(item => {
                itemsHtml += `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px; border-bottom: 1px dashed #ccc; padding-bottom: 5px;">
                        <span>${item.quantity}x ${item.name}</span>
                        <span>${item.unit_price * item.quantity} ج.م</span>
                    </div>
                `;
            });
        }

        const content = `
            <html>
            <head>
                <title>طلب #${order.order_code}</title>
                <style>
                    body { font-family: 'Courier New', monospace; direction: rtl; padding: 20px; }
                    .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
                    .details { margin-bottom: 20px; }
                    .items { margin-bottom: 20px; }
                    .total { text-align: left; font-weight: bold; font-size: 1.2em; border-top: 2px solid #000; padding-top: 10px; }
                    @media print {
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>مطبخ سارة 👩‍🍳</h2>
                    <p>رقم الطلب: #${order.order_code}</p>
                    <p>${new Date().toLocaleString('ar-EG')}</p>
                </div>
                <div class="details">
                    <p><strong>العميل:</strong> ${order.customer_name}</p>
                    <p><strong>الهاتف:</strong> ${order.customer_phone}</p>
                    <p><strong>العنوان:</strong> ${order.customer_address}</p>
                    <p><strong>ملاحظات:</strong> ${order.notes || '-'}</p>
                </div>
                <div class="items">
                    <h3>الأصناف:</h3>
                    ${itemsHtml}
                </div>
                <div class="total">
                    الإجمالي: ${order.total_amount} ج.م
                </div>
                <script>
                    window.onload = function() { window.print(); window.close(); }
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(content);
        printWindow.document.close();
    }

    // ============================
    // 3. تفاصيل الطلب (Modal)
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
                <h3>الأصناف المطلوبة:</h3>
                <ul class="modal-items-list">
            `;

            if (items && items.length) {
                items.forEach(item => {
                    html += `
                        <li class="modal-item-row">
                            <span style="font-weight:bold; font-size:1.1rem;">${item.quantity}x ${item.name || "صنف"}</span>
                        </li>
                    `;
                });
            } else {
                html += '<li class="modal-item-row">لا توجد أصناف مسجلة.</li>';
            }

            html += `</ul>`;
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
            if (e.target === modal) modal.classList.remove("is-open");
        });
    }

    document.addEventListener("DOMContentLoaded", () => {
        checkAuth();
        initDashboard();
    });
})();
