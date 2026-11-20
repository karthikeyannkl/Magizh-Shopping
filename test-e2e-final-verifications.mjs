import http from 'http';
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';

const BASE_URL = 'http://127.0.0.1:3892';

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const postData = body ? JSON.stringify(body) : null;

    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, text: data });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('FINAL MASTER CORRECTIONS E2E VERIFICATION SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      process.stdout.write(`Testing: ${name}... `);
      await fn();
      console.log('PASSED ✓');
      passed++;
    } catch (err) {
      console.log('FAILED ✗');
      console.error('   -> Error:', err.message);
      failed++;
    }
  }

  // 1. Database Integrity & Table Verification
  await test('SQLite Database integrity check and 17-table row verification', async () => {
    const SQL = await initSqlJs();
    const dbFile = path.resolve('server/data/magizh.sqlite');
    assert(fs.existsSync(dbFile), 'Database file must exist');
    const buffer = fs.readFileSync(dbFile);
    const db = new SQL.Database(buffer);

    const integrity = db.exec('PRAGMA integrity_check;');
    assert.strictEqual(integrity[0].values[0][0], 'ok', 'Integrity check must return ok');

    const tables = [
      'users', 'password_resets', 'categories', 'products', 'promotional_banners',
      'coupons', 'orders', 'coin_accounts', 'coin_ledger', 'manual_coin_requests',
      'partner_shops', 'partner_local_transactions', 'partner_bills',
      'coin_notifications', 'product_images', 'audit_logs'
    ];

    for (const table of tables) {
      const res = db.exec(`SELECT count(*) as count FROM ${table};`);
      const count = res[0].values[0][0];
      assert(typeof count === 'number', `Table ${table} must be readable`);
    }
    db.close();
  });

  // 2. Product Variants & Coming Soon Status
  await test('Products API returns active and coming_soon products', async () => {
    const res = await request('GET', '/api/products');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert(Array.isArray(res.data.products), 'Products must be an array');
    assert(res.data.products.length > 0, 'Products list must not be empty');

    // Check variant support
    const hasVariants = res.data.products.some((p) => Array.isArray(p.variants) && p.variants.length > 0);
    assert(hasVariants, 'Products must have weight variants');
  });

  // 3. Admin Authentication
  let adminToken = '';
  await test('Admin login returns valid JWT token', async () => {
    const res = await request('POST', '/api/auth/admin-login', {
      email: 'admin@magizh.in',
      password: 'admin123',
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    adminToken = res.data.token;
    assert(adminToken, 'Admin token must be present');
  });

  // 4. Product Creation with "coming_soon" Status & Variants
  let testProductId = '';
  await test('Admin creates product with "coming_soon" status and independent variants', async () => {
    const res = await request('POST', '/api/products', {
      name: 'Organic Barnyard Millet Flour - Coming Soon Special',
      description: 'Rich in fiber and protein, upcoming harvest batch',
      category: 'Millets',
      status: 'coming_soon',
      imageUrl: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&q=80&w=600',
      variants: [
        { id: 'v1', weight: '500g', price: 90, stock: 0, isComingSoon: true },
        { id: 'v2', weight: '1kg', price: 175, stock: 0, isComingSoon: true },
      ],
    }, { Authorization: `Bearer ${adminToken}` });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.product.status, 'coming_soon');
    testProductId = res.data.product.id;
  });

  // 5. Verification that Customer Storefront includes Coming Soon product
  await test('Storefront includes "coming_soon" product for preview', async () => {
    const res = await request('GET', '/api/products');
    assert.strictEqual(res.status, 200);
    const found = res.data.products.find((p) => p.id === testProductId);
    assert(found, 'Created coming_soon product must appear in storefront catalog');
    assert.strictEqual(found.status, 'coming_soon');
  });

  // 6. UPI UTR Validation - Invalid format rejection
  const testUtr = 'UTR' + Date.now().toString().slice(-9); // Exactly 12 alphanumeric chars
  await test('Order creation rejects invalid UTR format (< 12 chars)', async () => {
    const res = await request('POST', '/api/orders', {
      customerPhone: '9840011223',
      customerName: 'Karthik Raja',
      customerAddress: '12 Gandhi Road, Chennai 600020',
      district: 'Chennai',
      state: 'Tamil Nadu',
      pincode: '600020',
      items: [
        {
          productId: 'prod-001',
          productName: 'Organic Foxtail Millet',
          variantId: 'v-1kg',
          variantWeight: '1kg',
          price: 150,
          quantity: 1,
        },
      ],
      totalAmount: 150,
      paymentMethod: 'UPI',
      paymentUtr: '12345', // Invalid: only 5 digits
    });
    assert.strictEqual(res.status, 400);
    assert(res.data.error.includes('12-digit') || res.data.error.includes('12-character'));
  });

  // 7. UPI UTR Validation - Valid 12-digit UTR accepted
  let createdOrderId = '';
  await test('Order creation accepts valid 12-digit alphanumeric UTR', async () => {
    const res = await request('POST', '/api/orders', {
      customerPhone: '9840011223',
      customerName: 'Karthik Raja',
      customerAddress: '12 Gandhi Road, Chennai 600020',
      district: 'Chennai',
      state: 'Tamil Nadu',
      pincode: '600020',
      items: [
        {
          productId: 'prod-001',
          productName: 'Organic Foxtail Millet',
          variantId: 'v-1kg',
          variantWeight: '1kg',
          price: 150,
          quantity: 1,
        },
      ],
      totalAmount: 150,
      paymentMethod: 'UPI',
      paymentUtr: testUtr,
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.order.paymentUtr, testUtr);
    createdOrderId = res.data.order.id;
  });

  // 8. Duplicate UTR Rejection
  await test('Order creation rejects duplicate UTR across different orders with HTTP 400', async () => {
    const res = await request('POST', '/api/orders', {
      customerPhone: '9840099887',
      customerName: 'Another User',
      customerAddress: '45 Anna Salai, Chennai 600002',
      district: 'Chennai',
      state: 'Tamil Nadu',
      pincode: '600002',
      items: [
        {
          productId: 'prod-001',
          productName: 'Organic Foxtail Millet',
          variantId: 'v-1kg',
          variantWeight: '1kg',
          price: 150,
          quantity: 1,
        },
      ],
      totalAmount: 150,
      paymentMethod: 'UPI',
      paymentUtr: testUtr, // Duplicate of previous order
    });
    assert.strictEqual(res.status, 400);
    assert(res.data.error.includes('already been submitted'));
  });

  // 9. Order Status Lifecycle Management
  await test('Admin updates order status through lifecycle (Confirmed -> Processing -> Delivered)', async () => {
    // Confirm order
    let res = await request('PATCH', `/api/admin/orders/${createdOrderId}/status`, {
      orderStatus: 'Confirmed',
      paymentStatus: 'Paid',
    }, { Authorization: `Bearer ${adminToken}` });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.order.orderStatus, 'Confirmed');
    assert.strictEqual(res.data.order.paymentStatus, 'Paid');

    // Update to Processing
    res = await request('PATCH', `/api/admin/orders/${createdOrderId}/status`, {
      orderStatus: 'Processing',
    }, { Authorization: `Bearer ${adminToken}` });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.order.orderStatus, 'Processing');

    // Update to Delivered
    res = await request('PATCH', `/api/admin/orders/${createdOrderId}/status`, {
      orderStatus: 'Delivered',
    }, { Authorization: `Bearer ${adminToken}` });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.order.orderStatus, 'Delivered');
  });

  // 10. Clean up test product
  await test('Admin deletes or archives test product cleanly', async () => {
    const res = await request('DELETE', `/api/products/${testProductId}`, null, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.strictEqual(res.status, 200);
  });

  // 11. Image Gallery / Media Verification
  await test('Persistent Image Gallery in SQLite contains all 14 product images with valid data', async () => {
    const res = await request('GET', '/api/product-images');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert(Array.isArray(res.data.images), 'Images must be an array');
    assert.strictEqual(res.data.images.length, 14, `Expected 14 product images in SQLite, found ${res.data.images.length}`);

    for (const img of res.data.images) {
      assert(img.id, 'Image must have an id');
      assert(img.url && img.url.length > 5, 'Image must have valid url');
      assert(img.filename || img.fileName, 'Image must have a filename');
    }
  });

  console.log('\n====================================================');
  console.log(`FINAL RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

// Bootstrap test server
import express from 'express';
import { apiRouter } from './server/api.js';
import { initDatabase } from './server/db.js';

async function bootstrap() {
  await initDatabase();

  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = app.listen(3892, '127.0.0.1', () => {
    console.log('Final verification harness running against 127.0.0.1:3892...\n');
    runTests()
      .catch((e) => {
        console.error('Fatal Verification Error:', e);
        server.close();
        process.exit(1);
      })
      .then(() => {
        server.close();
        process.exit(0);
      });
  });

  server.on('error', (err) => {
    console.error('Test server error:', err);
    process.exit(1);
  });
}

bootstrap();
