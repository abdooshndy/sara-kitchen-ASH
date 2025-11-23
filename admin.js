// admin.js
// منطق لوحة تحكم الأدمن (طلبات + منتجات + تصنيفات)

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
            const { data: authData, error } = await client.auth.signInWithPassword({ email, password });

            if (error) {
                console.error("Login error:", error);
                errorEl.textContent = "فشل الدخول: تأكد من البيانات.";
                btn.disabled = false;
                btn.textContent = "دخول";
            } else {
                // جلب دور المستخدم وتوجيهه للصفحة المناسبة
                const { data: profile } = await client
                    .from("profiles")
                    .select("role")
                    .eq("id", authData.user.id)
                    .single();

                if (profile) {
                    showToast("تم تسجيل الدخول بنجاح", "success");

                    // توجيه حسب الدور
                    if (profile.role === "admin") {
                        window.location.href = "admin-dashboard.html";
                    } else if (profile.role === "cook") {
                        window.location.href = "kitchen.html";
                    } else if (profile.role === "driver") {
                        window.location.href = "driver.html";
                    } else {
                        // العميل
                        window.location.href = "index.html";
                    }
                } else {
                    errorEl.textContent = "فشل تحميل بيانات المستخدم.";
                    btn.disabled = false;
                    btn.textContent = "دخول";
                }
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
        setupSubTabs();

        // تحميل البيانات الأولية
        await loadStats(client);
        await loadOrders(client);
        await loadProducts(client);
        await loadCategories(client);
        await loadUsers(client);

        // إعداد المودالات
        setupProductModal(client);
        setupCategoryModal(client);
        setupModalClose();

        // إعداد مساعد تيليجرام
        setupTelegramHelper();
    }

    // ============================
    // 3.7 مساعد تيليجرام (جديد)
    // ============================
    function setupTelegramHelper() {
        const checkBtn = document.getElementById("check-telegram-updates-btn");
        const tokenInput = document.getElementById("telegram-bot-token-check");
        const resultContainer = document.getElementById("telegram-ids-result");
        const savedContainer = document.createElement("div");
        savedContainer.id = "saved-telegram-chats";
        savedContainer.style.marginTop = "1.5rem";
        savedContainer.style.borderTop = "1px solid #eee";
        savedContainer.style.paddingTop = "1rem";

        if (!checkBtn || !tokenInput || !resultContainer) return;

        // إضافة حاوية القائمة المحفوظة
        resultContainer.parentNode.appendChild(savedContainer);

        // محاولة تعبئة التوكن من الكونفيج لو موجود
        if (CONFIG.telegram && CONFIG.telegram.botToken && CONFIG.telegram.botToken !== "YOUR_BOT_TOKEN_HERE") {
            tokenInput.value = CONFIG.telegram.botToken;
            loadSavedChats(savedContainer); // تحميل القائمة المحفوظة عند البدء
        }

        checkBtn.addEventListener("click", async () => {
            const token = tokenInput.value.trim();
            if (!token) {
                alert("من فضلك أدخل Bot Token");
                return;
            }

            checkBtn.disabled = true;
            checkBtn.textContent = "جاري البحث...";
            resultContainer.innerHTML = '<p class="loading">جاري الاتصال بتيليجرام...</p>';
            resultContainer.style.maxHeight = "200px"; // تصغير المربع
            resultContainer.style.overflowY = "auto";

            try {
                const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
                const data = await response.json();

                if (!data.ok) {
                    throw new Error(data.description || "فشل الاتصال");
                }

                const updates = data.result;
                if (!updates || !updates.length) {
                    resultContainer.innerHTML = '<p style="color: orange;">لا توجد رسائل جديدة. تأكد من إرسال رسالة للبوت أولاً.</p>';
                    checkBtn.disabled = false;
                    checkBtn.textContent = "جلب المعرفات";
                    return;
                }

                // استخراج الـ Chat IDs الفريدة
                const chats = new Map();
                updates.forEach(update => {
                    if (update.message && update.message.chat) {
                        const chat = update.message.chat;
                        chats.set(chat.id, {
                            id: chat.id,
                            name: `${chat.first_name || ''} ${chat.last_name || ''}`.trim() || chat.title || 'Unknown',
                            username: chat.username ? `@${chat.username}` : '-'
                        });
                    }
                });

                if (chats.size === 0) {
                    resultContainer.innerHTML = '<p>لم يتم العثور على محادثات.</p>';
                } else {
                    let html = '<table class="admin-table" style="width:100%; font-size:0.9rem;">';
                    html += '<thead><tr><th>الاسم</th><th>ID</th><th>إجراء</th></tr></thead><tbody>';

                    chats.forEach(chat => {
                        html += `
                            <tr>
                                <td>${chat.name}</td>
                                <td style="font-family:monospace;">${chat.id}</td>
                                <td>
                                    <button class="btn btn-sm btn-primary save-chat-btn" data-id="${chat.id}" data-name="${chat.name}" style="padding: 2px 8px; font-size: 0.8rem;">
                                        حفظ
                                    </button>
                                </td>
                            </tr>
                        `;
                    });

                    html += '</tbody></table>';
                    resultContainer.innerHTML = html;

                    // تفعيل أزرار الحفظ التلقائي
                    resultContainer.querySelectorAll('.save-chat-btn').forEach(btn => {
                        btn.addEventListener('click', async () => {
                            const chatId = btn.dataset.id;
                            const chatName = btn.dataset.name;
                            await saveTelegramChatId(chatId, chatName, btn);
                            loadSavedChats(savedContainer); // تحديث القائمة المحفوظة
                        });
                    });
                }

            } catch (err) {
                console.error(err);
                resultContainer.innerHTML = `<p class="error">حدث خطأ: ${err.message}</p>`;
            } finally {
                checkBtn.disabled = false;
                checkBtn.textContent = "جلب المعرفات";
            }
        });
    }

    async function loadSavedChats(container) {
        container.innerHTML = '<p class="loading">جاري تحميل القائمة المحفوظة...</p>';
        try {
            const client = initSupabase();
            const { data: setting } = await client
                .from('system_settings')
                .select('value')
                .eq('key', 'telegram_config')
                .single();

            if (!setting || !setting.value || !setting.value.chatIds || !setting.value.chatIds.length) {
                container.innerHTML = '<p style="color:#666; font-size:0.9rem;">لا توجد معرفات محفوظة حالياً.</p>';
                return;
            }

            // تنظيف البيانات (تحويل النصوص القديمة لكائنات وتعيين دور افتراضي)
            let chatIds = setting.value.chatIds.map(c => {
                if (typeof c === 'string') return { id: c, name: 'مستخدم', role: 'admin' };
                if (!c.role) c.role = 'admin'; // تعيين افتراضي إذا كان مفقوداً
                return c;
            });

            let html = '<h4 style="margin-bottom:0.5rem; font-size:1rem;">المعرفات المحفوظة:</h4>';
            html += '<ul style="list-style:none; padding:0;">';

            chatIds.forEach((chat, index) => {
                html += `
                    <li style="display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; background:#fff; padding:8px 10px; margin-bottom:5px; border:1px solid #eee; border-radius:4px;">
                        <div style="margin-bottom:5px;">
                            <strong>${chat.name}</strong> <span style="font-family:monospace; color:#666; font-size:0.85rem;">(${chat.id})</span>
                        </div>
                        <div style="display:flex; gap:5px; align-items:center;">
                            <select class="form-input role-select" data-index="${index}" style="padding:2px 5px; font-size:0.85rem; width:auto;">
                                <option value="admin" ${chat.role === 'admin' ? 'selected' : ''}>أدمن</option>
                                <option value="cook" ${chat.role === 'cook' ? 'selected' : ''}>طباخ</option>
                                <option value="driver" ${chat.role === 'driver' ? 'selected' : ''}>سائق</option>
                            </select>
                            <button class="btn btn-sm btn-outline test-chat-btn" data-id="${chat.id}" data-role="${chat.role}" style="padding: 2px 8px; font-size: 0.8rem;">تجربة 🔔</button>
                            <button class="btn btn-sm btn-danger delete-chat-btn" data-id="${chat.id}" style="padding: 2px 8px; font-size: 0.8rem;">حذف</button>
                        </div>
                    </li>
                `;
            });
            html += '</ul>';
            html += '<button id="save-roles-btn" class="btn btn-primary btn-sm" style="margin-top:10px; width:100%;">حفظ التغييرات</button>';

            container.innerHTML = html;

            // تفعيل أزرار الحذف
            container.querySelectorAll('.delete-chat-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (confirm("هل أنت متأكد من حذف هذا المعرف؟")) {
                        await deleteTelegramChatId(btn.dataset.id);
                        loadSavedChats(container);
                    }
                });
            });

            // تفعيل أزرار التجربة
            container.querySelectorAll('.test-chat-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const chatId = btn.dataset.id;
                    const role = btn.dataset.role;
                    btn.disabled = true;
                    btn.textContent = "جاري الإرسال...";

                    try {
                        const client = initSupabase();
                        const { data: setting } = await client.from('system_settings').select('value').eq('key', 'telegram_config').single();
                        if (!setting || !setting.value || !setting.value.botToken) {
                            alert("لم يتم العثور على Bot Token.");
                            return;
                        }

                        const botToken = setting.value.botToken;
                        const message = `🔔 *تجربة إشعار*\n\nمرحباً! هذا اختبار للإشعارات.\nالدور الحالي: ${role}`;

                        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                chat_id: chatId,
                                text: message,
                                parse_mode: 'Markdown'
                            })
                        });

                        const result = await response.json();
                        if (result.ok) {
                            alert("تم إرسال الرسالة بنجاح! ✅");
                        } else {
                            alert(`فشل الإرسال: ${result.description}`);
                        }
                    } catch (err) {
                        console.error(err);
                        alert(`حدث خطأ: ${err.message}`);
                    } finally {
                        btn.disabled = false;
                        btn.textContent = "تجربة 🔔";
                    }
                });
            });

            // تفعيل زر حفظ الأدوار
            const saveRolesBtn = document.getElementById('save-roles-btn');
            if (saveRolesBtn) {
                saveRolesBtn.addEventListener('click', async () => {
                    saveRolesBtn.disabled = true;
                    saveRolesBtn.textContent = "جاري التحديث...";

                    const selects = container.querySelectorAll('.role-select');
                    // نعيد قراءة الإعدادات لضمان عدم الكتابة على بيانات قديمة
                    // لكن للتبسيط سنستخدم النسخة المحلية المعدلة
                    const newChatIds = JSON.parse(JSON.stringify(chatIds)); // Deep copy

                    selects.forEach(sel => {
                        const idx = parseInt(sel.dataset.index);
                        if (newChatIds[idx]) {
                            newChatIds[idx].role = sel.value;
                        }
                    });

                    try {
                        const client = initSupabase();
                        // نحتاج لجلب الإعدادات الحالية مرة أخرى لتحديثها
                        let { data: currentSetting } = await client.from('system_settings').select('value').eq('key', 'telegram_config').single();
                        let config = currentSetting ? currentSetting.value : { botToken: "", chatIds: [] };

                        config.chatIds = newChatIds;

                        const { error } = await client
                            .from('system_settings')
                            .update({ value: config, updated_at: new Date().toISOString() })
                            .eq('key', 'telegram_config');

                        if (error) throw error;
                        alert("تم تحديث الصلاحيات بنجاح! ✅");
                    } catch (err) {
                        console.error(err);
                        alert(`حدث خطأ أثناء التحديث: ${err.message || err}`);
                    } finally {
                        saveRolesBtn.disabled = false;
                        saveRolesBtn.textContent = "حفظ التغييرات";
                    }
                });
            }

        } catch (err) {
            console.error("Error loading saved chats:", err);
            container.innerHTML = '<p class="error">فشل تحميل القائمة المحفوظة.</p>';
        }
    }

    async function deleteTelegramChatId(chatId) {
        try {
            const client = initSupabase();
            let { data: setting } = await client
                .from('system_settings')
                .select('value')
                .eq('key', 'telegram_config')
                .single();

            if (!setting) return;

            let config = setting.value;
            if (!config.chatIds) return;

            // تصفية المصفوفة
            config.chatIds = config.chatIds.filter(c => {
                if (typeof c === 'string') return String(c) !== String(chatId);
                return String(c.id) !== String(chatId);
            });

            const { error } = await client
                .from('system_settings')
                .update({ value: config, updated_at: new Date().toISOString() })
                .eq('key', 'telegram_config');

            if (error) throw error;

        } catch (err) {
            console.error("Error deleting chat ID:", err);
            alert(`حدث خطأ أثناء الحذف: ${err.message || err}`);
        }
    }

    async function saveTelegramChatId(chatId, chatName, btn) {
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = "جاري الحفظ...";

        try {
            const client = initSupabase();

            // 1. جلب الإعدادات الحالية
            let { data: setting } = await client
                .from('system_settings')
                .select('value')
                .eq('key', 'telegram_config')
                .single();

            let config = setting ? setting.value : { botToken: "", chatIds: [] };

            // التأكد من وجود المصفوفة
            if (!config.chatIds) config.chatIds = [];

            // تنظيف المصفوفة من أي قيم نصية قديمة وتحويلها لكائنات
            config.chatIds = config.chatIds.map(c => {
                if (typeof c === 'string') return { id: c, name: 'مستخدم', role: 'admin' };
                return c;
            });

            // التحقق مما إذا كان المعرف موجوداً بالفعل
            // نستخدم String comparison للأمان
            const existingIndex = config.chatIds.findIndex(c => String(c.id) === String(chatId));

            const role = 'admin';

            if (existingIndex !== -1) {
                // إذا كان موجوداً، نحدث الاسم فقط
                config.chatIds[existingIndex].name = chatName;
                // لا نغير الدور إذا كان موجوداً
            } else {
                // إضافة جديد
                config.chatIds.push({ id: String(chatId), name: chatName, role: role });
            }

            // تحديث التوكن أيضاً إذا كان مدخلاً
            const tokenInput = document.getElementById("telegram-bot-token-check");
            if (tokenInput && tokenInput.value) {
                config.botToken = tokenInput.value.trim();
            }

            // 2. حفظ الإعدادات الجديدة
            const { error } = await client
                .from('system_settings')
                .upsert({
                    key: 'telegram_config',
                    value: config,
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;

            alert(`تم إضافة ${chatName} لقائمة الإشعارات بنجاح! 🎉`);
            btn.textContent = "تم الحفظ ✅";

        } catch (err) {
            console.error("Error saving chat ID:", err);
            alert("فشل الحفظ في قاعدة البيانات.");
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }

    // متغير لتخزين المستخدمين للبحث المحلي
    let allUsers = [];

    async function loadUsers(client) {
        const container = document.getElementById("admin-users-container");
        const searchInput = document.getElementById("user-search-input");
        if (!container) return;

        container.innerHTML = '<p class="loading">جاري تحميل المستخدمين...</p>';

        try {
            const { data: users, error } = await client
                .from("profiles")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;

            allUsers = users || []; // حفظ نسخة للبحث
            renderUsers(client, allUsers);

            // تفعيل البحث
            if (searchInput) {
                searchInput.addEventListener("input", (e) => {
                    const query = e.target.value.toLowerCase();
                    const filtered = allUsers.filter(u =>
                        (u.full_name && u.full_name.toLowerCase().includes(query)) ||
                        (u.phone && u.phone.includes(query))
                    );
                    renderUsers(client, filtered);
                });
            }

        } catch (err) {
            console.error("Error loading users:", err);
            container.innerHTML = '<p class="error">حدث خطأ أثناء تحميل المستخدمين (تأكد من الصلاحيات).</p>';
        }
    }

    async function renderUsers(client, usersList) {
        const container = document.getElementById("admin-users-container");
        container.innerHTML = "";

        if (!usersList || !usersList.length) {
            container.innerHTML = '<p>لا يوجد مستخدمين مطابقين.</p>';
            return;
        }

        const { data: { session } } = await client.auth.getSession();
        const currentUserId = session?.user?.id;

        usersList.forEach((user) => {
            const card = createUserCard(user, client, currentUserId);
            container.appendChild(card);
        });
    }

    function createUserCard(user, client, currentUserId) {
        const div = document.createElement("div");
        div.className = "admin-order-card";

        const isSelf = user.id === currentUserId;
        const roleColors = {
            'admin': '#c0392b',
            'cook': '#d35400',
            'driver': '#2980b9',
            'customer': '#27ae60'
        };

        div.innerHTML = `
            <div class="order-header">
                <h3>${user.full_name || 'مستخدم بدون اسم'}</h3>
                <span class="status-badge" style="background-color: ${roleColors[user.role] || '#7f8c8d'}">${user.role}</span>
            </div>
            <div class="order-details">
                <p><strong>الهاتف:</strong> ${user.phone || '-'}</p>
                <p><strong>تاريخ التسجيل:</strong> ${new Date(user.created_at).toLocaleDateString('ar-EG')}</p>
            </div>
            <div class="order-actions">
                <label>تغيير الصلاحية:</label>
                <select class="role-select" data-id="${user.id}" ${isSelf ? 'disabled' : ''}>
                    <option value="customer" ${user.role === 'customer' ? 'selected' : ''}>زبون (Customer)</option>
                    <option value="driver" ${user.role === 'driver' ? 'selected' : ''}>سائق (Driver)</option>
                    <option value="cook" ${user.role === 'cook' ? 'selected' : ''}>طباخ (Cook)</option>
                    <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>أدمن (Admin)</option>
                </select>
                ${isSelf ? '<small style="color:red; display:block;">لا يمكنك تغيير صلاحياتك</small>' : ''}
            </div>
        `;

        if (!isSelf) {
            const select = div.querySelector(".role-select");
            select.addEventListener("change", async (e) => {
                const newRole = e.target.value;
                if (confirm(`هل أنت متأكد من تغيير صلاحية "${user.full_name}" إلى ${newRole}؟`)) {
                    await updateUserRole(client, user.id, newRole);
                } else {
                    // إعادة القيمة السابقة عند الإلغاء
                    e.target.value = user.role;
                }
            });
        }

        return div;
    }

    async function updateUserRole(client, userId, newRole) {
        try {
            const { error } = await client.from("profiles").update({ role: newRole }).eq("id", userId);
            if (error) throw error;
            showToast(`تم تحديث الصلاحية إلى ${newRole}`, "success");
            loadUsers(client); // تحديث القائمة
        } catch (err) {
            console.error("Error updating role:", err);
            showToast("فشل تحديث الصلاحية", "error");
        }
    }

    // ============================
    // دوال مساعدة للإشعارات (نسخة محلية للأدمن)
    // ============================
    function formatPrice(amount) {
        return new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' }).format(amount);
    }

    async function sendDriverNotification(order) {
        // محاولة جلب الإعدادات
        let telegramConfig = CONFIG.telegram;
        try {
            const client = initSupabase();
            if (client) {
                const { data: setting } = await client.from('system_settings').select('value').eq('key', 'telegram_config').single();
                if (setting && setting.value) telegramConfig = setting.value;
            }
        } catch (e) { console.error(e); }

        if (!telegramConfig || !telegramConfig.botToken || !telegramConfig.chatIds) return;

        const { botToken, chatIds } = telegramConfig;

        // تجهيز الرسالة
        let message = `🚗 *طلب جاهز للتوصيل!* (#${order.order_code})\n\n`;
        message += `👤 *العميل:* ${order.customer_name}\n`;
        message += `📱 *الهاتف:* ${order.customer_phone}\n`;
        message += `📍 *العنوان:* ${order.customer_address}\n`;

        // رابط الموقع (Google Maps) لو العنوان يحتوي على رابط
        if (order.customer_address && order.customer_address.includes('http')) {
            message += `🗺 [فتح الموقع على الخريطة](${order.customer_address})\n`;
        }

        message += `\n💰 *المطلوب تحصيله:* ${formatPrice(order.total_amount)}\n`;

        if (order.notes) message += `📝 *ملاحظات:* ${order.notes}\n`;

        message += `\n✅ الرجاء تأكيد الاستلام من المطبخ.`;

        // إرسال للسائقين فقط
        if (Array.isArray(chatIds)) {
            chatIds.forEach(async (chat) => {
                let id = typeof chat === 'string' ? chat : chat.id;
                let role = typeof chat === 'string' ? 'admin' : (chat.role || 'admin');

                if (role === 'driver' || role === 'admin') {
                    try {
                        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                chat_id: id,
                                text: message,
                                parse_mode: 'Markdown'
                            })
                        });
                    } catch (err) { console.error(`Failed to send to ${id}`, err); }
                }
            });
        }
    }

    // ============================
    // 3.5 الإحصائيات
    // ============================
    async function loadStats(client) {
        const ordersEl = document.getElementById("admin-metric-orders-today");
        const salesEl = document.getElementById("admin-metric-sales-today");
        if (!ordersEl || !salesEl) return;

        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayISO = today.toISOString();

            const { data: orders, error } = await client
                .from("orders")
                .select("total_amount, status")
                .gte("created_at", todayISO)
                .neq("status", "CANCELLED");

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
                document.querySelectorAll('.tab-btn').forEach(t => {
                    t.classList.remove('active');
                    t.style.borderBottom = '3px solid transparent';
                });
                document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');

                tab.classList.add('active');
                const targetId = tab.dataset.target;
                document.getElementById(targetId).style.display = 'block';
            });
        });
    }

    function setupSubTabs() {
        const tabs = document.querySelectorAll('.sub-tab-btn');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault(); // منع أي سلوك افتراضي

                // إزالة التنشيط من الكل
                document.querySelectorAll('.sub-tab-btn').forEach(t => {
                    t.classList.remove('active');
                    t.classList.remove('btn-primary'); // إذا كنت تستخدم كلاسات بوتستراب
                    t.classList.add('btn-outline');
                });
                document.querySelectorAll('.sub-tab-content').forEach(c => c.style.display = 'none');

                // تنشيط التبويب المختار
                tab.classList.add('active');
                tab.classList.remove('btn-outline');
                // tab.classList.add('btn-primary'); // اختياري

                const targetId = tab.dataset.target;
                const targetEl = document.getElementById(targetId);
                if (targetEl) {
                    targetEl.style.display = 'block';
                }
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

            // إرسال إشعار للسائق إذا أصبحت الحالة "مع المندوب"
            if (newStatus === "WITH_DRIVER") {
                console.log("Status changed to WITH_DRIVER. Fetching full order details...");
                // نحتاج تفاصيل الطلب كاملة
                const { data: fullOrder } = await client.from('orders').select('*').eq('id', orderId).single();
                if (fullOrder) {
                    console.log("Full order fetched:", fullOrder);
                    await sendDriverNotification(fullOrder);
                } else {
                    console.error("Failed to fetch full order details.");
                }
            }

        } catch (err) {
            console.error("Error updating status:", err);
            showToast("فشل تحديث الحالة", "error");
        }
    }

    // ============================
    // دوال مساعدة للإشعارات (نسخة محلية للأدمن)
    // ============================
    function formatPrice(amount) {
        return new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' }).format(amount);
    }

    async function sendDriverNotification(order) {
        console.log("Starting sendDriverNotification for order:", order.id);
        // محاولة جلب الإعدادات
        let telegramConfig = CONFIG.telegram;
        try {
            const client = initSupabase();
            if (client) {
                const { data: setting } = await client.from('system_settings').select('value').eq('key', 'telegram_config').single();
                if (setting && setting.value) telegramConfig = setting.value;
            }
        } catch (e) { console.error("Error fetching config:", e); }

        if (!telegramConfig || !telegramConfig.botToken || !telegramConfig.chatIds) {
            console.error("Missing Telegram config:", telegramConfig);
            return;
        }

        const { botToken, chatIds } = telegramConfig;
        console.log("Loaded Chat IDs:", chatIds);

        // تجهيز الرسالة
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

        // إرسال للسائقين فقط
        if (Array.isArray(chatIds)) {
            chatIds.forEach(async (chat) => {
                let id = typeof chat === 'string' ? chat : chat.id;
                let role = typeof chat === 'string' ? 'admin' : (chat.role || 'admin');

                console.log(`Checking chat ${id} with role ${role}`);

                if (role === 'driver' || role === 'admin') {
                    console.log(`Sending to ${role} (${id})...`);
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
                        console.log(`Send result for ${id}:`, json);
                    } catch (err) { console.error(`Failed to send to ${id}`, err); }
                } else {
                    console.log(`Skipping ${id} (Role: ${role})`);
                }
            });
        }
    }

    // ============================
    // 5. إدارة المنتجات
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
        div.className = "admin-order-card";

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

        div.querySelector('.edit-product-btn').addEventListener('click', () => {
            openProductModal(client, product);
        });

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
            loadProducts(client);
        } catch (err) {
            console.error("Error deleting product:", err);
            showToast("فشل حذف المنتج", "error");
        }
    }

    // ============================
    // 6. إدارة التصنيفات (جديد)
    // ============================
    async function loadCategories(client) {
        const container = document.getElementById("admin-categories-container");
        if (!container) return;

        container.innerHTML = '<p class="loading">جاري تحميل التصنيفات...</p>';

        try {
            const { data: categories, error } = await client
                .from("categories")
                .select("*")
                .order("created_at", { ascending: false });

            if (error) throw error;

            container.innerHTML = "";
            if (!categories || !categories.length) {
                container.innerHTML = '<p>لا توجد تصنيفات. أضف تصنيفاً جديداً!</p>';
                return;
            }

            categories.forEach((cat) => {
                const card = createCategoryCard(cat, client);
                container.appendChild(card);
            });
        } catch (err) {
            console.error("Error loading categories:", err);
            container.innerHTML = '<p class="error">حدث خطأ أثناء تحميل التصنيفات.</p>';
        }
    }

    function createCategoryCard(category, client) {
        const div = document.createElement("div");
        div.className = "admin-order-card";

        div.innerHTML = `
            <div class="order-header">
                <h3>${category.name}</h3>
            </div>
            <div class="order-actions">
                <button class="btn btn-sm btn-primary edit-category-btn">تعديل ✏️</button>
                <button class="btn btn-sm btn-danger delete-category-btn">حذف 🗑️</button>
            </div>
        `;

        div.querySelector('.edit-category-btn').addEventListener('click', () => {
            openCategoryModal(category);
        });

        div.querySelector('.delete-category-btn').addEventListener('click', async () => {
            if (confirm(`هل أنت متأكد من حذف تصنيف "${category.name}"؟`)) {
                await deleteCategory(client, category.id);
            }
        });

        return div;
    }

    async function deleteCategory(client, categoryId) {
        try {
            const { error } = await client.from('categories').delete().eq('id', categoryId);
            if (error) throw error;
            showToast("تم حذف التصنيف بنجاح", "success");
            loadCategories(client);
        } catch (err) {
            console.error("Error deleting category:", err);
            showToast("فشل حذف التصنيف (قد يكون مرتبطاً بمنتجات)", "error");
        }
    }

    // ============================
    // 7. المودالات (Modals)
    // ============================

    // --- Product Modal ---
    function setupProductModal(client) {
        const modal = document.getElementById("product-modal");
        const addBtn = document.getElementById("add-product-btn");
        const form = document.getElementById("product-form");

        if (!modal || !form) return;

        if (addBtn) {
            addBtn.addEventListener("click", () => {
                openProductModal(client, null);
            });
        }

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
                    const { error } = await client.from("products").update(productData).eq("id", id);
                    if (error) throw error;
                    showToast("تم تحديث المنتج بنجاح", "success");
                } else {
                    const { error } = await client.from("products").insert(productData);
                    if (error) throw error;
                    showToast("تم إضافة المنتج بنجاح", "success");
                }
                modal.classList.remove("is-open");
                loadProducts(client);
            } catch (err) {
                console.error("Error saving product:", err);
                showToast("حدث خطأ أثناء الحفظ", "error");
            }
        });
    }

    async function openProductModal(client, product) {
        const modal = document.getElementById("product-modal");
        const title = document.getElementById("product-modal-title");
        const categorySelect = document.getElementById("product-category");

        // تحميل التصنيفات ديناميكياً
        try {
            const { data: categories, error } = await client.from("categories").select("name");

            if (error) throw error;

            categorySelect.innerHTML = '<option value="">-- اختر التصنيف --</option>';

            if (categories && categories.length) {
                categories.forEach(cat => {
                    const option = document.createElement("option");
                    option.value = cat.name;
                    option.textContent = cat.name;
                    categorySelect.appendChild(option);
                });
            } else {
                const option = document.createElement("option");
                option.value = "";
                option.textContent = "لا توجد تصنيفات (أضف تصنيفاً أولاً)";
                categorySelect.appendChild(option);
            }
        } catch (err) {
            console.error("Error loading categories for modal", err);
            categorySelect.innerHTML = '<option value="">فشل تحميل التصنيفات</option>';
        }

        document.getElementById("product-id").value = product ? product.id : "";
        document.getElementById("product-name").value = product ? product.name : "";
        document.getElementById("product-price").value = product ? product.price : "";
        document.getElementById("product-category").value = product ? product.category : "";
        document.getElementById("product-desc").value = product ? product.description || "" : "";
        document.getElementById("product-available").checked = product ? product.is_available : true;

        title.textContent = product ? "تعديل منتج" : "إضافة منتج جديد";
        modal.classList.add("is-open");
    }

    // --- Category Modal ---
    function setupCategoryModal(client) {
        const modal = document.getElementById("category-modal");
        const addBtn = document.getElementById("add-category-btn");
        const form = document.getElementById("category-form");

        if (!modal || !form) return;

        if (addBtn) {
            addBtn.addEventListener("click", () => {
                openCategoryModal(null);
            });
        }

        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const id = document.getElementById("category-id").value;
            const name = document.getElementById("category-name").value;

            try {
                if (id) {
                    const { error } = await client.from("categories").update({ name }).eq("id", id);
                    if (error) throw error;
                    showToast("تم تحديث التصنيف بنجاح", "success");
                } else {
                    const { error } = await client.from("categories").insert({ name });
                    if (error) throw error;
                    showToast("تم إضافة التصنيف بنجاح", "success");
                }
                modal.classList.remove("is-open");
                loadCategories(client);
            } catch (err) {
                console.error("Error saving category:", err);
                showToast("حدث خطأ أثناء الحفظ", "error");
            }
        });
    }

    function openCategoryModal(category) {
        const modal = document.getElementById("category-modal");
        const title = document.getElementById("category-modal-title");

        document.getElementById("category-id").value = category ? category.id : "";
        document.getElementById("category-name").value = category ? category.name : "";

        title.textContent = category ? "تعديل تصنيف" : "إضافة تصنيف جديد";
        modal.classList.add("is-open");
    }

    // --- General Modal Close ---
    function setupModalClose() {
        const modals = document.querySelectorAll(".modal-overlay");
        modals.forEach(modal => {
            const closeBtn = modal.querySelector(".modal-close");
            if (closeBtn) {
                closeBtn.addEventListener("click", () => modal.classList.remove("is-open"));
            }
            modal.addEventListener("click", (e) => {
                if (e.target === modal) modal.classList.remove("is-open");
            });
        });
    }

    // ============================
    // 8. تفاصيل الطلب (Modal)
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

    // ============================
    // 9. التشغيل عند التحميل
    // ============================
    document.addEventListener("DOMContentLoaded", () => {
        checkAuth();
        const page = document.body.dataset.page;
        if (page === "admin-login") {
            setupLogin();
        } else if (page === "admin-dashboard") {
            initDashboard();
        }
    });
})();
