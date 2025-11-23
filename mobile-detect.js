// mobile-detect.js
// الكشف عن الموبايل وإدارة واجهة المستخدم

(function () {
    const CONFIG = {
        mobileBreakpoint: 768,
        storageKey: 'sara_kitchen_view_mode', // 'mobile' or 'desktop'
    };

    // 1. التحقق من الجهاز وتفضيلات المستخدم
    function initView() {
        const savedMode = localStorage.getItem(CONFIG.storageKey);
        const isMobileDevice = window.innerWidth <= CONFIG.mobileBreakpoint ||
            /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        // تحديد الوضع الحالي:
        // إذا كان محفوظاً، نستخدمه.
        // إذا لم يكن محفوظاً، نعتمد على نوع الجهاز.
        let currentMode = savedMode ? savedMode : (isMobileDevice ? 'mobile' : 'desktop');

        // تطبيق الوضع
        applyMode(currentMode);

        // إضافة زر التبديل
        createViewSwitcher(currentMode);

        // إضافة القائمة السفلية إذا كنا في وضع الموبايل
        if (currentMode === 'mobile') {
            injectBottomNav();
            adjustPageForMobile();
        }
    }

    // 2. تطبيق الوضع (Mobile/Desktop)
    function applyMode(mode) {
        if (mode === 'mobile') {
            document.body.classList.add('mobile-view');
            document.body.classList.remove('desktop-view');
            // إضافة meta viewport للموبايل إذا لم تكن موجودة (للتأكد)
            if (!document.querySelector('meta[name="viewport"]')) {
                const meta = document.createElement('meta');
                meta.name = "viewport";
                meta.content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";
                document.head.appendChild(meta);
            }
        } else {
            document.body.classList.add('desktop-view');
            document.body.classList.remove('mobile-view');
        }
        localStorage.setItem(CONFIG.storageKey, mode);
    }

    // 3. إنشاء زر التبديل العائم
    function createViewSwitcher(currentMode) {
        const btn = document.createElement('button');
        btn.id = 'view-switcher-btn';
        btn.className = 'view-switcher-btn';
        btn.innerHTML = currentMode === 'mobile' ? '💻' : '📱';
        btn.title = currentMode === 'mobile' ? 'التبديل لنسخة الكمبيوتر' : 'التبديل لنسخة الموبايل';

        btn.addEventListener('click', () => {
            const newMode = document.body.classList.contains('mobile-view') ? 'desktop' : 'mobile';
            applyMode(newMode);
            // إعادة تحميل الصفحة لتطبيق التغييرات الهيكلية بشكل نظيف
            window.location.reload();
        });

        document.body.appendChild(btn);
    }

    // 4. حقن القائمة السفلية (Bottom Navigation)
    function injectBottomNav() {
        // التأكد من عدم وجودها مسبقاً
        if (document.getElementById('mobile-bottom-nav')) return;

        const currentPage = document.body.dataset.page || 'home'; // home, menu, cart, profile

        const nav = document.createElement('nav');
        nav.id = 'mobile-bottom-nav';
        nav.className = 'mobile-bottom-nav';

        const cartCount = document.getElementById('cart-count') ? document.getElementById('cart-count').textContent : '0';

        nav.innerHTML = `
            <a href="index.html" class="nav-item ${currentPage === 'home' ? 'active' : ''}">
                <span class="nav-icon">🏠</span>
                <span class="nav-label">الرئيسية</span>
            </a>
            <a href="menu.html" class="nav-item ${currentPage === 'menu' ? 'active' : ''}">
                <span class="nav-icon">📖</span>
                <span class="nav-label">المنيو</span>
            </a>
            <a href="cart.html" class="nav-item ${currentPage === 'cart' ? 'active' : ''}">
                <div class="icon-wrapper">
                    <span class="nav-icon">🛒</span>
                    <span class="mobile-cart-badge" id="mobile-cart-badge">${cartCount}</span>
                </div>
                <span class="nav-label">السلة</span>
            </a>
            <a href="profile.html" class="nav-item ${currentPage === 'profile' ? 'active' : ''}">
                <span class="nav-icon">👤</span>
                <span class="nav-label">حسابي</span>
            </a>
        `;

        document.body.appendChild(nav);

        // مراقبة تحديثات السلة لتحديث العداد في الأسفل أيضاً
        observeCartCount();
    }

    // 5. تعديلات إضافية للصفحة
    function adjustPageForMobile() {
        // إضافة مساحة في الأسفل عشان القائمة ما تغطيش المحتوى
        document.body.style.paddingBottom = '70px';
    }

    // مراقب لتحديث عداد السلة
    function observeCartCount() {
        const desktopBadge = document.getElementById('cart-count');
        const mobileBadge = document.getElementById('mobile-cart-badge');

        if (desktopBadge && mobileBadge) {
            // Observer لمراقبة التغييرات في العداد الأصلي
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mobileBadge.textContent = mutation.target.textContent;
                    // Animation effect
                    mobileBadge.classList.add('bump');
                    setTimeout(() => mobileBadge.classList.remove('bump'), 300);
                });
            });

            observer.observe(desktopBadge, { childList: true, characterData: true, subtree: true });
        }
    }

    // تشغيل عند التحميل
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initView);
    } else {
        initView();
    }
})();
