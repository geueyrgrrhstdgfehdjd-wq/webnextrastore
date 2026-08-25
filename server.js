const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000;
const db = require('./database');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

app.use(session({
  secret: process.env.SESSION_SECRET || 'nextrastore-fallback-' + Date.now(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  }
}));
app.use(flash());

app.use((req, res, next) => {
  if (req.path !== '/favicon.ico' && !req.path.startsWith('/uploads')) {
    try {
      db.prepare(`INSERT INTO visits (ip, user_agent, user_id, path) VALUES (?, ?, ?, ?)`)
        .run(req.ip || 'unknown', (req.headers['user-agent'] || '').substring(0, 200), req.session.userId || null, req.path);
    } catch (e) {}
  }
  next();
});

app.use((req, res, next) => {
  res.locals.user = null;
  res.locals.isAdmin = false;
  res.locals.settings = {};
  res.locals.flash = { success: req.flash('success'), error: req.flash('error') };

  db.prepare('SELECT * FROM settings').all().forEach(r => { res.locals.settings[r.key] = r.value; });

  if (req.session.userId) {
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
    if (u) {
      const rank = u.rank_id ? db.prepare('SELECT * FROM ranks WHERE id = ?').get(u.rank_id) : null;
      res.locals.user = { ...u, rank };
      res.locals.isAdmin = u.role === 'admin';
    }
  }

  const s = res.locals.settings;
  res.locals.dynamicCSS = `:root{--primary:${s.primary_color||'#8b5cf6'};--accent:${s.accent_color||'#06b6d4'};--secondary:${s.secondary_color||'#ec4899'};--bg:${s.bg_color||'#0a0a14'};--card:${s.card_color||'#14141f'};--text:${s.text_color||'#e5e7eb'};--text-muted:${s.text_muted_color||'#9ca3af'};--border:${s.border_color||'#1f1f2e'};--input:${s.input_color||'#0d0d16'};--success:${s.success_color||'#10b981'};--danger:${s.danger_color||'#ef4444'};--radius:${s.layout_border_radius_global||'16'}px;--blur:${s.effect_blur||'20'}px;--max-width:${s.layout_max_width||'1280'}px;--font:'${s.font_family||'Inter'}',sans-serif;--font-size:${s.font_size_base||'14'}px;}`;
  next();
});

app.use('/', require('./routes/auth'));
app.use('/', require('./routes/shop'));
app.use('/topup', require('./routes/topup'));
app.use('/admin', require('./routes/admin'));
app.use('/api', require('./routes/api'));

app.get('/', (req, res) => res.render('landing'));
app.get('/healthz', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`nextrastore running on port ${PORT}`);
  console.log('Admin: nextrastore / websitenextra');
});
