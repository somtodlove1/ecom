// public/js/utils.js - Shared utilities

// Toast notifications
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Format price
function formatPrice(price) {
  return Number(price).toLocaleString('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 2 });
}

// Format date
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('th-TH', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// Status labels
const STATUS_LABELS = {
  pending: 'รอชำระเงิน',
  slip_uploaded: 'แนบสลิปแล้ว',
  confirmed: 'ยืนยันแล้ว',
  shipping: 'กำลังจัดส่ง',
  completed: 'เสร็จสิ้น',
  cancelled: 'ยกเลิก'
};

// API wrapper
async function api(url, options = {}) {
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      ...options
    });
    return await res.json();
  } catch (err) {
    return { success: false, message: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้' };
  }
}

// Check auth and update navbar
async function initNavbar() {
  const data = await api('/api/auth/me');
  const cartCount = document.getElementById('cart-count');
  const navAuth = document.getElementById('nav-auth');
  const navAdmin = document.getElementById('nav-admin');

  if (data.success && data.user) {
    if (navAuth) {
      navAuth.innerHTML = `
        <span style="color:var(--text-muted);font-size:0.9rem;">สวัสดี, ${data.user.full_name || data.user.username}</span>
        <a href="/profile">โปรไฟล์ส่วนตัว</a>
        <a href="/orders">ออเดอร์ของฉัน</a>
        <a href="#" onclick="logout()">ออกจากระบบ</a>
      `;
    }
    if (navAdmin && data.user.role === 'admin') {
      navAdmin.style.display = 'flex';
    }
    // Load cart count
    if (cartCount) {
      const cartData = await api('/api/cart/count');
      if (cartData.success && cartData.count > 0) {
        cartCount.textContent = cartData.count;
        cartCount.style.display = 'flex';
      }
    }
  } else {
    if (navAuth) {
      navAuth.innerHTML = `
        <a href="/login">เข้าสู่ระบบ</a>
        <a href="/register" class="btn btn-primary btn-sm">สมัครสมาชิก</a>
      `;
    }
  }
}

async function logout() {
  await api('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login';
}

async function addToCart(productId) {
  const data = await api('/api/cart/add', {
    method: 'POST',
    body: JSON.stringify({ product_id: productId, quantity: 1 })
  });
  if (data.success) {
    showToast('เพิ่มสินค้าลงตะกร้าแล้ว', 'success');
    // Update cart count
    const cartCount = document.getElementById('cart-count');
    if (cartCount) {
      const c = await api('/api/cart/count');
      if (c.success) {
        cartCount.textContent = c.count;
        cartCount.style.display = 'flex';
      }
    }
  } else if (data.message === 'กรุณาเข้าสู่ระบบก่อน') {
    showToast('กรุณาเข้าสู่ระบบก่อนเพิ่มสินค้า', 'warning');
    setTimeout(() => window.location.href = '/login', 1500);
  } else {
    showToast(data.message, 'error');
  }
}

// Default product image fallback
function imgError(el) {
  el.src = 'https://via.placeholder.com/300x220/161628/6C63FF?text=No+Image';
}
