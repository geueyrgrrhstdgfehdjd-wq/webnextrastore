const bcrypt = require('bcryptjs');
const db = require('../database');
const USERNAME = process.argv[2] || 'nextrastore';
const PASSWORD = process.argv[3] || 'websitenextra';
const hash = bcrypt.hashSync(PASSWORD, 10);
const existing = db.prepare('SELECT id FROM users WHERE username=?').get(USERNAME);
if (existing) db.prepare(`UPDATE users SET password=?, role='admin', balance=99999 WHERE id=?`).run(hash, existing.id);
else db.prepare(`INSERT INTO users (username,password,role,balance,bio) VALUES (?,?,'admin',99999,'Admin')`).run(USERNAME, hash);
console.log('Admin reset:', USERNAME);
