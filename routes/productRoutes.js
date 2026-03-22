// routes/productRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { isAdmin } = require('../middleware/auth');
const { uploadProduct } = require('../middleware/upload');

// GET all products (with optional search & category filter)
router.get('/', async (req, res) => {
  try {
    const { search, category, sort } = req.query;
    let query = `
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = 1
    `;
    const params = [];

    if (search) {
      query += ' AND (p.name LIKE ? OR p.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    if (category) {
      query += ' AND c.slug = ?';
      params.push(category);
    }

    if (sort === 'price_asc') query += ' ORDER BY p.price ASC';
    else if (sort === 'price_desc') query += ' ORDER BY p.price DESC';
    else if (sort === 'newest') query += ' ORDER BY p.created_at DESC';
    else query += ' ORDER BY p.id ASC';

    const [products] = await db.execute(query, params);
    res.json({ success: true, products });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

// GET single product
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT p.*, c.name as category_name 
       FROM products p LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = ? AND p.is_active = 1`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ success: false, message: 'ไม่พบสินค้า' });
    res.json({ success: true, product: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

// GET all categories
router.get('/cats/all', async (req, res) => {
  try {
    const [cats] = await db.execute('SELECT * FROM categories');
    res.json({ success: true, categories: cats });
  } catch (err) {
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

// POST create product (admin)
router.post('/', isAdmin, uploadProduct.single('image'), async (req, res) => {
  try {
    const { name, description, price, stock, category_id } = req.body;
    const image_url = req.file ? `/uploads/products/${req.file.filename}` : '/uploads/products/default.jpg';

    await db.execute(
      'INSERT INTO products (name, description, price, stock, image_url, category_id) VALUES (?, ?, ?, ?, ?, ?)',
      [name, description, price, stock || 0, image_url, category_id || null]
    );
    res.json({ success: true, message: 'เพิ่มสินค้าสำเร็จ' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

// PUT update product (admin)
router.put('/:id', isAdmin, uploadProduct.single('image'), async (req, res) => {
  try {
    const { name, description, price, stock, category_id, is_active } = req.body;
    const [existing] = await db.execute('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ success: false, message: 'ไม่พบสินค้า' });

    const image_url = req.file ? `/uploads/products/${req.file.filename}` : existing[0].image_url;

    await db.execute(
      'UPDATE products SET name=?, description=?, price=?, stock=?, image_url=?, category_id=?, is_active=? WHERE id=?',
      [name, description, price, stock, image_url, category_id || null, is_active !== undefined ? is_active : existing[0].is_active, req.params.id]
    );
    res.json({ success: true, message: 'อัปเดตสินค้าสำเร็จ' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

// DELETE product (admin)
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    await db.execute('UPDATE products SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'ลบสินค้าสำเร็จ' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

// GET all products for admin (including inactive)
router.get('/admin/all', isAdmin, async (req, res) => {
  try {
    const [products] = await db.execute(
      `SELECT p.*, c.name as category_name FROM products p 
       LEFT JOIN categories c ON p.category_id = c.id ORDER BY p.id DESC`
    );
    res.json({ success: true, products });
  } catch (err) {
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

module.exports = router;
