const express = require('express');
const router = express.Router();
const db = require('../database');
const { requireAuth } = require('../middleware/auth');

router.get('/topup', requireAuth, (req, res) => res.render('topup'));

router.post('/topup', requireAuth, async (req, res) => {
  const { link } = req.body;
  const match = link.match(/[?&]v=([A-Za-z0-9]+)/);
  if (!match) { req.flash('error', 'ลิงก์ซองไม่ถูกต้อง'); return res.redirect('/topup'); }
  const code = match[1];

  if (db.prepare('SELECT id FROM used_vouchers WHERE voucher_code = ?').get(code)) {
    req.flash('error', 'ซองนี้ถูกใช้ไปแล้ว');
    return res.redirect('/topup');
  }

  const phone = db.prepare("SELECT value FROM settings WHERE key='truemoney_phone'").get()?.value;
  if (!phone) { req.flash('error', 'ยังไม่ได้ตั้งเบอร์รับซอง'); return res.redirect('/topup'); }

  try {
    const fetch = (await import('node-fetch')).default;
    const apiRes = await fetch(`https://api.truemoney.net/api/v1/payment_link/${phone}/${code}`);
    const data = await apiRes.json();

    if (data?.status?.code !== '0' || data.data?.voucher?.status !== 'active') {
      req.flash('error', 'ซองไม่ถูกต้องหรือถูกใช้แล้ว');
      return res.redirect('/topup');
    }

    const amount = parseFloat(data.data.amount || 0);
    db.transaction(() => {
      db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(amount, req.session.userId);
      db.prepare(`INSERT INTO used_vouchers (voucher_code, phone, amount, used_by) VALUES (?, ?, ?, ?)`).run(code, phone, amount, req.session.userId);
      db.prepare(`INSERT INTO transactions (user_id, type, amount, ref, note) VALUES (?, 'topup', ?, ?, 'TrueMoney')`).run(req.session.userId, amount, code);
    })();
    req.flash('success', `เติมเงินสำเร็จ +${amount} บาท`);
    res.redirect('/profile');
  } catch (err) {
    req.flash('error', 'เชื่อมต่อ TrueMoney ไม่ได้');
    res.redirect('/topup');
  }
});

module.exports = router;
