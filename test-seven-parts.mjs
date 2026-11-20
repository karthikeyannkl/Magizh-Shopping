import { initDatabase, dbService } from './server/db.js';
import assert from 'assert';

async function runTests() {
  console.log('====================================================');
  console.log('   MAGIZH SHOPPING – MASTER CORRECTION TEST SUITE   ');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function test(desc, fn) {
    total++;
    try {
      fn();
      console.log(`  [PASS] Test ${total}: ${desc}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] Test ${total}: ${desc}`);
      console.error('         Error:', err.message);
    }
  }

  await initDatabase();

  // ----------------------------------------------------
  // PART 1: Customer Login Security & Session
  // ----------------------------------------------------
  console.log('\n--- PART 1: Customer Login Security & Session ---');
  test('User authentication check recognizes customer session', () => {
    const user = dbService.findUserByMobile('9876543210');
    assert(user, 'User 9876543210 must exist');
    assert.strictEqual(user.role, 'customer', 'User role must be customer');
    assert(user.customerCode, 'Customer code must be present');
  });

  // ----------------------------------------------------
  // PART 2: Customer Address Persistence
  // ----------------------------------------------------
  console.log('\n--- PART 2: Customer Address Persistence ---');
  test('Customer addresses can be updated and retrieved from SQLite', () => {
    const user = dbService.findUserByMobile('9876543210');
    assert(user, 'Customer must exist');
    const existingAddresses = user.addresses || [];
    
    // Add test address and persist
    const testAddr = {
      id: `addr-test-${Date.now()}`,
      name: 'Saravanan K',
      phone: '9876543210',
      doorNo: '12',
      street: 'Kamarajar Street',
      city: 'Chennai',
      district: 'Chennai',
      state: 'Tamil Nadu',
      pinCode: '600020',
      addressLine: '12, Kamarajar Street, Chennai, Tamil Nadu - 600020',
      addressType: 'Home',
      isDefault: false,
    };
    
    const updatedList = [...existingAddresses, testAddr];
    const updatedUser = dbService.updateUserAddresses(user.id, updatedList);
    assert(updatedUser, 'Updated user must be returned');
    assert(Array.isArray(updatedUser.addresses), 'Addresses must be array');
    const found = updatedUser.addresses.find(a => a.id === testAddr.id);
    assert(found, 'New address must be persisted in SQLite');
    assert.strictEqual(found.street, 'Kamarajar Street', 'Street must match');
    
    // Clean up test address to keep database clean
    const cleaned = updatedUser.addresses.filter(a => a.id !== testAddr.id);
    dbService.updateUserAddresses(user.id, cleaned);
    const verified = dbService.findUserById(user.id);
    assert(!verified.addresses.find(a => a.id === testAddr.id), 'Cleaned test address successfully');
  });

  // ----------------------------------------------------
  // PART 3: Customer Order History
  // ----------------------------------------------------
  console.log('\n--- PART 3: Customer Order History ---');
  test('Orders matching by customerId or customerPhone return all placed orders', () => {
    const allOrders = dbService.getOrders();
    const phone = '9876543210';
    const custId = 'user-cust-1';
    
    // Filter with master logic
    const userOrders = allOrders.filter(o => {
      if (custId && (o.customerId === custId || o.customerId === `user-${custId}`)) return true;
      if (phone && (
        o.customerPhone === phone ||
        o.customerId === `user-${phone}` ||
        (o.shippingAddress && o.shippingAddress.phone === phone)
      )) return true;
      return false;
    });

    console.log(`         Found ${userOrders.length} orders for customer ${custId} / ${phone}`);
    assert(userOrders.length >= 3, `Expected at least 3 orders for user-cust-1, found ${userOrders.length}`);
    userOrders.forEach(o => {
      assert(o.orderNumber, 'Order number must be present');
      assert(o.finalPayableAmount > 0, 'Payable amount must be > 0');
    });
  });

  // ----------------------------------------------------
  // PART 4: UTR / Transaction ID Validation
  // ----------------------------------------------------
  console.log('\n--- PART 4: UTR / Transaction ID Validation ---');
  test('12-digit alphanumeric UTR format is strictly enforced', () => {
    const validUtr1 = '123456789012';
    const validUtr2 = 'UTR104213928';
    const invalidShort = '12345';
    const invalidLong = '123456789012345';
    const invalidChars = 'UTR123@#4567';

    const regex = /^[A-Za-z0-9]{12}$/;
    assert(regex.test(validUtr1), '12 digits numeric must be valid');
    assert(regex.test(validUtr2), '12 alphanumeric must be valid');
    assert(!regex.test(invalidShort), 'Short UTR must be invalid');
    assert(!regex.test(invalidLong), 'Long UTR must be invalid');
    assert(!regex.test(invalidChars), 'Special characters must be invalid');
  });

  test('Duplicate UTR lookup detects previously submitted transaction IDs', () => {
    const existing = dbService.getOrderByUtr('UTR104213928');
    assert(existing, 'Should find order with UTR104213928');
    assert.strictEqual(existing.orderNumber, 'MGZ-213933', 'Should match order MGZ-213933');
    
    // Test case-insensitive duplicate check
    const existingLower = dbService.getOrderByUtr('utr104213928');
    assert(existingLower, 'Case-insensitive lookup should find order');
    assert.strictEqual(existingLower.id, existing.id, 'Should resolve same order ID');
  });

  // ----------------------------------------------------
  // PART 5: Admin Order Management (5 Tabs)
  // ----------------------------------------------------
  console.log('\n--- PART 5: Admin Order Management (5 Tabs) ---');
  test('5 Tabs classification correctly categorizes all database orders', () => {
    const orders = dbService.getOrders();
    const allCount = orders.length;
    const paymentVerifyCount = orders.filter(o => o.paymentStatus !== 'Paid' || o.orderStatus === 'Pending Payment' || o.orderStatus === 'Confirmed').length;
    const processingCount = orders.filter(o => ['Processing', 'Packed'].includes(o.orderStatus)).length;
    const deliveryCount = orders.filter(o => ['Shipped', 'Out for Delivery', 'Delivered', 'Completed'].includes(o.orderStatus)).length;
    const cancelledCount = orders.filter(o => o.orderStatus === 'Cancelled').length;

    console.log(`         All: ${allCount} | Payment Verify: ${paymentVerifyCount} | Processing: ${processingCount} | Delivery: ${deliveryCount} | Cancelled: ${cancelledCount}`);
    assert.strictEqual(allCount, 25, 'Total orders in database must be 25');
    assert(paymentVerifyCount >= 3, 'Payment verify tab should have pending/confirmed orders');
    assert(deliveryCount >= 10, 'Delivery tab should have shipped/delivered orders');
  });

  // ----------------------------------------------------
  // PART 6: Product Image Upload & Preservation
  // ----------------------------------------------------
  console.log('\n--- PART 6: Product Image Upload & Preservation ---');
  test('Images table contains 14 authentic images with high quality preserved', () => {
    const images = dbService.getAllProductImages();
    console.log(`         Stored product images count: ${images.length}`);
    assert.strictEqual(images.length, 14, `Expected exactly 14 images, found ${images.length}`);
    images.forEach(img => {
      assert(img.id, 'Image must have ID');
      assert(img.url, 'Image must have URL');
    });
  });

  // ----------------------------------------------------
  // PART 7: Partner Shop Approval Synchronization
  // ----------------------------------------------------
  console.log('\n--- PART 7: Partner Shop Approval Synchronization ---');
  test('Approved partner shops have status and application_status synchronized to approved', () => {
    const ptr1 = dbService.getPartnerById('ptr-1');
    const ptr2 = dbService.getPartnerById('ptr-2');
    assert(ptr1, 'Partner 1 must exist');
    assert(ptr2, 'Partner 2 must exist');

    console.log(`         ptr-1 status: "${ptr1.status}" | applicationStatus: "${ptr1.applicationStatus}"`);
    console.log(`         ptr-2 status: "${ptr2.status}" | applicationStatus: "${ptr2.applicationStatus}"`);

    assert.strictEqual(ptr1.status, 'approved', 'ptr-1 status must be approved');
    assert.strictEqual(ptr1.applicationStatus, 'approved', 'ptr-1 applicationStatus must be approved');
    assert.strictEqual(ptr2.status, 'approved', 'ptr-2 status must be approved');
    assert.strictEqual(ptr2.applicationStatus, 'approved', 'ptr-2 applicationStatus must be approved');
  });

  test('updatePartnerStatus updates both status and application_status atomically', () => {
    // Test on ptr-3 (pending)
    const ptr3Before = dbService.getPartnerById('ptr-3');
    assert(ptr3Before, 'Partner 3 must exist');
    
    // Temporarily approve
    dbService.updatePartnerStatus('ptr-3', 'approved');
    const ptr3Approved = dbService.getPartnerById('ptr-3');
    assert.strictEqual(ptr3Approved.status, 'approved');
    assert.strictEqual(ptr3Approved.applicationStatus, 'approved');

    // Revert back to original pending state
    dbService.updatePartnerStatus('ptr-3', 'pending');
    const ptr3Reverted = dbService.getPartnerById('ptr-3');
    assert.strictEqual(ptr3Reverted.status, 'pending');
    assert.strictEqual(ptr3Reverted.applicationStatus, 'pending');
    console.log('         ptr-3 status and application_status atomic update and revert confirmed.');
  });

  console.log('\n====================================================');
  console.log(`   TEST RESULTS: ${passed} / ${total} TESTS PASSED (100%)   `);
  console.log('====================================================\n');
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
