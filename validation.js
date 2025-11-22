// validation.js
// دوال التحقق من صحة البيانات (Validation)
// استخدمها قبل إرسال البيانات للسيرفر

(function () {
    /**
     * مجموعة من دوال الـ Validation الشائعة
     */
    const Validators = {
        /**
         * التحقق من رقم الهاتف
         * @param {string} phone - رقم الهاتف
         * @returns {boolean}
         */
        phone: function (phone) {
            if (!phone || typeof phone !== "string") return false;
            // إزالة المسافات والرموز
            const cleaned = phone.replace(/[\s\-\(\)]/g, "");
            // التحقق من أن الرقم بين 10 و 15 رقم
            return /^[0-9]{10,15}$/.test(cleaned);
        },

        /**
         * التحقق من المبلغ المالي
         * @param {number|string} amount - المبلغ
         * @returns {boolean}
         */
        amount: function (amount) {
            const num = Number(amount);
            return !isNaN(num) && num > 0 && num < 1000000;
        },

        /**
         * التحقق من كود الطلب
         * @param {string} orderCode - كود الطلب (مثل S1001)
         * @returns {boolean}
         */
        orderCode: function (orderCode) {
            if (!orderCode || typeof orderCode !== "string") return false;
            // يجب أن يبدأ بحرف ويليه أرقام
            return /^[A-Z][0-9]+$/.test(orderCode);
        },

        /**
         * التحقق من الاسم
         * @param {string} name - الاسم
         * @returns {boolean}
         */
        name: function (name) {
            if (!name || typeof name !== "string") return false;
            // على الأقل حرفين، يسمح بالعربية والإنجليزية والمسافات
            return name.trim().length >= 2 && /^[\u0600-\u06FFa-zA-Z\s]+$/.test(name);
        },

        /**
         * التحقق من العنوان
         * @param {string} address - العنوان
         * @returns {boolean}
         */
        address: function (address) {
            if (!address || typeof address !== "string") return false;
            // على الأقل 5 أحرف
            return address.trim().length >= 5;
        },

        /**
         * التحقق من البريد الإلكتروني
         * @param {string} email - البريد الإلكتروني
         * @returns {boolean}
         */
        email: function (email) {
            if (!email || typeof email !== "string") return false;
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        },

        /**
         * التحقق من كلمة المرور
         * @param {string} password - كلمة المرور
         * @returns {boolean}
         */
        password: function (password) {
            if (!password || typeof password !== "string") return false;
            // على الأقل 6 أحرف
            return password.length >= 6;
        },

        /**
         * التحقق من الكمية
         * @param {number|string} quantity - الكمية
         * @returns {boolean}
         */
        quantity: function (quantity) {
            const num = Number(quantity);
            return Number.isInteger(num) && num > 0 && num <= 100;
        },

        /**
         * التحقق من أن القيمة غير فارغة
         * @param {any} value - القيمة
         * @returns {boolean}
         */
        required: function (value) {
            if (value === null || value === undefined) return false;
            if (typeof value === "string") return value.trim().length > 0;
            if (Array.isArray(value)) return value.length > 0;
            return true;
        },
    };

    /**
     * دالة للتحقق من نموذج كامل
     * @param {Object} data - البيانات المراد التحقق منها
     * @param {Object} rules - قواعد الـ Validation
     * @returns {Object} { valid: boolean, errors: Object }
     */
    function validateForm(data, rules) {
        const errors = {};
        let valid = true;

        for (const field in rules) {
            const fieldRules = Array.isArray(rules[field])
                ? rules[field]
                : [rules[field]];
            const value = data[field];

            for (const rule of fieldRules) {
                if (typeof rule === "function") {
                    if (!rule(value)) {
                        errors[field] = errors[field] || [];
                        errors[field].push("قيمة غير صحيحة");
                        valid = false;
                    }
                } else if (typeof rule === "object") {
                    // قاعدة مخصصة مع رسالة
                    if (!rule.validator(value)) {
                        errors[field] = errors[field] || [];
                        errors[field].push(rule.message || "قيمة غير صحيحة");
                        valid = false;
                    }
                }
            }
        }

        return { valid, errors };
    }

    /**
     * دالة لتنظيف رقم الهاتف
     * @param {string} phone - رقم الهاتف
     * @returns {string}
     */
    function cleanPhone(phone) {
        if (!phone) return "";
        return phone.replace(/[\s\-\(\)]/g, "");
    }

    /**
     * دالة لتنسيق رقم الهاتف للعرض
     * @param {string} phone - رقم الهاتف
     * @returns {string}
     */
    function formatPhone(phone) {
        const cleaned = cleanPhone(phone);
        // مثال: تنسيق للأرقام المصرية
        if (cleaned.length === 11) {
            return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(
                7
            )}`;
        }
        return cleaned;
    }

    /**
     * دالة لإضافة رسائل خطأ لحقول النموذج
     * @param {string} fieldId - معرف الحقل
     * @param {string} message - رسالة الخطأ
     */
    function showFieldError(fieldId, message) {
        const field = document.getElementById(fieldId);
        if (!field) return;

        // إزالة رسائل الخطأ السابقة
        const oldError = field.parentElement.querySelector(".field-error");
        if (oldError) oldError.remove();

        // إضافة كلاس للحقل
        field.classList.add("field-invalid");

        // إنشاء رسالة الخطأ
        const errorEl = document.createElement("div");
        errorEl.className = "field-error";
        errorEl.textContent = message;
        errorEl.style.cssText =
            "color: #c0392b; font-size: 0.85rem; margin-top: 0.25rem;";

        field.parentElement.appendChild(errorEl);
    }

    /**
     * دالة لإزالة رسائل الخطأ من حقل
     * @param {string} fieldId - معرف الحقل
     */
    function clearFieldError(fieldId) {
        const field = document.getElementById(fieldId);
        if (!field) return;

        field.classList.remove("field-invalid");
        const error = field.parentElement.querySelector(".field-error");
        if (error) error.remove();
    }

    /**
     * دالة لإضافة Validation تلقائي لنموذج
     * @param {string} formId - معرف النموذج
     * @param {Object} rules - قواعد الـ Validation
     * @param {Function} onValid - دالة تُستدعى عند نجاح الـ Validation
     */
    function setupFormValidation(formId, rules, onValid) {
        const form = document.getElementById(formId);
        if (!form) return;

        form.addEventListener("submit", function (e) {
            e.preventDefault();

            // جمع البيانات من النموذج
            const formData = new FormData(form);
            const data = {};
            for (const [key, value] of formData.entries()) {
                data[key] = value;
            }

            // التحقق من البيانات
            const { valid, errors } = validateForm(data, rules);

            // مسح الأخطاء السابقة
            Object.keys(rules).forEach((field) => clearFieldError(field));

            if (!valid) {
                // عرض الأخطاء
                for (const field in errors) {
                    showFieldError(field, errors[field][0]);
                }

                // التركيز على أول حقل خاطئ
                const firstErrorField = Object.keys(errors)[0];
                const field = document.getElementById(firstErrorField);
                if (field) field.focus();

                return;
            }

            // استدعاء الدالة عند نجاح الـ Validation
            if (onValid) onValid(data);
        });

        // إضافة Validation فوري عند الكتابة
        Object.keys(rules).forEach((fieldName) => {
            const field = document.getElementById(fieldName);
            if (!field) return;

            field.addEventListener("blur", function () {
                const value = field.value;
                const fieldRules = Array.isArray(rules[fieldName])
                    ? rules[fieldName]
                    : [rules[fieldName]];

                for (const rule of fieldRules) {
                    if (typeof rule === "function") {
                        if (!rule(value)) {
                            showFieldError(fieldName, "قيمة غير صحيحة");
                            return;
                        }
                    }
                }

                clearFieldError(fieldName);
            });
        });
    }

    // تصدير للاستخدام العام
    window.Validators = Validators;
    window.FormValidation = {
        validate: validateForm,
        cleanPhone: cleanPhone,
        formatPhone: formatPhone,
        showError: showFieldError,
        clearError: clearFieldError,
        setupForm: setupFormValidation,
    };
})();
