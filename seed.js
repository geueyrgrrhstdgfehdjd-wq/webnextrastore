const bcrypt = require('bcryptjs');
const db = require('./database');

try { db.prepare('DELETE FROM settings').run(); } catch (e) {}

const defaults = {
  shop_status:'open', shop_name:'nextrastore', shop_description:'ร้านค้าออนไลน์ยุคใหม่ ปลอดภัย รวดเร็ว',
  shop_tagline:'ร้านค้าที่ดีที่สุดสำหรับคุณ', announcement:'ยินดีต้อนรับสู่ nextrastore',
  min_topup:'10', register_bonus:'0',
  primary_color:'#8b5cf6', accent_color:'#06b6d4', secondary_color:'#ec4899',
  bg_color:'#0a0a14', bg_secondary_color:'#0f0f1a', card_color:'#14141f', card_hover_color:'#1a1a28',
  text_color:'#e5e7eb', text_muted_color:'#9ca3af', border_color:'#1f1f2e', input_color:'#0d0d16',
  success_color:'#10b981', warning_color:'#f59e0b', danger_color:'#ef4444', info_color:'#3b82f6',
  font_family:'Inter', font_size_base:'14', heading_weight:'700',
  product_border_radius:'16', product_border_width:'1', product_border_color:'#1f1f2e',
  product_padding:'normal', product_shadow:'medium', product_hover_effect:'lift',
  product_image_ratio:'1', product_image_fit:'cover',
  product_show_stock:'1', product_show_sold:'1', product_show_price:'1', product_show_category:'1',
  product_columns_desktop:'5', product_columns_tablet:'3', product_columns_mobile:'2',
  product_card_bg:'#14141f', product_card_text:'#e5e7eb', product_price_color:'#8b5cf6',
  product_out_of_stock_overlay:'1',
  effect_glassmorphism:'1', effect_blur:'20', effect_glow:'1', effect_glow_intensity:'20',
  effect_animations:'1', effect_button_ripple:'1', effect_hover_scale:'1',
  effect_page_transition:'fade', effect_background_pattern:'grid', effect_gradient_bg:'1',
  effect_particles:'0', effect_noise:'0', effect_card_hover_glow:'1',
  layout_max_width:'1280', layout_nav_position:'bottom', layout_show_sidebar:'0',
  layout_card_style:'glass', layout_border_radius_global:'16',
  show_balance:'1', show_visits:'1', show_announcement:'1', show_categories_filter:'1',
  show_search:'0', show_login_button:'1', show_register_button:'1', show_breadcrumb:'0',
  show_footer:'1', show_logo:'1', show_shop_description:'1',
  logo_url:'', favicon_url:'', bg_image_url:'', banner_image_url:'', og_image_url:'',
  hero_image_url:'', empty_state_image:'',
  meta_title:'nextrastore - ร้านค้าออนไลน์', meta_description:'ร้านค้าออนไลน์ยุคใหม่', meta_keywords:'ร้านค้า,ออนไลน์',
  contact_line:'@nextrastore', contact_facebook:'', contact_discord:'', contact_email:'', contact_phone:'',
  truemoney_phone:'0812345678',
  footer_text:'© 2026 nextrastore - All rights reserved', footer_show_social:'1'
};

const stmt = db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`);
for (const [k, v] of Object.entries(defaults)) stmt.run(k, v);

const rankCount = db.prepare('SELECT COUNT(*) as c FROM ranks').get().c;
if (rankCount === 0) {
  const ins = db.prepare('INSERT INTO ranks (name, discount, badge_color, icon, min_spent, sort_order) VALUES (?, ?, ?, ?, ?, ?)');
  ins.run('Member', 0, '#6b7280', 'user', 0, 1);
  ins.run('Silver', 5, '#94a3b8', 'award', 500, 2);
  ins.run('Gold', 10, '#fbbf24', 'trophy', 2000, 3);
  ins.run('Diamond', 15, '#a78bfa', 'gem', 10000, 4);
}

const catCount = db.prepare('SELECT COUNT(*) as c FROM categories').get().c;
if (catCount === 0) {
  const ins = db.prepare('INSERT INTO categories (name, icon, sort_order) VALUES (?, ?, ?)');
  ins.run('ทั่วไป', 'box', 1);
  ins.run('ไอเทม', 'package', 2);
  ins.run('บัญชี', 'key', 3);
}

const ADMIN_USERNAME = 'nextrastore';
const ADMIN_PASSWORD = 'websitenextra';
const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get(ADMIN_USERNAME);
const adminHash = bcrypt.hashSync(ADMIN_PASSWORD, 10);

if (adminExists) {
  db.prepare(`UPDATE users SET password=?, role='admin', balance=99999 WHERE id=?`).run(adminHash, adminExists.id);
  console.log('Updated admin');
} else {
  db.prepare(`INSERT INTO users (username, password, role, balance, bio) VALUES (?, ?, 'admin', 99999, 'ผู้ดูแลระบบ')`)
    .run(ADMIN_USERNAME, adminHash);
  console.log('Created admin');
}

db.prepare("DELETE FROM users WHERE username='admin'").run();
console.log('Seed done. Admin: nextrastore / websitenextra');
