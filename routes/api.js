const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/stats', (req, res) => {
  const totalUsers = db.prepare("SELECT COUNT(*) as c FROM users WHERE role='member'").get().c;
  const totalSold = db.prepare("SELECT COALESCE(SUM(quantity),0) as c FROM orders").get().c;
  const totalRevenue = db.prepare("SELECT COALESCE(SUM(amount),0) as c FROM transactions WHERE type='topup'").get().c;
  const uniqueVisitors = db.prepare("SELECT COUNT(DISTINCT ip) as c FROM visits").get().c;
  res.json({ totalUsers, totalSold, totalRevenue, uniqueVisitors });
});

module.exports = router;
