// routes/cartRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isLoggedIn } = require('../middleware/auth');

// GET cart
router.get('/', isLoggedIn, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const [items] = await db.execute(
      `SELECT ci.id, ci.quantity, p.id as product_id, p.name, p.price, p.image_url, p.stock
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.user_id = ? AND p.is_active = 1`,
      [userId]
    );
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    res.json({ success: true, items, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

// GET cart count
router.get('/count', isLoggedIn, async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT SUM(quantity) as count FROM cart_items WHERE user_id = ?',
      [req.session.user.id]
    );
    res.json({ success: true, count: rows[0].count || 0 });
  } catch (err) {
    res.json({ success: true, count: 0 });
  }
});

// POST add to cart
router.post('/add', isLoggedIn, async (req, res) => {
  try {
    const { product_id, quantity = 1 } = req.body;
    const userId = req.session.user.id;

    const [product] = await db.execute('SELECT * FROM products WHERE id = ? AND is_active = 1', [product_id]);
    if (product.length === 0) return res.status(404).json({ success: false, message: 'ไม่พบสินค้า' });
    if (product[0].stock < 1) return res.status(400).json({ success: false, message: 'สินค้าหมด' });

    const [existing] = await db.execute(
      'SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?', [userId, product_id]
    );

    if (existing.length > 0) {
      const newQty = Math.min(existing[0].quantity + quantity, product[0].stock);
      await db.execute('UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ?',
        [newQty, userId, product_id]);
    } else {
      await db.execute('INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)',
        [userId, product_id, Math.min(quantity, product[0].stock)]);
    }

    res.json({ success: true, message: 'เพิ่มสินค้าในตะกร้าสำเร็จ' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

// PUT update quantity
router.put('/update', isLoggedIn, async (req, res) => {
  try {
    const { cart_item_id, quantity } = req.body;
    const userId = req.session.user.id;

    if (quantity < 1) {
      await db.execute('DELETE FROM cart_items WHERE id = ? AND user_id = ?', [cart_item_id, userId]);
      return res.json({ success: true, message: 'ลบสินค้าออกจากตะกร้า' });
    }

    const [item] = await db.execute(
      `SELECT ci.*, p.stock FROM cart_items ci JOIN products p ON ci.product_id = p.id
       WHERE ci.id = ? AND ci.user_id = ?`, [cart_item_id, userId]
    );
    if (item.length === 0) return res.status(404).json({ success: false, message: 'ไม่พบรายการ' });

    const newQty = Math.min(quantity, item[0].stock);
    await db.execute('UPDATE cart_items SET quantity = ? WHERE id = ? AND user_id = ?',
      [newQty, cart_item_id, userId]);

    res.json({ success: true, message: 'อัปเดตตะกร้าสำเร็จ' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

// DELETE remove item
router.delete('/remove/:id', isLoggedIn, async (req, res) => {
  try {
    await db.execute('DELETE FROM cart_items WHERE id = ? AND user_id = ?',
      [req.params.id, req.session.user.id]);
    res.json({ success: true, message: 'ลบสินค้าออกจากตะกร้าสำเร็จ' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

// DELETE clear cart
router.delete('/clear', isLoggedIn, async (req, res) => {
  try {
    await db.execute('DELETE FROM cart_items WHERE user_id = ?', [req.session.user.id]);
    res.json({ success: true, message: 'ล้างตะกร้าสำเร็จ' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

module.exports = router;
