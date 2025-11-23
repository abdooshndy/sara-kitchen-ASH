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

    // دالة الاتصال بالـ Backend أو Gemini مباشرة
    async function callAIFunction(userMessage) {
        const client = window.getSupabaseClient ? window.getSupabaseClient() : (window.supabase ? window.supabase.createClient(APP_CONFIG.supabase.url, APP_CONFIG.supabase.anonKey) : null);

        if (!client) {
            throw new Error("Supabase client not initialized");
        }

        try {
            // 1. محاولة الاتصال بـ Edge Function أولاً
            const { data, error } = await client.functions.invoke('ai-chat', {
                body: { message: userMessage }
            });

            if (!error && data && data.reply) {
                return data.reply;
            }

            // إذا فشل الاتصال بالدالة (مثلاً لم يتم رفعها)، نستخدم الحل البديل (Client-side)
            console.warn("Edge Function failed, falling back to client-side AI...");
            throw new Error("Function not deployed");

        } catch (err) {
            // 2. الحل البديل: الاتصال بـ Gemini مباشرة من المتصفح
            return await callGeminiDirectly(client, userMessage);
        }
    }

    // دالة الاتصال المباشر (Fallback)
    async function callGeminiDirectly(supabase, userMessage) {
        // أ. جلب المنيو
        const { data: products } = await supabase
            .from('products')
            .select('name, price, description, category, is_available')
            .eq('is_available', true);

        // ب. تجهيز السياق
        const menuContext = products && products.length > 0
            ? products.map(p => `- ${p.name} (${p.category}): ${p.price} جنيه. ${p.description || ''}`).join('\n')
            : 'لا توجد أصناف متاحة حالياً.';

        const systemPrompt = `
أنتِ "سارة"، شيف ماهرة ومساعدة ذكية في منصة "مطبخ سارة للأكل البيتي".
دورك هو مساعدة العملاء في اختيار وجبات لذيذة، الإجابة عن استفساراتهم حول المنيو، وتقديم اقتراحات.

قواعدك:
1. تحدثي باللهجة المصرية الودودة والمحترمة (مثل: "يا فندم"، "من عيوني"، "أحلى أكل بيتي").
2. اعتمدي فقط على قائمة الطعام المرفقة أدناه في إجاباتك. لا تخترعي أصناف غير موجودة.
3. إذا سأل العميل عن شيء غير موجود، اعتذري بلطف واقترحي بديلاً متاحاً.
4. حاولي دائماً تشجيع العميل على الطلب ("تحب أضيفه للسلة؟").
5. اجعلي إجاباتك قصيرة ومفيدة (لا تتجاوزي 3-4 جمل إلا عند الضرورة).

قائمة الطعام المتاحة اليوم:
${menuContext}
`;

        // ج. الاتصال بـ Gemini API
        // مفتاح جديد
        const API_KEY = 'AIzaSyBmQ7_VzJxQB4dZ7bGp0ZC5QlZxKN9FvOo'; // سأستخدم نفس المفتاح للتجربة، لكن سأضيف معالجة أخطاء أفضل لمعرفة السبب الحقيقي

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [
                        {
                            role: 'user',
                            parts: [{ text: systemPrompt + "\n\nسؤال العميل: " + userMessage }]
                        }
                    ],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 500,
                    }
                })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Gemini API Error Details:", errorText);
            throw new Error(`Gemini API Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    }

    // ============================
    // Drag & Drop للزر
    // ============================
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;
    let xOffset = 0;
    let yOffset = 0;

    // تحميل الموضع المحفوظ
    const savedPosition = localStorage.getItem('ai_chat_position');
    if (savedPosition) {
        const { x, y } = JSON.parse(savedPosition);
        trigger.style.transform = `translate(${x}px, ${y}px)`;
        xOffset = x;
        yOffset = y;
    }

    function dragStart(e) {
        // تجاهل السحب إذا كانت النافذة مفتوحة
        if (windowEl.classList.contains('open')) {
            return;
        }

        if (e.type === "touchstart") {
            initialX = e.touches[0].clientX - xOffset;
            initialY = e.touches[0].clientY - yOffset;
        } else {
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
        }

        if (e.target === trigger || trigger.contains(e.target)) {
            isDragging = true;
        }
    }

    function dragEnd(e) {
        if (!isDragging) return;

        initialX = currentX;
        initialY = currentY;

        isDragging = false;

        // حفظ الموضع
        localStorage.setItem('ai_chat_position', JSON.stringify({ x: xOffset, y: yOffset }));
    }

    function drag(e) {
        if (!isDragging) return;

        e.preventDefault();

        if (e.type === "touchmove") {
            currentX = e.touches[0].clientX - initialX;
            currentY = e.touches[0].clientY - initialY;
        } else {
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
        }

        xOffset = currentX;
        yOffset = currentY;

        setTranslate(currentX, currentY, trigger);
    }

    function setTranslate(xPos, yPos, el) {
        el.style.transform = `translate(${xPos}px, ${yPos}px)`;
    }

    // Event listeners للسحب
    trigger.addEventListener("mousedown", dragStart);
    trigger.addEventListener("touchstart", dragStart);

    document.addEventListener("mouseup", dragEnd);
    document.addEventListener("touchend", dragEnd);

    document.addEventListener("mousemove", drag);
    document.addEventListener("touchmove", drag);

})();
