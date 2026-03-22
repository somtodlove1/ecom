// middleware/auth.js
function isLoggedIn(req, res, next) {
  if (req.session && req.session.user) {
    next();
  } else {
    res.status(401).json({ success: false, message: 'กรุณาเข้าสู่ระบบก่อน' });
  }
}

function isAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์เข้าถึง' });
  }
}

module.exports = { isLoggedIn, isAdmin };
