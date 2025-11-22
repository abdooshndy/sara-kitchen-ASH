// toast.js
// نظام إشعارات Toast محسّن
// يستخدم بدلاً من alert() التقليدي

(function () {
  /**
   * عرض إشعار Toast
   * @param {string} message - الرسالة
   * @param {string} type - النوع: success, error, warning, info
   * @param {number} duration - المدة بالميلي ثانية (افتراضي: 3000)
   */
  function showToast(message, type = "info", duration = 3000) {
    // إنشاء عنصر Toast
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    // أيقونات حسب النوع
    const icons = {
      success: "✓",
      error: "✕",
      warning: "⚠",
      info: "ℹ",
    };

    toast.innerHTML = `
      <div class="toast-icon">${icons[type] || "ℹ"}</div>
      <div class="toast-message">${message}</div>
      <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;

    // إضافة للـ DOM
    let container = document.querySelector(".toast-container");
    if (!container) {
      container = document.createElement("div");
      container.className = "toast-container";
      document.body.appendChild(container);
    }

    container.appendChild(toast);

    // Animation
    setTimeout(() => toast.classList.add("toast-show"), 10);

    // إزالة تلقائية
    setTimeout(() => {
      toast.classList.remove("toast-show");
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // تصدير للاستخدام العام
  window.showToast = showToast;

  // إضافة CSS إذا لم يكن موجوداً
  if (!document.getElementById("toast-styles")) {
    const style = document.createElement("style");
    style.id = "toast-styles";
    style.textContent = `
      .toast-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 10px;
        pointer-events: none;
      }

      .toast {
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 280px;
        max-width: 400px;
        padding: 14px 16px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s ease;
        pointer-events: all;
        border-left: 4px solid;
      }

      .toast-show {
        opacity: 1;
        transform: translateX(0);
      }

      .toast-icon {
        font-size: 20px;
        font-weight: bold;
        flex-shrink: 0;
      }

      .toast-message {
        flex: 1;
        font-size: 14px;
        color: #333;
        line-height: 1.4;
      }

      .toast-close {
        background: none;
        border: none;
        font-size: 24px;
        color: #999;
        cursor: pointer;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: color 0.2s;
      }

      .toast-close:hover {
        color: #333;
      }

      .toast-success {
        border-left-color: #3f7c4f;
      }

      .toast-success .toast-icon {
        color: #3f7c4f;
      }

      .toast-error {
        border-left-color: #c0392b;
      }

      .toast-error .toast-icon {
        color: #c0392b;
      }

      .toast-warning {
        border-left-color: #f39c12;
      }

      .toast-warning .toast-icon {
        color: #f39c12;
      }

      .toast-info {
        border-left-color: #3498db;
      }

      .toast-info .toast-icon {
        color: #3498db;
      }

      @media (max-width: 600px) {
        .toast-container {
          top: auto;
          bottom: 20px;
          right: 10px;
          left: 10px;
        }

        .toast {
          min-width: auto;
          max-width: none;
        }
      }
    `;
    document.head.appendChild(style);
  }
})();
