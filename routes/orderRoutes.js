// routes/orderRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isLoggedIn, isAdmin } = require('../middleware/auth');
const { uploadSlip } = require('../middleware/upload');

// POST checkout - create order + upload slip
router.post('/checkout', isLoggedIn, uploadSlip.single('slip'), async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const userId = req.session.user.id;
    const { shipping_address, note } = req.body;

    // Get cart items
    const { rows: cartItems } = await client.query(
      `SELECT ci.*, p.price, p.stock, p.name FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.user_id = $1 AND p.is_active = true`,
      [userId]
    );

    if (cartItems.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'ตะกร้าสินค้าว่างเปล่า' });
    }

    // Check stock
    for (const item of cartItems) {
      if (item.stock < item.quantity) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: `สินค้า "${item.name}" มีสต็อกไม่เพียงพอ` });
      }
    }

    const total = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const slip_image_url = req.file ? `/uploads/slips/${req.file.filename}` : null;
    const status = slip_image_url ? 'slip_uploaded' : 'pending';

    // Create order
    const { rows: orderResult } = await client.query(
      'INSERT INTO orders (user_id, total_amount, status, slip_image_url, shipping_address, note) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [userId, total, status, slip_image_url, shipping_address || '', note || '']
    );
    const orderId = orderResult[0].id;

    // Create order items & reduce stock
    for (const item of cartItems) {
      await client.query(
        'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1, $2, $3, $4)',
        [orderId, item.product_id, item.quantity, item.price]
      );
      await client.query(
        'UPDATE products SET stock = stock - $1 WHERE id = $2',
        [item.quantity, item.product_id]
      );
    }

    // Clear cart
    await client.query('DELETE FROM cart_items WHERE user_id = $1', [userId]);

    await client.query('COMMIT');
    res.json({ success: true, message: 'สั่งซื้อสินค้าสำเร็จ', order_id: orderId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการสั่งซื้อ' });
  } finally {
    client.release();
  }
});

// POST upload slip for existing order
router.post('/:id/slip', isLoggedIn, uploadSlip.single('slip'), async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { rows: orders } = await db.query(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2', [req.params.id, userId]
    );
    if (orders.length === 0) return res.status(404).json({ success: false, message: 'ไม่พบออเดอร์' });
    if (!req.file) return res.status(400).json({ success: false, message: 'กรุณาแนบสลิป' });

    const slip_url = `/uploads/slips/${req.file.filename}`;
    await db.query(
      "UPDATE orders SET slip_image_url = $1, status = 'slip_uploaded' WHERE id = $2",
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
    const { rows: orders } = await db.query(
      'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC',
      [req.session.user.id]
    );

    for (const order of orders) {
      const { rows: items } = await db.query(
        `SELECT oi.*, p.name, p.image_url FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = $1`,
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
      ? 'SELECT o.*, u.username, u.email, u.full_name FROM orders o JOIN users u ON o.user_id = u.id WHERE o.id = $1'
      : 'SELECT o.*, u.username FROM orders o JOIN users u ON o.user_id = u.id WHERE o.id = $1 AND o.user_id = $2';
    const params = isAdminUser ? [req.params.id] : [req.params.id, userId];

    const { rows: orders } = await db.query(query, params);
    if (orders.length === 0) return res.status(404).json({ success: false, message: 'ไม่พบออเดอร์' });

    const { rows: items } = await db.query(
      `SELECT oi.*, p.name, p.image_url FROM order_items oi
       JOIN products p ON oi.product_id = p.id WHERE oi.order_id = $1`,
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
    let paramCount = 1;
    if (status) { 
        query += ` WHERE o.status = $${paramCount++}`; 
        params.push(status); 
    }
    query += ' ORDER BY o.created_at DESC';

    const { rows: orders } = await db.query(query, params);
    for (const order of orders) {
      const { rows: items } = await db.query(
        `SELECT oi.*, p.name FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = $1`,
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
    await db.query('UPDATE orders SET status = $1 WHERE id = $2', [status, req.params.id]);
    res.json({ success: true, message: 'อัปเดตสถานะสำเร็จ' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

// GET members list (admin)
router.get('/admin/members', isAdmin, async (req, res) => {
  try {
    const { rows: members } = await db.query(
      'SELECT id, username, email, full_name, phone, role, created_at FROM users ORDER BY created_at DESC'
    );
    res.json({ success: true, members });
  } catch (err) {
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

module.exports = router;
