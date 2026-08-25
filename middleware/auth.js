function requireAuth(req, res, next) {
  if (!req.session.userId) return res.redirect('/login');
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.userId) return res.redirect('/login');
  const db = require('../database');
  const u = db.prepare('SELECT role FROM users WHERE id = ?').get(req.session.userId);
  if (!u || u.role !== 'admin') return res.redirect('/shop');
  next();
}

module.exports = { requireAuth, requireAdmin };
