// profile.js
// إدارة منطق صفحة الملف الشخصي

document.addEventListener("DOMContentLoaded", async () => {
    const client = window.getSupabaseClient();

    // التحقق من تسجيل الدخول
    const session = await CustomerAuth.checkSession();
    if (!session) {
        window.location.href = "customer-login.html";
        return;
    }

    // تحميل البيانات
    loadProfileData(session.user.id);
    loadAddresses(session.user.id);

    // إعداد الأزرار والنماذج
    setupEventListeners(session.user.id);
});

async function loadProfileData(userId) {
    const client = window.getSupabaseClient();
    const { data: profile, error } = await client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    if (profile) {
        document.getElementById('user-name').textContent = profile.full_name || 'عميلنا العزيز';
        document.getElementById('profile-name').value = profile.full_name || '';
        document.getElementById('profile-phone').value = profile.phone || '';
        document.getElementById('loyalty-points-count').textContent = profile.loyalty_points || 0;
    }
}

async function loadAddresses(userId) {
    const client = window.getSupabaseClient();
    const container = document.getElementById('addresses-list');

    const { data: addresses, error } = await client
        .from('customer_addresses')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    container.innerHTML = '';

    if (!addresses || addresses.length === 0) {
        container.innerHTML = '<p class="text-muted">لا توجد عناوين محفوظة.</p>';
        return;
    }

    addresses.forEach(addr => {
        const div = document.createElement('div');
        div.className = 'address-card';
        div.innerHTML = `
            <div class="address-info">
                <strong>${addr.label}</strong>
                <p>${addr.address_text}</p>
            </div>
            <button class="btn-delete-addr" data-id="${addr.id}">&times;</button>
        `;

        // زر الحذف
        div.querySelector('.btn-delete-addr').onclick = () => deleteAddress(addr.id, userId);

        container.appendChild(div);
    });
}

async function deleteAddress(addrId, userId) {
    if (!confirm('هل أنت متأكد من حذف هذا العنوان؟')) return;

    const client = window.getSupabaseClient();
    await client.from('customer_addresses').delete().eq('id', addrId);
    loadAddresses(userId);
    if (window.showToast) showToast("تم حذف العنوان", "success");
}

function setupEventListeners(userId) {
    // تسجيل الخروج
    document.getElementById('logout-btn').onclick = CustomerAuth.logout;

    // تحديث البروفايل
    document.getElementById('update-profile-form').onsubmit = async (e) => {
        e.preventDefault();
        const newName = document.getElementById('profile-name').value;
        const client = window.getSupabaseClient();

        const { error } = await client
            .from('profiles')
            .update({ full_name: newName })
            .eq('id', userId);

        if (!error) {
            if (window.showToast) showToast("تم تحديث البيانات", "success");
            document.getElementById('user-name').textContent = newName;
        } else {
            if (window.showToast) showToast("حدث خطأ", "error");
        }
    };

    // Modal العنوان
    const modal = document.getElementById('address-modal');
    const openBtn = document.getElementById('add-address-btn');
    const closeBtn = modal.querySelector('.close-modal');

    openBtn.onclick = () => modal.style.display = 'flex';
    closeBtn.onclick = () => modal.style.display = 'none';
    window.onclick = (e) => { if (e.target == modal) modal.style.display = 'none'; };

    // إضافة عنوان جديد
    document.getElementById('add-address-form').onsubmit = async (e) => {
        e.preventDefault();
        const label = document.getElementById('new-addr-label').value;
        const text = document.getElementById('new-addr-text').value;

        const client = window.getSupabaseClient();
        const { error } = await client.from('customer_addresses').insert({
            user_id: userId,
            label: label,
            address_text: text
        });

        if (!error) {
            if (window.showToast) showToast("تم إضافة العنوان", "success");
            modal.style.display = 'none';
            document.getElementById('add-address-form').reset();
            loadAddresses(userId);
        } else {
            if (window.showToast) showToast("حدث خطأ", "error");
        }
    };
}
