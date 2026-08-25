const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../database');

router.get('/login', (req, res) => req.session.userId ? res.redirect('/shop') : res.render('login'));
router.get('/register', (req, res) => req.session.userId ? res.redirect('/shop') : res.render('register'));

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const u = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!u || !bcrypt.compareSync(password, u.password)) {
    req.flash('error', 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    return res.redirect('/login');
  }
  req.session.userId = u.id;
  res.redirect('/shop');
});

router.post('/register', (req, res) => {
  const { username, password, confirm } = req.body;
  if (username.length < 3 || password.length < 4 || password !== confirm) {
    req.flash('error', 'ข้อมูลไม่ถูกต้อง');
    return res.redirect('/register');
  }
  if (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
    req.flash('error', 'ชื่อผู้ใช้ซ้ำ');
    return res.redirect('/register');
  }
  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(`INSERT INTO users (username, password, role, bio) VALUES (?, ?, 'member', 'สมาชิกใหม่')`).run(username, hash);
  req.session.userId = result.lastInsertRowid;
  res.redirect('/shop');
});

router.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });

module.exports = router;
