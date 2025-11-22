// app.js
// الكود العام لمنصّة "مطبخ سارة للأكل البيتي"

(function () {
  const CONFIG = window.APP_CONFIG || {};
  const CART_STORAGE_KEY = "sara_kitchen_cart_v1";

  let supabaseClient = null;
  const MEDIA_BUCKET = "product-images"; // اسم البكت في Storage

  // ============================
  // 0) أدوات خاصة بالصور (media)
  // ============================

  // ترجمة صف media إلى رابط جاهز للعرض
  function getMediaUrlFromRow(mediaRow) {
    if (!mediaRow) return null;

    // لو الصورة من لينك خارجي
    if (mediaRow.source_type === "EXTERNAL_URL" && mediaRow.url) {
      return mediaRow.url;
    }

    // لو الصورة مرفوعة في Supabase Storage
    if (mediaRow.source_type === "UPLOADED" && mediaRow.storage_path) {
      const client = initSupabaseClient();
      const { data } = client.storage
        .from(MEDIA_BUCKET)
        .getPublicUrl(mediaRow.storage_path);

      return data && data.publicUrl ? data.publicUrl : null;
    }

    return null;
  }

  // ============================
  // الحالة العامة
  // ============================

  // حالة السلة
  const cartState = {
    items: [],
    deliveryType: "PICKUP",
    deliverySettings: null,
    subtotal: 0,
    deliveryFee: 0,
    discount: 0,
    total: 0
  };

  // حالة المنيو
  const menuState = {
    categories: [],
    products: [],
    offers: [],
    filter: "all", // all | offers | instant | category:اسم
    searchText: ""
  };

  // ============================
  // 1) تهيئة Supabase
  // ============================

  function initSupabaseClient() {
    // استخدام الدالة المشتركة من utils.js إن وجدت
    if (window.getSupabaseClient) {
      return window.getSupabaseClient();
    }

    // Fallback: نفس المنطق القديم
    if (supabaseClient) return supabaseClient;

    if (!window.supabase || !window.supabase.createClient) {
      console.error(
        "لم يتم تحميل مكتبة Supabase. تأكد من وجود سكربت CDN قبل app.js"
      );
      return null;
    }

    if (!CONFIG.supabase || !CONFIG.supabase.url || !CONFIG.supabase.anonKey) {
      console.error("إعدادات Supabase غير مكتملة في config.js");
      return null;
    }

    const { createClient } = window.supabase;
    supabaseClient = createClient(CONFIG.supabase.url, CONFIG.supabase.anonKey);
    return supabaseClient;
  }

  // ============================
  // 2) أدوات عامة: السعر + السلة + واتساب + حالات الطلب
  // ============================

  function formatPrice(value) {
    const num = Number(value || 0);
    const label =
      CONFIG.currency && CONFIG.currency.label ? CONFIG.currency.label : "";
    return `${num.toFixed(2)} ${label}`.trim();
  }

  function loadCart() {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.error("خطأ أثناء قراءة السلة من LocalStorage", err);
      return [];
    }
  }

  function saveCart(cart) {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
      updateCartBadge(cart);
    } catch (err) {
      console.error("خطأ أثناء حفظ السلة", err);
    }
  }

  function updateCartBadge(cart) {
    // مستقبلًا ممكن نضيف عدّاد جنب رابط السلة في الهيدر
    void cart;
  }

  function addToCart(item) {
    const cart = loadCart();
    const existing = cart.find(
      (c) => c.type === item.type && c.refId === item.refId
    );

    if (existing) {
      existing.quantity += item.quantity || 1;
    } else {
      cart.push({
        type: item.type, // "PRODUCT" | "OFFER"
        refId: item.refId, // id من products أو offers
        name: item.name,
        unitPrice: Number(item.unitPrice || 0),
        quantity: item.quantity || 1
      });
    }

    saveCart(cart);
    if (window.showToast) showToast("تم إضافة العنصر إلى السلة ✅", "success");
    else alert("تم إضافة العنصر إلى السلة ✅");
  }

  // تحويل نوع التوصيل لنص عربي
  function deliveryTypeToText(deliveryType) {
    switch (deliveryType) {
      case "PICKUP":
        return "استلام من المطبخ";
      case "DELIVERY_INSIDE_CITY":
        return "توصيل داخل المدينة";
      case "DELIVERY_OUTSIDE_CITY":
        return "توصيل خارج المدينة";
      default:
        return deliveryType || "";
    }
  }

  // فتح رابط واتساب بالطلب
  function openWhatsAppForOrder(params) {
    const adminPhone =
      (CONFIG.contact && CONFIG.contact.phone) || "96550534441";

    const {
      orderCode,
      name,
      phone,
      address,
      deliveryType,
      notes,
      items,
      subtotal,
      deliveryFee,
      total
    } = params;

    let text = "طلب جديد من مطبخ سارة للأكل البيتي\n";
    text += `رقم الطلب: ${orderCode}\n`;
    text += `الاسم: ${name}\n`;
    text += `الموبايل: ${phone}\n`;
    text += `العنوان: ${address}\n`;
    text += `نوع التوصيل: ${deliveryTypeToText(deliveryType)}\n`;

    if (params.isAsap === false && params.scheduledFor) {
      const date = new Date(params.scheduledFor);
      const dateStr = date.toLocaleDateString('ar-EG');
      const timeStr = date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
      text += `📅 وقت التوصيل: ${dateStr} الساعة ${timeStr}\n\n`;
    } else {
      text += `📅 وقت التوصيل: في أقرب وقت\n\n`;
    }

    text += "الطلبات:\n";
    items.forEach((item) => {
      const lineTotal =
        Number(item.unitPrice || 0) * Number(item.quantity || 0);
      const typeLabel = item.type === "OFFER" ? "عرض" : "صنف";
      text += `- ${typeLabel} × ${item.quantity} - ${item.name} (${formatPrice(
        lineTotal
      )})\n`;
    });

    text += "\n";
    text += `إجمالي الأصناف: ${formatPrice(subtotal)}\n`;
    text += `رسوم التوصيل: ${formatPrice(deliveryFee)}\n`;
    text += `الإجمالي المطلوب: ${formatPrice(total)}\n`;

    if (notes) {
      text += `\nملاحظات العميل: ${notes}\n`;
    }

    const url = `https://wa.me/${adminPhone}?text=${encodeURIComponent(text)}`;

    try {
      window.open(url, "_blank");
    } catch (err) {
      console.warn("تعذر فتح رابط واتساب:", err, url);
    }
  }

  // ترجمة حالة الطلب إلى نص عربي جميل
  function orderStatusToLabel(status) {
    switch (status) {
      case "PENDING":
        return "تم استلام الطلب، في انتظار التأكيد";
      case "PREPARING":
        return "جاري تحضير طلبك في المطبخ";
      case "WITH_DRIVER":
        return "الطلب مع المندوب وفي الطريق إليك";
      case "DELIVERED":
        return "تم تسليم الطلب، شكرًا لتعاملك معنا ❤️";
      case "CANCELLED":
        return "تم إلغاء الطلب";
      default:
        return status || "";
    }
  }

  // لاختيار كلاس CSS مناسب لكل حالة (للون البادج)
  function orderStatusToBadgeClass(status) {
    switch (status) {
      case "PENDING":
        return "status-badge--pending";
      case "PREPARING":
        return "status-badge--preparing";
      case "WITH_DRIVER":
        return "status-badge--with-driver";
      case "DELIVERED":
        return "status-badge--delivered";
      case "CANCELLED":
        return "status-badge--cancelled";
      default:
        return "";
    }
  }

  // ============================
  // 3) منطق صفحة المنيو
  // ============================

  async function initMenuPage() {
    const client = initSupabaseClient();
    if (!client) return;

    const offersContainer = document.getElementById("offers-container");
    const instantContainer = document.getElementById(
      "instant-products-container"
    );
    const categoriesContainer = document.getElementById("categories-container");

    if (!offersContainer || !instantContainer || !categoriesContainer) {
      console.warn("لم يتم العثور على حاويات المنيو في الصفحة.");
      return;
    }

    await loadMenuData(client);
    setupMenuInteractions();
    renderMenuAll();
  }

  async function loadMenuData(client) {
    const offersContainer = document.getElementById("offers-container");
    const instantContainer = document.getElementById(
      "instant-products-container"
    );
    const categoriesContainer = document.getElementById("categories-container");

    try {
      const [catsRes, prodsRes, offersRes] = await Promise.all([
        client
          .from("categories")
          .select("*")
          .order("display_order", { ascending: true }),
        client
          .from("products")
          .select("*")
          .eq("is_available", true),
        client
          .from("offers")
          .select("*")
      ]);

      if (catsRes.error) throw catsRes.error;
      if (prodsRes.error) throw prodsRes.error;
      // Offers table doesn't exist yet, ignore error

      menuState.categories = catsRes.data || [];
      menuState.products = prodsRes.data || [];
      menuState.offers = offersRes.data || [];
    } catch (err) {
      console.error("خطأ أثناء تحميل بيانات المنيو:", err);
      const msg = document.createElement("div");
      msg.className = "menu-placeholder";
      msg.textContent =
        "حدث خطأ أثناء تحميل القائمة. برجاء إعادة المحاولة لاحقًا.";
      offersContainer.innerHTML = "";
      instantContainer.innerHTML = "";
      categoriesContainer.innerHTML = "";
      categoriesContainer.appendChild(msg);
    }
  }

  function setupMenuInteractions() {
    const searchInput = document.getElementById("menu-search-input");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        menuState.searchText = (e.target.value || "").trim();
        renderMenuAll();
      });
    }

    const filterButtons = document.querySelectorAll(".menu-filter-btn");
    filterButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        filterButtons.forEach((b) => b.classList.remove("is-active"));
        btn.classList.add("is-active");

        const filterValue = btn.getAttribute("data-filter") || "all";
        menuState.filter = filterValue;
        renderMenuAll();
      });
    });

    // المساعد الذكي (واجهة فقط حالياً – بدون ربط OpenAI)
    const aiBtn = document.getElementById("ai-assistant-submit");
    const aiInput = document.getElementById("ai-assistant-input");
    const aiResult = document.getElementById("ai-assistant-result");

    if (aiBtn && aiInput && aiResult) {
      aiBtn.addEventListener("click", () => {
        const text = aiInput.value.trim();
        if (!text) {
          aiResult.innerHTML =
            '<p class="ai-placeholder">من فضلك اكتب احتياجك الأول (عدد الأفراد، نوع الأكل، الميزانية إن وجد...)</p>';
          return;
        }

        aiResult.innerHTML =
          '<p class="ai-placeholder">ميزة الذكاء الاصطناعي هتتفعل بعد ربط المنصّة بـ OpenAI API من الباك إند. دلوقتي تقدر تختار من الأصناف والعروض الظاهرة قدامك ❤️</p>';
      });
    }
  }

  function getCurrentFilter() {
    const f = menuState.filter || "all";
    if (f.startsWith("category:")) {
      return { type: "category", value: f.split(":")[1] || "" };
    }
    return { type: f, value: null };
  }

  function textMatches(item, searchText) {
    if (!searchText) return true;
    const s = searchText.toLowerCase();
    const fields = [];
    if (item.name) fields.push(item.name);
    if (item.description) fields.push(item.description);
    return fields.join(" ").toLowerCase().includes(s);
  }

  function renderMenuAll() {
    renderOffersSection();
    renderInstantSection();
    renderCategoriesSection();
  }

  // ----- قسم العروض -----

  function renderOffersSection() {
    const section = document.getElementById("menu-offers-section");
    const container = document.getElementById("offers-container");
    if (!section || !container) return;

    const { type } = getCurrentFilter();
    const searchText = menuState.searchText;

    if (!menuState.offers.length || (type !== "all" && type !== "offers")) {
      section.style.display = "none";
      return;
    }

    section.style.display = "";
    container.innerHTML = "";

    const offers = menuState.offers.filter((offer) =>
      textMatches(offer, searchText)
    );

    if (!offers.length) {
      const empty = document.createElement("div");
      empty.className = "menu-placeholder";
      empty.textContent = "لا توجد عروض مطابقة لبحثك حاليًا.";
      container.appendChild(empty);
      return;
    }

    offers.forEach((offer) => {
      const card = document.createElement("article");
      card.className = "menu-item-card";

      // صورة العرض (لو موجودة)
      if (offer.imageUrl) {
        const imgWrapper = document.createElement("div");
        imgWrapper.className = "menu-item-image-wrapper";
        const img = document.createElement("img");
        img.className = "menu-item-image";
        img.src = offer.imageUrl;
        img.alt = offer.name || "صورة العرض";
        imgWrapper.appendChild(img);
        card.appendChild(imgWrapper);
      }

      const header = document.createElement("div");
      header.className = "menu-item-header";

      const title = document.createElement("h3");
      title.className = "menu-item-name";
      title.textContent = offer.name || "عرض";

      const price = document.createElement("div");
      price.className = "menu-item-price";
      const finalPrice = Number(offer.final_price || offer.base_price || 0);
      price.textContent = formatPrice(finalPrice);

      header.appendChild(title);
      header.appendChild(price);

      const desc = document.createElement("p");
      desc.className = "menu-item-desc";
      desc.textContent = offer.description || "عرض خاص من مطبخ سارة.";

      const meta = document.createElement("div");
      meta.className = "menu-item-meta";

      const tags = document.createElement("div");
      tags.className = "menu-item-tags";

      if (
        offer.base_price &&
        offer.final_price &&
        Number(offer.final_price) < Number(offer.base_price)
      ) {
        const discountBadge = document.createElement("span");
        discountBadge.className = "badge";
        const diff =
          Number(offer.base_price) - Number(offer.final_price);
        discountBadge.textContent = `وفر ${formatPrice(diff)}`;
        tags.appendChild(discountBadge);
      } else {
        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = "عرض";
        tags.appendChild(badge);
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = "menu-item-add-btn";
      button.textContent = "أضف العرض للسلة";
      button.addEventListener("click", () => {
        addToCart({
          type: "OFFER",
          refId: offer.id,
          name: offer.name,
          unitPrice: finalPrice
        });
      });

      meta.appendChild(tags);
      meta.appendChild(button);

      card.appendChild(header);
      card.appendChild(desc);
      card.appendChild(meta);

      container.appendChild(card);
    });
  }

  // ----- قسم الأصناف الفورية -----

  function renderInstantSection() {
    const section = document.getElementById("menu-instant-section");
    const container = document.getElementById("instant-products-container");
    if (!section || !container) return;

    const { type } = getCurrentFilter();
    const searchText = menuState.searchText;

    if (type === "offers" || type === "category") {
      section.style.display = "none";
      return;
    }

    const products = menuState.products.filter(
      (p) => p.is_instant && textMatches(p, searchText)
    );

    if (!products.length && !searchText && type !== "instant") {
      section.style.display = "none";
      return;
    }

    section.style.display = "";
    container.innerHTML = "";

    if (!products.length) {
      const empty = document.createElement("div");
      empty.className = "menu-placeholder";
      empty.textContent = "لا توجد أصناف فورية مطابقة لبحثك حاليًا.";
      container.appendChild(empty);
      return;
    }

    products.forEach((product) => {
      const card = createProductCard(product, { showInstantBadge: true });
      container.appendChild(card);
    });
  }

  // ----- قسم كل الأصناف حسب التصنيف -----

  function renderCategoriesSection() {
    const section = document.getElementById("menu-products-section");
    const container = document.getElementById("categories-container");
    if (!section || !container) return;

    const { type, value } = getCurrentFilter();
    const searchText = menuState.searchText;

    if (type === "offers" || type === "instant") {
      section.style.display = "none";
      return;
    }

    const categories = menuState.categories;
    const products = menuState.products;

    container.innerHTML = "";

    if (!categories.length || !products.length) {
      const empty = document.createElement("div");
      empty.className = "menu-placeholder";
      empty.textContent = "لا توجد أصناف متاحة حاليًا.";
      container.appendChild(empty);
      section.style.display = "";
      return;
    }

    let anyCategoryRendered = false;

    categories.forEach((cat) => {
      if (type === "category" && value && cat.name !== value) return;

      const productsForCategory = products.filter(
        (p) => p.category === cat.name && textMatches(p, searchText)
      );

      if (!productsForCategory.length) return;

      anyCategoryRendered = true;

      const block = document.createElement("section");
      block.className = "menu-category-block";
      block.setAttribute("data-category-name", cat.name || "");

      const title = document.createElement("h3");
      title.className = "menu-category-title";
      title.textContent = cat.name || "تصنيف";

      const grid = document.createElement("div");
      grid.className = "menu-cards-grid";

      productsForCategory.forEach((product) => {
        const card = createProductCard(product, { showInstantBadge: true });
        grid.appendChild(card);
      });

      block.appendChild(title);
      block.appendChild(grid);
      container.appendChild(block);
    });

    if (!anyCategoryRendered) {
      const empty = document.createElement("div");
      empty.className = "menu-placeholder";
      empty.textContent = "لا توجد أصناف مطابقة لبحثك أو الفلتر المحدد.";
      container.appendChild(empty);
    }

    section.style.display = "";
  }

  // ----- إنشاء كرت منتج -----

  function createProductCard(product, options) {
    const opts = options || {};

    const card = document.createElement("article");
    card.className = "menu-item-card";

    // صورة المنتج (لو موجودة)
    if (product.imageUrl) {
      const imgWrapper = document.createElement("div");
      imgWrapper.className = "menu-item-image-wrapper";
      const img = document.createElement("img");
      img.className = "menu-item-image";
      img.src = product.imageUrl;
      img.alt = product.name || "صورة الصنف";
      imgWrapper.appendChild(img);
      card.appendChild(imgWrapper);
    }

    const header = document.createElement("div");
    header.className = "menu-item-header";

    const title = document.createElement("h3");
    title.className = "menu-item-name";
    title.textContent = product.name || "صنف";

    const price = document.createElement("div");
    price.className = "menu-item-price";
    price.textContent = formatPrice(Number(product.price || 0));

    header.appendChild(title);
    header.appendChild(price);

    const desc = document.createElement("p");
    desc.className = "menu-item-desc";
    desc.textContent = product.description || "";

    const meta = document.createElement("div");
    meta.className = "menu-item-meta";

    const tags = document.createElement("div");
    tags.className = "menu-item-tags";

    if (opts.showInstantBadge && product.is_instant) {
      const instantBadge = document.createElement("span");
      instantBadge.className = "badge badge-instant";
      instantBadge.textContent = "فوري";
      tags.appendChild(instantBadge);
    }

    // عرض الوسوم (Tags)
    if (product.tags && Array.isArray(product.tags)) {
      product.tags.forEach(tag => {
        const tagSpan = document.createElement("span");
        tagSpan.className = "badge-tag";

        // تنسيقات خاصة لبعض الوسوم
        if (tag.includes("حار")) tagSpan.classList.add("badge-tag--hot");
        else if (tag.includes("نباتي")) tagSpan.classList.add("badge-tag--vegan");
        else if (tag.includes("الأكثر مبيعاً")) tagSpan.classList.add("badge-tag--bestseller");

        tagSpan.textContent = tag;
        tags.appendChild(tagSpan);
      });
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "menu-item-add-btn";
    button.textContent = "أضف للسلة";
    button.addEventListener("click", async () => {
      // التحقق من وجود خيارات للمنتج
      const hasOptions = await checkProductOptions(product.id);

      if (hasOptions) {
        openProductOptionsModal(product);
      } else {
        addToCart({
          type: "PRODUCT",
          refId: product.id,
          name: product.name,
          unitPrice: Number(product.price || 0)
        });
      }
    });

    meta.appendChild(tags);
    meta.appendChild(button);

    card.appendChild(header);
    card.appendChild(desc);
    card.appendChild(meta);

    return card;
  }

  // دالة للتحقق من وجود خيارات (يمكن تحسينها بجلب الخيارات مع المنتجات لتقليل الطلبات)
  async function checkProductOptions(productId) {
    const client = initSupabaseClient();
    if (!client) return false;

    const { count, error } = await client
      .from('product_options')
      .select('*', { count: 'exact', head: true })
      .eq('product_id', productId);

    return count > 0;
  }

  // منطق Modal التخصيص
  let currentModalProduct = null;
  let selectedOptions = {};

  async function openProductOptionsModal(product) {
    const modal = document.getElementById("product-options-modal");
    if (!modal) return;

    currentModalProduct = product;
    selectedOptions = {}; // Reset

    document.getElementById("modal-product-name").textContent = product.name;
    document.getElementById("modal-total-price").textContent = formatPrice(product.price);

    const container = document.getElementById("modal-options-container");
    container.innerHTML = '<div class="spinner"></div>';

    modal.style.display = "flex";

    // جلب الخيارات
    const client = initSupabaseClient();
    const { data: options } = await client
      .from('product_options')
      .select('*, values:product_option_values(*)')
      .eq('product_id', product.id);

    renderModalOptions(options, container);
    updateModalTotal();

    // إغلاق الـ Modal
    const closeBtn = modal.querySelector(".close-modal");
    closeBtn.onclick = () => modal.style.display = "none";
    window.onclick = (event) => {
      if (event.target == modal) modal.style.display = "none";
    };

    // زر الإضافة في الـ Modal
    const addBtn = document.getElementById("modal-add-to-cart-btn");
    addBtn.onclick = () => {
      // التحقق من الخيارات المطلوبة
      // ... (يمكن إضافة التحقق هنا)

      addToCart({
        type: "PRODUCT",
        refId: product.id,
        name: product.name,
        unitPrice: Number(product.price || 0), // السعر الأساسي
        selectedOptions: selectedOptions, // الخيارات المختارة
        totalPrice: calculateTotalWithOptions() // السعر الإجمالي للوحدة
      });
      modal.style.display = "none";
    };
  }

  function renderModalOptions(options, container) {
    container.innerHTML = "";
    if (!options || !options.length) {
      container.textContent = "لا توجد خيارات متاحة.";
      return;
    }

    options.forEach(opt => {
      const group = document.createElement("div");
      group.className = "modal-option-group";

      const title = document.createElement("div");
      title.className = "modal-option-title";
      title.textContent = opt.name + (opt.is_required ? " (مطلوب)" : "");
      group.appendChild(title);

      opt.values.forEach(val => {
        const row = document.createElement("label");
        row.className = "modal-option-item";

        const input = document.createElement("input");
        input.type = opt.type === 'MULTIPLE' ? 'checkbox' : 'radio';
        input.name = `option_${opt.id}`;
        input.value = val.id;
        input.dataset.price = val.price_adjustment;
        input.dataset.name = val.name;
        input.dataset.optionName = opt.name;

        input.addEventListener("change", () => {
          updateSelectedOptions();
          updateModalTotal();
        });

        const labelText = document.createElement("span");
        const priceText = Number(val.price_adjustment) > 0 ? ` (+${formatPrice(val.price_adjustment)})` : "";
        labelText.textContent = val.name + priceText;

        row.appendChild(labelText);
        row.appendChild(input);
        group.appendChild(row);
      });

      container.appendChild(group);
    });
  }

  function updateSelectedOptions() {
    selectedOptions = {};
    const inputs = document.querySelectorAll('#modal-options-container input:checked');
    inputs.forEach(input => {
      const optName = input.dataset.optionName;
      if (!selectedOptions[optName]) selectedOptions[optName] = [];

      selectedOptions[optName].push({
        value: input.dataset.name,
        price: Number(input.dataset.price)
      });
    });
  }

  function calculateTotalWithOptions() {
    let total = Number(currentModalProduct.price || 0);
    Object.values(selectedOptions).flat().forEach(opt => {
      total += opt.price;
    });
    return total;
  }

  function updateModalTotal() {
    const total = calculateTotalWithOptions();
    document.getElementById("modal-total-price").textContent = formatPrice(total);
  }


  // ============================
  // 4) منطق صفحة السلة
  // ============================

  async function initCartPage() {
    const client = initSupabaseClient();
    cartState.items = loadCart();

    if (client) {
      await loadDeliverySettings(client);
    }

    const selectedRadio = document.querySelector(
      'input[name="delivery-type"]:checked'
    );
    cartState.deliveryType = selectedRadio
      ? selectedRadio.value
      : "PICKUP";

    setupCartInteractions();
    renderCart();
    recalculateTotals();

    // التحقق من المستخدم المسجل
    if (window.CustomerAuth) {
      const session = await CustomerAuth.checkSession();
      if (session) {
        setupCartForUser(session.user.id);
      } else {
        document.getElementById('guest-checkout-alert').style.display = 'block';
      }
    }
  }

  async function setupCartForUser(userId) {
    const client = initSupabaseClient();

    // جلب بيانات البروفايل
    const { data: profile } = await client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profile) {
      const nameInput = document.getElementById('cart-customer-name');
      const phoneInput = document.getElementById('cart-customer-phone');
      if (nameInput) nameInput.value = profile.full_name || '';
      if (phoneInput) {
        phoneInput.value = profile.phone || '';
        phoneInput.readOnly = true; // رقم الهاتف هو المعرف
        phoneInput.style.backgroundColor = '#f9f9f9';
      }
    }

    // جلب العناوين
    const { data: addresses } = await client
      .from('customer_addresses')
      .select('*')
      .eq('user_id', userId);

    if (addresses && addresses.length > 0) {
      const container = document.getElementById('saved-addresses-container');
      const select = document.getElementById('saved-address-select');
      const manualContainer = document.getElementById('manual-address-container');

      container.style.display = 'block';
      manualContainer.style.display = 'none'; // إخفاء اليدوي افتراضياً

      addresses.forEach(addr => {
        const opt = document.createElement('option');
        opt.value = addr.address_text;
        opt.textContent = `${addr.label}: ${addr.address_text.substring(0, 30)}...`;
        select.appendChild(opt);
      });

      // عند تغيير العنوان
      select.addEventListener('change', () => {
        if (select.value) {
          document.getElementById('cart-customer-address').value = select.value;
        }
      });

      // رابط "استخدم عنوان جديد"
      document.getElementById('use-new-address-link').onclick = (e) => {
        e.preventDefault();
        select.value = "";
        manualContainer.style.display = 'block';
        document.getElementById('cart-customer-address').value = "";
        document.getElementById('cart-customer-address').focus();
      };
    }
  }

  async function loadDeliverySettings(client) {
    try {
      const { data, error } = await client
        .from("delivery_settings")
        .select("*")
        .limit(1);

      if (!error && data && data.length) {
        cartState.deliverySettings = data[0];
      }
    } catch (err) {
      console.warn("تعذر تحميل إعدادات التوصيل:", err);
    }
  }

  function setupCartInteractions() {
    const radios = document.querySelectorAll('input[name="delivery-type"]');
    radios.forEach((radio) => {
      radio.addEventListener("change", () => {
        if (radio.checked) {
          cartState.deliveryType = radio.value;
          recalculateTotals();
        }
      });
    });

    // منطق توقيت الطلب (الجدولة)
    const timingRadios = document.querySelectorAll('input[name="order-timing"]');
    const scheduledContainer = document.getElementById("scheduled-time-container");

    timingRadios.forEach((radio) => {
      radio.addEventListener("change", () => {
        if (radio.checked && scheduledContainer) {
          if (radio.value === "SCHEDULED") {
            scheduledContainer.style.display = "block";
            // تعيين الحد الأدنى للوقت (بعد ساعة من الآن)
            const now = new Date();
            now.setHours(now.getHours() + 1);
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset()); // Adjust for local timezone
            const minTime = now.toISOString().slice(0, 16);
            const dateInput = document.getElementById("scheduled-date");
            if (dateInput) dateInput.min = minTime;
          } else {
            scheduledContainer.style.display = "none";
          }
        }
      });
    });

    const placeOrderBtn = document.getElementById("cart-place-order-btn");
    if (placeOrderBtn) {
      placeOrderBtn.addEventListener("click", () => {
        handlePlaceOrder();
      });
    }
  }

  function renderCart() {
    const container = document.getElementById("cart-items-container");
    const placeOrderBtn = document.getElementById("cart-place-order-btn");
    if (!container) return;

    container.innerHTML = "";

    if (!cartState.items.length) {
      const msg = document.createElement("div");
      msg.className = "menu-placeholder";
      msg.textContent =
        "السلة فارغة حاليًا. يمكنك إضافة أصناف من صفحة القائمة.";
      container.appendChild(msg);
      if (placeOrderBtn) placeOrderBtn.disabled = true;
      recalculateTotals();
      return;
    }

    if (placeOrderBtn) placeOrderBtn.disabled = false;

    cartState.items.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "cart-item-row";

      const info = document.createElement("div");
      info.className = "cart-item-info";

      const title = document.createElement("div");
      title.className = "cart-item-name";
      title.textContent = item.name || "";

      const typeLabel = document.createElement("div");
      typeLabel.className = "cart-item-type";
      typeLabel.textContent =
        item.type === "OFFER" ? "عرض" : "صنف من المنيو";

      info.appendChild(title);
      info.appendChild(typeLabel);

      const qtyWrapper = document.createElement("div");
      qtyWrapper.className = "cart-item-qty";

      const qtyInput = document.createElement("input");
      qtyInput.type = "number";
      qtyInput.min = "1";
      qtyInput.value = item.quantity;
      qtyInput.addEventListener("change", () => {
        let q = parseInt(qtyInput.value, 10);
        if (isNaN(q) || q < 1) {
          q = 1;
          qtyInput.value = "1";
        }
        cartState.items[index].quantity = q;
        saveCart(cartState.items);
        recalculateTotals();
        renderCart();
      });

      qtyWrapper.appendChild(qtyInput);

      const priceWrapper = document.createElement("div");
      priceWrapper.className = "cart-item-prices";

      const unit = document.createElement("div");
      unit.className = "cart-item-unit";
      unit.textContent = formatPrice(item.unitPrice);

      const total = document.createElement("div");
      total.className = "cart-item-total";
      total.textContent = formatPrice(
        item.unitPrice * item.quantity
      );

      priceWrapper.appendChild(unit);
      priceWrapper.appendChild(total);

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "cart-item-remove-btn";
      removeBtn.textContent = "إزالة";
      removeBtn.addEventListener("click", () => {
        cartState.items.splice(index, 1);
        saveCart(cartState.items);
        renderCart();
        recalculateTotals();
      });

      row.appendChild(info);
      row.appendChild(qtyWrapper);
      row.appendChild(priceWrapper);
      row.appendChild(removeBtn);

      container.appendChild(row);
    });
  }

  function recalculateTotals() {
    const subtotalEl = document.getElementById("cart-subtotal-value");
    const deliveryFeeEl = document.getElementById(
      "cart-delivery-fee-value"
    );
    const discountEl = document.getElementById("cart-discount-value");
    const totalEl = document.getElementById("cart-total-value");

    let subtotal = 0;
    cartState.items.forEach((item) => {
      subtotal += Number(item.unitPrice || 0) * Number(item.quantity || 0);
    });

    let deliveryFee = 0;
    const ds = cartState.deliverySettings;
    if (cartState.deliveryType === "DELIVERY_INSIDE_CITY" && ds) {
      deliveryFee = Number(ds.inside_city_fee || 0);
    } else if (
      cartState.deliveryType === "DELIVERY_OUTSIDE_CITY" &&
      ds
    ) {
      deliveryFee = Number(ds.outside_city_fee || 0);
    } else {
      deliveryFee = 0;
    }

    const discount = 0; // لسه ما فعلناش الكوبونات
    const total = subtotal + deliveryFee - discount;

    cartState.subtotal = subtotal;
    cartState.deliveryFee = deliveryFee;
    cartState.discount = discount;
    cartState.total = total;

    if (subtotalEl) subtotalEl.textContent = formatPrice(subtotal);
    if (deliveryFeeEl) deliveryFeeEl.textContent = formatPrice(deliveryFee);
    if (discountEl) discountEl.textContent = formatPrice(discount);
    if (totalEl) totalEl.textContent = formatPrice(total);
  }

  async function handlePlaceOrder() {
    if (!cartState.items.length) {
      if (window.showToast) showToast("السلة فارغة. برجاء إضافة أصناف أولًا.", "error");
      else alert("السلة فارغة. برجاء إضافة أصناف أولًا.");
      return;
    }

    const nameInput = document.getElementById("cart-customer-name");
    const phoneInput = document.getElementById("cart-customer-phone");
    const addressInput = document.getElementById("cart-customer-address");
    const notesInput = document.getElementById("cart-notes");

    const name = ((nameInput && nameInput.value) || "").trim();
    const phone = ((phoneInput && phoneInput.value) || "").trim();
    const address = ((addressInput && addressInput.value) || "").trim();
    const notes = ((notesInput && notesInput.value) || "").trim();

    if (!name || !phone || !address) {
      if (window.showToast) showToast("من فضلك أدخل الاسم، ورقم الموبايل، والعنوان.", "error");
      else alert("من فضلك أدخل الاسم، ورقم الموبايل، والعنوان.");
      return;
    }

    const client = initSupabaseClient();
    if (!client) {
      if (window.showToast) showToast("تعذر الاتصال بقاعدة البيانات. برجاء المحاولة لاحقًا.", "error");
      else alert("تعذر الاتصال بقاعدة البيانات. برجاء المحاولة لاحقًا.");
      return;
    }

    // نخزن نسخة من السلة قبل مسحها علشان رسالة الواتساب
    const itemsSnapshot = cartState.items.map((it) => ({ ...it }));

    // نتأكد إن الإجماليات متحدّثة
    recalculateTotals();

    const placeOrderBtn = document.getElementById("cart-place-order-btn");
    if (placeOrderBtn) {
      placeOrderBtn.disabled = true;
      placeOrderBtn.textContent = "جاري تسجيل الطلب...";
    }

    try {
      // التحقق من المستخدم الحالي
      let userId = null;
      if (window.CustomerAuth) {
        const session = await CustomerAuth.checkSession();
        if (session) userId = session.user.id;
      }

      // إذا لم يكن مسجلاً، نستخدم الدالة القديمة لإنشاء/جلب عميل مؤقت (أو نعتمد على user_id NULL)
      // ملاحظة: في التصميم الجديد، user_id في orders يمكن أن يكون NULL للزوار.
      // لكننا ما زلنا بحاجة لـ customer_id لجدول customers القديم إذا كنا سنحافظ عليه،
      // أو نحدث المنطق للاعتماد على user_id.
      // للأمان، سنستمر في إنشاء customer entry للزوار والمسجلين لتوحيد المرجعية في جدول customers القديم إذا لزم الأمر،
      // ولكن الأفضل الاعتماد على user_id للمسجلين.

      let customerId = null;
      // سنحتفظ بالمنطق القديم لإنشاء سجل في جدول customers لغرض التوافق
      customerId = await getOrCreateCustomerId(
        client,
        name,
        phone,
        address
      );

      // استخدام RPC لتوليد رقم الطلب
      const { data: orderCode, error: codeError } = await client.rpc('generate_order_code');

      if (codeError) {
        console.error("Error generating order code:", codeError);
        throw new Error("فشل توليد رقم الطلب");
      }

      // جمع بيانات الجدولة
      let isAsap = true;
      let scheduledFor = null;
      const timingRadio = document.querySelector('input[name="order-timing"]:checked');

      if (timingRadio && timingRadio.value === "SCHEDULED") {
        isAsap = false;
        const dateInput = document.getElementById("scheduled-date");
        if (dateInput && dateInput.value) {
          scheduledFor = new Date(dateInput.value).toISOString();
        } else {
          if (window.showToast) showToast("من فضلك حدد تاريخ ووقت التوصيل.", "error");
          else alert("من فضلك حدد تاريخ ووقت التوصيل.");
          throw new Error("تاريخ التوصيل مطلوب");
        }
      }

      const orderInsertPayload = {
        order_code: orderCode,
        customer_id: customerId, // للحفاظ على التوافق القديم
        user_id: userId,        // للمستخدمين المسجلين (جديد)
        customer_name: name,
        customer_phone: phone,
        customer_address: address,
        delivery_type: cartState.deliveryType,
        subtotal_amount: cartState.subtotal,
        delivery_fee: cartState.deliveryFee,
        discount_amount: cartState.discount,
        total_amount: cartState.total,
        coupon_code: null,
        notes: notes || null,
        is_asap: isAsap,
        scheduled_for: scheduledFor
      };

      const { data: order, error: orderError } = await client
        .from("orders")
        .insert(orderInsertPayload)
        .select("id, order_code")
        .single();

      if (orderError) throw orderError;

      const orderId = order.id;

      const orderItemsPayload = cartState.items.map((item) => {
        const isOffer = item.type === "OFFER";
        return {
          order_id: orderId,
          item_type: isOffer ? "OFFER" : "PRODUCT",
          product_id: isOffer ? null : item.refId,
          offer_id: isOffer ? item.refId : null,
          name: item.name,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total_price: item.unitPrice * item.quantity,
          options_details: null,
          notes: null
        };
      });

      const { error: itemsError } = await client
        .from("order_items")
        .insert(orderItemsPayload);

      if (itemsError) throw itemsError;

      // ✅ Database Function تتولى زيادة الرقم تلقائياً - لا حاجة للاستدعاء اليدوي

      // فتح واتساب برسالة للأدمن بعد ما الطلب يتسجل
      openWhatsAppForOrder({
        orderCode: order.order_code,
        name,
        phone,
        address,
        deliveryType: cartState.deliveryType,
        notes,
        items: itemsSnapshot,
        subtotal: cartState.subtotal,
        deliveryFee: cartState.deliveryFee,
        total: cartState.total,
        isAsap: isAsap,
        scheduledFor: scheduledFor
      });

      cartState.items = [];
      saveCart(cartState.items);
      renderCart();
      recalculateTotals();

      if (window.showToast) {
        showToast(`تم تسجيل طلبك بنجاح 🎉\nرقم الطلب: ${order.order_code}`, "success");
      } else {
        alert(`تم تسجيل طلبك بنجاح 🎉\nرقم الطلب: ${order.order_code}`);
      }
    } catch (err) {
      console.error("خطأ أثناء تسجيل الطلب:", err);
      if (window.showToast) showToast("حدث خطأ أثناء تسجيل الطلب. برجاء المحاولة مرة أخرى.", "error");
      else alert("حدث خطأ أثناء تسجيل الطلب.");
    } finally {
      if (placeOrderBtn) {
        placeOrderBtn.disabled = false;
        placeOrderBtn.textContent = "تأكيد الطلب";
      }
    }
  }

  async function getOrCreateCustomerId(client, name, phone, address) {
    // No longer using customers table - just return null
    // Data will be stored directly in orders table
    return null;
  }



  // ============================
  // 5) منطق صفحة متابعة الطلب (track.html)
  // ============================

  async function initTrackPage() {
    const client = initSupabaseClient();
    if (!client) {
      console.error("تعذر تهيئة Supabase في صفحة متابعة الطلب");
      return;
    }

    const form = document.getElementById("track-form");
    const codeInput = document.getElementById("track-order-code");
    const phoneInput = document.getElementById("track-phone");
    const resultContainer = document.getElementById("track-result");

    if (!form || !codeInput || !phoneInput || !resultContainer) {
      console.warn("عناصر صفحة التتبع غير مكتملة.");
      return;
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const rawCode = (codeInput.value || "").trim().toUpperCase();
      const phone = (phoneInput.value || "").trim();

      if (!rawCode || !phone) {
        resultContainer.innerHTML =
          '<p class="track-error">من فضلك أدخل رقم الطلب ورقم الموبايل.</p>';
        return;
      }

      // إظهار حالة التحميل
      resultContainer.innerHTML =
        '<p class="track-loading">جاري البحث عن طلبك...</p>';

      try {
        const { data: order, error } = await client
          .from("orders")
          .select("*")
          .eq("order_code", rawCode)
          .eq("customer_phone", phone)
          .limit(1)
          .single();

        if (error) {
          console.warn("خطأ أثناء جلب الطلب:", error);
          resultContainer.innerHTML =
            '<p class="track-error">تعذر الوصول لبيانات الطلب. برجاء المحاولة مرة أخرى.</p>';
          return;
        }

        if (!order) {
          resultContainer.innerHTML =
            '<p class="track-error">لم يتم العثور على طلب بهذا الرقم ورقم الموبايل.</p>';
          return;
        }

        // جلب عناصر الطلب
        const { data: items, error: itemsError } = await client
          .from("order_items")
          .select("*")
          .eq("order_id", order.id);

        if (itemsError) {
          console.warn("خطأ أثناء جلب عناصر الطلب:", itemsError);
        }

        renderTrackResult(order, items || []);
      } catch (err) {
        console.error("استثناء أثناء جلب الطلب:", err);
        resultContainer.innerHTML =
          '<p class="track-error">حدث خطأ غير متوقع. برجاء المحاولة لاحقًا.</p>';
      }
    });
  }

  function renderTrackResult(order, items) {
    const resultContainer = document.getElementById("track-result");
    if (!resultContainer) return;

    const statusLabel = orderStatusToLabel(order.status);
    const statusBadgeClass = orderStatusToBadgeClass(order.status);
    const deliveryText = deliveryTypeToText(order.delivery_type);

    let itemsHtml = "";
    if (items && items.length) {
      itemsHtml =
        '<ul class="track-items-list">' +
        items
          .map((item) => {
            const lineTotal =
              Number(item.unit_price || 0) * Number(item.quantity || 0);
            const typeLabel =
              item.item_type === "OFFER" ? "عرض" : "صنف من القائمة";
            return `
              <li class="track-item-row">
                <div>
                  <div class="track-item-name">${item.name || ""}</div>
                  <div class="track-item-meta">${typeLabel} × ${item.quantity
              }</div>
                </div>
                <div class="track-item-price">${formatPrice(lineTotal)}</div>
              </li>
            `;
          })
          .join("") +
        "</ul>";
    } else {
      itemsHtml =
        '<p class="track-placeholder">لم يتم العثور على تفاصيل الأصناف لهذا الطلب.</p>';
    }

    resultContainer.innerHTML = `
      <div class="track-card">
        <div class="track-card-header">
          <div class="track-code">رقم الطلب: <strong>${order.order_code
      }</strong></div>
          <span class="status-badge ${statusBadgeClass}">
            ${statusLabel}
          </span>
        </div>

        <div class="track-card-body">
          <div class="track-row">
            <span class="track-label">الاسم:</span>
            <span class="track-value">${order.customer_name || "-"}</span>
          </div>
          <div class="track-row">
            <span class="track-label">الموبايل:</span>
            <span class="track-value">${order.customer_phone || "-"}</span>
          </div>
          <div class="track-row">
            <span class="track-label">العنوان:</span>
            <span class="track-value">${order.customer_address || "-"}</span>
          </div>
          <div class="track-row">
            <span class="track-label">نوع التوصيل:</span>
            <span class="track-value">${deliveryText}</span>
          </div>
          <div class="track-row">
            <span class="track-label">إجمالي الأصناف:</span>
            <span class="track-value">${formatPrice(
        order.subtotal_amount
      )}</span>
          </div>
          <div class="track-row">
            <span class="track-label">رسوم التوصيل:</span>
            <span class="track-value">${formatPrice(
        order.delivery_fee
      )}</span>
          </div>
          <div class="track-row track-row-total">
            <span class="track-label">الإجمالي المطلوب:</span>
            <span class="track-value">${formatPrice(
        order.total_amount
      )}</span>
          </div>
          ${order.notes
        ? `
          <div class="track-row">
            <span class="track-label">ملاحظات العميل:</span>
            <span class="track-value">${order.notes}</span>
          </div>`
        : ""
      }
        </div>

        <div class="track-card-items">
          <h3 class="track-items-title">تفاصيل الطلب</h3>
          ${itemsHtml}
        </div>
      </div>
    `;
  }

  // ============================
  // 6) تهيئة عامة عند تحميل الصفحة
  // ============================

  function initGlobal() {
    // أي إعدادات عامة للهيدر أو السلة
    const cart = loadCart();
    updateCartBadge(cart);
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!window.APP_CONFIG) {
      console.error(
        "APP_CONFIG غير موجود. تأكد من تحميل config.js قبل app.js"
      );
    }

    initGlobal();

    const page =
      document.body && document.body.dataset
        ? document.body.dataset.page
        : null;

    if (page === "menu") {
      initMenuPage();
    } else if (page === "cart") {
      initCartPage();
    } else if (page === "track") {
      initTrackPage();
    }
    // لاحقًا: my-orders / admin / driver ...
  });
})();
