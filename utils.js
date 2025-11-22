// utils.js
// دوال مساعدة مشتركة (Utilities)
// يتم استخدامها في جميع أنحاء المشروع

(function () {
    const CONFIG = window.APP_CONFIG || {};

    /**
     * مثيل واحد من Supabase Client (Singleton)
     */
    let supabaseClientInstance = null;

    /**
     * تهيئة والحصول على Supabase Client
     * @returns {Object} Supabase client instance
     */
    function getSupabaseClient() {
        if (supabaseClientInstance) {
            return supabaseClientInstance;
        }

        if (!window.supabase) {
            console.error("Supabase library not loaded");
            return null;
        }

        if (!CONFIG.supabase || !CONFIG.supabase.url || !CONFIG.supabase.anonKey) {
            console.error("Supabase configuration missing");
            return null;
        }

        supabaseClientInstance = window.supabase.createClient(
            CONFIG.supabase.url,
            CONFIG.supabase.anonKey
        );

        return supabaseClientInstance;
    }

    /**
     * تنسيق السعر بالعملة المحلية
     * @param {number} value - القيمة
     * @returns {string}
     */
    function formatPrice(value) {
        const currency = CONFIG.currency || { code: "EGP", label: "ج.م" };
        return `${Number(value).toFixed(2)} ${currency.label}`;
    }

    /**
     * تنسيق التاريخ والوقت بالعربية
     * @param {string|Date} date - التاريخ
     * @returns {string}
     */
    function formatDate(date) {
        const d = new Date(date);
        const options = {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        };
        return d.toLocaleDateString("ar-EG", options);
    }

    /**
     * تنسيق التاريخ فقط بدون الوقت
     * @param {string|Date} date - التاريخ
     * @returns {string}
     */
    function formatDateOnly(date) {
        const d = new Date(date);
        const options = { year: "numeric", month: "long", day: "numeric" };
        return d.toLocaleDateString("ar-EG", options);
    }

    /**
     * تنسيق الوقت فقط
     * @param {string|Date} date - التاريخ
     * @returns {string}
     */
    function formatTimeOnly(date) {
        const d = new Date(date);
        const options = { hour: "2-digit", minute: "2-digit" };
        return d.toLocaleTimeString("ar-EG", options);
    }

    /**
     * حساب الوقت المنقضي (منذ كم ساعة/يوم)
     * @param {string|Date} date - التاريخ
     * @returns {string}
     */
    function timeAgo(date) {
        const now = new Date();
        const past = new Date(date);
        const diffMs = now - past;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return "الآن";
        if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
        if (diffHours < 24) return `منذ ${diffHours} ساعة`;
        if (diffDays < 7) return `منذ ${diffDays} يوم`;
        return formatDateOnly(date);
    }

    /**
     * معالجة الأخطاء وعرضها للمستخدم
     * @param {Error} error - الخطأ
     * @param {string} userMessage - رسالة للمستخدم
     */
    function handleError(error, userMessage = "حدث خطأ غير متوقع") {
        console.error("Error:", error);

        // عرض رسالة للمستخدم
        if (window.showToast) {
            window.showToast(userMessage, "error");
        } else {
            alert(userMessage);
        }
    }

    /**
     * توليد معرف فريد (UUID بسيط)
     * @returns {string}
     */
    function generateId() {
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
            /[xy]/g,
            function (c) {
                const r = (Math.random() * 16) | 0;
                const v = c === "x" ? r : (r & 0x3) | 0x8;
                return v.toString(16);
            }
        );
    }

    /**
     * تأخير التنفيذ (Sleep/Delay)
     * @param {number} ms - المدة بالميلي ثانية
     * @returns {Promise}
     */
    function delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Debounce - تأخير تنفيذ دالة حتى يتوقف المستخدم عن الإدخال
     * @param {Function} func - الدالة
     * @param {number} wait - مدة الانتظار
     * @returns {Function}
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Throttle - تحديد عدد مرات تنفيذ دالة في فترة زمنية
     * @param {Function} func - الدالة
     * @param {number} limit - الحد الأقصى (بالميلي ثانية)
     * @returns {Function}
     */
    function throttle(func, limit) {
        let inThrottle;
        return function (...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => (inThrottle = false), limit);
            }
        };
    }

    /**
     * نسخ نص إلى الحافظة (Clipboard)
     * @param {string} text - النص
     * @returns {Promise<boolean>}
     */
    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            if (window.showToast) {
                window.showToast("تم النسخ ✓", "success");
            }
            return true;
        } catch (err) {
            console.error("Failed to copy:", err);
            return false;
        }
    }

    /**
     * فتح رابط WhatsApp
     * @param {string} phone - رقم الهاتف
     * @param {string} message - الرسالة
     */
    function openWhatsApp(phone, message = "") {
        const cleanPhone = phone.replace(/[^0-9]/g, "");
        const encodedMessage = encodeURIComponent(message);
        const url = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
        window.open(url, "_blank");
    }

    /**
     * التحقق من الاتصال بالإنترنت
     * @returns {boolean}
     */
    function isOnline() {
        return navigator.onLine;
    }

    /**
     * الحصول على معلومات الجهاز
     * @returns {Object}
     */
    function getDeviceInfo() {
        return {
            isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
                navigator.userAgent
            ),
            isTablet: /iPad|Android/i.test(navigator.userAgent) && !window.MSStream,
            isDesktop: !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
                navigator.userAgent
            ),
            platform: navigator.platform,
            userAgent: navigator.userAgent,
        };
    }

    /**
     * تخزين في LocalStorage بشكل آمن
     * @param {string} key - المفتاح
     * @param {any} value - القيمة
     */
    function setStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error("Failed to save to localStorage:", error);
        }
    }

    /**
     * قراءة من LocalStorage
     * @param {string} key - المفتاح
     * @param {any} defaultValue - القيمة الافتراضية
     * @returns {any}
     */
    function getStorage(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error("Failed to read from localStorage:", error);
            return defaultValue;
        }
    }

    /**
     * حذف من LocalStorage
     * @param {string} key - المفتاح
     */
    function removeStorage(key) {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.error("Failed to remove from localStorage:", error);
        }
    }

    /**
     * مسح كل LocalStorage
     */
    function clearStorage() {
        try {
            localStorage.clear();
        } catch (error) {
            console.error("Failed to clear localStorage:", error);
        }
    }

    /**
     * Escape HTML لمنع XSS
     * @param {string} text - النص
     * @returns {string}
     */
    function escapeHtml(text) {
        const map = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;",
        };
        return text.replace(/[&<>"']/g, (m) => map[m]);
    }

    /**
     * تحويل Object إلى Query String
     * @param {Object} obj - الكائن
     * @returns {string}
     */
    function objectToQueryString(obj) {
        return Object.keys(obj)
            .map(
                (key) => `${encodeURIComponent(key)}=${encodeURIComponent(obj[key])}`
            )
            .join("&");
    }

    /**
     * إنشاء loading spinner
     * @returns {HTMLElement}
     */
    function createSpinner() {
        const spinner = document.createElement("div");
        spinner.className = "spinner";
        spinner.innerHTML = `
      <div class="spinner-border" role="status">
        <span class="sr-only">جاري التحميل...</span>
      </div>
    `;
        spinner.style.cssText = `
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 2rem;
    `;
        return spinner;
    }

    // تصدير الدوال للاستخدام العام
    window.Utils = {
        // Supabase
        getSupabaseClient,

        // Formatting
        formatPrice,
        formatDate,
        formatDateOnly,
        formatTimeOnly,
        timeAgo,

        // Error Handling
        handleError,

        // Utilities
        generateId,
        delay,
        debounce,
        throttle,

        // Clipboard
        copyToClipboard,

        // External
        openWhatsApp,

        // Device
        isOnline,
        getDeviceInfo,

        // Storage
        setStorage,
        getStorage,
        removeStorage,
        clearStorage,

        // Security
        escapeHtml,

        // Misc
        objectToQueryString,
        createSpinner,
    };

    // اختصار للوصول السريع
    window.getSupabaseClient = getSupabaseClient;
})();
