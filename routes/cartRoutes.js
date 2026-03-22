// routes/cartRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isLoggedIn } = require('../middleware/auth');

// GET cart items
router.get('/', isLoggedIn, async (req, res) => {
  try {
    const { rows: items } = await db.query(
      `SELECT ci.*, p.name, p.price, p.image_url, p.stock 
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.user_id = $1 AND p.is_active = true
       ORDER BY ci.created_at DESC`,
      [req.session.user.id]
    );
    res.json({ success: true, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

// GET cart count
router.get('/count', async (req, res) => {
  if (!req.session || !req.session.user) return res.json({ success: true, count: 0 });
  try {
    const { rows } = await db.query(
      'SELECT SUM(quantity) as count FROM cart_items WHERE user_id = $1',
      [req.session.user.id]
    );
    res.json({ success: true, count: rows[0].count || 0 });
  } catch (err) {
    res.status(500).json({ success: false, count: 0 });
  }
});

// POST add to cart
router.post('/add', isLoggedIn, async (req, res) => {
  try {
    const { product_id, quantity } = req.body;
    const userId = req.session.user.id;
    const qty = parseInt(quantity) || 1;

    // Check product exists and stock
    const { rows: productRows } = await db.query('SELECT * FROM products WHERE id = $1 AND is_active = true', [product_id]);
    if (productRows.length === 0) return res.status(404).json({ success: false, message: 'ไม่พบสินค้า' });
    const product = productRows[0];

    const { rows: existing } = await db.query(
      'SELECT * FROM cart_items WHERE user_id = $1 AND product_id = $2', [userId, product_id]
    );

    let currentQty = existing.length > 0 ? existing[0].quantity : 0;
    if (currentQty + qty > product.stock) {
      return res.status(400).json({ success: false, message: 'สินค้าในสต็อกไม่เพียงพอ' });
    }

    if (existing.length > 0) {
      await db.query('UPDATE cart_items SET quantity = $1 WHERE user_id = $2 AND product_id = $3',
        [currentQty + qty, userId, product_id]
      );
    } else {
      await db.query('INSERT INTO cart_items (user_id, product_id, quantity) VALUES ($1, $2, $3)',
        [userId, product_id, qty]
      );
    }

    res.json({ success: true, message: 'เพิ่มลงตะกร้าแล้ว' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

// PUT update quantity
router.put('/update/:cart_item_id', isLoggedIn, async (req, res) => {
  try {
    const { quantity } = req.body;
    const cart_item_id = req.params.cart_item_id;
    const userId = req.session.user.id;

    if (quantity <= 0) {
      await db.query('DELETE FROM cart_items WHERE id = $1 AND user_id = $2', [cart_item_id, userId]);
      return res.json({ success: true, message: 'ลบสินค้าแล้ว' });
    }

    const { rows: itemRows } = await db.query(
      `SELECT ci.*, p.stock FROM cart_items ci JOIN products p ON ci.product_id = p.id WHERE ci.id = $1 AND ci.user_id = $2`,
      [cart_item_id, userId]
    );
    if (itemRows.length === 0) return res.status(404).json({ success: false, message: 'ไม่พบสินค้าในตะกร้า' });
    const item = itemRows[0];
    
    if (quantity > item.stock) {
      return res.status(400).json({ success: false, message: 'สินค้าในสต็อกไม่เพียงพอ' });
    }

    await db.query('UPDATE cart_items SET quantity = $1 WHERE id = $2 AND user_id = $3',
      [quantity, cart_item_id, userId]
    );
    res.json({ success: true, message: 'อัปเดตจำนวนแล้ว' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

// DELETE single item
router.delete('/remove/:cart_item_id', isLoggedIn, async (req, res) => {
  try {
    await db.query('DELETE FROM cart_items WHERE id = $1 AND user_id = $2',
      [req.params.cart_item_id, req.session.user.id]
    );
    res.json({ success: true, message: 'ลบสินค้าออกจากตะกร้าแล้ว' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

// DELETE clear cart
router.delete('/clear', isLoggedIn, async (req, res) => {
  try {
    await db.query('DELETE FROM cart_items WHERE user_id = $1', [req.session.user.id]);
    res.json({ success: true, message: 'ล้างตะกร้าสินค้าแล้ว' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

module.exports = router;
