// ai-chat.js
// منطق المساعد الذكي

(function () {
    // حقن HTML في الصفحة
    const chatHTML = `
        <div class="ai-chat-trigger" id="ai-chat-trigger">
            <div class="ai-chat-icon">🤖</div>
        </div>
        <div class="ai-chat-window" id="ai-chat-window">
            <div class="ai-chat-header">
                <div class="ai-chat-title">
                    <span>👩‍🍳</span> الشيف سارة (AI)
                </div>
                <button class="ai-chat-close" id="ai-chat-close">&times;</button>
            </div>
            <div class="ai-chat-messages" id="ai-chat-messages">
                <div class="message bot">
                    أهلاً بك في مطبخ سارة! 🥘<br>
                    أنا مساعدك الذكي، اسألني عن المنيو، أو اطلب مني اقتراح أكلة لذيذة!
                </div>
            </div>
            <form class="ai-chat-input-area" id="ai-chat-form">
                <input type="text" class="ai-chat-input" id="ai-chat-input" placeholder="اكتب رسالتك هنا..." autocomplete="off">
                <button type="submit" class="ai-chat-send" id="ai-chat-send">
                    ➤
                </button>
            </form>
        </div>
    `;

    // إضافة الـ HTML والـ CSS للصفحة
    const container = document.createElement('div');
    container.innerHTML = chatHTML;
    document.body.appendChild(container);

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'ai-chat.css';
    document.head.appendChild(link);

    // العناصر
    const trigger = document.getElementById('ai-chat-trigger');
    const windowEl = document.getElementById('ai-chat-window');
    const closeBtn = document.getElementById('ai-chat-close');
    const form = document.getElementById('ai-chat-form');
    const input = document.getElementById('ai-chat-input');
    const messagesContainer = document.getElementById('ai-chat-messages');

    // فتح/إغلاق
    function toggleChat() {
        windowEl.classList.toggle('open');
        if (windowEl.classList.contains('open')) {
            input.focus();
        }
    }

    trigger.addEventListener('click', toggleChat);
    closeBtn.addEventListener('click', toggleChat);

    // إرسال الرسالة
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;

        // إضافة رسالة المستخدم
        addMessage(text, 'user');
        input.value = '';

        // مؤشر الكتابة
        const typingId = addTypingIndicator();

        try {
            // استدعاء الـ AI
            const response = await callAIFunction(text);

            // إزالة المؤشر وإضافة الرد
            removeMessage(typingId);
            addMessage(response, 'bot');
        } catch (err) {
            console.error(err);
            removeMessage(typingId);
            addMessage("عذراً، حدث خطأ في الاتصال. حاول مرة أخرى.", 'bot');
        }
    });

    function addMessage(text, sender) {
        const div = document.createElement('div');
        div.className = `message ${sender}`;
        div.innerHTML = text.replace(/\n/g, '<br>'); // دعم الأسطر الجديدة
        messagesContainer.appendChild(div);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        return div.id = 'msg-' + Date.now();
    }

    function addTypingIndicator() {
        const div = document.createElement('div');
        div.className = 'message typing';
        div.textContent = 'جاري الكتابة...';
        div.id = 'typing-' + Date.now();
        messagesContainer.appendChild(div);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        return div.id;
    }

    function removeMessage(id) {
        const el = document.getElementById(id);
        if (el) el.remove();
    }

    // دالة الاتصال بالـ Backend
    async function callAIFunction(userMessage) {
        const client = window.getSupabaseClient ? window.getSupabaseClient() : (window.supabase ? window.supabase.createClient(APP_CONFIG.supabase.url, APP_CONFIG.supabase.anonKey) : null);

        if (!client) {
            throw new Error("Supabase client not initialized");
        }

        const { data, error } = await client.functions.invoke('ai-chat', {
            body: { message: userMessage }
        });

        if (error) {
            console.error("Edge Function Error:", error);
            throw error;
        }

        return data.reply;
    }

})();
