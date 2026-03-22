// server.js
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// ============ Middleware ============
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/views', express.static(path.join(__dirname, 'views')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'secret_key_change_me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 1 day
  }
}));

// ============ Routes ============
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);

// Admin members route
app.get('/api/members', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์' });
  }
  try {
    const db = require('./config/db');
    const { rows: members } = await db.query(
      'SELECT id, username, email, full_name, phone, role, created_at FROM users ORDER BY created_at DESC'
    );
    res.json({ success: true, members });
  } catch (err) {
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

// ============ HTML Page Routes ============
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views/index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'views/login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'views/register.html')));
app.get('/cart', (req, res) => res.sendFile(path.join(__dirname, 'views/cart.html')));
app.get('/checkout', (req, res) => res.sendFile(path.join(__dirname, 'views/checkout.html')));
app.get('/orders', (req, res) => res.sendFile(path.join(__dirname, 'views/orders.html')));
app.get('/profile', (req, res) => res.sendFile(path.join(__dirname, 'views/profile.html')));
app.get('/product/:id', (req, res) => res.sendFile(path.join(__dirname, 'views/product-detail.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'views/admin/dashboard.html')));
app.get('/admin/products', (req, res) => res.sendFile(path.join(__dirname, 'views/admin/products.html')));
app.get('/admin/orders', (req, res) => res.sendFile(path.join(__dirname, 'views/admin/orders.html')));
app.get('/admin/members', (req, res) => res.sendFile(path.join(__dirname, 'views/admin/members.html')));

// ============ Start Server ============
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log(`📦 Database: ${process.env.DB_NAME}@${process.env.DB_HOST}`);
});
