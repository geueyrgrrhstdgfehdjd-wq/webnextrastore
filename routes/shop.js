const express = require('express');
const router = express.Router();
const db = require('../database');
const { requireAuth } = require('../middleware/auth');

router.get('/enter', (req, res) => res.redirect(req.session.userId ? '/shop' : '/login'));

router.get('/shop', requireAuth, (req, res) => {
  const shopStatus = db.prepare("SELECT value FROM settings WHERE key='shop_status'").get()?.value;
  if (shopStatus === 'closed' && res.locals.user.role !== 'admin') {
    return res.render('shop', { products: [], categories: [], shopClosed: true });
  }
  const categories = db.prepare('SELECT * FROM categories ORDER BY sort_order').all();
  const products = db.prepare(`
    SELECT p.*, c.name AS category_name FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.status = 'open' ORDER BY p.sort_order, p.id DESC
  `).all();
  res.render('shop', { products, categories, shopClosed: false });
});

router.get('/profile', requireAuth, (req, res) => {
  const user = db.prepare(`
    SELECT u.*, r.name as rank_name, r.badge_color, r.icon as rank_icon, r.discount
    FROM users u LEFT JOIN ranks r ON u.rank_id = r.id WHERE u.id = ?
  `).get(req.session.userId);
  const orders = db.prepare(`
    SELECT o.*, p.name as product_name, p.image FROM orders o
    LEFT JOIN products p ON o.product_id = p.id
    WHERE o.user_id = ? ORDER BY o.id DESC LIMIT 20
  `).all(req.session.userId);
  const transactions = db.prepare(`SELECT * FROM transactions WHERE user_id = ? ORDER BY id DESC LIMIT 20`).all(req.session.userId);
  res.render('profile', { user, orders, transactions });
});

router.post('/profile/update', requireAuth, (req, res) => {
  db.prepare('UPDATE users SET bio = ? WHERE id = ?').run(req.body.bio || '', req.session.userId);
  res.redirect('/profile');
});

router.get('/contact', requireAuth, (req, res) => res.render('contact'));

router.post('/buy/:id', requireAuth, (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  if (!product || product.stock < 1) { req.flash('error', 'สินค้าหมด'); return res.redirect('/shop'); }
  if (user.balance < product.price) { req.flash('error', 'ยอดเงินไม่เพียงพอ'); return res.redirect('/topup'); }

  const txn = db.transaction(() => {
    db.prepare('UPDATE users SET balance = balance - ?, total_spent = total_spent + ? WHERE id = ?').run(product.price, product.price, user.id);
    db.prepare('UPDATE products SET stock = stock - 1, sold = sold + 1 WHERE id = ?').run(product.id);
    db.prepare(`INSERT INTO orders (user_id, product_id, product_name, quantity, total_price) VALUES (?, ?, ?, 1, ?)`).run(user.id, product.id, product.name, product.price);
    db.prepare(`INSERT INTO transactions (user_id, type, amount, product_id, note) VALUES (?, 'purchase', ?, ?, ?)`).run(user.id, product.price, product.id, `ซื้อ ${product.name}`);
  });
  txn();
  req.flash('success', `ซื้อ ${product.name} สำเร็จ`);
  res.redirect('/profile');
});

module.exports = router;
