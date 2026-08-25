const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('../database');
const { requireAdmin } = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../public/uploads'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 5*1024*1024 } });

router.use(requireAdmin);

router.get('/', (req, res) => res.redirect('/admin/dashboard'));

router.get('/dashboard', (req, res) => {
  const stats = {
    totalUsers: db.prepare("SELECT COUNT(*) c FROM users WHERE role='member'").get().c,
    totalAdmins: db.prepare("SELECT COUNT(*) c FROM users WHERE role='admin'").get().c,
    totalSold: db.prepare("SELECT COALESCE(SUM(quantity),0) c FROM orders").get().c,
    totalRevenue: db.prepare("SELECT COALESCE(SUM(amount),0) c FROM transactions WHERE type='topup'").get().c,
    uniqueVisitors: db.prepare("SELECT COUNT(DISTINCT ip) c FROM visits").get().c,
    todayVisits: db.prepare("SELECT COUNT(*) c FROM visits WHERE date(created_at)=date('now','localtime')").get().c,
    todayTopup: db.prepare("SELECT COALESCE(SUM(amount),0) c FROM transactions WHERE type='topup' AND date(created_at)=date('now','localtime')").get().c,
    totalPurchases: db.prepare("SELECT COALESCE(SUM(amount),0) c FROM transactions WHERE type='purchase'").get().c,
    totalProducts: db.prepare("SELECT COUNT(*) c FROM products").get().c,
    totalCategories: db.prepare("SELECT COUNT(*) c FROM categories").get().c,
    totalOrders: db.prepare("SELECT COUNT(*) c FROM orders").get().c,
  };
  res.render('admin/dashboard', { ...stats, recentOrders: [], recentTopups: [] });
});

router.get('/settings', (req, res) => {
  const settings = {};
  db.prepare('SELECT * FROM settings').all().forEach(s => settings[s.key] = s.value);
  res.render('admin/settings', { settings });
});

router.post('/settings', (req, res) => {
  const allowed = ['shop_status','shop_name','shop_description','primary_color','bg_color','card_color','text_color','accent_color','contact_line','contact_facebook','truemoney_phone','announcement','min_topup','register_bonus'];
  const stmt = db.prepare(`INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`);
  allowed.forEach(k => { if (req.body[k] !== undefined) stmt.run(k, String(req.body[k])); });
  res.redirect('/admin/settings');
});

router.get('/ranks', (req, res) => res.render('admin/ranks', { ranks: db.prepare('SELECT * FROM ranks ORDER BY sort_order').all() }));
router.post('/ranks/add', (req, res) => {
  db.prepare('INSERT INTO ranks (name, discount, badge_color, icon, min_spent, sort_order) VALUES (?, ?, ?, ?, ?, ?)').run(req.body.name, parseFloat(req.body.discount)||0, req.body.badge_color||'#8b5cf6', req.body.icon||'crown', parseFloat(req.body.min_spent)||0, parseInt(req.body.sort_order)||0);
  res.redirect('/admin/ranks');
});
router.post('/ranks/edit/:id', (req, res) => {
  db.prepare('UPDATE ranks SET name=?, discount=?, badge_color=?, icon=?, min_spent=?, sort_order=? WHERE id=?').run(req.body.name, parseFloat(req.body.discount)||0, req.body.badge_color, req.body.icon, parseFloat(req.body.min_spent)||0, parseInt(req.body.sort_order)||0, req.params.id);
  res.redirect('/admin/ranks');
});
router.post('/ranks/delete/:id', (req, res) => {
  db.prepare('UPDATE users SET rank_id=NULL WHERE rank_id=?').run(req.params.id);
  db.prepare('DELETE FROM ranks WHERE id=?').run(req.params.id);
  res.redirect('/admin/ranks');
});

router.get('/categories', (req, res) => {
  const categories = db.prepare(`SELECT c.*, COUNT(p.id) as product_count FROM categories c LEFT JOIN products p ON p.category_id=c.id GROUP BY c.id ORDER BY c.sort_order`).all();
  res.render('admin/categories', { categories });
});
router.post('/categories/add', (req, res) => { db.prepare('INSERT INTO categories (name, icon, sort_order) VALUES (?,?,?)').run(req.body.name, req.body.icon||'box', parseInt(req.body.sort_order)||0); res.redirect('/admin/categories'); });
router.post('/categories/edit/:id', (req, res) => { db.prepare('UPDATE categories SET name=?, icon=?, sort_order=? WHERE id=?').run(req.body.name, req.body.icon, parseInt(req.body.sort_order)||0, req.params.id); res.redirect('/admin/categories'); });
router.post('/categories/delete/:id', (req, res) => { db.prepare('UPDATE products SET category_id=NULL WHERE category_id=?').run(req.params.id); db.prepare('DELETE FROM categories WHERE id=?').run(req.params.id); res.redirect('/admin/categories'); });

