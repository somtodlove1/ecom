// routes/orderRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isLoggedIn, isAdmin } = require('../middleware/auth');
const { uploadSlip } = require('../middleware/upload');

// POST checkout - create order + upload slip
router.post('/checkout', isLoggedIn, uploadSlip.single('slip'), async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const userId = req.session.user.id;
    const { shipping_address, note } = req.body;

    // Get cart items
    const [cartItems] = await conn.execute(
      `SELECT ci.*, p.price, p.stock, p.name FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.user_id = ? AND p.is_active = 1`,
      [userId]
    );

    if (cartItems.length === 0) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'ตะกร้าสินค้าว่างเปล่า' });
    }

    // Check stock
    for (const item of cartItems) {
      if (item.stock < item.quantity) {
        await conn.rollback();
        return res.status(400).json({ success: false, message: `สินค้า "${item.name}" มีสต็อกไม่เพียงพอ` });
      }
    }

    const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const slip_image_url = req.file ? `/uploads/slips/${req.file.filename}` : null;
    const status = slip_image_url ? 'slip_uploaded' : 'pending';

    // Create order
    const [orderResult] = await conn.execute(
      'INSERT INTO orders (user_id, total_amount, status, slip_image_url, shipping_address, note) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, total, status, slip_image_url, shipping_address || '', note || '']
    );
    const orderId = orderResult.insertId;

    // Create order items & reduce stock
    for (const item of cartItems) {
      await conn.execute(
        'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
        [orderId, item.product_id, item.quantity, item.price]
      );
      await conn.execute(
        'UPDATE products SET stock = stock - ? WHERE id = ?',
        [item.quantity, item.product_id]
      );
    }

    // Clear cart
    await conn.execute('DELETE FROM cart_items WHERE user_id = ?', [userId]);

    await conn.commit();
    res.json({ success: true, message: 'สั่งซื้อสินค้าสำเร็จ', order_id: orderId });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการสั่งซื้อ' });
  } finally {
    conn.release();
  }
});

// POST upload slip for existing order
router.post('/:id/slip', isLoggedIn, uploadSlip.single('slip'), async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [orders] = await db.execute(
      'SELECT * FROM orders WHERE id = ? AND user_id = ?', [req.params.id, userId]
    );
    if (orders.length === 0) return res.status(404).json({ success: false, message: 'ไม่พบออเดอร์' });
    if (!req.file) return res.status(400).json({ success: false, message: 'กรุณาแนบสลิป' });

    const slip_url = `/uploads/slips/${req.file.filename}`;
    await db.execute(
      "UPDATE orders SET slip_image_url = ?, status = 'slip_uploaded' WHERE id = ?",
      [slip_url, req.params.id]
    );
    res.json({ success: true, message: 'แนบสลิปสำเร็จ' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

// GET my orders (member)
router.get('/my', isLoggedIn, async (req, res) => {
  try {
    const [orders] = await db.execute(
      'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
      [req.session.user.id]
    );

    for (const order of orders) {
      const [items] = await db.execute(
        `SELECT oi.*, p.name, p.image_url FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ?`,
        [order.id]
      );
      order.items = items;
    }

    res.json({ success: true, orders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

// GET single order detail
router.get('/:id', isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const isAdminUser = req.session.user.role === 'admin';
    const query = isAdminUser
      ? 'SELECT o.*, u.username, u.email, u.full_name FROM orders o JOIN users u ON o.user_id = u.id WHERE o.id = ?'
      : 'SELECT o.*, u.username FROM orders o JOIN users u ON o.user_id = u.id WHERE o.id = ? AND o.user_id = ?';
    const params = isAdminUser ? [req.params.id] : [req.params.id, userId];

    const [orders] = await db.execute(query, params);
    if (orders.length === 0) return res.status(404).json({ success: false, message: 'ไม่พบออเดอร์' });

    const [items] = await db.execute(
      `SELECT oi.*, p.name, p.image_url FROM order_items oi
       JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?`,
      [req.params.id]
    );

    res.json({ success: true, order: { ...orders[0], items } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

// GET all orders (admin)
router.get('/', isAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    let query = `SELECT o.*, u.username, u.email, u.full_name 
                 FROM orders o JOIN users u ON o.user_id = u.id`;
    const params = [];
    if (status) { query += ' WHERE o.status = ?'; params.push(status); }
    query += ' ORDER BY o.created_at DESC';

    const [orders] = await db.execute(query, params);
    for (const order of orders) {
      const [items] = await db.execute(
        `SELECT oi.*, p.name FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?`,
        [order.id]
      );
      order.items = items;
    }
    res.json({ success: true, orders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

// PUT update order status (admin)
router.put('/:id/status', isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'slip_uploaded', 'confirmed', 'shipping', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'สถานะไม่ถูกต้อง' });
    }
    await db.execute('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true, message: 'อัปเดตสถานะสำเร็จ' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

// GET members list (admin)
router.get('/admin/members', isAdmin, async (req, res) => {
  try {
    const [members] = await db.execute(
      'SELECT id, username, email, full_name, phone, role, created_at FROM users ORDER BY created_at DESC'
    );
    res.json({ success: true, members });
  } catch (err) {
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

module.exports = router;
