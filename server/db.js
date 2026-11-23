// Production Relational Database Layer with SQLite (local persistent) & PostgreSQL Support
import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { hashPassword, hashOtp, verifyOtp } from './security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'magizh.sqlite');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let db = null;

/**
 * Saves current SQLite memory state to persistent disk file atomically.
 */
export function persistDatabase() {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    try {
      const tempFile = `${DB_FILE}.tmp`;
      fs.writeFileSync(tempFile, buffer);
      fs.renameSync(tempFile, DB_FILE);
    } catch {
      // Windows file lock fallback
      fs.writeFileSync(DB_FILE, buffer);
    }
  } catch (err) {
    console.error('[DB] Failed to persist database file:', err.message);
  }
}

/**
 * Initializes Database Schema and Runs Migrations.
 */
export async function initDatabase() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE);
      db = new SQL.Database(fileBuffer);
      console.log('[DB] Loaded existing SQLite database from disk:', DB_FILE);
    } catch (err) {
      console.warn('[DB] Could not load database file, creating fresh database:', err.message);
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
    console.log('[DB] Initializing new SQLite database');
  }

  // Execute Schema Migrations
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      mobile TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      role TEXT NOT NULL DEFAULT 'customer',
      customer_code TEXT NOT NULL,
      referral_code TEXT NOT NULL,
      referred_by TEXT,
      addresses_json TEXT,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      email TEXT PRIMARY KEY,
      otp_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      cooldown_until INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      tamil_name TEXT NOT NULL,
      icon TEXT NOT NULL,
      color TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tamil_name TEXT,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      benefits_json TEXT,
      ingredients_json TEXT,
      net_weight TEXT,
      sku TEXT,
      barcode TEXT,
      origin TEXT,
      images_json TEXT NOT NULL,
      rating REAL NOT NULL DEFAULT 5.0,
      reviews_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      is_bestseller INTEGER NOT NULL DEFAULT 0,
      is_today_offer INTEGER NOT NULL DEFAULT 0,
      is_premium INTEGER NOT NULL DEFAULT 0,
      b5_reward_percent REAL,
      partner_shop_id TEXT,
      variants_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS promotional_banners (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      subtitle TEXT NOT NULL,
      image_url TEXT NOT NULL,
      link_url TEXT,
      tag TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      start_date TEXT,
      end_date TEXT
    );

    CREATE TABLE IF NOT EXISTS coupons (
      code TEXT PRIMARY KEY,
      discount_type TEXT NOT NULL,
      discount_value REAL NOT NULL,
      min_order_value REAL NOT NULL,
      max_discount REAL,
      description TEXT NOT NULL,
      valid_until TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      order_number TEXT UNIQUE NOT NULL,
      customer_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      shipping_address_json TEXT NOT NULL,
      merchandise_subtotal REAL NOT NULL,
      coupon_code TEXT,
      coupon_discount REAL NOT NULL DEFAULT 0,
      eligible_merchandise_amount REAL NOT NULL,
      coins_redeemed REAL NOT NULL DEFAULT 0,
      coin_discount_amount REAL NOT NULL DEFAULT 0,
      delivery_charge REAL NOT NULL DEFAULT 0,
      tax_amount REAL NOT NULL DEFAULT 0,
      final_payable_amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      payment_status TEXT NOT NULL,
      order_status TEXT NOT NULL,
      reward_coins_earned REAL NOT NULL DEFAULT 0,
      reward_coins_credited INTEGER NOT NULL DEFAULT 0,
      partner_id TEXT,
      items_json TEXT NOT NULL,
      timeline_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS coin_accounts (
      customer_id TEXT PRIMARY KEY,
      available_balance REAL NOT NULL DEFAULT 0,
      total_earned REAL NOT NULL DEFAULT 0,
      total_redeemed REAL NOT NULL DEFAULT 0,
      pending_balance REAL NOT NULL DEFAULT 0,
      reversed_balance REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS coin_ledger (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      order_id TEXT,
      order_number TEXT,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      reason TEXT NOT NULL,
      balance_after REAL NOT NULL,
      status TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS manual_coin_requests (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_email TEXT,
      b5_id TEXT,
      coins REAL NOT NULL,
      approved_amount REAL,
      reason TEXT NOT NULL,
      requested_by TEXT NOT NULL,
      requested_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      admin_id TEXT,
      admin_notes TEXT,
      previous_balance REAL,
      new_balance REAL,
      resolved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS partner_shops (
      id TEXT PRIMARY KEY,
      owner_name TEXT NOT NULL,
      shop_name TEXT NOT NULL,
      mobile TEXT NOT NULL,
      email TEXT NOT NULL,
      partner_code TEXT UNIQUE NOT NULL,
      district TEXT NOT NULL,
      pin_code TEXT NOT NULL,
      address TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      commission_rate REAL NOT NULL DEFAULT 8.0,
      special_coin_bonus_multiplier REAL NOT NULL DEFAULT 1.5,
      partner_redemption_cap_percentage REAL NOT NULL DEFAULT 50.0,
      partner_offer_start_date TEXT,
      partner_offer_end_date TEXT,
      partner_eligibility_rules TEXT,
      total_sales REAL NOT NULL DEFAULT 0,
      total_orders INTEGER NOT NULL DEFAULT 0,
      total_commission_paid REAL NOT NULL DEFAULT 0,
      unsettled_amount REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS partner_local_transactions (
      id TEXT PRIMARY KEY,
      receipt_number TEXT UNIQUE NOT NULL,
      partner_id TEXT NOT NULL,
      partner_name TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      eligible_purchase_amount REAL NOT NULL,
      coins_redeemed REAL NOT NULL,
      net_cash_paid REAL NOT NULL,
      commission_rate REAL NOT NULL,
      partner_commission_earned REAL NOT NULL,
      partner_settlement_due REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'completed',
      created_at TEXT NOT NULL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS partner_bills (
      id TEXT PRIMARY KEY,
      bill_number TEXT UNIQUE NOT NULL,
      partner_id TEXT NOT NULL,
      partner_name TEXT NOT NULL,
      merchant_upi_id TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      original_bill_amount REAL NOT NULL,
      coins_to_redeem REAL NOT NULL,
      discount_amount REAL NOT NULL,
      payable_amount REAL NOT NULL,
      items_summary TEXT,
      payment_method TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING_CUSTOMER_APPROVAL',
      customer_approved_at TEXT,
      partner_received_at TEXT,
      admin_decision_at TEXT,
      admin_decision_by TEXT,
      admin_notes TEXT,
      receipt_number TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS coin_notifications (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      type TEXT NOT NULL,
      coins REAL NOT NULL,
      previous_balance REAL NOT NULL,
      new_balance REAL NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_viewed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      viewed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT NOT NULL,
      ip_address TEXT
    );

    CREATE TABLE IF NOT EXISTS product_images (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      url TEXT NOT NULL,
      data_base64 TEXT,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      title TEXT,
      assigned_product_id TEXT,
      assigned_category_id TEXT,
      is_primary INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);

  // Run dynamic schema migrations on existing SQLite tables
  migrateSchema();

  // Check if initial seed is needed
  const userCheck = db.exec("SELECT COUNT(*) as c FROM users");
  const count = userCheck[0]?.values[0][0] || 0;

  if (count === 0) {
    seedDatabase();
  } else {
    persistDatabase();
  }
}

/**
 * Ensures existing SQLite database tables have all newly added columns without data loss.
 */
function migrateSchema() {
  const partnerCols = [
    { name: 'city', type: 'TEXT' },
    { name: 'merchant_upi_id', type: 'TEXT' },
    { name: 'gst_number', type: 'TEXT' },
    { name: 'documents_json', type: 'TEXT' },
    { name: 'password_hash', type: 'TEXT' },
    { name: 'application_status', type: "TEXT DEFAULT 'pending'" },
    { name: 'rejection_reason', type: 'TEXT' },
    { name: 'store_category', type: "TEXT DEFAULT 'Organic Groceries'" },
    { name: 'store_images_json', type: "TEXT DEFAULT '[]'" },
  ];

  try {
    const info = db.exec("PRAGMA table_info(partner_shops);");
    if (info[0]) {
      const existing = new Set(info[0].values.map((v) => v[1]));
      for (const col of partnerCols) {
        if (!existing.has(col.name)) {
          try {
            db.run(`ALTER TABLE partner_shops ADD COLUMN ${col.name} ${col.type};`);
          } catch (e) {
            // Already present or alter error
          }
        }
      }
    }
  } catch (err) {
    console.warn('[DB Migration] Partner schema check:', err.message);
  }

  try {
    const userInfo = db.exec("PRAGMA table_info(users);");
    if (userInfo[0]) {
      const userExisting = new Set(userInfo[0].values.map((v) => v[1]));
      if (!userExisting.has('profile_photo')) {
        try { db.run("ALTER TABLE users ADD COLUMN profile_photo TEXT;"); } catch (_) {}
      }
      if (!userExisting.has('email_verified')) {
        try { db.run("ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0;"); } catch (_) {}
      }
    }
  } catch (err) {
    console.warn('[DB Migration] Users schema check:', err.message);
  }

  // Migration for manual_coin_requests
  const manualCoinRequestCols = [
    { name: 'customer_email', type: 'TEXT' },
    { name: 'b5_id', type: 'TEXT' },
    { name: 'approved_amount', type: 'REAL' },
    { name: 'admin_id', type: 'TEXT' },
    { name: 'previous_balance', type: 'REAL' },
    { name: 'new_balance', type: 'REAL' },
  ];

  try {
    const mcrInfo = db.exec("PRAGMA table_info(manual_coin_requests);");
    if (mcrInfo[0]) {
      const existing = new Set(mcrInfo[0].values.map((v) => v[1]));
      for (const col of manualCoinRequestCols) {
        if (!existing.has(col.name)) {
          try {
            db.run(`ALTER TABLE manual_coin_requests ADD COLUMN ${col.name} ${col.type};`);
          } catch (_) {}
        }
      }
    }
  } catch (err) {
    console.warn('[DB Migration] manual_coin_requests schema check:', err.message);
  }

  // Migration for promotional_banners order_index
  try {
    const banInfo = db.exec("PRAGMA table_info(promotional_banners);");
    if (banInfo[0]) {
      const existing = new Set(banInfo[0].values.map((v) => v[1]));
      if (!existing.has('order_index')) {
        try {
          db.run("ALTER TABLE promotional_banners ADD COLUMN order_index INTEGER DEFAULT 0;");
        } catch (_) {}
      }
    }
  } catch (err) {
    console.warn('[DB Migration] promotional_banners schema check:', err.message);
  }

  // Migration for store_settings table (Payment configs & UPI configuration)
  try {
    db.run(`CREATE TABLE IF NOT EXISTS store_settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );`);
    const existing = db.exec("SELECT * FROM store_settings WHERE key = 'payment_config'");
    if (!existing[0] || !existing[0].values[0]) {
      const defaultConfig = JSON.stringify({
        merchantUpiId: 'magizhcafee-3@okhdfcbank',
        merchantName: 'Magizh Shopping',
        enableCod: true,
        enableUpi: true,
        qrImageUrl: '',
      });
      db.run("INSERT INTO store_settings (key, value_json, updated_at) VALUES ('payment_config', ?, ?)", [
        defaultConfig,
        new Date().toISOString(),
      ]);
    }
  } catch (err) {
    console.warn('[DB Migration] store_settings schema check:', err.message);
  }

  // Migration for orders payment_utr and upi_transaction_ref
  try {
    const orderInfo = db.exec("PRAGMA table_info(orders);");
    if (orderInfo[0]) {
      const existing = new Set(orderInfo[0].values.map((v) => v[1]));
      if (!existing.has('payment_utr')) {
        try { db.run("ALTER TABLE orders ADD COLUMN payment_utr TEXT;"); } catch (_) {}
      }
      if (!existing.has('upi_transaction_ref')) {
        try { db.run("ALTER TABLE orders ADD COLUMN upi_transaction_ref TEXT;"); } catch (_) {}
      }
      if (!existing.has('product_coin_redemptions_json')) {
        try { db.run("ALTER TABLE orders ADD COLUMN product_coin_redemptions_json TEXT;"); } catch (_) {}
      }
    }
  } catch (err) {
    console.warn('[DB Migration] orders schema check:', err.message);
  }

  // Migration for products b5_coin_redemption_percentage
  try {
    const prodInfo = db.exec("PRAGMA table_info(products);");
    if (prodInfo[0]) {
      const existing = new Set(prodInfo[0].values.map((v) => v[1]));
      if (!existing.has('b5_coin_redemption_percentage')) {
        try { db.run("ALTER TABLE products ADD COLUMN b5_coin_redemption_percentage REAL DEFAULT 20.0;"); } catch (_) {}
      }
    }
  } catch (err) {
    console.warn('[DB Migration] products schema check:', err.message);
  }

  // Migration for partner_bills columns: utr_number, customer_confirmed_at, partner_reward_coins
  try {
    const billInfo = db.exec("PRAGMA table_info(partner_bills);");
    if (billInfo[0]) {
      const existing = new Set(billInfo[0].values.map((v) => v[1]));
      if (!existing.has('utr_number')) {
        try { db.run("ALTER TABLE partner_bills ADD COLUMN utr_number TEXT;"); } catch (_) {}
      }
      if (!existing.has('customer_confirmed_at')) {
        try { db.run("ALTER TABLE partner_bills ADD COLUMN customer_confirmed_at TEXT;"); } catch (_) {}
      }
      if (!existing.has('partner_reward_coins')) {
        try { db.run("ALTER TABLE partner_bills ADD COLUMN partner_reward_coins REAL DEFAULT 0;"); } catch (_) {}
      }
    }
  } catch (err) {
    console.warn('[DB Migration] partner_bills schema check:', err.message);
  }

  // Pre-seed merchant UPI IDs and cities for default demo partners
  try {
    db.run("UPDATE partner_shops SET merchant_upi_id = 'magizhcafee-3@okhdfcbank', city = 'Coimbatore' WHERE id = 'ptr-1' AND (merchant_upi_id IS NULL OR merchant_upi_id = '')");
    db.run("UPDATE partner_shops SET merchant_upi_id = 'maduraigrains@okhdfcbank', city = 'Madurai' WHERE id = 'ptr-2' AND (merchant_upi_id IS NULL OR merchant_upi_id = '')");
    db.run("UPDATE partner_shops SET merchant_upi_id = 'salemherbal@okhdfcbank', city = 'Salem' WHERE id = 'ptr-3' AND (merchant_upi_id IS NULL OR merchant_upi_id = '')");
    // Synchronize partner_shops status and application_status so approved shops are never blocked
    db.run("UPDATE partner_shops SET application_status = status WHERE status = 'approved' AND (application_status IS NULL OR application_status != 'approved')");
    // Standardize all historical redemptions/debits in coin_ledger as 'debit'
    db.run("UPDATE coin_ledger SET type = 'debit' WHERE type LIKE '%redemption%' OR type LIKE '%deduct%' OR type LIKE '%spent%'");
    // Ensure all banners have robust click destination links
    db.run("UPDATE promotional_banners SET link_url = 'offers' WHERE link_url IS NULL OR link_url = '' OR link_url = '#millets' OR title LIKE '%Pongal%' OR title LIKE '%Festival%'");
    db.run("UPDATE promotional_banners SET link_url = 'partner-shops' WHERE link_url = '#partner-shops' OR title LIKE '%Partner%'");
    db.run("UPDATE promotional_banners SET link_url = 'category:Traditional Millet Products' WHERE title LIKE '%Millet%' AND link_url != 'partner-shops'");
    db.run("UPDATE promotional_banners SET link_url = 'wallet' WHERE title LIKE '%Reward%' OR title LIKE '%Bonus%'");
  } catch {}
}

/**
 * Seeds initial data with rich South Indian millets, authentic Tamil names, and preloaded accounts.
 */
function seedDatabase() {
  console.log('[DB] Seeding database with initial authentic catalog and demo personas...');

  const defaultPasswordHash = hashPassword('password123');

  // 1. Users
  const users = [
    {
      id: 'user-cust-1',
      mobile: '9876543210',
      name: 'Saravanan K',
      email: 'saravanan@magizh.in',
      password_hash: defaultPasswordHash,
      role: 'customer',
      customer_code: 'MAG-CUST-84920',
      referral_code: 'MAG-REF-771',
      addresses_json: JSON.stringify([
        {
          id: 'addr-1',
          name: 'Saravanan K',
          phone: '9876543210',
          addressLine: 'Flat 4B, Green Meadows, 1st Cross, Gandhi Nagar, Adyar',
          district: 'Chennai',
          pinCode: '600020',
          state: 'Tamil Nadu',
          landmark: 'Near Gandhi Nagar Club',
          isDefault: true,
        },
      ]),
      created_at: '2026-01-10T09:00:00Z',
      status: 'active',
    },
    {
      id: 'user-partner-1',
      mobile: '9843210987',
      name: 'Muthusamy R',
      email: 'kovaiorganics@magizh.in',
      password_hash: defaultPasswordHash,
      role: 'partner',
      customer_code: 'MAG-PTR-101',
      referral_code: 'MAG-REF-PTR101',
      addresses_json: JSON.stringify([]),
      created_at: '2026-01-15T10:00:00Z',
      status: 'active',
    },
    {
      id: 'user-sales-1',
      mobile: '9823456789',
      name: 'Anbarasan G',
      email: 'anbarasan.sales@magizh.in',
      password_hash: defaultPasswordHash,
      role: 'sales',
      customer_code: 'MAG-SALES-202',
      referral_code: 'MAG-REF-LEADER',
      addresses_json: JSON.stringify([]),
      created_at: '2026-01-05T08:30:00Z',
      status: 'active',
    },
    {
      id: 'user-admin-1',
      mobile: '9999999999',
      name: 'Magizh Administrator',
      email: 'admin@magizh.in',
      password_hash: defaultPasswordHash,
      role: 'admin',
      customer_code: 'MAG-ADM-001',
      referral_code: 'MAG-REF-ROOT',
      addresses_json: JSON.stringify([]),
      created_at: '2026-01-01T00:00:00Z',
      status: 'active',
    },
  ];

  for (const u of users) {
    db.run(
      `INSERT INTO users (id, mobile, name, email, password_hash, role, customer_code, referral_code, addresses_json, created_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [u.id, u.mobile, u.name, u.email, u.password_hash, u.role, u.customer_code, u.referral_code, u.addresses_json, u.created_at, u.status]
    );
  }

  // 2. Preloaded 800 B5 Coins for Saravanan
  db.run(
    `INSERT INTO coin_accounts (customer_id, available_balance, total_earned, total_redeemed, pending_balance, reversed_balance)
     VALUES (?, ?, ?, ?, ?, ?)`,
    ['user-cust-1', 800, 1200, 400, 50, 0]
  );

  db.run(
    `INSERT INTO coin_ledger (id, customer_id, order_id, order_number, type, amount, reason, balance_after, status, timestamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['TXN-INIT-1', 'user-cust-1', null, null, 'credit', 800, 'Preloaded account verification balance', 800, 'completed', '2026-01-10T09:00:00Z']
  );

  // 3. Partner Shops
  const partners = [
    {
      id: 'ptr-1',
      owner_name: 'Muthusamy R',
      shop_name: 'Kovai Natural Organics & Millet Hub',
      mobile: '9843210987',
      email: 'kovaiorganics@magizh.in',
      partner_code: 'MAG-PTR-101',
      district: 'Coimbatore',
      pin_code: '641002',
      address: 'Plot 12, West Sambandam Road, RS Puram, Coimbatore',
      status: 'approved',
      commission_rate: 8.0,
      special_coin_bonus_multiplier: 1.5,
      partner_redemption_cap_percentage: 50.0,
      total_sales: 48250,
      total_orders: 32,
      total_commission_paid: 3860,
      unsettled_amount: 4200,
      created_at: '2026-01-15T10:00:00Z',
    },
    {
      id: 'ptr-2',
      owner_name: 'Lakshmi Narayanan',
      shop_name: 'Madurai Traditional Grains & Cold Press',
      mobile: '9789012345',
      email: 'madurai.grains@magizh.in',
      partner_code: 'MAG-PTR-102',
      district: 'Madurai',
      pin_code: '625001',
      address: '45, South Masi Street, Madurai',
      status: 'approved',
      commission_rate: 8.0,
      special_coin_bonus_multiplier: 1.5,
      partner_redemption_cap_percentage: 40.0,
      total_sales: 31400,
      total_orders: 21,
      total_commission_paid: 2512,
      unsettled_amount: 3100,
      created_at: '2026-02-01T11:00:00Z',
    },
    {
      id: 'ptr-3',
      owner_name: 'Selvam Perumal',
      shop_name: 'Salem Herbal Care & Podi Stores',
      mobile: '9654321098',
      email: 'salem.herbal@magizh.in',
      partner_code: 'MAG-PTR-103',
      district: 'Salem',
      pin_code: '636001',
      address: '88, Bazaar Street, Salem',
      status: 'pending',
      commission_rate: 7.0,
      special_coin_bonus_multiplier: 1.2,
      partner_redemption_cap_percentage: 50.0,
      total_sales: 0,
      total_orders: 0,
      total_commission_paid: 0,
      unsettled_amount: 0,
      created_at: '2026-03-01T14:00:00Z',
    },
  ];

  for (const p of partners) {
    db.run(
      `INSERT INTO partner_shops (id, owner_name, shop_name, mobile, email, partner_code, district, pin_code, address, status, commission_rate, special_coin_bonus_multiplier, partner_redemption_cap_percentage, total_sales, total_orders, total_commission_paid, unsettled_amount, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [p.id, p.owner_name, p.shop_name, p.mobile, p.email, p.partner_code, p.district, p.pin_code, p.address, p.status, p.commission_rate, p.special_coin_bonus_multiplier, p.partner_redemption_cap_percentage, p.total_sales, p.total_orders, p.total_commission_paid, p.unsettled_amount, p.created_at]
    );
  }

  // 4. Categories
  const categories = [
    { id: 'cat-1', name: 'Traditional Millet Products', tamil_name: 'பாரம்பரிய சிறுதானியங்கள்', icon: '🌾', color: 'bg-emerald-50 text-emerald-800' },
    { id: 'cat-2', name: 'Podi Varieties', tamil_name: 'பாரம்பரிய பொடி வகைகள்', icon: '🌶️', color: 'bg-orange-50 text-orange-800' },
    { id: 'cat-3', name: 'Thokku and Pickles', tamil_name: 'தொக்கு மற்றும் ஊறுகாய்', icon: '🫙', color: 'bg-amber-50 text-amber-800' },
    { id: 'cat-4', name: 'Millet Snacks and Sweets', tamil_name: 'சிறுதானிய தின்பண்டங்கள்', icon: '🥮', color: 'bg-yellow-50 text-yellow-800' },
    { id: 'cat-5', name: 'Natural Soaps', tamil_name: 'மூலிகை குளியல் சோப்புகள்', icon: '🧼', color: 'bg-teal-50 text-teal-800' },
    { id: 'cat-6', name: 'Healthy Food Products', tamil_name: 'ஆரோக்கிய உணவு பொருட்கள்', icon: '🍯', color: 'bg-lime-50 text-lime-800' },
  ];

  for (const c of categories) {
    db.run(
      `INSERT INTO categories (id, name, tamil_name, icon, color, active) VALUES (?, ?, ?, ?, ?, 1)`,
      [c.id, c.name, c.tamil_name, c.icon, c.color]
    );
  }

  // 5. Promotional Banners
  const banners = [
    {
      id: 'ban-1',
      title: 'Festival Harvest Feast — 2x B5 Coins',
      subtitle: 'Shop Traditional Foxtail, Kodo & Barnyard Millets with instant 50% Coin Redemption',
      image_url: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=1200&q=80',
      link_url: '#millets',
      tag: 'HARVEST SPECIAL',
      active: 1,
    },
    {
      id: 'ban-2',
      title: 'Partner Shops In-Store Pay',
      subtitle: 'Visit any approved partner shop across Tamil Nadu and redeem up to 50% using your B5 Coins',
      image_url: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=1200&q=80',
      link_url: '#partner-shops',
      tag: 'LOCAL PARTNERS',
      active: 1,
    },
  ];

  for (const b of banners) {
    db.run(
      `INSERT INTO promotional_banners (id, title, subtitle, image_url, link_url, tag, active) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [b.id, b.title, b.subtitle, b.image_url, b.link_url, b.tag, b.active]
    );
  }

  // 6. Coupons
  const coupons = [
    { code: 'WELCOME100', discount_type: 'fixed', discount_value: 100, min_order_value: 500, max_discount: null, description: 'Flat ₹100 Off on orders above ₹500', valid_until: '2026-12-31' },
    { code: 'PONGAL10', discount_type: 'percentage', discount_value: 10, min_order_value: 800, max_discount: 200, description: '10% Festive Discount on Millets and Ghee', valid_until: '2026-12-31' },
    { code: 'HEALTHY50', discount_type: 'fixed', discount_value: 50, min_order_value: 300, max_discount: null, description: '₹50 Off on healthy soaps and podis', valid_until: '2026-12-31' },
  ];

  for (const cp of coupons) {
    db.run(
      `INSERT INTO coupons (code, discount_type, discount_value, min_order_value, max_discount, description, valid_until, active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [cp.code, cp.discount_type, cp.discount_value, cp.min_order_value, cp.max_discount, cp.description, cp.valid_until]
    );
  }

  // 7. Products (Traditional Foxtail, Chettinad Idli Podi, A2 Ghee, Palm Jaggery, etc.)
  const products = [
    {
      id: 'prod-1',
      name: 'Traditional Foxtail Millet Noodles (Thinai)',
      tamil_name: 'பாரம்பரிய தினை நூடுல்ஸ்',
      category: 'Traditional Millet Products',
      description: '100% whole grain Foxtail Millet Noodles prepared using cold extrusion without Maida, MSG, preservatives, or artificial enhancers.',
      benefits_json: JSON.stringify(['Low Glycemic Index', 'Rich in Dietary Fiber & Iron', 'Zero Maida & Trans Fats']),
      ingredients_json: JSON.stringify(['Foxtail Millet Flour', 'Whole Wheat Flour', 'Rock Salt', 'Spices']),
      net_weight: '210g - 1kg',
      sku: 'MLT-FOX-01',
      barcode: '8901234500012',
      origin: 'Dharmapuri Millet Cluster, Tamil Nadu',
      images_json: JSON.stringify([
        'https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80',
      ]),
      rating: 4.8,
      reviews_count: 142,
      status: 'active',
      is_bestseller: 1,
      is_today_offer: 1,
      is_premium: 0,
      variants_json: JSON.stringify([
        { weight: '210g (Pack of 1)', price: 95, originalPrice: 120, stock: 45, sku: 'MLT-FOX-210' },
        { weight: '630g (Pack of 3)', price: 260, originalPrice: 360, stock: 30, sku: 'MLT-FOX-630' },
        { weight: '1kg Family Pack', price: 390, originalPrice: 520, stock: 20, sku: 'MLT-FOX-1000' },
      ]),
      created_at: '2026-01-10T10:00:00Z',
    },
    {
      id: 'prod-2',
      name: 'Authentic Chettinad Idli Podi (Gunpowder)',
      tamil_name: 'செட்டிநாடு பாரம்பரிய இட்லி பொடி',
      category: 'Podi Varieties',
      description: 'Slow-roasted lentils, Guntur red chilies, white sesame seeds, hing, and curry leaves hand-pounded to an aromatic coarse finish.',
      benefits_json: JSON.stringify(['High Plant Protein', 'Traditional Stone Ground Flavor', 'No Chemical Preservatives']),
      ingredients_json: JSON.stringify(['Urad Dal', 'Chana Dal', 'Guntur Red Chilli', 'White Sesame', 'Hing', 'Curry Leaves']),
      net_weight: '200g - 1kg',
      sku: 'POD-IDL-01',
      barcode: '8901234500029',
      origin: 'Karaikudi, Chettinad Region, Tamil Nadu',
      images_json: JSON.stringify([
        'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1505253758473-96b46deae42a?auto=format&fit=crop&w=800&q=80',
      ]),
      rating: 4.9,
      reviews_count: 310,
      status: 'active',
      is_bestseller: 1,
      is_today_offer: 0,
      is_premium: 1,
      variants_json: JSON.stringify([
        { weight: '200g', price: 140, originalPrice: 175, stock: 65, sku: 'POD-IDL-200' },
        { weight: '500g', price: 310, originalPrice: 399, stock: 40, sku: 'POD-IDL-500' },
        { weight: '1kg Bulk Jar', price: 580, originalPrice: 750, stock: 15, sku: 'POD-IDL-1000' },
      ]),
      created_at: '2026-01-10T10:30:00Z',
    },
    {
      id: 'prod-9',
      name: 'Pure Desi Cow A2 Bilona Ghee (Cultured Butter)',
      tamil_name: 'பாரம்பரிய A2 நாட்டு மாட்டு நெய்',
      category: 'Healthy Food Products',
      description: 'Golden aromatic A2 Ghee prepared using the ancient Vedic Bilona method — grass-fed Kangayam cow milk, hand-churned cultured butter.',
      benefits_json: JSON.stringify(['Enhances Gut Health', 'Vedic Churned Cultured Butter (Bilona)', 'Rich in Omega-3 and Vitamin K2']),
      ingredients_json: JSON.stringify(['100% Pure Kangayam Desi Cow Milk Fat']),
      net_weight: '250ml - 1000ml',
      sku: 'GHE-A2-01',
      barcode: '8901234500098',
      origin: 'Kangayam Cattle Sanctuary, Tamil Nadu',
      images_json: JSON.stringify([
        'https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=800&q=80',
      ]),
      rating: 5.0,
      reviews_count: 420,
      status: 'active',
      is_bestseller: 1,
      is_today_offer: 0,
      is_premium: 1,
      variants_json: JSON.stringify([
        { weight: '250ml Glass Bottle', price: 420, originalPrice: 480, stock: 35, sku: 'GHE-A2-250' },
        { weight: '500ml Glass Bottle', price: 799, originalPrice: 950, stock: 25, sku: 'GHE-A2-500' },
        { weight: '1000ml (1 Litre)', price: 1550, originalPrice: 1850, stock: 12, sku: 'GHE-A2-1000' },
      ]),
      created_at: '2026-01-10T11:00:00Z',
    },
  ];

  for (const prod of products) {
    db.run(
      `INSERT INTO products (id, name, tamil_name, category, description, benefits_json, ingredients_json, net_weight, sku, barcode, origin, images_json, rating, reviews_count, status, is_bestseller, is_today_offer, is_premium, variants_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [prod.id, prod.name, prod.tamil_name, prod.category, prod.description, prod.benefits_json, prod.ingredients_json, prod.net_weight, prod.sku, prod.barcode, prod.origin, prod.images_json, prod.rating, prod.reviews_count, prod.status, prod.is_bestseller, prod.is_today_offer, prod.is_premium, prod.variants_json, prod.created_at]
    );
  }

  // Persist seed data to disk
  persistDatabase();
}

// -------------------------------------------------------------
// Database Query & Transaction Methods
// -------------------------------------------------------------

export const dbService = {
  // Users & Auth
  findUserByMobile(mobile) {
    const res = db.exec("SELECT * FROM users WHERE mobile = ?", [mobile]);
    if (!res[0] || !res[0].values[0]) return null;
    return mapUserRow(res[0].columns, res[0].values[0]);
  },

  findUserByEmail(email) {
    if (!email) return null;
    const res = db.exec("SELECT * FROM users WHERE LOWER(email) = LOWER(?)", [email.trim()]);
    if (!res[0] || !res[0].values[0]) return null;
    return mapUserRow(res[0].columns, res[0].values[0]);
  },

  findUserById(id) {
    if (!id) return null;
    const res = db.exec("SELECT * FROM users WHERE id = ?", [id]);
    if (!res[0] || !res[0].values[0]) return null;
    return mapUserRow(res[0].columns, res[0].values[0]);
  },

  getCustomers() {
    const res = db.exec("SELECT * FROM users WHERE role = 'customer' ORDER BY created_at DESC");
    if (!res[0]) return [];
    const cols = res[0].columns;
    const allOrders = this.getOrders();
    return res[0].values.map((row) => {
      const u = mapUserRow(cols, row);
      const custOrders = allOrders.filter(
        (o) => o.customerId === u.id || o.customerPhone === u.mobile
      );
      const totalOrders = custOrders.length;
      const totalSpent = custOrders
        .filter((o) => o.paymentStatus === 'Paid')
        .reduce((sum, o) => sum + (o.finalPayableAmount || 0), 0);
      return {
        ...u,
        totalOrders,
        totalSpent,
      };
    });
  },

  createUser(userData) {
    db.run(
      `INSERT INTO users (id, mobile, name, email, password_hash, role, customer_code, referral_code, referred_by, addresses_json, created_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userData.id,
        userData.mobile,
        userData.name,
        userData.email,
        userData.passwordHash || null,
        userData.role || 'customer',
        userData.customerCode,
        userData.referralCode,
        userData.referredBy || null,
        JSON.stringify(userData.addresses || []),
        userData.createdAt || new Date().toISOString(),
        userData.status || 'active',
      ]
    );

    // Initialize 0 welcome coins (Coins must be requested manually and approved by Admin)
    db.run(
      `INSERT OR IGNORE INTO coin_accounts (customer_id, available_balance, total_earned, total_redeemed, pending_balance, reversed_balance)
       VALUES (?, 0, 0, 0, 0, 0)`,
      [userData.id]
    );

    persistDatabase();
    return this.findUserByMobile(userData.mobile);
  },

  updateUserPassword(email, newPasswordHash) {
    db.run(
      "UPDATE users SET password_hash = ? WHERE LOWER(email) = LOWER(?)",
      [newPasswordHash, email.trim()]
    );
    persistDatabase();
  },

  // Password Reset Management
  savePasswordResetOtp(email, otpHash, expiresAt, cooldownUntil) {
    db.run(
      `INSERT INTO password_resets (email, otp_hash, expires_at, attempts, cooldown_until, created_at)
       VALUES (?, ?, ?, 0, ?, ?)
       ON CONFLICT(email) DO UPDATE SET
         otp_hash = excluded.otp_hash,
         expires_at = excluded.expires_at,
         attempts = 0,
         cooldown_until = excluded.cooldown_until,
         created_at = excluded.created_at`,
      [email.toLowerCase().trim(), otpHash, expiresAt, cooldownUntil, new Date().toISOString()]
    );
    persistDatabase();
  },

  getPasswordResetRecord(email) {
    const res = db.exec("SELECT * FROM password_resets WHERE LOWER(email) = LOWER(?)", [email.toLowerCase().trim()]);
    if (!res[0] || !res[0].values[0]) return null;
    const cols = res[0].columns;
    const row = res[0].values[0];
    return {
      email: row[cols.indexOf('email')],
      otpHash: row[cols.indexOf('otp_hash')],
      expiresAt: row[cols.indexOf('expires_at')],
      attempts: row[cols.indexOf('attempts')],
      cooldownUntil: row[cols.indexOf('cooldown_until')],
      createdAt: row[cols.indexOf('created_at')],
    };
  },

  incrementResetAttempts(email) {
    db.run(
      "UPDATE password_resets SET attempts = attempts + 1 WHERE LOWER(email) = LOWER(?)",
      [email.toLowerCase().trim()]
    );
    persistDatabase();
  },

  clearPasswordReset(email) {
    db.run("DELETE FROM password_resets WHERE LOWER(email) = LOWER(?)", [email.toLowerCase().trim()]);
    persistDatabase();
  },

  // Products
  getProducts(includeArchived = false) {
    const sql = includeArchived
      ? "SELECT * FROM products ORDER BY created_at DESC"
      : "SELECT * FROM products WHERE status IN ('active', 'coming_soon') ORDER BY created_at DESC";
    const res = db.exec(sql);
    if (!res[0]) return [];
    return res[0].values.map((v) => mapProductRow(res[0].columns, v));
  },

  getProductById(id) {
    const res = db.exec("SELECT * FROM products WHERE id = ?", [id]);
    if (!res[0] || !res[0].values[0]) return null;
    return mapProductRow(res[0].columns, res[0].values[0]);
  },

  saveProduct(p) {
    const existing = this.getProductById(p.id);
    const coinRedemptionPct = p.b5CoinRedemptionPercentage !== undefined && p.b5CoinRedemptionPercentage !== null
      ? Number(p.b5CoinRedemptionPercentage)
      : 20.0;

    if (existing) {
      db.run(
        `UPDATE products SET
          name = ?, tamil_name = ?, category = ?, description = ?,
          benefits_json = ?, ingredients_json = ?, net_weight = ?,
          sku = ?, barcode = ?, origin = ?, images_json = ?,
          status = ?, is_bestseller = ?, is_today_offer = ?, is_premium = ?,
          b5_reward_percent = ?, b5_coin_redemption_percentage = ?, variants_json = ?
         WHERE id = ?`,
        [
          p.name, p.tamilName || null, p.category, p.description,
          JSON.stringify(p.benefits || []), JSON.stringify(p.ingredients || []),
          p.netWeight || null, p.sku || null, p.barcode || null, p.origin || null,
          JSON.stringify(p.images || []), p.status || 'active',
          p.isBestSeller ? 1 : 0, p.isTodayOffer ? 1 : 0, p.isPremium ? 1 : 0,
          p.b5RewardPercentage || null, coinRedemptionPct, JSON.stringify(p.variants || []),
          p.id,
        ]
      );
    } else {
      db.run(
        `INSERT INTO products (id, name, tamil_name, category, description, benefits_json, ingredients_json, net_weight, sku, barcode, origin, images_json, rating, reviews_count, status, is_bestseller, is_today_offer, is_premium, b5_reward_percent, b5_coin_redemption_percentage, variants_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 5.0, 0, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.id, p.name, p.tamilName || null, p.category, p.description,
          JSON.stringify(p.benefits || []), JSON.stringify(p.ingredients || []),
          p.netWeight || null, p.sku || null, p.barcode || null, p.origin || null,
          JSON.stringify(p.images || []), p.status || 'active',
          p.isBestSeller ? 1 : 0, p.isTodayOffer ? 1 : 0, p.isPremium ? 1 : 0,
          p.b5RewardPercentage || null, coinRedemptionPct, JSON.stringify(p.variants || []),
          p.createdAt || new Date().toISOString(),
        ]
      );
    }
    persistDatabase();
    return this.getProductById(p.id);
  },

  archiveOrDeleteProduct(productId) {
    // Check if product is referenced by any historical orders
    const res = db.exec("SELECT COUNT(*) as c FROM orders WHERE items_json LIKE ?", [`%${productId}%`]);
    const referencedCount = res[0]?.values[0][0] || 0;

    if (referencedCount > 0) {
      // Archive to preserve historical order integrity
      db.run("UPDATE products SET status = 'archived' WHERE id = ?", [productId]);
      persistDatabase();
      return {
        action: 'archived',
        message: `Product is referenced in ${referencedCount} historical order(s). It has been safely deactivated/archived to protect order records.`,
      };
    } else {
      // Safe to delete entirely
      db.run("DELETE FROM products WHERE id = ?", [productId]);
      persistDatabase();
      return {
        action: 'deleted',
        message: 'Product had no order references and has been permanently deleted.',
      };
    }
  },

  // Categories
  getCategories(includeInactive = false) {
    const sql = includeInactive
      ? "SELECT * FROM categories ORDER BY id ASC"
      : "SELECT * FROM categories WHERE active = 1 ORDER BY id ASC";
    const res = db.exec(sql);
    if (!res[0]) return [];
    const cols = res[0].columns;
    return res[0].values.map((v) => ({
      id: v[cols.indexOf('id')],
      name: v[cols.indexOf('name')],
      tamilName: v[cols.indexOf('tamil_name')],
      icon: v[cols.indexOf('icon')],
      color: v[cols.indexOf('color')],
      active: v[cols.indexOf('active')] === 1,
    }));
  },

  saveCategory(cat) {
    const tamilName = cat.tamilName || cat.tamil_name || cat.name || '';
    const icon = cat.icon || 'Sparkles';
    const color = cat.color || 'emerald';
    const active = cat.active !== false && cat.active !== 0 ? 1 : 0;
    const catId = cat.id || `cat-${Date.now()}`;

    // Check if category exists by ID or by Name to prevent unique constraint crashes
    const byId = db.exec("SELECT id FROM categories WHERE id = ?", [catId]);
    const byName = db.exec("SELECT id FROM categories WHERE name = ?", [cat.name]);

    if (byId[0] && byId[0].values.length > 0) {
      db.run(
        `UPDATE categories SET name = ?, tamil_name = ?, icon = ?, color = ?, active = ? WHERE id = ?`,
        [cat.name, tamilName, icon, color, active, catId]
      );
    } else if (byName[0] && byName[0].values.length > 0) {
      const existingId = byName[0].values[0][0];
      db.run(
        `UPDATE categories SET tamil_name = ?, icon = ?, color = ?, active = ? WHERE id = ?`,
        [tamilName, icon, color, active, existingId]
      );
    } else {
      db.run(
        `INSERT INTO categories (id, name, tamil_name, icon, color, active) VALUES (?, ?, ?, ?, ?, ?)`,
        [catId, cat.name, tamilName, icon, color, active]
      );
    }
    persistDatabase();
    return this.getCategories(true);
  },

  deleteCategory(id) {
    db.run("DELETE FROM categories WHERE id = ?", [id]);
    persistDatabase();
  },

  // Banners
  getBanners(includeInactive = false) {
    const now = new Date().toISOString();
    let sql = includeInactive
      ? "SELECT * FROM promotional_banners ORDER BY COALESCE(order_index, 9999) ASC, rowid ASC"
      : "SELECT * FROM promotional_banners WHERE active = 1 AND (start_date IS NULL OR start_date = '' OR start_date <= ?) AND (end_date IS NULL OR end_date = '' OR end_date >= ?) ORDER BY COALESCE(order_index, 9999) ASC, rowid ASC";
    const res = includeInactive ? db.exec(sql) : db.exec(sql, [now, now]);
    if (!res[0]) return [];
    const cols = res[0].columns;
    return res[0].values.map((v) => ({
      id: v[cols.indexOf('id')],
      title: v[cols.indexOf('title')],
      subtitle: v[cols.indexOf('subtitle')],
      imageUrl: v[cols.indexOf('image_url')],
      linkUrl: v[cols.indexOf('link_url')],
      tag: v[cols.indexOf('tag')],
      active: v[cols.indexOf('active')] === 1,
      startDate: v[cols.indexOf('start_date')],
      endDate: v[cols.indexOf('end_date')],
      orderIndex: cols.indexOf('order_index') !== -1 && v[cols.indexOf('order_index')] != null ? v[cols.indexOf('order_index')] : 0,
    }));
  },

  deleteBanner(id) {
    db.run("DELETE FROM promotional_banners WHERE id = ?", [id]);
    persistDatabase();
  },

  saveBanner(b) {
    db.run(
      `INSERT INTO promotional_banners (id, title, subtitle, image_url, link_url, tag, active, start_date, end_date, order_index)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         subtitle = excluded.subtitle,
         image_url = excluded.image_url,
         link_url = excluded.link_url,
         tag = excluded.tag,
         active = excluded.active,
         start_date = excluded.start_date,
         end_date = excluded.end_date,
         order_index = excluded.order_index`,
      [
        b.id,
        b.title,
        b.subtitle || null,
        b.imageUrl,
        b.linkUrl || null,
        b.tag || null,
        b.active ? 1 : 0,
        b.startDate || null,
        b.endDate || null,
        b.orderIndex != null ? Number(b.orderIndex) : 0,
      ]
    );
    persistDatabase();
  },

  // Store Settings (Payment config & Admin UPI configuration)
  getStoreSettings(key) {
    const res = db.exec("SELECT value_json FROM store_settings WHERE key = ?", [key]);
    if (!res[0] || !res[0].values[0]) return null;
    try {
      return JSON.parse(res[0].values[0][0]);
    } catch {
      return null;
    }
  },

  saveStoreSettings(key, valueObj) {
    const jsonStr = JSON.stringify(valueObj);
    const now = new Date().toISOString();
    db.run(
      `INSERT INTO store_settings (key, value_json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
      [key, jsonStr, now]
    );
    persistDatabase();
    return valueObj;
  },

  // Partner Shops
  getPartners() {
    const res = db.exec("SELECT * FROM partner_shops ORDER BY created_at DESC");
    if (!res[0]) return [];
    return res[0].values.map((v) => mapPartnerRow(res[0].columns, v));
  },

  getPartnerById(id) {
    const res = db.exec("SELECT * FROM partner_shops WHERE id = ?", [id]);
    if (!res[0] || !res[0].values[0]) return null;
    return mapPartnerRow(res[0].columns, res[0].values[0]);
  },

  findPartnerByMobile(mobile) {
    if (!mobile) return null;
    const res = db.exec("SELECT * FROM partner_shops WHERE mobile = ?", [String(mobile).trim()]);
    if (!res[0] || !res[0].values[0]) return null;
    return mapPartnerRow(res[0].columns, res[0].values[0]);
  },

  findPartnerByEmail(email) {
    if (!email) return null;
    const res = db.exec("SELECT * FROM partner_shops WHERE LOWER(email) = LOWER(?)", [String(email).trim()]);
    if (!res[0] || !res[0].values[0]) return null;
    return mapPartnerRow(res[0].columns, res[0].values[0]);
  },

  findPartnerByCode(code) {
    if (!code) return null;
    const res = db.exec("SELECT * FROM partner_shops WHERE UPPER(partner_code) = UPPER(?)", [String(code).trim()]);
    if (!res[0] || !res[0].values[0]) return null;
    return mapPartnerRow(res[0].columns, res[0].values[0]);
  },

  createPartner(p) {
    const existingMobile = this.findPartnerByMobile(p.mobile);
    if (existingMobile) throw new Error('A partner with this mobile number already exists.');
    const existingEmail = this.findPartnerByEmail(p.email);
    if (existingEmail) throw new Error('A partner with this email address already exists.');

    const partnerId = p.id || `ptr-${Date.now().toString().slice(-6)}`;
    const partnerCode = p.partnerCode || `MAG-PTR-${Math.floor(100 + Math.random() * 900)}`;
    const passwordHash = p.password ? hashPassword(p.password) : hashPassword('partner123');

    db.run(
      `INSERT INTO partner_shops (
        id, owner_name, shop_name, mobile, email, partner_code,
        district, city, pin_code, address, merchant_upi_id, gst_number,
        password_hash, documents_json, status, application_status,
        commission_rate, special_coin_bonus_multiplier, partner_redemption_cap_percentage,
        total_sales, total_orders, total_commission_paid, unsettled_amount, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', 'approved', ?, 1.5, 50.0, 0, 0, 0, 0, ?)`,
      [
        partnerId,
        p.ownerName.trim(),
        p.shopName.trim(),
        p.mobile.trim(),
        p.email.trim().toLowerCase(),
        partnerCode,
        p.district.trim(),
        p.city ? p.city.trim() : p.district.trim(),
        p.pinCode.trim(),
        p.address.trim(),
        p.merchantUpiId ? p.merchantUpiId.trim() : 'magizhcafee-3@okhdfcbank',
        p.gstNumber ? p.gstNumber.trim().toUpperCase() : null,
        passwordHash,
        JSON.stringify(p.documents || []),
        p.commissionRate ? parseFloat(p.commissionRate) : 8.0,
        new Date().toISOString()
      ]
    );

    // Create corresponding partner user account in users table
    const existingUser = this.findUserByMobile(p.mobile);
    if (!existingUser) {
      this.createUser({
        id: `user-${partnerId}`,
        name: p.ownerName.trim(),
        mobile: p.mobile.trim(),
        email: p.email.trim().toLowerCase(),
        passwordHash: passwordHash,
        role: 'partner',
        customerCode: partnerCode,
        referralCode: `MAG-REF-${partnerCode.slice(-4)}`,
      });
    }

    persistDatabase();
    return this.getPartnerById(partnerId);
  },

  registerPartnerApplication(p) {
    const existingMobile = this.findPartnerByMobile(p.mobile);
    if (existingMobile) {
      throw new Error('A partner application with this mobile number already exists.');
    }
    const existingEmail = this.findPartnerByEmail(p.email);
    if (existingEmail) {
      throw new Error('A partner application with this email address already exists.');
    }

    const partnerId = `ptr-${Date.now().toString().slice(-6)}`;
    const partnerCode = `MAG-PTR-${Math.floor(100 + Math.random() * 900)}`;
    const passwordHash = p.password ? hashPassword(p.password) : hashPassword('partner123');

    db.run(
      `INSERT INTO partner_shops (
        id, owner_name, shop_name, mobile, email, partner_code,
        district, city, pin_code, address, merchant_upi_id, gst_number,
        password_hash, documents_json, status, application_status,
        commission_rate, special_coin_bonus_multiplier, partner_redemption_cap_percentage,
        total_sales, total_orders, total_commission_paid, unsettled_amount, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', 8.0, 1.5, 50.0, 0, 0, 0, 0, ?)`,
      [
        partnerId,
        p.ownerName.trim(),
        p.shopName.trim(),
        p.mobile.trim(),
        p.email.trim().toLowerCase(),
        partnerCode,
        p.district.trim(),
        p.city ? p.city.trim() : p.district.trim(),
        p.pinCode.trim(),
        p.address.trim(),
        p.merchantUpiId ? p.merchantUpiId.trim() : 'magizhcafee-3@okhdfcbank',
        p.gstNumber ? p.gstNumber.trim().toUpperCase() : null,
        passwordHash,
        JSON.stringify(p.documents || []),
        new Date().toISOString(),
      ]
    );

    this.logAudit(
      'partner',
      p.ownerName,
      'REGISTER_PARTNER',
      `New partner franchise application submitted for "${p.shopName}" (${partnerCode}) with status PENDING.`
    );

    persistDatabase();
    return this.getPartnerById(partnerId);
  },

  getPartnerApplications(statusFilter = null) {
    const sql = statusFilter
      ? "SELECT * FROM partner_shops WHERE LOWER(COALESCE(application_status, status, 'pending')) = ? ORDER BY created_at DESC"
      : "SELECT * FROM partner_shops ORDER BY created_at DESC";
    const res = statusFilter ? db.exec(sql, [statusFilter.trim().toLowerCase()]) : db.exec(sql);
    if (!res[0]) return [];
    return res[0].values.map((v) => mapPartnerRow(res[0].columns, v));
  },

  decidePartnerApplication(partnerId, decision, adminName = 'Admin', notes = '') {
    const partner = this.getPartnerById(partnerId);
    if (!partner) throw new Error('Partner shop application not found.');

    const newStatus = decision === 'approve' ? 'approved' : 'rejected';
    db.run(
      `UPDATE partner_shops SET
         status = ?,
         application_status = ?,
         rejection_reason = ?
       WHERE id = ?`,
      [newStatus, newStatus, decision === 'reject' ? notes : null, partnerId]
    );

    // If approved, create or promote user record in users table
    if (decision === 'approve') {
      const existingUser = this.findUserByMobile(partner.mobile);
      if (!existingUser) {
        this.createUser({
          id: `user-${partner.id}`,
          name: partner.ownerName,
          mobile: partner.mobile,
          email: partner.email,
          passwordHash: partner.passwordHash || hashPassword('partner123'),
          role: 'partner',
          customerCode: partner.partnerCode,
          referralCode: `MAG-REF-${partner.partnerCode.slice(-4)}`,
          status: 'active',
        });
      } else {
        db.run("UPDATE users SET role = 'partner', status = 'active' WHERE id = ?", [existingUser.id]);
      }
    }

    this.logAudit(
      'admin',
      adminName,
      decision === 'approve' ? 'APPROVE_PARTNER' : 'REJECT_PARTNER',
      `Partner application for "${partner.shopName}" (${partner.id}) was ${newStatus}. ${notes}`
    );

    persistDatabase();
    return this.getPartnerById(partnerId);
  },

  savePartner(p) {
    db.run(
      `INSERT INTO partner_shops (id, owner_name, shop_name, mobile, email, partner_code, district, pin_code, address, status, commission_rate, special_coin_bonus_multiplier, partner_redemption_cap_percentage, partner_offer_start_date, partner_offer_end_date, partner_eligibility_rules, total_sales, total_orders, total_commission_paid, unsettled_amount, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         owner_name = excluded.owner_name,
         shop_name = excluded.shop_name,
         mobile = excluded.mobile,
         email = excluded.email,
         district = excluded.district,
         pin_code = excluded.pin_code,
         address = excluded.address,
         status = excluded.status,
         application_status = excluded.status,
         commission_rate = excluded.commission_rate,
         special_coin_bonus_multiplier = excluded.special_coin_bonus_multiplier,
         partner_redemption_cap_percentage = excluded.partner_redemption_cap_percentage,
         partner_offer_start_date = excluded.partner_offer_start_date,
         partner_offer_end_date = excluded.partner_offer_end_date,
         partner_eligibility_rules = excluded.partner_eligibility_rules`,
      [
        p.id, p.ownerName, p.shopName, p.mobile, p.email, p.partnerCode,
        p.district, p.pinCode, p.address, p.status, p.commissionRate,
        p.specialCoinBonusMultiplier || 1.5,
        p.partnerRedemptionCapPercentage || 50.0,
        p.partnerOfferStartDate || null,
        p.partnerOfferEndDate || null,
        p.partnerEligibilityRules || null,
        p.totalSales || 0, p.totalOrders || 0,
        p.totalCommissionPaid || 0, p.unsettledAmount || 0,
        p.createdAt || new Date().toISOString(),
      ]
    );
    persistDatabase();
    return this.getPartnerById(p.id);
  },

  updatePartnerStatus(partnerId, status) {
    const appStatus = status === 'approved' ? 'approved' : (status === 'rejected' ? 'rejected' : status);
    db.run("UPDATE partner_shops SET status = ?, application_status = ? WHERE id = ?", [status, appStatus, partnerId]);

    // Synchronize associated user account in users table
    const partner = this.getPartnerById(partnerId);
    if (partner) {
      const existingUser = this.findUserByMobile(partner.mobile);
      if (existingUser) {
        if (status === 'approved') {
          db.run("UPDATE users SET role = 'partner', status = 'active' WHERE id = ?", [existingUser.id]);
        } else if (status === 'suspended') {
          db.run("UPDATE users SET status = 'suspended' WHERE id = ?", [existingUser.id]);
        }
      } else if (status === 'approved') {
        this.createUser({
          id: `user-${partner.id}`,
          name: partner.ownerName,
          mobile: partner.mobile,
          email: partner.email,
          passwordHash: partner.passwordHash || hashPassword('partner123'),
          role: 'partner',
          customerCode: partner.partnerCode,
          referralCode: `MAG-REF-${partner.partnerCode.slice(-4)}`,
          status: 'active',
        });
      }
    }

    persistDatabase();
  },

  // Orders Management
  createOrder(order) {
    const orderId = order.id || `ord-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const orderNumber = order.orderNumber || `MGZ-${Date.now().toString().slice(-6)}`;
    const customerId = order.customerId || (order.customerPhone ? `user-${order.customerPhone}` : 'guest');
    const customerName = order.customerName || 'Customer';
    const customerPhone = order.customerPhone || '';
    const shippingAddressJson = JSON.stringify(order.shippingAddress || {
      address: order.customerAddress || '',
      district: order.district || '',
      state: order.state || 'Tamil Nadu',
      pincode: order.pincode || '',
    });
    const merchandiseSubtotal = Number(order.merchandiseSubtotal || order.totalAmount || 0);
    const couponCode = order.couponCode || null;
    const couponDiscount = Number(order.couponDiscount || 0);
    const eligibleMerchandiseAmount = Number(order.eligibleMerchandiseAmount || merchandiseSubtotal);
    const coinsRedeemed = Number(order.coinsRedeemed || 0);
    const coinDiscountAmount = Number(order.coinDiscountAmount || 0);
    const deliveryCharge = Number(order.deliveryCharge || 0);
    const taxAmount = Number(order.taxAmount || 0);
    const finalPayableAmount = Number(order.finalPayableAmount || order.totalAmount || (merchandiseSubtotal - couponDiscount - coinDiscountAmount + deliveryCharge));
    const paymentMethod = order.paymentMethod || 'UPI';
    const paymentStatus = order.paymentStatus || 'Pending Payment';
    const orderStatus = order.orderStatus || 'Pending Payment';
    const rewardCoinsEarned = Number(order.rewardCoinsEarned || 0);
    const rewardCoinsCredited = order.rewardCoinsCredited ? 1 : 0;
    const partnerId = order.partnerId || null;
    const itemsJson = JSON.stringify(order.items || []);
    const timelineJson = JSON.stringify(order.timeline || [{ status: orderStatus, timestamp: new Date().toISOString(), note: 'Order created' }]);
    const paymentUtr = order.paymentUtr ? String(order.paymentUtr).trim() : null;
    const upiTransactionRef = order.upiTransactionRef || null;
    const productCoinRedemptionsJson = JSON.stringify(order.productCoinRedemptions || []);
    const createdAt = order.createdAt || new Date().toISOString();
    const updatedAt = order.updatedAt || new Date().toISOString();

    db.run(
      `INSERT INTO orders (id, order_number, customer_id, customer_name, customer_phone, shipping_address_json, merchandise_subtotal, coupon_code, coupon_discount, eligible_merchandise_amount, coins_redeemed, coin_discount_amount, delivery_charge, tax_amount, final_payable_amount, payment_method, payment_status, order_status, reward_coins_earned, reward_coins_credited, partner_id, items_json, timeline_json, payment_utr, upi_transaction_ref, product_coin_redemptions_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        orderNumber,
        customerId,
        customerName,
        customerPhone,
        shippingAddressJson,
        merchandiseSubtotal,
        couponCode,
        couponDiscount,
        eligibleMerchandiseAmount,
        coinsRedeemed,
        coinDiscountAmount,
        deliveryCharge,
        taxAmount,
        finalPayableAmount,
        paymentMethod,
        paymentStatus,
        orderStatus,
        rewardCoinsEarned,
        rewardCoinsCredited,
        partnerId,
        itemsJson,
        timelineJson,
        paymentUtr,
        upiTransactionRef,
        productCoinRedemptionsJson,
        createdAt,
        updatedAt,
      ]
    );
    persistDatabase();
    return this.getOrderById(orderId);
  },

  getOrderById(id) {
    const res = db.exec("SELECT * FROM orders WHERE id = ? OR order_number = ?", [id, id]);
    if (!res[0] || !res[0].values[0]) return null;
    return mapOrderRow(res[0].columns, res[0].values[0]);
  },

  getOrderByUtr(utr) {
    if (!utr) return null;
    const cleanUtr = String(utr).trim();
    const res = db.exec("SELECT * FROM orders WHERE UPPER(payment_utr) = UPPER(?) LIMIT 1", [cleanUtr]);
    if (!res[0] || !res[0].values[0]) return null;
    return mapOrderRow(res[0].columns, res[0].values[0]);
  },

  getOrders() {
    const res = db.exec("SELECT * FROM orders ORDER BY created_at DESC");
    if (!res[0]) return [];
    return res[0].values.map((v) => mapOrderRow(res[0].columns, v));
  },

  updateOrderStatus(orderId, status, note = '') {
    const order = this.getOrderById(orderId);
    if (!order) return null;
    const timeline = order.timeline || [];
    timeline.push({ status, timestamp: new Date().toISOString(), note });
    db.run(
      "UPDATE orders SET order_status = ?, timeline_json = ?, updated_at = ? WHERE id = ? OR order_number = ?",
      [status, JSON.stringify(timeline), new Date().toISOString(), orderId, orderId]
    );
    persistDatabase();
    return this.getOrderById(orderId);
  },

  verifyOrderPayment(orderId, adminName = 'Administrator', notes = '') {
    const order = this.getOrderById(orderId);
    if (!order) return null;
    const nowIso = new Date().toISOString();
    const timeline = order.timeline || [];
    timeline.push({
      status: 'Confirmed',
      timestamp: nowIso,
      note: notes || `UPI Payment verified by Admin (${adminName}). Payment confirmed.`,
    });
    db.run(
      "UPDATE orders SET payment_status = 'Paid', order_status = 'Confirmed', timeline_json = ?, updated_at = ? WHERE id = ? OR order_number = ?",
      [JSON.stringify(timeline), nowIso, order.id, order.id]
    );
    persistDatabase();
    return this.getOrderById(order.id);
  },

  // Coin Accounts & Ledger
  getCoinAccount(customerId) {
    const res = db.exec("SELECT * FROM coin_accounts WHERE customer_id = ?", [customerId]);
    if (!res[0] || !res[0].values[0]) {
      db.run(
        "INSERT OR IGNORE INTO coin_accounts (customer_id, available_balance, total_earned, total_redeemed, pending_balance, reversed_balance) VALUES (?, 0, 0, 0, 0, 0)",
        [customerId]
      );
      persistDatabase();
      return { customerId, availableBalance: 0, totalEarned: 0, totalRedeemed: 0, pendingBalance: 0, reversedBalance: 0 };
    }
    const cols = res[0].columns;
    const row = res[0].values[0];
    return {
      customerId: row[cols.indexOf('customer_id')],
      availableBalance: row[cols.indexOf('available_balance')],
      totalEarned: row[cols.indexOf('total_earned')],
      totalRedeemed: row[cols.indexOf('total_redeemed')],
      pendingBalance: row[cols.indexOf('pending_balance')],
      reversedBalance: row[cols.indexOf('reversed_balance')],
    };
  },

  saveCoinAccount(acc) {
    db.run(
      `INSERT INTO coin_accounts (customer_id, available_balance, total_earned, total_redeemed, pending_balance, reversed_balance)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(customer_id) DO UPDATE SET
         available_balance = excluded.available_balance,
         total_earned = excluded.total_earned,
         total_redeemed = excluded.total_redeemed,
         pending_balance = excluded.pending_balance,
         reversed_balance = excluded.reversed_balance`,
      [acc.customerId, acc.availableBalance, acc.totalEarned, acc.totalRedeemed, acc.pendingBalance || 0, acc.reversedBalance || 0]
    );
    persistDatabase();
  },

  recordCoinTransaction(tx) {
    db.run(
      `INSERT INTO coin_ledger (id, customer_id, order_id, order_number, type, amount, reason, balance_after, status, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tx.id || `TX-${Date.now()}`,
        tx.customerId,
        tx.orderId || null,
        tx.orderNumber || null,
        tx.type,
        tx.amount,
        tx.reason,
        tx.balanceAfter,
        tx.status || 'completed',
        tx.timestamp || new Date().toISOString(),
      ]
    );
    persistDatabase();
  },

  getCoinTransactions(customerId) {
    const sql = customerId
      ? "SELECT * FROM coin_ledger WHERE customer_id = ? ORDER BY timestamp DESC"
      : "SELECT * FROM coin_ledger ORDER BY timestamp DESC";
    const res = customerId ? db.exec(sql, [customerId]) : db.exec(sql);
    if (!res[0]) return [];
    const cols = res[0].columns;
    return res[0].values.map((v) => ({
      id: v[cols.indexOf('id')],
      customerId: v[cols.indexOf('customer_id')],
      orderId: v[cols.indexOf('order_id')],
      orderNumber: v[cols.indexOf('order_number')],
      type: v[cols.indexOf('type')],
      amount: v[cols.indexOf('amount')],
      reason: v[cols.indexOf('reason')],
      balanceAfter: v[cols.indexOf('balance_after')],
      status: v[cols.indexOf('status')],
      timestamp: v[cols.indexOf('timestamp')],
    }));
  },

  // Atomic Partner In-Store Local Transaction
  processLocalPartnerTransaction(partnerIdOrOpts, customerIdArg, eligiblePurchaseAmountArg, requestedCoinsArg, notesArg) {
    let partnerId, customerId, eligiblePurchaseAmount, requestedCoins, notes, customerName, customerPhone;
    if (typeof partnerIdOrOpts === 'object') {
      partnerId = partnerIdOrOpts.partnerId;
      customerId = partnerIdOrOpts.customerId;
      eligiblePurchaseAmount = partnerIdOrOpts.eligiblePurchaseAmount;
      requestedCoins = partnerIdOrOpts.coinsRedeemed;
      notes = partnerIdOrOpts.notes;
      customerName = partnerIdOrOpts.customerName;
      customerPhone = partnerIdOrOpts.customerPhone;
    } else {
      partnerId = partnerIdOrOpts;
      customerId = customerIdArg;
      eligiblePurchaseAmount = eligiblePurchaseAmountArg;
      requestedCoins = requestedCoinsArg;
      notes = notesArg;
    }

    const partner = this.getPartnerById(partnerId);
    if (!partner || partner.status !== 'approved') {
      throw new Error('Partner shop is not approved for B5 Coin redemption');
    }

    const coinAccRes = db.exec("SELECT * FROM coin_accounts WHERE customer_id = ?", [customerId]);
    if (!coinAccRes[0] || !coinAccRes[0].values[0]) {
      throw new Error('Customer coin wallet not found');
    }
    const cols = coinAccRes[0].columns;
    const accRow = coinAccRes[0].values[0];
    const availableBalance = accRow[cols.indexOf('available_balance')];
    const totalRedeemed = accRow[cols.indexOf('total_redeemed')];

    // Enforce 50% system ceiling & partner specific cap
    const systemMaxCap = Math.floor(eligiblePurchaseAmount * 0.50);
    const partnerCapPercent = Math.min(50, partner.partnerRedemptionCapPercentage || 50);
    const partnerMaxCap = Math.floor(eligiblePurchaseAmount * (partnerCapPercent / 100));
    const effectiveCap = Math.min(systemMaxCap, partnerMaxCap);

    if (requestedCoins > effectiveCap) {
      throw new Error(`Requested redemption exceeds cap. Maximum permitted is ${effectiveCap} B5 Coins (${partnerCapPercent}% cap).`);
    }

    if (requestedCoins > availableBalance) {
      throw new Error(`Insufficient coins. You requested ${requestedCoins} but have only ${availableBalance} available.`);
    }

    const netCashPaid = eligiblePurchaseAmount - requestedCoins;
    const commissionEarned = Math.floor(eligiblePurchaseAmount * (partner.commissionRate / 100));
    const settlementDue = eligiblePurchaseAmount - commissionEarned;
    const receiptNumber = `RCP-PTR-${Date.now().toString().slice(-6)}`;
    const txnId = `TXN-LOCAL-${Date.now()}`;

    // Atomic deductions & ledger
    const newBalance = availableBalance - requestedCoins;
    db.run(
      "UPDATE coin_accounts SET available_balance = ?, total_redeemed = ? WHERE customer_id = ?",
      [newBalance, totalRedeemed + requestedCoins, customerId]
    );

    db.run(
      `INSERT INTO coin_ledger (id, customer_id, order_id, order_number, type, amount, reason, balance_after, status, timestamp)
       VALUES (?, ?, ?, ?, 'partner_local_redemption', ?, ?, ?, 'completed', ?)`,
      [
        txnId,
        customerId,
        receiptNumber,
        receiptNumber,
        requestedCoins,
        `In-store purchase at ${partner.shopName} (Receipt #${receiptNumber})`,
        newBalance,
        new Date().toISOString(),
      ]
    );

    // Record local partner transaction
    db.run(
      `INSERT INTO partner_local_transactions (id, receipt_number, partner_id, partner_name, customer_id, customer_name, customer_phone, eligible_purchase_amount, coins_redeemed, net_cash_paid, commission_rate, partner_commission_earned, partner_settlement_due, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)`,
      [
        txnId,
        receiptNumber,
        partner.id,
        partner.shopName,
        customerId,
        customerName || 'Valued Customer',
        customerPhone || '',
        eligiblePurchaseAmount,
        requestedCoins,
        netCashPaid,
        partner.commissionRate,
        commissionEarned,
        settlementDue,
        new Date().toISOString(),
      ]
    );

    // Update partner sales and settlement ledger
    db.run(
      `UPDATE partner_shops SET
         total_sales = total_sales + ?,
         total_orders = total_orders + 1,
         total_commission_paid = total_commission_paid + ?,
         unsettled_amount = unsettled_amount + ?
       WHERE id = ?`,
      [eligiblePurchaseAmount, commissionEarned, settlementDue, partner.id]
    );

    persistDatabase();

    return {
      id: txnId,
      receiptNumber,
      partnerId: partner.id,
      partnerName: partner.shopName,
      customerId,
      customerName: customerName || 'Valued Customer',
      customerPhone: customerPhone || '',
      eligiblePurchaseAmount,
      coinsRedeemed: requestedCoins,
      netCashPaid,
      commissionRate: partner.commissionRate,
      partnerCommissionEarned: commissionEarned,
      partnerSettlementDue: settlementDue,
      status: 'completed',
      createdAt: new Date().toISOString(),
      notes: notes || '',
    };
  },

  getPartnerLocalTransactions(partnerId) {
    const res = db.exec("SELECT * FROM partner_local_transactions WHERE partner_id = ? ORDER BY created_at DESC", [partnerId]);
    if (!res[0]) return [];
    const cols = res[0].columns;
    return res[0].values.map((v) => ({
      id: v[cols.indexOf('id')],
      receiptNumber: v[cols.indexOf('receipt_number')],
      partnerId: v[cols.indexOf('partner_id')],
      partnerName: v[cols.indexOf('partner_name')],
      customerId: v[cols.indexOf('customer_id')],
      eligiblePurchaseAmount: v[cols.indexOf('eligible_purchase_amount')],
      coinsRedeemed: v[cols.indexOf('coins_redeemed')],
      netCashPaid: v[cols.indexOf('net_cash_paid')],
      commissionRate: v[cols.indexOf('commission_rate')],
      partnerCommissionEarned: v[cols.indexOf('partner_commission_earned')],
      partnerSettlementDue: v[cols.indexOf('partner_settlement_due')],
      status: v[cols.indexOf('status')],
      createdAt: v[cols.indexOf('created_at')],
    }));
  },

  // -------------------------------------------------------------
  // E. In-Store Partner Bills & Admin Verification Workflow
  // -------------------------------------------------------------

  lookupCustomerForPartner(mobile) {
    if (!mobile) return null;
    const user = this.findUserByMobile(mobile.trim());
    if (!user) return null;
    const coinAcc = this.getCoinAccount(user.id);
    return {
      id: user.id,
      customerId: user.id,
      name: user.name,
      customerName: user.name,
      mobile: user.mobile,
      customerPhone: user.mobile,
      customerCode: user.customerCode,
      coinBalance: coinAcc.availableBalance,
      availableBalance: coinAcc.availableBalance,
      availableCoins: coinAcc.availableBalance,
      coinAccount: coinAcc,
    };
  },

  createPartnerBill(data) {
    const partner = this.getPartnerById(data.partnerId);
    if (!partner || partner.status !== 'approved') {
      throw new Error('Only approved partner shops can create in-store billing requests.');
    }

    const customer = this.findUserById(data.customerId) || this.findUserByMobile(data.customerPhone);
    if (!customer) {
      throw new Error('Customer account not found.');
    }

    const originalAmount = parseFloat(data.originalBillAmount);
    if (isNaN(originalAmount) || originalAmount <= 0) {
      throw new Error('Original bill amount must be greater than zero.');
    }

    const coinAccount = this.getCoinAccount(customer.id);
    const partnerCapPercent = Math.min(50, partner.partnerRedemptionCapPercentage || 50);
    const maxCap = Math.floor(originalAmount * (partnerCapPercent / 100)); // Partner configured cap (max 50%)
    const requestedCoins = Math.max(0, parseInt(data.coinsToRedeem, 10) || 0);

    if (requestedCoins > maxCap) {
      throw new Error(`B5 Coin redemption cannot exceed ${partnerCapPercent}% of the bill amount (Maximum allowed: ${maxCap} coins).`);
    }

    if (requestedCoins > coinAccount.availableBalance) {
      throw new Error(`Customer has only ${coinAccount.availableBalance} B5 Coins available.`);
    }

    const discountAmount = requestedCoins; // 1 B5 Coin = ₹1
    const payableAmount = originalAmount - discountAmount;
    const billId = `bill-${Date.now()}`;
    const billNumber = `MAG-BILL-${Math.floor(100000 + Math.random() * 900000)}`;

    db.run(
      `INSERT INTO partner_bills (
        id, bill_number, partner_id, partner_name, merchant_upi_id,
        customer_id, customer_name, customer_phone, original_bill_amount,
        coins_to_redeem, discount_amount, payable_amount, items_summary,
        status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_CUSTOMER_APPROVAL', ?)`,
      [
        billId,
        billNumber,
        partner.id,
        partner.shopName,
        partner.merchantUpiId || 'magizhcafee-3@okhdfcbank',
        customer.id,
        customer.name,
        customer.mobile,
        originalAmount,
        requestedCoins,
        discountAmount,
        payableAmount,
        data.itemsSummary || 'In-store merchandise purchase',
        new Date().toISOString(),
      ]
    );

    persistDatabase();
    return this.getBillById(billId);
  },

  getBillById(id) {
    const res = db.exec("SELECT * FROM partner_bills WHERE id = ? OR bill_number = ?", [id, id]);
    if (!res[0] || !res[0].values[0]) return null;
    return mapBillRow(res[0].columns, res[0].values[0]);
  },

  getCustomerPendingBills(customerId, mobile) {
    const cid = customerId && customerId !== 'guest' && customerId !== 'DEFAULT_GUEST_USER' ? String(customerId).trim() : '';
    const phone = mobile ? String(mobile).trim() : '';
    if (!cid && !phone) return [];

    let sql;
    let params;
    if (cid && phone) {
      sql = `SELECT * FROM partner_bills 
             WHERE (customer_id = ? OR customer_phone = ?) 
               AND (status NOT IN ('COMPLETED', 'REJECTED', 'CANCELLED') 
                    OR datetime(COALESCE(admin_decision_at, partner_received_at, created_at)) >= datetime('now', '-30 minutes'))
             ORDER BY created_at DESC`;
      params = [cid, phone];
    } else if (cid) {
      sql = `SELECT * FROM partner_bills 
             WHERE customer_id = ? 
               AND (status NOT IN ('COMPLETED', 'REJECTED', 'CANCELLED') 
                    OR datetime(COALESCE(admin_decision_at, partner_received_at, created_at)) >= datetime('now', '-30 minutes'))
             ORDER BY created_at DESC`;
      params = [cid];
    } else {
      sql = `SELECT * FROM partner_bills 
             WHERE customer_phone = ? 
               AND (status NOT IN ('COMPLETED', 'REJECTED', 'CANCELLED') 
                    OR datetime(COALESCE(admin_decision_at, partner_received_at, created_at)) >= datetime('now', '-30 minutes'))
             ORDER BY created_at DESC`;
      params = [phone];
    }

    const res = db.exec(sql, params);
    if (!res[0]) return [];
    const cols = res[0].columns;
    return res[0].values.map((v) => mapBillRow(cols, v));
  },

  getCustomerAllBills(customerId, mobile) {
    const cid = customerId && customerId !== 'guest' && customerId !== 'DEFAULT_GUEST_USER' ? String(customerId).trim() : '';
    const phone = mobile ? String(mobile).trim() : '';
    if (!cid && !phone) return [];

    let sql;
    let params;
    if (cid && phone) {
      sql = `SELECT * FROM partner_bills WHERE (customer_id = ? OR customer_phone = ?) ORDER BY created_at DESC`;
      params = [cid, phone];
    } else if (cid) {
      sql = `SELECT * FROM partner_bills WHERE customer_id = ? ORDER BY created_at DESC`;
      params = [cid];
    } else {
      sql = `SELECT * FROM partner_bills WHERE customer_phone = ? ORDER BY created_at DESC`;
      params = [phone];
    }

    const res = db.exec(sql, params);
    if (!res[0]) return [];
    const cols = res[0].columns;
    return res[0].values.map((v) => mapBillRow(cols, v));
  },

  getPartnerBills(partnerId) {
    const res = db.exec("SELECT * FROM partner_bills WHERE partner_id = ? ORDER BY created_at DESC", [partnerId]);
    if (!res[0]) return [];
    const cols = res[0].columns;
    return res[0].values.map((v) => mapBillRow(cols, v));
  },

  customerSelectBillPayment(billId, paymentMethod) {
    const bill = this.getBillById(billId);
    if (!bill) throw new Error('Bill not found.');

    const method = String(paymentMethod).toLowerCase().trim();
    if (method !== 'cash' && method !== 'upi') {
      throw new Error('Please select either Cash or UPI payment method.');
    }

    // Selecting payment method prepares the checkout option without completing or advancing to partner verification
    db.run(
      `UPDATE partner_bills SET
         payment_method = ?,
         status = 'AWAITING_CUSTOMER_CONFIRMATION',
         customer_approved_at = ?
       WHERE id = ?`,
      [method, new Date().toISOString(), bill.id]
    );

    persistDatabase();
    return this.getBillById(bill.id);
  },

  customerConfirmBillPayment(billId, customerId, paymentMethod, utrNumber = '') {
    const bill = this.getBillById(billId);
    if (!bill) throw new Error('Bill not found.');

    if (bill.status === 'COMPLETED') {
      throw new Error(`Bill #${bill.billNumber} has already been completed.`);
    }
    if (bill.status === 'CANCELLED' || bill.status === 'REJECTED') {
      throw new Error(`Bill #${bill.billNumber} has been ${bill.status.toLowerCase()}.`);
    }

    const method = String(paymentMethod || bill.paymentMethod || 'cash').toLowerCase().trim();
    if (method !== 'cash' && method !== 'upi') {
      throw new Error('Please select either Cash or UPI payment method.');
    }

    const nowIso = new Date().toISOString();
    const cleanUtr = String(utrNumber || '').trim();

    db.run(
      `UPDATE partner_bills SET
         payment_method = ?,
         utr_number = ?,
         status = 'PENDING_PARTNER_VERIFICATION',
         customer_confirmed_at = ?,
         customer_approved_at = ?
       WHERE id = ?`,
      [method, cleanUtr, nowIso, nowIso, bill.id]
    );

    this.logAudit(
      'customer',
      bill.customerName,
      'CONFIRM_BILL_PAYMENT',
      `Customer confirmed in-store payment of ₹${bill.payableAmount} via ${method.toUpperCase()}${cleanUtr ? ` (UTR: ${cleanUtr})` : ''} for Bill #${bill.billNumber}. Awaiting cashier verification.`
    );

    persistDatabase();
    return this.getBillById(bill.id);
  },

  partnerConfirmBillPaymentReceived(billId, partnerId) {
    const bill = this.getBillById(billId);
    if (!bill) throw new Error('Bill not found.');
    if (bill.partnerId !== partnerId) throw new Error('Unauthorized partner.');

    db.run(
      `UPDATE partner_bills SET
         status = 'PENDING_ADMIN_APPROVAL',
         partner_received_at = ?
       WHERE id = ?`,
      [new Date().toISOString(), bill.id]
    );

    persistDatabase();
    return this.getBillById(bill.id);
  },

  updatePartnerSettings(partnerId, settings) {
    const partner = this.getPartnerById(partnerId);
    if (!partner) throw new Error('Partner shop not found.');

    if (settings.merchantUpiId !== undefined) {
      const upi = String(settings.merchantUpiId).trim();
      const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
      if (!upiRegex.test(upi)) {
        throw new Error('Invalid UPI ID format. Exactly ONE valid UPI ID is required (e.g. yourshop@upi or 9843210987@okaxis).');
      }
      partner.merchantUpiId = upi;
    }

    if (settings.partnerRedemptionCapPercentage !== undefined) {
      const cap = parseFloat(settings.partnerRedemptionCapPercentage);
      if (isNaN(cap) || cap < 5 || cap > 50) {
        throw new Error('Coin discount percentage must be between 5% and 50%.');
      }
      partner.partnerRedemptionCapPercentage = cap;
    }

    if (settings.storeCategory !== undefined && String(settings.storeCategory).trim()) {
      partner.storeCategory = String(settings.storeCategory).trim();
    }
    if (settings.shopName !== undefined && String(settings.shopName).trim()) {
      partner.shopName = String(settings.shopName).trim();
    }
    if (settings.address !== undefined && String(settings.address).trim()) {
      partner.address = String(settings.address).trim();
    }
    if (settings.storeImages !== undefined && Array.isArray(settings.storeImages)) {
      const validImages = settings.storeImages.slice(0, 4);
      partner.storeImages = validImages;
      db.run("UPDATE partner_shops SET store_images_json = ? WHERE id = ?", [JSON.stringify(validImages), partner.id]);
    }

    db.run(
      `UPDATE partner_shops SET
         merchant_upi_id = ?,
         partner_redemption_cap_percentage = ?,
         store_category = ?,
         shop_name = ?,
         address = ?
       WHERE id = ?`,
      [
        partner.merchantUpiId,
        partner.partnerRedemptionCapPercentage,
        partner.storeCategory || 'Organic Groceries',
        partner.shopName,
        partner.address,
        partner.id,
      ]
    );

    persistDatabase();
    return this.getPartnerById(partner.id);
  },

  updatePartnerStoreImages(partnerId, storeImages) {
    const partner = this.getPartnerById(partnerId);
    if (!partner) throw new Error('Partner shop not found.');
    const validImages = Array.isArray(storeImages) ? storeImages.slice(0, 4) : [];
    db.run("UPDATE partner_shops SET store_images_json = ? WHERE id = ?", [JSON.stringify(validImages), partner.id]);
    persistDatabase();
    return this.getPartnerById(partner.id);
  },

  partnerApproveBill(billId, partnerId, notes = '') {
    const bill = this.getBillById(billId);
    if (!bill) throw new Error('Bill not found.');
    if (bill.partnerId !== partnerId) throw new Error('Unauthorized partner.');

    // Concurrency / Idempotency protection: Prevent duplicate approvals
    if (bill.status === 'COMPLETED') {
      throw new Error(`Bill #${bill.billNumber} has already been completed and coins deducted.`);
    }
    if (bill.status === 'CANCELLED' || bill.status === 'REJECTED') {
      throw new Error(`Bill #${bill.billNumber} is ${bill.status.toLowerCase()} and cannot be approved.`);
    }

    const nowIso = new Date().toISOString();

    // Revalidate customer coin account balance before permanent deduction
    const coinAcc = this.getCoinAccount(bill.customerId);
    if (bill.coinsToRedeem > 0 && coinAcc.availableBalance < bill.coinsToRedeem) {
      throw new Error(`Customer has only ${coinAcc.availableBalance} B5 Coins available. Cannot deduct ${bill.coinsToRedeem} coins.`);
    }

    const receiptNumber = `RCP-PTR-${Date.now().toString().slice(-6)}`;

    // Deduct coins from Customer Wallet
    if (bill.coinsToRedeem > 0) {
      const newBalance = coinAcc.availableBalance - bill.coinsToRedeem;
      const newTotalRedeemed = coinAcc.totalRedeemed + bill.coinsToRedeem;

      db.run(
        "UPDATE coin_accounts SET available_balance = ?, total_redeemed = ? WHERE customer_id = ?",
        [newBalance, newTotalRedeemed, bill.customerId]
      );

      // Record in double-entry coin ledger for customer
      this.recordCoinTransaction({
        id: `TX-BILL-${Date.now()}`,
        customerId: bill.customerId,
        orderId: bill.billNumber,
        orderNumber: bill.billNumber,
        type: 'debit',
        amount: bill.coinsToRedeem,
        reason: `In-store purchase at ${bill.partnerName} (Bill #${bill.billNumber})`,
        balanceAfter: newBalance,
        status: 'completed',
        timestamp: nowIso,
      });

      // Persistent coin redemption notification for customer celebration
      this.createCoinNotification({
        customerId: bill.customerId,
        type: 'redemption',
        coins: bill.coinsToRedeem,
        previousBalance: coinAcc.availableBalance,
        newBalance: newBalance,
        title: 'B5 Coins Redeemed Successfully!',
        message: `You saved ₹${bill.coinsToRedeem} using ${bill.coinsToRedeem} B5 Coins at ${bill.partnerName}.`,
      });
    }

    // Partner Reward Coins & Sales Oversight
    const partner = this.getPartnerById(bill.partnerId);
    let partnerRewardCoins = 0;
    if (partner) {
      const commissionEarned = Math.floor(bill.originalBillAmount * (partner.commissionRate / 100));
      const settlementDue = bill.originalBillAmount - commissionEarned;
      const bonusMult = partner.specialCoinBonusMultiplier || 1.5;
      partnerRewardCoins = Math.floor(bill.originalBillAmount * (0.05 * bonusMult));

      db.run(
        `UPDATE partner_shops SET
           total_sales = total_sales + ?,
           total_orders = total_orders + 1,
           total_commission_paid = total_commission_paid + ?,
           unsettled_amount = unsettled_amount + ?
         WHERE id = ?`,
        [bill.originalBillAmount, commissionEarned, settlementDue, partner.id]
      );

      // Credit partner user reward coins if partner account exists
      const partnerUser = this.findUserByMobile(partner.mobile) || this.findUserById('user-' + partner.id);
      if (partnerUser && partnerRewardCoins > 0) {
        const partnerCoinAcc = this.getCoinAccount(partnerUser.id);
        const pNewBal = partnerCoinAcc.availableBalance + partnerRewardCoins;
        const pNewEarned = partnerCoinAcc.totalEarned + partnerRewardCoins;

        db.run(
          "UPDATE coin_accounts SET available_balance = ?, total_earned = ? WHERE customer_id = ?",
          [pNewBal, pNewEarned, partnerUser.id]
        );

        this.recordCoinTransaction({
          id: `TX-PTR-REW-${Date.now()}`,
          customerId: partnerUser.id,
          orderId: bill.billNumber,
          orderNumber: bill.billNumber,
          type: 'partner_sales_reward',
          amount: partnerRewardCoins,
          reason: `Partner retail reward for in-store Bill #${bill.billNumber} (${bill.customerName})`,
          balanceAfter: pNewBal,
          status: 'completed',
          timestamp: nowIso,
        });
      }
    }

    db.run(
      `UPDATE partner_bills SET
         status = 'COMPLETED',
         receipt_number = ?,
         partner_received_at = ?,
         admin_decision_at = ?,
         admin_decision_by = 'Partner Cashier Verified',
         admin_notes = ?,
         partner_reward_coins = ?
       WHERE id = ?`,
      [receiptNumber, nowIso, nowIso, notes || 'Payment verified in person by store partner', partnerRewardCoins, bill.id]
    );

    this.logAudit(
      'partner',
      bill.partnerName,
      'PARTNER_APPROVE_BILL',
      `Partner approved Bill #${bill.billNumber}: ₹${bill.payableAmount} verified via ${bill.paymentMethod || 'In-Store'}, ${bill.coinsToRedeem} B5 Coins deducted, ${partnerRewardCoins} Partner Reward Coins granted.`
    );

    persistDatabase();
    return this.getBillById(bill.id);
  },

  partnerRejectBill(billId, partnerId, reason = '') {
    const bill = this.getBillById(billId);
    if (!bill) throw new Error('Bill not found.');
    if (bill.partnerId !== partnerId) throw new Error('Unauthorized partner.');

    if (bill.status === 'COMPLETED') {
      throw new Error('Cannot reject a bill that has already been completed.');
    }

    const nowIso = new Date().toISOString();
    const cleanReason = reason || 'Payment not received / Disputed by Store Partner';

    db.run(
      `UPDATE partner_bills SET
         status = 'REJECTED',
         admin_notes = ?,
         admin_decision_at = ?
       WHERE id = ?`,
      [cleanReason, nowIso, bill.id]
    );

    this.logAudit(
      'partner',
      bill.partnerName,
      'REJECT_PARTNER_BILL',
      `Partner rejected/disputed Bill #${bill.billNumber}. Reason: ${cleanReason}. Zero coins deducted.`
    );

    persistDatabase();
    return this.getBillById(bill.id);
  },

  cancelPartnerBill(billId, partnerId, reason = '') {
    return this.partnerRejectBill(billId, partnerId, reason || 'Cancelled by store partner');
  },

  getPendingAdminBills() {
    const res = db.exec("SELECT * FROM partner_bills WHERE status = 'PENDING_ADMIN_APPROVAL' ORDER BY created_at DESC");
    if (!res[0]) return [];
    const cols = res[0].columns;
    return res[0].values.map((v) => mapBillRow(cols, v));
  },

  getAllPartnerBills() {
    const res = db.exec("SELECT * FROM partner_bills ORDER BY created_at DESC LIMIT 100");
    if (!res[0]) return [];
    const cols = res[0].columns;
    return res[0].values.map((v) => mapBillRow(cols, v));
  },

  adminDecideBill(billId, decision, adminName = 'Admin', notes = '') {
    const bill = this.getBillById(billId);
    if (!bill) throw new Error('Bill not found.');

    // Prevent duplicate approvals
    if (bill.status !== 'PENDING_ADMIN_APPROVAL') {
      throw new Error(`Bill #${bill.billNumber} is not pending admin approval (current status: ${bill.status}).`);
    }

    const nowIso = new Date().toISOString();

    if (decision === 'approve') {
      // Revalidate customer coin account balance
      const coinAcc = this.getCoinAccount(bill.customerId);
      if (bill.coinsToRedeem > 0 && coinAcc.availableBalance < bill.coinsToRedeem) {
        throw new Error(`Insufficient customer coins: requested ${bill.coinsToRedeem} but wallet has only ${coinAcc.availableBalance}.`);
      }

      const receiptNumber = `RCP-PTR-${Date.now().toString().slice(-6)}`;

      // Deduct coins if any were used
      if (bill.coinsToRedeem > 0) {
        const newBalance = coinAcc.availableBalance - bill.coinsToRedeem;
        const newTotalRedeemed = coinAcc.totalRedeemed + bill.coinsToRedeem;

        db.run(
          "UPDATE coin_accounts SET available_balance = ?, total_redeemed = ? WHERE customer_id = ?",
          [newBalance, newTotalRedeemed, bill.customerId]
        );

        // Double-entry coin ledger record
        this.recordCoinTransaction({
          id: `TX-BILL-${Date.now()}`,
          customerId: bill.customerId,
          orderId: bill.billNumber,
          orderNumber: bill.billNumber,
          type: 'debit',
          amount: bill.coinsToRedeem,
          reason: `In-store purchase at ${bill.partnerName} (Bill #${bill.billNumber})`,
          balanceAfter: newBalance,
          status: 'completed',
          timestamp: nowIso,
        });

        // Persistent coin redemption notification for customer celebration
        this.createCoinNotification({
          customerId: bill.customerId,
          type: 'redemption',
          coins: bill.coinsToRedeem,
          previousBalance: coinAcc.availableBalance,
          newBalance: newBalance,
          title: 'B5 Coins Redeemed Successfully!',
          message: `You saved ₹${bill.coinsToRedeem} using ${bill.coinsToRedeem} B5 Coins at ${bill.partnerName}.`,
        });
      }

      // Update partner sales and commission ledger
      const partner = this.getPartnerById(bill.partnerId);
      if (partner) {
        const commissionEarned = Math.floor(bill.originalBillAmount * (partner.commissionRate / 100));
        const settlementDue = bill.originalBillAmount - commissionEarned;
        db.run(
          `UPDATE partner_shops SET
             total_sales = total_sales + ?,
             total_orders = total_orders + 1,
             total_commission_paid = total_commission_paid + ?,
             unsettled_amount = unsettled_amount + ?
           WHERE id = ?`,
          [bill.originalBillAmount, commissionEarned, settlementDue, partner.id]
        );
      }

      db.run(
        `UPDATE partner_bills SET
           status = 'COMPLETED',
           receipt_number = ?,
           admin_decision_at = ?,
           admin_decision_by = ?,
           admin_notes = ?
         WHERE id = ?`,
        [receiptNumber, nowIso, adminName, notes || 'Payment verified by Admin', bill.id]
      );

      this.logAudit(
        'admin',
        adminName,
        'APPROVE_PARTNER_BILL',
        `Approved Bill #${bill.billNumber} for ${bill.partnerName}: ₹${bill.payableAmount} paid via ${bill.paymentMethod}, ${bill.coinsToRedeem} B5 Coins deducted.`
      );
    } else {
      // Rejected: DO NOT DEDUCT COINS
      db.run(
        `UPDATE partner_bills SET
           status = 'REJECTED',
           admin_decision_at = ?,
           admin_decision_by = ?,
           admin_notes = ?
         WHERE id = ?`,
        [nowIso, adminName, notes || 'Payment rejected by Admin', bill.id]
      );

      this.logAudit(
        'admin',
        adminName,
        'REJECT_PARTNER_BILL',
        `Rejected Bill #${bill.billNumber} for ${bill.partnerName}. Reason: ${notes}`
      );
    }

    persistDatabase();
    return this.getBillById(bill.id);
  },

  // -------------------------------------------------------------
  // F. Persistent Coin Credit Notifications & Celebrations
  // -------------------------------------------------------------

  createCoinNotification(data) {
    const notifId = `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    db.run(
      `INSERT INTO coin_notifications (
         id, customer_id, type, coins, previous_balance, new_balance, title, message, is_viewed, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        notifId,
        data.customerId,
        data.type || 'credit',
        data.coins,
        data.previousBalance,
        data.newBalance,
        data.title,
        data.message,
        new Date().toISOString(),
      ]
    );
    persistDatabase();
    return notifId;
  },

  getUnreadCoinNotifications(customerId) {
    const res = db.exec(
      "SELECT * FROM coin_notifications WHERE customer_id = ? AND is_viewed = 0 ORDER BY created_at ASC",
      [customerId]
    );
    if (!res[0]) return [];
    const cols = res[0].columns;
    return res[0].values.map((v) => mapCoinNotificationRow(cols, v));
  },

  markCoinNotificationViewed(notificationId) {
    db.run(
      "UPDATE coin_notifications SET is_viewed = 1, viewed_at = ? WHERE id = ?",
      [new Date().toISOString(), notificationId]
    );
    persistDatabase();
  },

  creditCustomerCoinsWithNotification(customerId, coins, reason, adminName = 'Admin') {
    const user = this.findUserById(customerId);
    if (!user) throw new Error('Customer account not found.');

    const amount = parseFloat(coins);
    if (isNaN(amount) || amount <= 0) {
      throw new Error('Coins amount must be greater than zero.');
    }

    const coinAcc = this.getCoinAccount(customerId);
    const previousBalance = coinAcc.availableBalance;
    const newBalance = previousBalance + amount;
    const newTotalEarned = coinAcc.totalEarned + amount;

    db.run(
      "UPDATE coin_accounts SET available_balance = ?, total_earned = ? WHERE customer_id = ?",
      [newBalance, newTotalEarned, customerId]
    );

    const txId = `TX-CREDIT-${Date.now()}`;
    this.recordCoinTransaction({
      id: txId,
      customerId,
      orderId: null,
      orderNumber: null,
      type: 'admin_credit_reward',
      amount,
      reason: reason || 'Promotional B5 Coin reward credited by Administrator',
      balanceAfter: newBalance,
      status: 'completed',
      timestamp: new Date().toISOString(),
    });

    const notifId = this.createCoinNotification({
      customerId,
      type: 'credit',
      coins: amount,
      previousBalance,
      newBalance,
      title: 'Congratulations! Your B5 Coins Have Arrived!',
      message: reason || `Admin has credited ${amount} B5 Coins to your Magizh Shopping wallet.`,
    });

    this.logAudit(
      'admin',
      adminName,
      'CREDIT_B5_COINS',
      `Credited ${amount} B5 Coins to ${user.name} (${user.id}). Balance: ${previousBalance} -> ${newBalance}. Reason: ${reason}`
    );

    persistDatabase();
    return {
      success: true,
      notificationId: notifId,
      previousBalance,
      newBalance,
      coinsCredited: amount,
    };
  },

  // Manual Coin Credit Requests (Phase 1)
  createManualCoinRequest(data) {
    const id = data.id || `REQ-${Date.now()}`;
    const requestedAt = data.requestedAt || new Date().toISOString();
    const coins = parseFloat(data.coins) || 0;
    if (coins <= 0) throw new Error('Coins amount must be greater than zero.');

    db.run(
      `INSERT INTO manual_coin_requests (
        id, customer_id, customer_name, customer_phone, customer_email,
        b5_id, coins, reason, requested_by, requested_at, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        id,
        data.customerId,
        data.customerName || 'Customer',
        data.customerPhone || '',
        data.customerEmail || data.email || '',
        data.b5Id || '',
        coins,
        data.reason || 'Manual coin credit request',
        data.requestedBy || data.customerName || 'Customer',
        requestedAt,
      ]
    );
    this.logAudit(
      'customer',
      data.customerName || 'Customer',
      'SUBMIT_COIN_REQUEST',
      `Submitted request for ${coins} B5 Coins. Reason: ${data.reason}`
    );
    persistDatabase();
    return this.getManualCoinRequestById(id);
  },

  getManualCoinRequestById(id) {
    const res = db.exec("SELECT * FROM manual_coin_requests WHERE id = ?", [id]);
    if (!res[0] || !res[0].values[0]) return null;
    const cols = res[0].columns;
    const row = res[0].values[0];
    const obj = {};
    cols.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return {
      id: obj.id,
      customerId: obj.customer_id,
      customerName: obj.customer_name,
      customerPhone: obj.customer_phone,
      customerEmail: obj.customer_email || '',
      b5Id: obj.b5_id || '',
      coins: obj.coins,
      approvedAmount: obj.approved_amount != null ? obj.approved_amount : undefined,
      reason: obj.reason,
      requestedBy: obj.requested_by,
      requestedAt: obj.requested_at,
      status: obj.status,
      adminId: obj.admin_id || undefined,
      adminNotes: obj.admin_notes || undefined,
      previousBalance: obj.previous_balance != null ? obj.previous_balance : undefined,
      newBalance: obj.new_balance != null ? obj.new_balance : undefined,
      resolvedAt: obj.resolved_at || undefined,
    };
  },

  getManualCoinRequests(customerId = null) {
    let sql = "SELECT * FROM manual_coin_requests";
    const params = [];
    if (customerId) {
      sql += " WHERE customer_id = ?";
      params.push(customerId);
    }
    sql += " ORDER BY requested_at DESC";

    const res = db.exec(sql, params);
    if (!res[0]) return [];
    const cols = res[0].columns;
    return res[0].values.map((row) => {
      const obj = {};
      cols.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return {
        id: obj.id,
        customerId: obj.customer_id,
        customerName: obj.customer_name,
        customerPhone: obj.customer_phone,
        customerEmail: obj.customer_email || '',
        b5Id: obj.b5_id || '',
        coins: obj.coins,
        approvedAmount: obj.approved_amount != null ? obj.approved_amount : undefined,
        reason: obj.reason,
        requestedBy: obj.requested_by,
        requestedAt: obj.requested_at,
        status: obj.status,
        adminId: obj.admin_id || undefined,
        adminNotes: obj.admin_notes || undefined,
        previousBalance: obj.previous_balance != null ? obj.previous_balance : undefined,
        newBalance: obj.new_balance != null ? obj.new_balance : undefined,
        resolvedAt: obj.resolved_at || undefined,
      };
    });
  },

  resolveManualCoinRequest(requestId, status, adminId = 'Admin', adminNotes = '', approvedAmount = null) {
    const req = this.getManualCoinRequestById(requestId);
    if (!req) throw new Error('Request not found.');
    if (req.status !== 'pending') throw new Error(`Request has already been ${req.status}.`);

    const now = new Date().toISOString();
    if (status === 'approved') {
      const amount = approvedAmount != null ? parseFloat(approvedAmount) : req.coins;
      if (isNaN(amount) || amount <= 0) throw new Error('Approved coins amount must be greater than zero.');

      const coinAcc = this.getCoinAccount(req.customerId);
      const prevBal = coinAcc.availableBalance;
      const newBal = prevBal + amount;
      const newTotal = coinAcc.totalEarned + amount;

      db.run(
        "UPDATE coin_accounts SET available_balance = ?, total_earned = ? WHERE customer_id = ?",
        [newBal, newTotal, req.customerId]
      );

      const txId = `TXN-MANUAL-${Date.now()}`;
      this.recordCoinTransaction({
        id: txId,
        customerId: req.customerId,
        orderId: null,
        orderNumber: null,
        type: 'manual_credit',
        amount: amount,
        reason: `Admin Manual Approval (${req.reason || 'Coin Request'})`,
        balanceAfter: newBal,
        status: 'completed',
        timestamp: now,
      });

      this.createCoinNotification({
        customerId: req.customerId,
        type: 'credit',
        coins: amount,
        previousBalance: prevBal,
        newBalance: newBal,
        title: 'B5 Coins Approved & Credited!',
        message: adminNotes || `Your request for ${amount} B5 Coins has been approved by Admin.`,
      });

      db.run(
        `UPDATE manual_coin_requests
         SET status = 'approved', approved_amount = ?, admin_id = ?, previous_balance = ?, new_balance = ?, admin_notes = ?, resolved_at = ?
         WHERE id = ?`,
        [amount, adminId, prevBal, newBal, adminNotes || 'Approved by Admin', now, requestId]
      );

      this.logAudit(
        'admin',
        adminId,
        'APPROVE_COIN_REQUEST',
        `Approved request ${requestId} for ${req.customerName}. Credited: ${amount} coins. Balance: ${prevBal} -> ${newBal}. Note: ${adminNotes}`
      );
    } else if (status === 'rejected') {
      db.run(
        `UPDATE manual_coin_requests
         SET status = 'rejected', admin_id = ?, admin_notes = ?, resolved_at = ?
         WHERE id = ?`,
        [adminId, adminNotes || 'Rejected by Admin', now, requestId]
      );

      this.logAudit(
        'admin',
        adminId,
        'REJECT_COIN_REQUEST',
        `Rejected request ${requestId} for ${req.customerName}. Note: ${adminNotes}`
      );
    } else {
      throw new Error(`Invalid status "${status}". Allowed: approved, rejected.`);
    }

    persistDatabase();
    return this.getManualCoinRequestById(requestId);
  },

  // Audit Logs
  logAudit(actorRole, actorName, action, details, ipAddress = '127.0.0.1') {
    db.run(
      `INSERT INTO audit_logs (id, timestamp, actor_role, actor_name, action, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [`LOG-${Date.now()}`, new Date().toISOString(), actorRole, actorName, action, details, ipAddress]
    );
    persistDatabase();
  },

  getAuditLogs() {
    const res = db.exec("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100");
    if (!res[0]) return [];
    const cols = res[0].columns;
    return res[0].values.map((v) => ({
      id: v[cols.indexOf('id')],
      timestamp: v[cols.indexOf('timestamp')],
      actorRole: v[cols.indexOf('actor_role')],
      actorName: v[cols.indexOf('actor_name')],
      action: v[cols.indexOf('action')],
      details: v[cols.indexOf('details')],
      ipAddress: v[cols.indexOf('ip_address')],
    }));
  },

  // Customer Profile Management
  getCustomerFullProfile(userId) {
    const user = this.findUserById(userId);
    if (!user) return null;
    const coinAcc = this.getCoinAccount(userId);
    const coinTxns = this.getCoinTransactions(userId);
    const orders = this.getOrders(userId);
    const pendingBills = this.getCustomerPendingBills(userId);

    const { passwordHash, ...safeUser } = user;
    return {
      user: safeUser,
      coinAccount: coinAcc,
      recentTransactions: coinTxns.slice(0, 15),
      orders: orders.slice(0, 15),
      pendingBills,
    };
  },

  updateCustomerProfile(userId, updates) {
    const user = this.findUserById(userId) || this.findUserByMobile(userId);
    if (!user) throw new Error('Customer account not found.');

    if (updates.email && updates.email.trim().toLowerCase() !== user.email.toLowerCase()) {
      const existingEmail = this.findUserByEmail(updates.email.trim());
      if (existingEmail && existingEmail.id !== user.id) {
        throw new Error('This email address is already registered to another account.');
      }
    }

    if (updates.mobile && updates.mobile.trim() !== user.mobile) {
      const existingMobile = this.findUserByMobile(updates.mobile.trim());
      if (existingMobile && existingMobile.id !== user.id) {
        throw new Error('This mobile number is already registered to another account.');
      }
    }

    const newName = updates.name ? updates.name.trim() : user.name;
    const newEmail = updates.email ? updates.email.trim().toLowerCase() : user.email;
    const newMobile = updates.mobile ? updates.mobile.trim() : user.mobile;
    const newPhoto = updates.profilePhoto !== undefined ? updates.profilePhoto : (user.profilePhoto || null);
    const addressesJson = updates.addresses !== undefined ? JSON.stringify(updates.addresses) : JSON.stringify(user.addresses || []);

    db.run(
      `UPDATE users SET name = ?, email = ?, mobile = ?, profile_photo = ?, addresses_json = ? WHERE id = ?`,
      [newName, newEmail, newMobile, newPhoto, addressesJson, user.id]
    );
    this.logAudit('customer', newName, 'UPDATE_PROFILE', `Customer ${user.id} updated personal profile details.`);
    persistDatabase();
    return this.findUserById(user.id);
  },

  updateUserAddresses(userId, addresses) {
    const user = this.findUserById(userId) || this.findUserByMobile(userId);
    if (!user) throw new Error('Customer account not found.');
    const addressesJson = JSON.stringify(Array.isArray(addresses) ? addresses : []);
    db.run("UPDATE users SET addresses_json = ? WHERE id = ? OR mobile = ?", [addressesJson, user.id, user.mobile]);
    persistDatabase();
    return this.findUserById(user.id);
  },

  changeUserPassword(userId, oldPassword, newPassword) {
    const user = this.findUserById(userId);
    if (!user) throw new Error('User not found.');

    const isOldValid = user.passwordHash && verifyPassword(oldPassword, user.passwordHash);
    if (!isOldValid) {
      throw new Error('Current password does not match.');
    }

    if (!newPassword || newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters long.');
    }

    const newHash = hashPassword(newPassword);
    db.run("UPDATE users SET password_hash = ? WHERE id = ?", [newHash, userId]);
    this.logAudit('customer', user.name, 'CHANGE_PASSWORD', `User ${userId} updated account password.`);
    persistDatabase();
    return true;
  },

  verifyCustomerEmail(userId) {
    db.run("UPDATE users SET email_verified = 1 WHERE id = ?", [userId]);
    persistDatabase();
    return true;
  },

  // Product Image Library Management
  saveProductImage(img) {
    const id = img.id || `img-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    db.run(
      `INSERT INTO product_images (
        id, filename, url, data_base64, mime_type, size_bytes, title,
        assigned_product_id, assigned_category_id, is_primary, sort_order, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        img.filename,
        img.url,
        img.dataBase64 || null,
        img.mimeType || 'image/jpeg',
        img.sizeBytes || 0,
        img.title || img.filename,
        img.assignedProductId || null,
        img.assignedCategoryId || null,
        img.isPrimary ? 1 : 0,
        img.sortOrder || 0,
        img.createdAt || new Date().toISOString()
      ]
    );
    persistDatabase();
    return this.getProductImageById(id);
  },

  getAllProductImages() {
    const res = db.exec("SELECT * FROM product_images ORDER BY created_at DESC");
    if (!res[0]) return [];
    const cols = res[0].columns;
    return res[0].values.map((v) => mapProductImageRow(cols, v));
  },

  getProductImageById(id) {
    const res = db.exec("SELECT * FROM product_images WHERE id = ?", [id]);
    if (!res[0] || !res[0].values[0]) return null;
    return mapProductImageRow(res[0].columns, res[0].values[0]);
  },

  deleteProductImage(id) {
    db.run("DELETE FROM product_images WHERE id = ?", [id]);
    persistDatabase();
    return true;
  },

  assignProductImage(id, { productId, categoryId, isPrimary }) {
    if (isPrimary && productId) {
      db.run("UPDATE product_images SET is_primary = 0 WHERE assigned_product_id = ?", [productId]);
    }
    db.run(
      `UPDATE product_images SET
         assigned_product_id = COALESCE(?, assigned_product_id),
         assigned_category_id = COALESCE(?, assigned_category_id),
         is_primary = CASE WHEN ? IS NOT NULL THEN ? ELSE is_primary END
       WHERE id = ?`,
      [productId || null, categoryId || null, isPrimary !== undefined ? (isPrimary ? 1 : 0) : null, isPrimary ? 1 : 0, id]
    );
    persistDatabase();
    return this.getProductImageById(id);
  },
};

// Helper row mappers
function mapUserRow(cols, row) {
  return {
    id: row[cols.indexOf('id')],
    mobile: row[cols.indexOf('mobile')],
    name: row[cols.indexOf('name')],
    email: row[cols.indexOf('email')],
    passwordHash: row[cols.indexOf('password_hash')],
    role: row[cols.indexOf('role')],
    customerCode: row[cols.indexOf('customer_code')],
    referralCode: row[cols.indexOf('referral_code')],
    referredBy: row[cols.indexOf('referred_by')],
    addresses: JSON.parse(row[cols.indexOf('addresses_json')] || '[]'),
    createdAt: row[cols.indexOf('created_at')],
    status: row[cols.indexOf('status')],
    profilePhoto: cols.indexOf('profile_photo') !== -1 ? row[cols.indexOf('profile_photo')] : null,
    emailVerified: cols.indexOf('email_verified') !== -1 ? Boolean(row[cols.indexOf('email_verified')]) : false,
  };
}

function mapProductImageRow(cols, row) {
  return {
    id: row[cols.indexOf('id')],
    filename: row[cols.indexOf('filename')],
    url: row[cols.indexOf('url')],
    dataBase64: cols.indexOf('data_base64') !== -1 ? row[cols.indexOf('data_base64')] : null,
    mimeType: row[cols.indexOf('mime_type')],
    sizeBytes: row[cols.indexOf('size_bytes')],
    title: row[cols.indexOf('title')],
    assignedProductId: row[cols.indexOf('assigned_product_id')],
    assignedCategoryId: row[cols.indexOf('assigned_category_id')],
    isPrimary: row[cols.indexOf('is_primary')] === 1,
    sortOrder: row[cols.indexOf('sort_order')],
    createdAt: row[cols.indexOf('created_at')],
  };
}

function mapProductRow(cols, row) {
  return {
    id: row[cols.indexOf('id')],
    name: row[cols.indexOf('name')],
    tamilName: row[cols.indexOf('tamil_name')],
    category: row[cols.indexOf('category')],
    description: row[cols.indexOf('description')],
    benefits: JSON.parse(row[cols.indexOf('benefits_json')] || '[]'),
    ingredients: JSON.parse(row[cols.indexOf('ingredients_json')] || '[]'),
    netWeight: row[cols.indexOf('net_weight')],
    sku: row[cols.indexOf('sku')],
    barcode: row[cols.indexOf('barcode')],
    origin: row[cols.indexOf('origin')],
    images: JSON.parse(row[cols.indexOf('images_json')] || '[]'),
    rating: row[cols.indexOf('rating')],
    reviewsCount: row[cols.indexOf('reviews_count')],
    status: row[cols.indexOf('status')],
    isBestSeller: row[cols.indexOf('is_bestseller')] === 1,
    isTodayOffer: row[cols.indexOf('is_today_offer')] === 1,
    isPremium: row[cols.indexOf('is_premium')] === 1,
    b5RewardPercentage: row[cols.indexOf('b5_reward_percent')],
    b5CoinRedemptionPercentage: cols.indexOf('b5_coin_redemption_percentage') !== -1 && row[cols.indexOf('b5_coin_redemption_percentage')] != null ? row[cols.indexOf('b5_coin_redemption_percentage')] : 20.0,
    partnerShopId: row[cols.indexOf('partner_shop_id')],
    variants: JSON.parse(row[cols.indexOf('variants_json')] || '[]'),
    createdAt: row[cols.indexOf('created_at')],
  };
}

function mapPartnerRow(cols, row) {
  return {
    id: row[cols.indexOf('id')],
    ownerName: row[cols.indexOf('owner_name')],
    shopName: row[cols.indexOf('shop_name')],
    mobile: row[cols.indexOf('mobile')],
    email: row[cols.indexOf('email')],
    partnerCode: row[cols.indexOf('partner_code')],
    district: row[cols.indexOf('district')],
    city: cols.indexOf('city') !== -1 && row[cols.indexOf('city')] ? row[cols.indexOf('city')] : row[cols.indexOf('district')],
    pinCode: row[cols.indexOf('pin_code')],
    address: row[cols.indexOf('address')],
    status: row[cols.indexOf('status')],
    merchantUpiId: cols.indexOf('merchant_upi_id') !== -1 && row[cols.indexOf('merchant_upi_id')] ? row[cols.indexOf('merchant_upi_id')] : 'magizhcafee-3@okhdfcbank',
    storeCategory: cols.indexOf('store_category') !== -1 && row[cols.indexOf('store_category')] ? row[cols.indexOf('store_category')] : 'Organic Groceries',
    storeImages: cols.indexOf('store_images_json') !== -1 && row[cols.indexOf('store_images_json')] ? JSON.parse(row[cols.indexOf('store_images_json')] || '[]') : [],
    gstNumber: cols.indexOf('gst_number') !== -1 ? row[cols.indexOf('gst_number')] : null,
    documents: cols.indexOf('documents_json') !== -1 ? JSON.parse(row[cols.indexOf('documents_json')] || '[]') : [],
    passwordHash: cols.indexOf('password_hash') !== -1 ? row[cols.indexOf('password_hash')] : null,
    applicationStatus: cols.indexOf('application_status') !== -1 && row[cols.indexOf('application_status')] ? row[cols.indexOf('application_status')] : row[cols.indexOf('status')],
    rejectionReason: cols.indexOf('rejection_reason') !== -1 ? row[cols.indexOf('rejection_reason')] : null,
    commissionRate: row[cols.indexOf('commission_rate')],
    specialCoinBonusMultiplier: row[cols.indexOf('special_coin_bonus_multiplier')],
    partnerRedemptionCapPercentage: row[cols.indexOf('partner_redemption_cap_percentage')],
    partnerOfferStartDate: row[cols.indexOf('partner_offer_start_date')],
    partnerOfferEndDate: row[cols.indexOf('partner_offer_end_date')],
    partnerEligibilityRules: row[cols.indexOf('partner_eligibility_rules')],
    totalSales: row[cols.indexOf('total_sales')],
    totalOrders: row[cols.indexOf('total_orders')],
    totalCommissionPaid: row[cols.indexOf('total_commission_paid')],
    unsettledAmount: row[cols.indexOf('unsettled_amount')],
    createdAt: row[cols.indexOf('created_at')],
  };
}

function mapBillRow(cols, row) {
  return {
    id: row[cols.indexOf('id')],
    billNumber: row[cols.indexOf('bill_number')],
    partnerId: row[cols.indexOf('partner_id')],
    partnerName: row[cols.indexOf('partner_name')],
    merchantUpiId: row[cols.indexOf('merchant_upi_id')],
    customerId: row[cols.indexOf('customer_id')],
    customerName: row[cols.indexOf('customer_name')],
    customerPhone: row[cols.indexOf('customer_phone')],
    originalBillAmount: row[cols.indexOf('original_bill_amount')],
    billAmount: row[cols.indexOf('original_bill_amount')],
    coinsToRedeem: row[cols.indexOf('coins_to_redeem')],
    discountAmount: row[cols.indexOf('discount_amount')],
    payableAmount: row[cols.indexOf('payable_amount')],
    itemsSummary: row[cols.indexOf('items_summary')],
    paymentMethod: row[cols.indexOf('payment_method')],
    status: row[cols.indexOf('status')],
    rejectionReason: row[cols.indexOf('admin_notes')],
    customerApprovedAt: row[cols.indexOf('customer_approved_at')],
    customerConfirmedAt: cols.indexOf('customer_confirmed_at') !== -1 ? row[cols.indexOf('customer_confirmed_at')] : row[cols.indexOf('customer_approved_at')],
    utrNumber: cols.indexOf('utr_number') !== -1 ? row[cols.indexOf('utr_number')] : null,
    partnerRewardCoins: cols.indexOf('partner_reward_coins') !== -1 ? Number(row[cols.indexOf('partner_reward_coins')] || 0) : 0,
    partnerReceivedAt: row[cols.indexOf('partner_received_at')],
    adminDecisionAt: row[cols.indexOf('admin_decision_at')],
    adminDecisionBy: row[cols.indexOf('admin_decision_by')],
    adminNotes: row[cols.indexOf('admin_notes')],
    receiptNumber: row[cols.indexOf('receipt_number')],
    createdAt: row[cols.indexOf('created_at')],
  };
}

function mapCoinNotificationRow(cols, row) {
  return {
    id: row[cols.indexOf('id')],
    customerId: row[cols.indexOf('customer_id')],
    type: row[cols.indexOf('type')],
    coins: row[cols.indexOf('coins')],
    previousBalance: row[cols.indexOf('previous_balance')],
    newBalance: row[cols.indexOf('new_balance')],
    title: row[cols.indexOf('title')],
    message: row[cols.indexOf('message')],
    isViewed: row[cols.indexOf('is_viewed')] === 1,
    createdAt: row[cols.indexOf('created_at')],
    viewedAt: row[cols.indexOf('viewed_at')],
  };
}

function mapOrderRow(cols, row) {
  const utrIdx = cols.indexOf('payment_utr');
  const upiRefIdx = cols.indexOf('upi_transaction_ref');
  const prodCoinsIdx = cols.indexOf('product_coin_redemptions_json');
  return {
    id: row[cols.indexOf('id')],
    orderNumber: row[cols.indexOf('order_number')],
    customerId: row[cols.indexOf('customer_id')],
    customerName: row[cols.indexOf('customer_name')],
    customerPhone: row[cols.indexOf('customer_phone')],
    shippingAddress: JSON.parse(row[cols.indexOf('shipping_address_json')] || '{}'),
    merchandiseSubtotal: row[cols.indexOf('merchandise_subtotal')],
    couponCode: row[cols.indexOf('coupon_code')],
    couponDiscount: row[cols.indexOf('coupon_discount')],
    eligibleMerchandiseAmount: row[cols.indexOf('eligible_merchandise_amount')],
    coinsRedeemed: row[cols.indexOf('coins_redeemed')],
    coinDiscountAmount: row[cols.indexOf('coin_discount_amount')],
    deliveryCharge: row[cols.indexOf('delivery_charge')],
    taxAmount: row[cols.indexOf('tax_amount')],
    finalPayableAmount: row[cols.indexOf('final_payable_amount')],
    paymentMethod: row[cols.indexOf('payment_method')],
    paymentStatus: row[cols.indexOf('payment_status')],
    orderStatus: row[cols.indexOf('order_status')],
    rewardCoinsEarned: row[cols.indexOf('reward_coins_earned')],
    rewardCoinsCredited: row[cols.indexOf('reward_coins_credited')] === 1,
    partnerId: row[cols.indexOf('partner_id')],
    items: JSON.parse(row[cols.indexOf('items_json')] || '[]'),
    timeline: JSON.parse(row[cols.indexOf('timeline_json')] || '[]'),
    paymentUtr: utrIdx >= 0 && row[utrIdx] ? row[utrIdx] : undefined,
    upiTransactionRef: upiRefIdx >= 0 && row[upiRefIdx] ? row[upiRefIdx] : undefined,
    productCoinRedemptions: prodCoinsIdx >= 0 && row[prodCoinsIdx] ? JSON.parse(row[prodCoinsIdx] || '[]') : undefined,
    createdAt: row[cols.indexOf('created_at')],
    updatedAt: row[cols.indexOf('updated_at')],
  };
}