router.get('/products', (req, res) => {
  res.render('admin/products', {
    products: db.prepare(`SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id=c.id ORDER BY p.sort_order, p.id DESC`).all(),
    categories: db.prepare('SELECT * FROM categories ORDER BY sort_order').all()
  });
});
router.post('/products/add', upload.single('image'), (req, res) => {
  const image = req.file ? '/uploads/' + req.file.filename : '';
  db.prepare(`INSERT INTO products (name, description, price, stock, category_id, sort_order, image) VALUES (?,?,?,?,?,?,?)`).run(req.body.name, req.body.description||'', parseFloat(req.body.price)||0, parseInt(req.body.stock)||0, req.body.category_id||null, parseInt(req.body.sort_order)||0, image);
  res.redirect('/admin/products');
});
router.post('/products/edit/:id', upload.single('image'), (req, res) => {
  const existing = db.prepare('SELECT image FROM products WHERE id=?').get(req.params.id);
  const image = req.file ? '/uploads/' + req.file.filename : existing?.image || '';
  db.prepare(`UPDATE products SET name=?, description=?, price=?, stock=?, category_id=?, sort_order=?, image=?, status=? WHERE id=?`).run(req.body.name, req.body.description||'', parseFloat(req.body.price)||0, parseInt(req.body.stock)||0, req.body.category_id||null, parseInt(req.body.sort_order)||0, image, req.body.status||'open', req.params.id);
  res.redirect('/admin/products');
});
router.post('/products/delete/:id', (req, res) => { db.prepare('DELETE FROM products WHERE id=?').run(req.params.id); res.redirect('/admin/products'); });

router.get('/stock', (req, res) => res.render('admin/stock', { products: db.prepare(`SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id=c.id ORDER BY p.stock ASC`).all() }));
router.post('/stock/update/:id', (req, res) => {
  if (req.body.adjustment) db.prepare('UPDATE products SET stock = stock + ? WHERE id=?').run(parseInt(req.body.adjustment)||0, req.params.id);
  else db.prepare('UPDATE products SET stock=? WHERE id=?').run(parseInt(req.body.stock)||0, req.params.id);
  res.redirect('/admin/stock');
});

router.get('/users', (req, res) => res.render('admin/users', {
  users: db.prepare(`SELECT u.*, r.name as rank_name, r.badge_color FROM users u LEFT JOIN ranks r ON u.rank_id=r.id ORDER BY u.id DESC`).all(),
  ranks: db.prepare('SELECT * FROM ranks ORDER BY sort_order').all()
}));
router.post('/users/add', (req, res) => {
  if (db.prepare('SELECT id FROM users WHERE username=?').get(req.body.username)) return res.redirect('/admin/users');
  db.prepare(`INSERT INTO users (username, password, role, balance, rank_id) VALUES (?,?,?,?,?)`).run(req.body.username, bcrypt.hashSync(req.body.password, 10), req.body.role||'member', parseFloat(req.body.balance)||0, req.body.rank_id||null);
  res.redirect('/admin/users');
});
router.post('/users/edit/:id', (req, res) => {
  db.prepare('UPDATE users SET username=?, role=?, balance=?, rank_id=? WHERE id=?').run(req.body.username, req.body.role, parseFloat(req.body.balance)||0, req.body.rank_id||null, req.params.id);
  res.redirect('/admin/users');
});
router.post('/users/password/:id', (req, res) => {
  db.prepare('UPDATE users SET password=? WHERE id=?').run(bcrypt.hashSync(req.body.password, 10), req.params.id);
  res.redirect('/admin/users');
});
router.post('/users/delete/:id', (req, res) => {
  if (parseInt(req.params.id) === req.session.userId) return res.redirect('/admin/users');
  db.prepare('DELETE FROM orders WHERE user_id=?').run(req.params.id);
  db.prepare('DELETE FROM transactions WHERE user_id=?').run(req.params.id);
  db.prepare('DELETE FROM users WHERE id=?').run(req.params.id);
  res.redirect('/admin/users');
});

router.get('/web-settings', (req, res) => {
  const settings = {};
  db.prepare('SELECT * FROM settings').all().forEach(s => settings[s.key] = s.value);
  res.render('admin/web-settings', { settings });
});

router.post('/web-settings', (req, res) => {
  const allowed = ['shop_status','shop_name','shop_description','shop_tagline','announcement','min_topup','register_bonus','meta_title','meta_description','meta_keywords','primary_color','accent_color','secondary_color','bg_color','bg_secondary_color','card_color','card_hover_color','text_color','text_muted_color','border_color','input_color','success_color','warning_color','danger_color','info_color','font_family','font_size_base','heading_weight','product_border_radius','product_border_width','product_border_color','product_padding','product_shadow','product_hover_effect','product_image_ratio','product_image_fit','product_show_stock','product_show_sold','product_show_price','product_show_category','product_columns_desktop','product_columns_tablet','product_columns_mobile','product_card_bg','product_card_text','product_price_color','product_out_of_stock_overlay','effect_glassmorphism','effect_blur','effect_glow','effect_glow_intensity','effect_animations','effect_button_ripple','effect_hover_scale','effect_page_transition','effect_background_pattern','effect_gradient_bg','effect_particles','effect_noise','effect_card_hover_glow','layout_max_width','layout_nav_position','layout_show_sidebar','layout_card_style','layout_border_radius_global','show_balance','show_visits','show_announcement','show_categories_filter','show_search','show_login_button','show_register_button','show_breadcrumb','show_footer','show_logo','show_shop_description','logo_url','favicon_url','bg_image_url','banner_image_url','og_image_url','hero_image_url','empty_state_image','contact_line','contact_facebook','contact_discord','contact_email','contact_phone','truemoney_phone','footer_text','footer_show_social'];
  const stmt = db.prepare(`INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`);
  allowed.forEach(k => { if (req.body[k] !== undefined) { let v = String(req.body[k]); if (!v) v='0'; stmt.run(k, v); } });
  res.redirect('/admin/web-settings');
});

module.exports = router;
