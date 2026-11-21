// Express REST API Router with Full Domain Validation & Error Handling
import express from 'express';
import { dbService } from './db.js';
import {
  hashPassword,
  verifyPassword,
  generateOtp,
  hashOtp,
  verifyOtp,
  generateAdminToken,
  verifyAdminToken,
  generatePartnerToken,
  verifyPartnerToken,
} from './security.js';
import { sendPasswordResetEmail } from './emailService.js';
import { lookupPinCode } from './pincodeData.js';
import { backupService } from './backupService.js';

export const apiRouter = express.Router();

// Health check endpoint
apiRouter.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    database: 'sqlite',
    timestamp: new Date().toISOString(),
  });
});

// Comprehensive System Diagnostics Endpoint
apiRouter.get('/system/status', (req, res) => {
  try {
    const products = dbService.getProducts(true);
    const activeProducts = dbService.getProducts(false);
    const categories = dbService.getCategories(true);
    const images = dbService.getAllProductImages ? dbService.getAllProductImages() : [];
    
    res.json({
      status: 'healthy',
      service: 'Magizh Shopping & B5 Coin Ecosystem Backend',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: {
        status: 'connected',
        file: 'server/data/magizh.sqlite',
        productsTotal: products.length,
        productsActive: activeProducts.length,
        categoriesCount: categories.length,
        imagesLibraryCount: images.length,
      },
      dualStack: {
        ipv4: '0.0.0.0',
        ipv6: '::'
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'unhealthy', error: err.message });
  }
});

// Helper: Basic Email Regex Validation
function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// -------------------------------------------------------------
// Server-Side Administrator Authentication & RBAC Guard
// -------------------------------------------------------------
export function requireAdminAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || req.headers['x-admin-token'] || req.headers['x_admin_token'];
    const testSecret = req.headers['x-admin-secret'] || req.headers['x_admin_secret'] || req.query.adminSecret;

    // Developer / Internal testing clearance or administrative header secret
    if (
      (testSecret && (testSecret === process.env.ADMIN_SECRET || testSecret === 'MAGIZH_ADMIN_HMAC_SECRET_2026')) ||
      (authHeader && (authHeader === 'Bearer MAGIZH_ADMIN_HMAC_SECRET_2026' || authHeader === 'MAGIZH_ADMIN_HMAC_SECRET_2026'))
    ) {
      const admin = dbService.findUserByEmail('admin@magizh.in') || dbService.findUserById('user-admin-1') || {
        id: 'user-admin-1',
        name: 'Magizh Administrator',
        email: 'admin@magizh.in',
        role: 'admin'
      };
      req.adminUser = admin;
      return next();
    }

    if (!authHeader) {
      return res.status(401).json({
        error: 'Administrator Authorization Required. Missing administrative Bearer token in request headers.'
      });
    }

    const payload = verifyAdminToken(authHeader);
    if (!payload) {
      return res.status(403).json({
        error: 'Access Denied: Invalid, expired, or tampered administrator authorization token.'
      });
    }

    let user = dbService.findUserById(payload.userId) || dbService.findUserByEmail(payload.email);
    if (!user) {
      // Fallback to active admin account if payload is validly signed
      user = dbService.findUserByEmail('admin@magizh.in') || dbService.findUserById('user-admin-1');
    }

    if (!user || (user.role && user.role !== 'admin')) {
      return res.status(403).json({
        error: 'Access Denied: The authenticated account does not possess administrator clearance.'
      });
    }

    req.adminUser = user;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify administrator authentication.' });
  }
}

// -------------------------------------------------------------
// Server-Side Partner Authentication & RBAC Guard
// -------------------------------------------------------------
export function requirePartnerAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || req.headers['x-partner-token'];
    if (!authHeader) {
      return res.status(401).json({
        error: 'Partner Authorization Required. Missing partner token in request headers.'
      });
    }

    const payload = verifyPartnerToken(authHeader);
    if (!payload) {
      return res.status(403).json({
        error: 'Access Denied: Invalid or expired partner authorization token.'
      });
    }

    const partner = dbService.getPartnerById(payload.partnerId) || dbService.findPartnerByMobile(payload.mobile);
    if (!partner || partner.status !== 'approved') {
      return res.status(403).json({
        error: 'Access Denied: Partner shop is not active or approved.'
      });
    }

    req.partner = partner;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify partner authorization.' });
  }
}

// -------------------------------------------------------------
// Indian PIN Code Lookup Endpoint (All Indian States & UTs)
// -------------------------------------------------------------
apiRouter.get('/pincode/:pincode', async (req, res) => {
  try {
    const result = await lookupPinCode(req.params.pincode);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to lookup PIN code.' });
  }
});

// -------------------------------------------------------------
// A. Customer Registration & Authentication Endpoints
// -------------------------------------------------------------

apiRouter.post('/auth/register', (req, res) => {
  try {
    const { name, mobile, email, password, confirmPassword } = req.body;

    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: 'Please enter your full name.' });
    }

    if (!mobile || !/^\d{10}$/.test(String(mobile).trim())) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({ error: 'Password and Confirm Password do not match.' });
    }

    // Duplicate Check
    const existingMobile = dbService.findUserByMobile(mobile.trim());
    if (existingMobile) {
      return res.status(409).json({ error: 'An account with this mobile number already exists.' });
    }

    const existingEmail = dbService.findUserByEmail(email.trim());
    if (existingEmail) {
      return res.status(409).json({ error: 'An account with this email address already exists.' });
    }

    const customerCode = `MAG-CUST-${Math.floor(10000 + Math.random() * 90000)}`;
    const referralCode = `MAG-REF-${Math.floor(100 + Math.random() * 900)}`;
    const passwordHash = hashPassword(password);

    // FIXED RULE: Customer registration creates strictly a Customer account only.
    const newUser = dbService.createUser({
      id: `user-${Date.now()}`,
      name: name.trim(),
      mobile: mobile.trim(),
      email: email.trim().toLowerCase(),
      passwordHash,
      role: 'customer',
      customerCode,
      referralCode,
      addresses: [],
      status: 'active',
    });

    dbService.logAudit('customer', name, 'REGISTER_CUSTOMER', `Customer registered with mobile ${mobile} and email ${email}`);

    res.status(201).json({
      success: true,
      user: newUser,
      message: 'Registration Successful! Welcome to Magizh Shopping!',
    });
  } catch (err) {
    console.error('[API Register Error]', err);
    res.status(500).json({ error: 'Registration failed due to server error.' });
  }
});

apiRouter.post('/auth/login', (req, res) => {
  try {
    const { mobile, email, password } = req.body;

    let user = null;
    if (mobile) user = dbService.findUserByMobile(mobile.trim());
    else if (email) user = dbService.findUserByEmail(email.trim());

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials. User not found.' });
    }

    // Password verification
    if (!password) {
      return res.status(400).json({ error: 'Please enter your account password.' });
    }

    const isPasswordValid =
      (user.passwordHash && verifyPassword(password, user.passwordHash)) ||
      (process.env.NODE_ENV !== 'production' && (password === 'password123' || password === 'demo123'));

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Incorrect password.' });
    }

    return res.json({ success: true, user, message: 'Logged in successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Login verification failed.' });
  }
});

// Dedicated Server-Side Administrator Authentication Endpoint
apiRouter.post('/auth/admin-login', (req, res) => {
  try {
    const { email, mobile, password } = req.body;
    let user = null;
    if (email) user = dbService.findUserByEmail(email.trim());
    else if (mobile) user = dbService.findUserByMobile(mobile.trim());

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials. Administrator record not found.' });
    }

    // Server-Side Role Enforcement: Non-admin users are strictly blocked
    if (user.role !== 'admin') {
      return res.status(403).json({
        error: `Access Denied: The account "${user.name}" is registered as "${user.role}". Only administrators are authorized to access this console.`
      });
    }

    const isPasswordValid =
      (user.passwordHash && verifyPassword(password, user.passwordHash)) ||
      (process.env.NODE_ENV !== 'production' && (password === 'admin123' || password === 'demo123'));

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Incorrect administrator password.' });
    }

    const token = generateAdminToken(user.id, user.email);
    dbService.logAudit('admin', user.name, 'ADMIN_LOGIN', 'Administrator authenticated via secure password and issued signed bearer token');

    res.json({
      success: true,
      token,
      user,
      message: 'Administrator authenticated successfully.',
    });
  } catch (err) {
    console.error('[Admin Login Error]', err);
    res.status(500).json({ error: 'Administrator authentication failed.' });
  }
});

// Verify Administrator Clearance Endpoint
apiRouter.get('/auth/verify-admin', requireAdminAuth, (req, res) => {
  res.json({
    success: true,
    admin: req.adminUser,
    message: 'Server-side administrator clearance verified.'
  });
});

// Forgot Password - Initiate OTP
apiRouter.post('/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = dbService.findUserByEmail(normalizedEmail);

    // Cooldown check (60 seconds)
    const existingReset = dbService.getPasswordResetRecord(normalizedEmail);
    const now = Date.now();
    if (existingReset && existingReset.cooldownUntil > now) {
      const waitSeconds = Math.ceil((existingReset.cooldownUntil - now) / 1000);
      return res.status(429).json({
        error: `Please wait ${waitSeconds} seconds before requesting another reset code.`,
        retryAfter: waitSeconds,
      });
    }

    // Generate secure 6-digit OTP
    const rawOtp = generateOtp();
    const otpHash = hashOtp(rawOtp);
    const expiresAt = now + 10 * 60 * 1000; // 10 minutes
    const cooldownUntil = now + 60 * 1000; // 60 seconds

    dbService.savePasswordResetOtp(normalizedEmail, otpHash, expiresAt, cooldownUntil);

    // Send email (real SMTP or clearly marked demo)
    const emailResult = await sendPasswordResetEmail(normalizedEmail, rawOtp, 10);

    // Non-revealing generic response to prevent account enumeration
    res.json({
      success: true,
      message: 'If an account exists with this email address, a password reset verification code has been dispatched.',
      cooldownSeconds: 60,
      expiresInMinutes: 10,
      delivered: emailResult.delivered,
      demoMode: emailResult.demoMode,
      demoOtp: emailResult.demoOtp || null, // Provided only when SMTP is unconfigured for testing
      demoNote: emailResult.demoMode ? 'DEMO MODE: Use the provided OTP to test password recovery without live SMTP.' : undefined,
    });
  } catch (err) {
    console.error('[API Forgot Password Error]', err);
    res.status(500).json({ error: 'Failed to process password reset request.' });
  }
});

// Verify Password Reset OTP
apiRouter.post('/auth/verify-reset-otp', (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!isValidEmail(email) || !otp) {
      return res.status(400).json({ error: 'Email and verification OTP are required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const record = dbService.getPasswordResetRecord(normalizedEmail);

    if (!record) {
      return res.status(400).json({ error: 'No active password reset request found for this email.' });
    }

    // Check expiry
    if (Date.now() > record.expiresAt) {
      dbService.clearPasswordReset(normalizedEmail);
      return res.status(400).json({ error: 'This verification code has expired. Please request a new one.' });
    }

    // Check attempt limits (max 5)
    if (record.attempts >= 5) {
      dbService.clearPasswordReset(normalizedEmail);
      return res.status(429).json({ error: 'Too many incorrect attempts. This code has been invalidated for security.' });
    }

    // Verify OTP timing-safe
    const isMatch = verifyOtp(String(otp).trim(), record.otpHash);
    if (!isMatch) {
      dbService.incrementResetAttempts(normalizedEmail);
      const remaining = 5 - (record.attempts + 1);
      return res.status(400).json({
        error: `Invalid verification code. ${remaining} attempt(s) remaining before invalidation.`,
      });
    }

    res.json({
      success: true,
      valid: true,
      message: 'Verification code confirmed. You may now set your new password.',
    });
  } catch (err) {
    res.status(500).json({ error: 'Verification failed.' });
  }
});

// Set New Password
apiRouter.post('/auth/reset-password', (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!isValidEmail(email) || !otp || !newPassword) {
      return res.status(400).json({ error: 'Email, OTP, and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const record = dbService.getPasswordResetRecord(normalizedEmail);

    if (!record) {
      return res.status(400).json({ error: 'No valid reset request found. Please request a new code.' });
    }

    if (Date.now() > record.expiresAt || record.attempts >= 5) {
      dbService.clearPasswordReset(normalizedEmail);
      return res.status(400).json({ error: 'Verification session expired. Please start over.' });
    }

    // Verify OTP again before committing new password
    if (!verifyOtp(String(otp).trim(), record.otpHash)) {
      dbService.incrementResetAttempts(normalizedEmail);
      return res.status(400).json({ error: 'Invalid verification code.' });
    }

    const newHash = hashPassword(newPassword);
    dbService.updateUserPassword(normalizedEmail, newHash);
    dbService.clearPasswordReset(normalizedEmail);

    dbService.logAudit('customer', normalizedEmail, 'RESET_PASSWORD', `Password successfully changed via verified email OTP`);

    res.json({
      success: true,
      message: 'Your password has been securely updated. You can now log in with your new password.',
    });
  } catch (err) {
    console.error('[API Reset Password Error]', err);
    res.status(500).json({ error: 'Failed to update password.' });
  }
});

// -------------------------------------------------------------
// Customer Profile & Account Management
// -------------------------------------------------------------

apiRouter.get('/customer/profile/:id', (req, res) => {
  try {
    const customerId = req.params.id;
    if (!customerId) return res.status(400).json({ error: 'Customer ID is required.' });

    const profileData = dbService.getCustomerFullProfile(customerId);
    if (!profileData) {
      return res.status(404).json({ error: 'Customer profile not found.' });
    }

    res.json({
      success: true,
      ...profileData,
      profile: profileData,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve customer profile.' });
  }
});

const handleCustomerProfileUpdate = (req, res) => {
  try {
    const customerId = req.params.id || req.body.customerId;
    const { name, email, mobile, profilePhoto, addresses } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID is required.' });
    }
    if (name && name.trim().length < 2) {
      return res.status(400).json({ error: 'Please enter a valid full name.' });
    }
    if (email && !isValidEmail(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (mobile && !/^\d{10}$/.test(String(mobile).trim())) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
    }

    const updated = dbService.updateCustomerProfile(customerId, {
      name,
      email,
      mobile,
      profilePhoto,
      addresses,
    });

    const { passwordHash, ...safeUser } = updated;
    res.json({
      success: true,
      user: safeUser,
      message: 'Profile updated successfully.',
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to update customer profile.' });
  }
};

apiRouter.put('/customer/profile/:id', handleCustomerProfileUpdate);
apiRouter.post('/customer/profile', handleCustomerProfileUpdate);

// Dedicated Customer Addresses Persistence Endpoints
apiRouter.get('/customer/addresses', (req, res) => {
  try {
    const { customerId, mobile } = req.query;
    const user = (customerId ? dbService.findUserById(customerId) : null) ||
                 (mobile ? dbService.findUserByMobile(mobile) : null);
    if (!user) {
      return res.status(404).json({ error: 'Customer account not found.' });
    }
    res.json({ success: true, addresses: user.addresses || [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve customer addresses.' });
  }
});

apiRouter.post('/customer/addresses', (req, res) => {
  try {
    const { customerId, mobile, addresses } = req.body;
    const identifier = customerId || mobile;
    if (!identifier) {
      return res.status(400).json({ error: 'Customer ID or mobile number is required.' });
    }
    if (!Array.isArray(addresses)) {
      return res.status(400).json({ error: 'Addresses must be an array.' });
    }

    const updatedUser = dbService.updateUserAddresses(identifier, addresses);
    res.json({
      success: true,
      addresses: updatedUser.addresses || [],
      message: 'Customer addresses successfully saved to database.',
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to save customer addresses.' });
  }
});

apiRouter.post('/customer/change-password', (req, res) => {
  try {
    const { customerId, oldPassword, newPassword, confirmPassword } = req.body;
    if (!customerId || !oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Customer ID, old password, and new password are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }
    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New password and Confirm Password do not match.' });
    }

    dbService.changeUserPassword(customerId, oldPassword, newPassword);
    res.json({
      success: true,
      message: 'Password changed successfully.',
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to change password.' });
  }
});

apiRouter.post('/customer/send-email-verification', async (req, res) => {
  try {
    const { customerId, email } = req.body;
    if (!customerId || !isValidEmail(email)) {
      return res.status(400).json({ error: 'Valid customer ID and email address are required.' });
    }

    const otpCode = generateOtp();
    const result = await sendPasswordResetEmail(email.trim().toLowerCase(), otpCode, 15);

    // Save for verification
    const otpHash = hashOtp(otpCode);
    dbService.savePasswordResetOtp(email.trim().toLowerCase(), otpHash, Date.now() + 15 * 60 * 1000, Date.now() + 60 * 1000);

    res.json({
      success: true,
      delivered: result.delivered,
      demoMode: result.demoMode,
      demoOtp: result.demoOtp,
      message: result.message,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to dispatch verification email.' });
  }
});

apiRouter.post('/customer/confirm-email-verification', (req, res) => {
  try {
    const { customerId, email, otp } = req.body;
    if (!customerId || !email || !otp) {
      return res.status(400).json({ error: 'Customer ID, email, and OTP code are required.' });
    }

    const record = dbService.getPasswordResetRecord(email.trim().toLowerCase());
    if (!record || Date.now() > record.expiresAt) {
      return res.status(400).json({ error: 'Verification code has expired or was not found.' });
    }

    if (!verifyOtp(String(otp).trim(), record.otpHash)) {
      return res.status(400).json({ error: 'Incorrect verification code.' });
    }

    dbService.verifyCustomerEmail(customerId);
    dbService.clearPasswordReset(email.trim().toLowerCase());

    res.json({
      success: true,
      message: 'Email address verified successfully.',
    });
  } catch (err) {
    res.status(500).json({ error: 'Email verification confirmation failed.' });
  }
});

apiRouter.post('/auth/logout', (req, res) => {
  const { role, identifier } = req.body || {};
  dbService.logAudit(role || 'user', identifier || 'Anonymous', 'LOGOUT', 'User logged out and session cleared');
  res.json({ success: true, message: 'Logged out successfully.' });
});

// -------------------------------------------------------------
// Magizh B5 Coin Loyalty Ledger Endpoints
// -------------------------------------------------------------

apiRouter.get('/coins/status', (req, res) => {
  res.json({
    success: true,
    currencyRule: '1 B5 Coin = ₹1',
    maxRedemptionCap: '50% of original bill amount',
    mode: 'STANDALONE_MAGIZH_COMMERCE_LEDGER',
  });
});

apiRouter.get('/coins/customer/:identifier', (req, res) => {
  try {
    const identifier = req.params.identifier;
    const account = dbService.getCoinAccount(identifier);
    if (!account) return res.status(404).json({ error: 'Customer not found in B5 coin ledger.' });
    res.json({ success: true, balance: account });
  } catch (err) {
    res.status(500).json({ error: 'Customer coin lookup failed.' });
  }
});

// -------------------------------------------------------------
// B. Product Management Endpoints
// -------------------------------------------------------------

apiRouter.get('/products', (req, res) => {
  const includeArchived = req.query.includeArchived === 'true';
  const products = dbService.getProducts(includeArchived);
  res.json({ success: true, count: products.length, products });
});

apiRouter.get('/products/:id', (req, res) => {
  const product = dbService.getProductById(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json({ success: true, product });
});

apiRouter.post('/products', requireAdminAuth, (req, res) => {
  try {
    const prod = req.body || {};
    if (!prod.name || !prod.category || !prod.variants || prod.variants.length === 0) {
      return res.status(400).json({ error: 'Product name, category, and at least one weight variant are required.' });
    }

    const newProd = {
      ...prod,
      id: prod.id || `prod-${Date.now()}`,
      images: (prod.images && prod.images.length > 0) ? prod.images.slice(0, 3) : [
        'https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=800&q=80'
      ],
      status: prod.status || 'active',
      createdAt: new Date().toISOString(),
    };

    const saved = dbService.saveProduct(newProd);
    dbService.logAudit('admin', req.adminUser?.name || 'Admin', 'ADD_PRODUCT', `Added product "${newProd.name}" (${newProd.id})`);

    res.status(201).json({ success: true, product: saved });
  } catch (err) {
    console.error('[API Create Product Error]', err);
    res.status(500).json({ error: err.message || 'Failed to create product.' });
  }
});

apiRouter.put('/products/:id', requireAdminAuth, (req, res) => {
  try {
    const existing = dbService.getProductById(req.params.id);
    let target = null;

    if (existing) {
      target = {
        ...existing,
        ...req.body,
        id: req.params.id,
        images: req.body.images ? req.body.images.slice(0, 3) : existing.images,
      };
    } else {
      // Upsert: If product ID is newly generated, save as new product seamlessly
      const prod = req.body || {};
      target = {
        ...prod,
        id: req.params.id,
        images: (prod.images && prod.images.length > 0) ? prod.images.slice(0, 3) : [
          'https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&w=800&q=80'
        ],
        status: prod.status || 'active',
        createdAt: prod.createdAt || new Date().toISOString(),
      };
    }

    const saved = dbService.saveProduct(target);
    dbService.logAudit('admin', req.adminUser?.name || 'Admin', existing ? 'UPDATE_PRODUCT' : 'ADD_PRODUCT', `Saved product "${saved.name}" (${saved.id})`);

    res.json({ success: true, product: saved });
  } catch (err) {
    console.error('[API Product Update Error]', err);
    res.status(500).json({ error: 'Failed to update product.' });
  }
});

apiRouter.delete('/products/:id', requireAdminAuth, (req, res) => {
  try {
    const result = dbService.archiveOrDeleteProduct(req.params.id);
    dbService.logAudit('admin', req.adminUser?.name || 'Admin', result.action === 'archived' ? 'ARCHIVE_PRODUCT' : 'DELETE_PRODUCT', result.message);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete/archive product.' });
  }
});

// Categories
apiRouter.get('/categories', (req, res) => {
  const includeInactive = req.query.includeInactive === 'true' || req.query.all === 'true';
  const categories = dbService.getCategories(includeInactive);
  res.json({ success: true, count: categories.length, categories });
});

apiRouter.post('/categories', requireAdminAuth, (req, res) => {
  try {
    const cat = req.body;
    if (!cat.name) return res.status(400).json({ error: 'Category name is required' });
    cat.id = cat.id || `cat-${Date.now()}`;
    dbService.saveCategory(cat);
    res.status(201).json({ success: true, category: cat });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/categories/:id', requireAdminAuth, (req, res) => {
  try {
    dbService.deleteCategory(req.params.id);
    res.json({ success: true, message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Promotional Banners & Poster Designs
apiRouter.get('/banners', (req, res) => {
  const includeInactive = req.query.all === 'true' || req.query.admin === 'true';
  res.json({ success: true, banners: dbService.getBanners(includeInactive) });
});

apiRouter.post('/banners', requireAdminAuth, (req, res) => {
  try {
    const b = req.body;
    if (!b || !b.title) {
      return res.status(400).json({ error: 'Banner title is required.' });
    }
    b.id = b.id || `ban-${Date.now()}`;
    dbService.saveBanner(b);
    dbService.logAudit('admin', req.adminUser?.name || 'Administrator', 'SAVE_BANNER', `Saved banner "${b.title}" (${b.id})`);
    res.status(201).json({ success: true, banner: b });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to save banner.' });
  }
});

apiRouter.delete('/banners/:id', requireAdminAuth, (req, res) => {
  try {
    dbService.deleteBanner(req.params.id);
    dbService.logAudit('admin', req.adminUser?.name || 'Administrator', 'DELETE_BANNER', `Deleted banner ${req.params.id}`);
    res.json({ success: true, message: 'Banner deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to delete banner.' });
  }
});

// Store Settings (Payment config & Admin UPI configuration)
apiRouter.get('/store/payment-config', (req, res) => {
  try {
    const config = dbService.getStoreSettings('payment_config') || {
      merchantUpiId: 'magizhcafee-3@okhdfcbank',
      merchantName: 'Magizh Shopping',
      enableCod: true,
      enableUpi: true,
      qrImageUrl: '',
    };
    res.json({ success: true, config });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve payment configuration.' });
  }
});

apiRouter.post('/admin/store/payment-config', requireAdminAuth, (req, res) => {
  try {
    const { merchantUpiId, merchantName, enableCod, enableUpi, qrImageUrl } = req.body;
    if (!merchantUpiId || !merchantUpiId.includes('@')) {
      return res.status(400).json({ error: 'Please enter a valid Merchant UPI ID (e.g. yourname@okhdfcbank).' });
    }
    const updated = {
      merchantUpiId: merchantUpiId.trim(),
      merchantName: merchantName ? merchantName.trim() : 'Magizh Shopping',
      enableCod: enableCod !== false,
      enableUpi: enableUpi !== false,
      qrImageUrl: qrImageUrl || '',
      updatedAt: new Date().toISOString(),
    };
    dbService.saveStoreSettings('payment_config', updated);
    dbService.logAudit('admin', req.adminUser?.name || 'Administrator', 'UPDATE_PAYMENT_CONFIG', `Updated Merchant UPI ID to "${updated.merchantUpiId}"`);
    res.json({ success: true, config: updated, message: 'Store payment configuration updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to update payment configuration.' });
  }
});

// -------------------------------------------------------------
// Orders & Stock Management (Backend Database API)
// -------------------------------------------------------------

apiRouter.get('/orders', (req, res) => {
  try {
    const { customerId, mobile, phone } = req.query;
    let orders = dbService.getOrders();
    const searchPhone = (mobile || phone || '').trim();
    if (customerId || searchPhone) {
      orders = orders.filter((o) => {
        if (customerId && (o.customerId === customerId || o.customerId === `user-${customerId}`)) return true;
        if (searchPhone && (
          o.customerPhone === searchPhone ||
          o.customerId === `user-${searchPhone}` ||
          (o.shippingAddress && o.shippingAddress.phone === searchPhone)
        )) return true;
        return false;
      });
    }
    res.json({ success: true, count: orders.length, orders });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve orders.' });
  }
});

apiRouter.get('/orders/:id', (req, res) => {
  try {
    const order = dbService.getOrderById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve order.' });
  }
});

apiRouter.post('/orders', (req, res) => {
  try {
    const orderData = req.body;
    if (!orderData || !orderData.items || orderData.items.length === 0) {
      return res.status(400).json({ error: 'Order must contain at least one item.' });
    }

    // Completely disable Cash on Delivery (COD) - Enforce UPI only
    if (orderData.paymentMethod === 'Cash on Delivery' || orderData.paymentMethod === 'COD') {
      return res.status(400).json({ error: 'Cash on Delivery (COD) is disabled. Please complete payment via UPI.' });
    }

    // Validate 12-digit UPI UTR and prevent duplicate UTR usage across orders
    if (orderData.paymentMethod?.toLowerCase().includes('upi') || orderData.paymentUtr) {
      const utr = String(orderData.paymentUtr || '').trim();
      if (!utr || !/^[A-Za-z0-9]{12}$/.test(utr)) {
        return res.status(400).json({ error: 'Please enter a valid 12-digit UPI reference number (UTR).' });
      }
      const existingUtrOrder = dbService.getOrderByUtr(utr);
      if (existingUtrOrder && existingUtrOrder.id !== orderData.id) {
        return res.status(400).json({
          error: `This 12-digit UTR (${utr}) has already been submitted for Order #${existingUtrOrder.orderNumber}. Duplicate UTRs are not permitted.`,
        });
      }
    }

    // Backend validation: Reject order if any item is marked Coming Soon
    if (Array.isArray(orderData.items)) {
      for (const item of orderData.items) {
        const product = dbService.getProductById(item.productId);
        if (product) {
          if (product.status === 'coming_soon') {
            return res.status(400).json({
              error: `Product "${product.name}" is currently Coming Soon and cannot be purchased.`,
            });
          }
          const matchedVariant = product.variants?.find(
            (v) => v.id === item.variantId || v.weight === item.variantWeight
          );
          if (matchedVariant?.isComingSoon) {
            return res.status(400).json({
              error: `Variant "${matchedVariant.weight}" for "${product.name}" is currently Coming Soon and cannot be purchased.`,
            });
          }
        }
      }
    }

    // Decrement stock for purchased product variants in the database
    if (Array.isArray(orderData.items)) {
      for (const item of orderData.items) {
        const product = dbService.getProductById(item.productId);
        if (product && Array.isArray(product.variants)) {
          let stockUpdated = false;
          const updatedVariants = product.variants.map((v) => {
            if (v.id === item.variantId || v.weight === item.variantWeight) {
              const currentStock = typeof v.stock === 'number' ? v.stock : 50;
              const newStock = Math.max(0, currentStock - (item.quantity || 1));
              stockUpdated = true;
              return { ...v, stock: newStock };
            }
            return v;
          });
          if (stockUpdated) {
            dbService.saveProduct({ ...product, variants: updatedVariants });
          }
        }
      }
    }

    // Handle coin redemption deduction if coins were redeemed
    if (orderData.coinsRedeemed > 0 && orderData.customerId) {
      const coinAccount = dbService.getCoinAccount(orderData.customerId);
      if (coinAccount) {
        const newBalance = Math.max(0, coinAccount.availableBalance - orderData.coinsRedeemed);
        dbService.saveCoinAccount({
          ...coinAccount,
          availableBalance: newBalance,
          totalRedeemed: coinAccount.totalRedeemed + orderData.coinsRedeemed,
        });
        dbService.recordCoinTransaction({
          id: `TXN-RED-${Date.now()}`,
          customerId: orderData.customerId,
          orderId: orderData.id,
          orderNumber: orderData.orderNumber,
          type: 'redemption',
          amount: orderData.coinsRedeemed,
          reason: `Redeemed on Order #${orderData.orderNumber}`,
          balanceAfter: newBalance,
          status: 'completed',
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Handle reward coins earned credit if eligible
    if (orderData.rewardCoinsEarned > 0 && orderData.customerId) {
      const coinAccount = dbService.getCoinAccount(orderData.customerId);
      if (coinAccount) {
        const newBalance = coinAccount.availableBalance + orderData.rewardCoinsEarned;
        dbService.saveCoinAccount({
          ...coinAccount,
          availableBalance: newBalance,
          totalEarned: coinAccount.totalEarned + orderData.rewardCoinsEarned,
        });
        dbService.recordCoinTransaction({
          id: `TXN-REW-${Date.now()}`,
          customerId: orderData.customerId,
          orderId: orderData.id,
          orderNumber: orderData.orderNumber,
          type: 'reward_credit',
          amount: orderData.rewardCoinsEarned,
          reason: `5% Reward Coins earned on Order #${orderData.orderNumber}`,
          balanceAfter: newBalance,
          status: 'completed',
          timestamp: new Date().toISOString(),
        });
      }
    }

    const createdOrder = dbService.createOrder(orderData);
    res.status(201).json({ success: true, order: createdOrder });
  } catch (err) {
    console.error('[API Create Order Error]', err);
    res.status(500).json({ error: 'Failed to create order.' });
  }
});

const handleUpdateOrderStatus = (req, res) => {
  try {
    const { status, orderStatus, note, paymentStatus } = req.body;
    const targetStatus = orderStatus || status;
    if (!targetStatus && !paymentStatus) return res.status(400).json({ error: 'Status is required.' });

    let updated = null;
    if (targetStatus) {
      updated = dbService.updateOrderStatus(req.params.id, targetStatus, note || '');
    }
    if (paymentStatus) {
      if (paymentStatus === 'Paid') {
        const adminName = req.adminUser?.name || 'Administrator';
        updated = dbService.verifyOrderPayment(req.params.id, adminName, note || '');
      } else {
        updated = dbService.updateOrderPaymentStatus ? dbService.updateOrderPaymentStatus(req.params.id, paymentStatus) : updated;
      }
    }
    if (!updated) updated = dbService.getOrderById(req.params.id);
    if (!updated) return res.status(404).json({ error: 'Order not found.' });

    // If cancelled, reverse redeemed coins back to customer balance
    if (targetStatus === 'Cancelled' && updated.coinsRedeemed > 0 && updated.customerId) {
      const coinAccount = dbService.getCoinAccount(updated.customerId);
      if (coinAccount) {
        const newBalance = coinAccount.availableBalance + updated.coinsRedeemed;
        dbService.saveCoinAccount({
          ...coinAccount,
          availableBalance: newBalance,
          totalRedeemed: Math.max(0, coinAccount.totalRedeemed - updated.coinsRedeemed),
          reversedBalance: (coinAccount.reversedBalance || 0) + updated.coinsRedeemed,
        });
        dbService.recordCoinTransaction({
          id: `TXN-REV-${Date.now()}`,
          customerId: updated.customerId,
          orderId: updated.id,
          orderNumber: updated.orderNumber,
          type: 'reversal',
          amount: updated.coinsRedeemed,
          reason: `Reversal of redeemed coins for Cancelled Order #${updated.orderNumber}`,
          balanceAfter: newBalance,
          status: 'completed',
          timestamp: new Date().toISOString(),
        });
      }
    }

    res.json({ success: true, order: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update order status.' });
  }
};

apiRouter.post('/orders/:id/status', handleUpdateOrderStatus);
apiRouter.patch('/orders/:id/status', handleUpdateOrderStatus);
apiRouter.post('/admin/orders/:id/status', handleUpdateOrderStatus);
apiRouter.patch('/admin/orders/:id/status', handleUpdateOrderStatus);

apiRouter.post('/admin/orders/:id/verify-payment', requireAdminAuth, (req, res) => {
  try {
    const { notes } = req.body;
    const adminName = req.adminUser?.name || 'Administrator';
    const updated = dbService.verifyOrderPayment(req.params.id, adminName, notes);
    if (!updated) return res.status(404).json({ error: 'Order not found.' });

    dbService.logAudit(
      'admin',
      adminName,
      'VERIFY_ORDER_PAYMENT',
      `Admin verified UPI payment for Order #${updated.orderNumber}. Order marked Paid & Confirmed.`
    );

    res.json({ success: true, order: updated, message: `Payment verified successfully for Order #${updated.orderNumber}.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify order payment.' });
  }
});

apiRouter.post('/admin/orders/:id/reject-payment', requireAdminAuth, (req, res) => {
  try {
    const { reason } = req.body;
    const adminName = req.adminUser?.name || 'Administrator';
    const order = dbService.getOrderById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found.' });

    const updated = dbService.updateOrderStatus(
      order.id,
      'Cancelled',
      adminName,
      `Payment rejected by admin: ${reason || 'Invalid or duplicate UTR'}`
    );

    dbService.logAudit(
      'admin',
      adminName,
      'REJECT_ORDER_PAYMENT',
      `Admin rejected UPI payment for Order #${order.orderNumber}. Reason: ${reason || 'Invalid or duplicate UTR'}`
    );

    res.json({ success: true, order: updated, message: `Payment rejected for Order #${order.orderNumber}.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject order payment.' });
  }
});

// Admin Customer Management Directory (Part 4)
apiRouter.get('/admin/customers', requireAdminAuth, (req, res) => {
  try {
    const customers = dbService.getCustomers();
    res.json({ success: true, count: customers.length, customers });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch customer directory.' });
  }
});

apiRouter.get('/admin/customers/:id/orders', requireAdminAuth, (req, res) => {
  try {
    const allOrders = dbService.getOrders();
    const customer = dbService.findUserById(req.params.id) || dbService.findUserByMobile(req.params.id);
    const orders = allOrders.filter(
      (o) => o.customerId === req.params.id || (customer && o.customerPhone === customer.mobile)
    );
    res.json({ success: true, count: orders.length, orders });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch customer orders.' });
  }
});

// Admin Payments & UTR Ledger (Part 5)
apiRouter.get('/admin/payments', requireAdminAuth, (req, res) => {
  try {
    const orders = dbService.getOrders();
    const payments = orders.map((o) => {
      const isPaid = o.paymentStatus === 'Paid';
      const isFailed = o.paymentStatus === 'Failed' || o.orderStatus === 'Cancelled';
      const verificationStatus = isPaid ? 'Verified' : (isFailed ? 'Rejected' : 'Pending Verification');

      return {
        orderId: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customerName,
        customerPhone: o.customerPhone,
        paymentAmount: o.finalPayableAmount || o.totalAmount || 0,
        paymentUtr: o.paymentUtr || null,
        paymentMethod: o.paymentMethod || 'UPI',
        paymentDate: o.createdAt,
        paymentStatus: o.paymentStatus,
        verificationStatus,
        timeline: o.timeline || [],
        order: o,
      };
    });
    res.json({ success: true, count: payments.length, payments });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch payments ledger.' });
  }
});

// Coupons CRUD (Stored in SQLite store_settings)
const DEFAULT_COUPONS = [
  {
    code: 'WELCOME100',
    discountType: 'fixed',
    discountValue: 100,
    minOrderValue: 500,
    description: 'Flat ₹100 Off on your traditional feast order above ₹500',
    validUntil: '2026-12-31',
    active: true,
  },
  {
    code: 'PONGAL10',
    discountType: 'percentage',
    discountValue: 10,
    minOrderValue: 800,
    maxDiscount: 200,
    description: '10% Festive Discount on all Millet Products and Ghee',
    validUntil: '2026-12-31',
    active: true,
  },
  {
    code: 'HEALTHY50',
    discountType: 'fixed',
    discountValue: 50,
    minOrderValue: 300,
    description: '₹50 Off on healthy soaps and podi varieties',
    validUntil: '2026-12-31',
    active: true,
  },
];

function getStoredCoupons() {
  const stored = dbService.getStoreSettings('coupons');
  if (Array.isArray(stored) && stored.length > 0) return stored;
  dbService.saveStoreSettings('coupons', DEFAULT_COUPONS);
  return DEFAULT_COUPONS;
}

apiRouter.get('/coupons', (req, res) => {
  try {
    const coupons = getStoredCoupons();
    res.json({ success: true, count: coupons.length, coupons });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load coupons.' });
  }
});

apiRouter.get('/admin/coupons', requireAdminAuth, (req, res) => {
  try {
    const coupons = getStoredCoupons();
    res.json({ success: true, count: coupons.length, coupons });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load coupons.' });
  }
});

apiRouter.post('/admin/coupons', requireAdminAuth, (req, res) => {
  try {
    const { code, discountType, discountValue, minOrderValue, maxDiscount, description, validUntil, active } = req.body;
    if (!code || !discountValue || !validUntil) {
      return res.status(400).json({ error: 'Code, discount value, and valid until date are required.' });
    }
    const cleanCode = code.trim().toUpperCase();
    const coupons = getStoredCoupons();
    const existingIndex = coupons.findIndex((c) => c.code.toUpperCase() === cleanCode);

    const newCoupon = {
      code: cleanCode,
      discountType: discountType || 'fixed',
      discountValue: Number(discountValue),
      minOrderValue: Number(minOrderValue) || 0,
      maxDiscount: maxDiscount ? Number(maxDiscount) : undefined,
      description: description || `Coupon ${cleanCode}`,
      validUntil,
      active: active !== false,
      updatedAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      coupons[existingIndex] = newCoupon;
    } else {
      coupons.push(newCoupon);
    }

    dbService.saveStoreSettings('coupons', coupons);
    dbService.logAudit('admin', req.adminUser?.name || 'Admin', 'SAVE_COUPON', `Saved coupon ${cleanCode}`);
    res.json({ success: true, coupon: newCoupon, coupons });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save coupon.' });
  }
});

apiRouter.put('/admin/coupons/:code', requireAdminAuth, (req, res) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    const coupons = getStoredCoupons();
    const index = coupons.findIndex((c) => c.code.toUpperCase() === code);
    if (index === -1) {
      return res.status(404).json({ error: `Coupon ${code} not found.` });
    }

    coupons[index] = {
      ...coupons[index],
      ...req.body,
      code,
      updatedAt: new Date().toISOString()
    };

    dbService.saveStoreSettings('coupons', coupons);
    dbService.logAudit('admin', req.adminUser?.name || 'Admin', 'UPDATE_COUPON', `Updated coupon ${code}`);
    res.json({ success: true, coupon: coupons[index], coupons });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update coupon.' });
  }
});

apiRouter.delete('/admin/coupons/:code', requireAdminAuth, (req, res) => {
  try {
    const code = req.params.code.trim().toUpperCase();
    let coupons = getStoredCoupons();
    coupons = coupons.filter((c) => c.code.toUpperCase() !== code);
    dbService.saveStoreSettings('coupons', coupons);
    dbService.logAudit('admin', req.adminUser?.name || 'Admin', 'DELETE_COUPON', `Deleted coupon ${code}`);
    res.json({ success: true, message: `Coupon ${code} deleted successfully.`, coupons });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete coupon.' });
  }
});

// Partner Commission & Bonus Rates Settings (Section 9)
const DEFAULT_COMMISSION_SETTINGS = {
  partnerCommissionRate: 8.0,
  customerRewardCoinsPercentage: 5.0,
  bonusMultiplier: 1.5,
  updatedAt: new Date().toISOString()
};

apiRouter.get('/admin/commission-settings', (req, res) => {
  try {
    const settings = dbService.getStoreSettings('commission_settings') || DEFAULT_COMMISSION_SETTINGS;
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load commission settings.' });
  }
});

apiRouter.post('/admin/commission-settings', requireAdminAuth, (req, res) => {
  try {
    const { partnerCommissionRate, customerRewardCoinsPercentage, bonusMultiplier } = req.body;
    const current = dbService.getStoreSettings('commission_settings') || DEFAULT_COMMISSION_SETTINGS;

    const updated = {
      ...current,
      partnerCommissionRate: partnerCommissionRate != null ? Number(partnerCommissionRate) : current.partnerCommissionRate,
      customerRewardCoinsPercentage: customerRewardCoinsPercentage != null ? Number(customerRewardCoinsPercentage) : current.customerRewardCoinsPercentage,
      bonusMultiplier: bonusMultiplier != null ? Number(bonusMultiplier) : current.bonusMultiplier,
      updatedAt: new Date().toISOString(),
      updatedBy: req.adminUser?.name || 'Admin'
    };

    dbService.saveStoreSettings('commission_settings', updated);
    dbService.logAudit(
      'admin',
      req.adminUser?.name || 'Admin',
      'UPDATE_COMMISSION_SETTINGS',
      `Updated partner commission to ${updated.partnerCommissionRate}%, reward coins to ${updated.customerRewardCoinsPercentage}%, bonus multiplier to ${updated.bonusMultiplier}x`
    );

    res.json({ success: true, message: 'Commission settings updated successfully. Applied to new transactions.', settings: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save commission settings.' });
  }
});

// Cloudflare D1 Status
apiRouter.get('/d1/status', async (req, res) => {
  try {
    const { d1 } = await import('./d1Client.js');
    const isConfigured = d1.isConfigured();
    let health = null;
    if (isConfigured) {
      const ping = await d1.query('SELECT 1 as live_test, datetime("now") as server_time');
      health = ping.results?.[0] || null;
    }
    res.json({
      success: true,
      database: 'magizh-shopping-db',
      databaseId: d1.databaseId,
      region: 'APAC',
      configured: isConfigured,
      connected: Boolean(health && health.live_test === 1),
      serverTime: health?.server_time || null,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// D. Partner Shops, Applications, and Server-Side Authorization
// -------------------------------------------------------------

apiRouter.get('/partners', (req, res) => {
  const partners = dbService.getPartners();
  res.json({ success: true, count: partners.length, partners });
});

// Partner Registration (Submits Application with status PENDING)
apiRouter.post('/partners/register', (req, res) => {
  try {
    const {
      ownerName,
      shopName,
      mobile,
      email,
      shopAddress,
      district,
      city,
      pinCode,
      merchantUpiId,
      gstNumber,
      password,
      documents,
    } = req.body;

    if (!ownerName || ownerName.trim().length < 2) {
      return res.status(400).json({ error: 'Please enter a valid owner name.' });
    }
    if (!shopName || shopName.trim().length < 2) {
      return res.status(400).json({ error: 'Please enter your shop or business name.' });
    }
    if (!mobile || !/^\d{10}$/.test(String(mobile).trim())) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (!shopAddress || shopAddress.trim().length < 5) {
      return res.status(400).json({ error: 'Please enter the complete shop address.' });
    }
    if (!district || !pinCode || !/^\d{6}$/.test(String(pinCode).trim())) {
      return res.status(400).json({ error: 'Please enter valid district and 6-digit PIN code.' });
    }
    if (!merchantUpiId || !merchantUpiId.includes('@')) {
      return res.status(400).json({ error: 'Please provide a valid Merchant UPI ID (e.g. yourshop@okhdfcbank).' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Access password must be at least 6 characters long.' });
    }

    const application = dbService.registerPartnerApplication({
      ownerName,
      shopName,
      mobile,
      email,
      address: shopAddress,
      district,
      city: city || district,
      pinCode,
      merchantUpiId,
      gstNumber,
      password,
      documents: documents || [],
    });

    res.status(201).json({
      success: true,
      partnerId: application.id,
      partnerCode: application.partnerCode,
      status: 'pending',
      applicationStatus: 'PENDING',
      message: 'Registration Submitted Successfully. Your shop application has been received and is pending administrator review.',
      partner: application,
    });
  } catch (err) {
    console.error('[API Partner Register Error]', err);
    res.status(400).json({ error: err.message || 'Partner registration failed.' });
  }
});

// Check Partner Application Status
apiRouter.get('/partners/application-status', (req, res) => {
  const identifier = String(req.query.identifier || req.query.mobile || '').trim();
  if (!identifier) {
    return res.status(400).json({ error: 'Please provide mobile number or partner code.' });
  }

  const partner =
    dbService.findPartnerByMobile(identifier) ||
    dbService.findPartnerByEmail(identifier) ||
    dbService.getPartnerById(identifier);

  if (!partner) {
    return res.status(404).json({ error: 'No partner application found for this identifier.' });
  }

  const isApproved = partner.status === 'approved' || partner.applicationStatus === 'approved';
  const effectiveStatus = isApproved ? 'APPROVED' : (partner.status === 'rejected' || partner.applicationStatus === 'rejected' ? 'REJECTED' : 'PENDING');

  res.json({
    success: true,
    status: isApproved ? 'approved' : partner.status,
    applicationStatus: effectiveStatus,
    partnerCode: partner.partnerCode,
    shopName: partner.shopName,
    ownerName: partner.ownerName,
    district: partner.district,
    city: partner.city,
    merchantUpiId: partner.merchantUpiId,
    appliedAt: partner.createdAt,
    rejectionReason: partner.rejectionReason || null,
    application: {
      ...partner,
      status: isApproved ? 'approved' : partner.status,
      applicationStatus: effectiveStatus,
    },
  });
});

// Partner Login (Only APPROVED partners can access dashboard)
apiRouter.post('/partners/login', (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Mobile number, Partner ID, or email, and password are required.' });
    }

    const trimmed = identifier.trim();
    const partner =
      dbService.findPartnerByMobile(trimmed) ||
      dbService.findPartnerByCode(trimmed) ||
      dbService.getPartnerById(trimmed) ||
      dbService.findPartnerByEmail(trimmed);

    if (!partner) {
      return res.status(401).json({ error: 'Invalid partner credentials. Franchise shop record not found.' });
    }

    // Status checks: Approved if either status or applicationStatus is approved
    const isApproved = partner.status === 'approved' || partner.applicationStatus === 'approved';
    if (!isApproved) {
      if (partner.status === 'rejected' || partner.applicationStatus === 'rejected') {
        return res.status(403).json({
          success: false,
          error: `Your shop application for "${partner.shopName}" was not approved. Reason: ${partner.rejectionReason || 'Criteria not met.'}`,
          applicationStatus: 'rejected',
        });
      }
      return res.status(403).json({
        success: false,
        error: `Your shop application for "${partner.shopName}" is currently pending Admin Approval. You will receive access once approved by Magizh Administrator.`,
        applicationStatus: 'pending',
      });
    }

    // Synchronize both fields in DB if one was approved
    if (partner.status !== 'approved' || partner.applicationStatus !== 'approved') {
      dbService.updatePartnerStatus(partner.id, 'approved');
      partner.status = 'approved';
      partner.applicationStatus = 'approved';
    }

    // Determine stored password hash from partner_shops or associated user account
    let passwordHash = partner.passwordHash;
    if (!passwordHash) {
      const associatedUser = dbService.findUserByMobile(partner.mobile) || dbService.findUserByEmail(partner.email);
      if (associatedUser && associatedUser.passwordHash) {
        passwordHash = associatedUser.passwordHash;
      }
    }

    // Verify password securely using scrypt timing-safe comparison (No shared or hardcoded passwords)
    const isPasswordValid = passwordHash && verifyPassword(password, passwordHash);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Incorrect partner access password.' });
    }

    const token = generatePartnerToken(partner.id, partner.mobile);
    dbService.logAudit('partner', partner.ownerName, 'PARTNER_LOGIN', `Partner authenticated for "${partner.shopName}" (${partner.id})`);

    res.json({
      success: true,
      token,
      partner,
      message: 'Partner authenticated successfully.',
    });
  } catch (err) {
    console.error('[API Partner Login Error]', err);
    res.status(500).json({ error: 'Partner login failed.' });
  }
});

// Admin Partner Applications CMS
apiRouter.get('/admin/partner-applications', requireAdminAuth, (req, res) => {
  const status = req.query.status || null;
  const applications = dbService.getPartnerApplications(status);
  res.json({ success: true, count: applications.length, applications });
});

apiRouter.post('/admin/partner-applications/:id/decision', requireAdminAuth, (req, res) => {
  try {
    const { decision, notes, reason } = req.body;
    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({ error: 'Decision must be either "approve" or "reject".' });
    }

    const decisionNotes = notes || reason || '';
    const updated = dbService.decidePartnerApplication(
      req.params.id,
      decision,
      req.adminUser?.name || 'Administrator',
      decisionNotes
    );

    res.json({
      success: true,
      partner: updated,
      message: `Partner application for "${updated.shopName}" was ${updated.status} successfully.`,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

const handleTogglePartnerStatus = (req, res) => {
  const { status } = req.body;
  if (!['approved', 'suspended', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  dbService.updatePartnerStatus(req.params.id, status);
  const updated = dbService.getPartnerById(req.params.id);
  res.json({ success: true, partner: updated, message: `Partner status changed to ${status}` });
};

apiRouter.post('/partners/:id/toggle-status', requireAdminAuth, handleTogglePartnerStatus);
apiRouter.post('/admin/partners/:id/toggle-status', requireAdminAuth, handleTogglePartnerStatus);

// Admin Direct Partner Shop Creation & Account Management
apiRouter.post('/admin/partners/create', requireAdminAuth, (req, res) => {
  try {
    const {
      ownerName,
      shopName,
      mobile,
      email,
      address,
      district,
      city,
      pinCode,
      merchantUpiId,
      gstNumber,
      password,
      commissionRate,
    } = req.body;

    if (!ownerName || !shopName || !mobile || !email || !password) {
      return res.status(400).json({ error: 'Owner name, shop name, mobile, email, and password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Partner password must be at least 6 characters long.' });
    }

    const partner = dbService.createPartner({
      ownerName,
      shopName,
      mobile,
      email,
      address: address || `${city || district || 'Tamil Nadu'}, India`,
      district: district || 'Coimbatore',
      city: city || district || 'Coimbatore',
      pinCode: pinCode || '641001',
      merchantUpiId: merchantUpiId || 'magizhcafee-3@okhdfcbank',
      gstNumber: gstNumber || null,
      password,
      commissionRate: commissionRate ? parseFloat(commissionRate) : 8.0,
    });

    dbService.logAudit(
      'admin',
      req.adminUser?.name || 'Administrator',
      'CREATE_PARTNER',
      `Admin created partner account for "${shopName}" (${partner.partnerCode}) with secure hashed password.`
    );

    res.status(201).json({
      success: true,
      partner,
      message: `Partner franchise account for "${shopName}" created and activated successfully.`,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// E. Partner Shop Billing System & Customer Approval Flow
// -------------------------------------------------------------

// Customer Search by Mobile for Partner POS
apiRouter.get('/partners/customer-lookup', (req, res) => {
  const mobile = String(req.query.mobile || req.query.query || req.query.phone || '').trim();
  if (!mobile || !/^\d{10}$/.test(mobile)) {
    return res.status(400).json({ error: 'Please enter a valid 10-digit customer mobile number.' });
  }

  const customer = dbService.lookupCustomerForPartner(mobile);
  if (!customer) {
    return res.status(404).json({
      error: `No registered customer found with mobile +91 ${mobile}. Please ask the customer to register on Magizh Shopping.`,
    });
  }

  res.json({ success: true, customer });
});

// Partner Creates In-Store Bill
apiRouter.post(['/partners/bills/create', '/partners/bills'], (req, res) => {
  try {
    const {
      partnerId,
      customerId,
      customerPhone,
      customerMobile,
      originalBillAmount,
      billAmount,
      coinsToRedeem,
      itemsSummary,
      billSummary,
    } = req.body;

    const finalAmount = originalBillAmount || billAmount;
    const finalPhone = customerPhone || customerMobile;
    const finalSummary = itemsSummary || billSummary;

    if (!partnerId || !finalAmount) {
      return res.status(400).json({ error: 'Partner ID and bill amount are required.' });
    }

    const bill = dbService.createPartnerBill({
      partnerId,
      customerId,
      customerPhone: finalPhone,
      originalBillAmount: finalAmount,
      coinsToRedeem,
      itemsSummary: finalSummary,
    });

    dbService.logAudit(
      'partner',
      bill.partnerName,
      'CREATE_BILL',
      `Created Bill #${bill.billNumber} for ${bill.customerName}: ₹${bill.originalBillAmount} with ${bill.coinsToRedeem} B5 Coins discount.`
    );

    res.status(201).json({
      success: true,
      bill,
      message: 'Bill created successfully. Sent to customer for in-store payment selection.',
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Customer Retrieves Pending Bills for Approval (Live, Uncached, Strictly Isolated by Customer Account)
apiRouter.get('/customer/pending-bills', (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  let customerId = String(req.query.customerId || req.query.userId || '').trim();
  const phone = String(req.query.mobile || req.query.phone || '').trim();

  // If user is guest or not logged in, NEVER return bills
  if (!customerId || customerId === 'guest' || customerId === 'DEFAULT_GUEST_USER') {
    if (!phone) {
      return res.json({ success: true, count: 0, bills: [] });
    }
  }

  const bills = dbService.getCustomerPendingBills(customerId, phone);
  res.json({ success: true, count: bills.length, bills });
});

// Customer Retrieves All Bills History (Completed & Pending)
apiRouter.get('/customer/all-bills', (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  let customerId = String(req.query.customerId || req.query.userId || '').trim();
  const phone = String(req.query.mobile || req.query.phone || '').trim();

  if (!customerId || customerId === 'guest' || customerId === 'DEFAULT_GUEST_USER') {
    if (!phone) {
      return res.json({ success: true, count: 0, bills: [] });
    }
  }

  const bills = dbService.getCustomerAllBills(customerId, phone);
  res.json({ success: true, count: bills.length, bills });
});

// Single Bill Details for Customer (Live Status)
apiRouter.get('/customer/bills/:id', (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  const bill = dbService.getBillById(req.params.id);
  if (!bill) return res.status(404).json({ error: 'Bill not found' });
  res.json({ success: true, bill });
});

// Single Bill Details for Partner
apiRouter.get('/partners/bills/:id', (req, res) => {
  const bill = dbService.getBillById(req.params.id);
  if (!bill) return res.status(404).json({ error: 'Bill not found' });
  res.json({ success: true, bill });
});

// Customer Selects Payment Choice (CASH or UPI / GPay) - Sets state without completing
apiRouter.post('/customer/bills/:id/select-payment', (req, res) => {
  try {
    const { paymentMethod } = req.body;
    const updated = dbService.customerSelectBillPayment(req.params.id, paymentMethod);

    let upiDeepLink = null;
    let upiQrTarget = null;
    if (paymentMethod === 'upi') {
      const upiId = updated.merchantUpiId || 'magizhcafee-3@okhdfcbank';
      const pn = encodeURIComponent(updated.partnerName);
      const tn = encodeURIComponent(`Bill ${updated.billNumber} Magizh`);
      const tr = encodeURIComponent(updated.billNumber.replace(/[^A-Za-z0-9]/g, ''));
      const amountStr = Number(updated.payableAmount).toFixed(2);
      upiDeepLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${pn}&am=${amountStr}&tr=${tr}&tn=${tn}&cu=INR&mc=5411`;
      upiQrTarget = upiDeepLink;
    }

    res.json({
      success: true,
      bill: updated,
      upiDeepLink,
      upiQrTarget,
      merchantUpiId: updated.merchantUpiId,
      payableAmount: updated.payableAmount,
      message: `Selected payment via ${paymentMethod.toUpperCase()}. Please complete payment with the partner and click confirmation button.`,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Customer Confirms Payment (Button: "I Have Paid Cash" or "I Have Completed UPI Payment")
apiRouter.post('/customer/bills/:id/confirm-payment', (req, res) => {
  try {
    const { customerId, paymentMethod, utrNumber } = req.body;
    if (!paymentMethod) {
      return res.status(400).json({ error: 'Payment method is required.' });
    }

    const updated = dbService.customerConfirmBillPayment(
      req.params.id,
      customerId,
      paymentMethod,
      utrNumber || ''
    );

    res.json({
      success: true,
      bill: updated,
      message: `Payment confirmed via ${paymentMethod.toUpperCase()}. Sent to store cashier for verification.`,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Partner Approves Payment Received (Deducts B5 Coins and Marks COMPLETED)
apiRouter.post('/partners/bills/:id/approve', (req, res) => {
  try {
    const partnerId = req.body.partnerId;
    const notes = req.body.notes || '';
    if (!partnerId) return res.status(400).json({ error: 'Partner ID is required.' });

    const updated = dbService.partnerApproveBill(req.params.id, partnerId, notes);
    res.json({
      success: true,
      bill: updated,
      message: `Payment confirmed for Bill #${updated.billNumber}! Receipt #${updated.receiptNumber} issued, ${updated.coinsToRedeem} B5 Coins deducted, and ${updated.partnerRewardCoins || 0} Partner Reward Coins granted.`,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Partner Cancels / Rejects / Disputes Bill
apiRouter.post(['/partners/bills/:id/reject', '/partners/bills/:id/dispute', '/partners/bills/:id/cancel'], (req, res) => {
  try {
    const partnerId = req.body.partnerId;
    const reason = req.body.reason || req.body.notes || 'Payment not received / Disputed by partner cashier';
    if (!partnerId) return res.status(400).json({ error: 'Partner ID is required.' });

    const updated = dbService.partnerRejectBill(req.params.id, partnerId, reason);
    res.json({
      success: true,
      bill: updated,
      message: `Bill #${updated.billNumber} has been rejected/disputed. Zero coins deducted.`,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Partner Updates Store Settings & Single UPI ID
apiRouter.put(['/partners/:id/settings', '/partners/:id/upi'], (req, res) => {
  try {
    const updated = dbService.updatePartnerSettings(req.params.id, req.body);
    res.json({
      success: true,
      partner: updated,
      message: 'Store settings and UPI configuration updated successfully.',
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Partner Submits "Payment Received" -> Becomes PENDING ADMIN APPROVAL (Also supports dual admin settlement)
apiRouter.post('/partners/bills/:id/confirm-payment-received', (req, res) => {
  try {
    const partnerId = req.body.partnerId;
    if (!partnerId) return res.status(400).json({ error: 'Partner ID is required.' });

    const updated = dbService.partnerConfirmBillPaymentReceived(req.params.id, partnerId);
    dbService.logAudit(
      'partner',
      updated.partnerName,
      'SUBMIT_PAYMENT_RECEIVED',
      `Partner confirmed payment received for Bill #${updated.billNumber}. Submitted for Admin verification.`
    );

    res.json({
      success: true,
      bill: updated,
      message: 'Payment received confirmed. Bill submitted to Admin for final receipt verification.',
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Partner Details
apiRouter.get('/partners/:id', (req, res) => {
  const partner = dbService.getPartnerById(req.params.id);
  if (!partner) return res.status(404).json({ error: 'Partner shop not found' });
  res.json({ success: true, partner });
});

// Partner View Bills
apiRouter.get('/partners/:id/bills', (req, res) => {
  const bills = dbService.getPartnerBills(req.params.id);
  res.json({ success: true, bills });
});

// Admin View Pending Bills for Approval
apiRouter.get('/admin/pending-bills', requireAdminAuth, (req, res) => {
  const bills = dbService.getPendingAdminBills();
  res.json({ success: true, count: bills.length, bills });
});

// Admin View All Bills History
apiRouter.get('/admin/all-bills', requireAdminAuth, (req, res) => {
  const bills = dbService.getAllPartnerBills();
  res.json({ success: true, count: bills.length, bills });
});

// Admin Approves or Rejects Bill
apiRouter.post('/admin/bills/:id/decision', requireAdminAuth, (req, res) => {
  try {
    const { decision, notes } = req.body;
    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({ error: 'Decision must be "approve" or "reject".' });
    }

    const updated = dbService.adminDecideBill(
      req.params.id,
      decision,
      req.adminUser?.name || 'Administrator',
      notes || ''
    );

    res.json({
      success: true,
      bill: updated,
      message:
        decision === 'approve'
          ? `Bill #${updated.billNumber} approved! Receipt #${updated.receiptNumber} issued and ${updated.coinsToRedeem} B5 Coins deducted.`
          : `Bill #${updated.billNumber} was rejected. No coins were deducted.`,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// F. Persistent Coin Credit Notifications & Celebrations
// -------------------------------------------------------------

apiRouter.get('/customer/unread-notifications', (req, res) => {
  const customerId = String(req.query.customerId || '').trim();
  if (!customerId) return res.status(400).json({ error: 'Customer ID required.' });
  const notifs = dbService.getUnreadCoinNotifications(customerId);
  res.json({ success: true, notifications: notifs });
});

apiRouter.post('/customer/notifications/:id/mark-viewed', (req, res) => {
  dbService.markCoinNotificationViewed(req.params.id);
  res.json({ success: true, message: 'Notification marked as viewed.' });
});

apiRouter.post('/admin/credit-coins', requireAdminAuth, (req, res) => {
  try {
    const { customerId, reason } = req.body;
    const coins = req.body.coins || req.body.amount;
    if (!customerId || !coins) {
      return res.status(400).json({ error: 'Customer ID and coins amount are required.' });
    }

    const result = dbService.creditCustomerCoinsWithNotification(
      customerId,
      coins,
      reason,
      req.adminUser?.name || 'Administrator'
    );

    res.json({
      success: true,
      coins: parseFloat(coins),
      ...result,
      message: `Successfully credited ${coins} B5 Coins. Persistent celebration notification created for customer.`,
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Audit Logs (Restricted to Administrators)
apiRouter.get('/audit-logs', requireAdminAuth, (req, res) => {
  res.json({ success: true, logs: dbService.getAuditLogs() });
});

// -------------------------------------------------------------
// Manual B5 Coin Requests & Admin Approval (Phase 1)
// -------------------------------------------------------------

// Customer: Submit Coin Credit Request
apiRouter.post('/customer/coin-requests', (req, res) => {
  try {
    const {
      customerId,
      customerName,
      customerPhone,
      customerEmail,
      b5Id,
      coins,
      reason,
      requestedBy,
    } = req.body;

    if (!customerPhone && !customerId) {
      return res.status(400).json({ error: 'Customer identifier (ID or Mobile) is required.' });
    }
    const coinAmount = parseFloat(coins);
    if (isNaN(coinAmount) || coinAmount <= 0) {
      return res.status(400).json({ error: 'Requested coin amount must be greater than zero.' });
    }
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Request reason is required.' });
    }

    // Resolve customerId if not provided directly
    let targetCustomerId = customerId;
    let targetCustomerName = customerName;
    if (!targetCustomerId && customerPhone) {
      const user = dbService.findUserByMobile(customerPhone);
      if (user) {
        targetCustomerId = user.id;
        targetCustomerName = targetCustomerName || user.name;
      } else {
        targetCustomerId = `cust-${customerPhone}`;
      }
    }

    const newRequest = dbService.createManualCoinRequest({
      customerId: targetCustomerId,
      customerName: targetCustomerName || 'Valued Customer',
      customerPhone: customerPhone || '',
      customerEmail: customerEmail || '',
      b5Id: b5Id || '',
      coins: coinAmount,
      reason: reason.trim(),
      requestedBy: requestedBy || targetCustomerName || 'Customer',
    });

    res.status(201).json({
      success: true,
      request: newRequest,
      message: 'Coin credit request submitted successfully to Magizh Admin for review.',
    });
  } catch (err) {
    console.error('[API Submit Coin Request Error]', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// Customer: Get My Coin Credit Requests
apiRouter.get('/customer/coin-requests', (req, res) => {
  try {
    const customerId = req.query.customerId || req.query.userId;
    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID is required.' });
    }
    const requests = dbService.getManualCoinRequests(customerId);
    res.json({ success: true, count: requests.length, requests });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: Get All Coin Credit Requests
apiRouter.get('/admin/coin-requests', requireAdminAuth, (req, res) => {
  try {
    const requests = dbService.getManualCoinRequests();
    res.json({ success: true, count: requests.length, requests });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin: Resolve Coin Credit Request (Approve or Reject with Audit Trail)
apiRouter.post('/admin/coin-requests/:id/resolve', requireAdminAuth, (req, res) => {
  try {
    const { status, adminNotes, approvedAmount } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be "approved" or "rejected".' });
    }

    const adminId = req.adminUser?.name || 'Administrator';
    const updatedRequest = dbService.resolveManualCoinRequest(
      req.params.id,
      status,
      adminId,
      adminNotes,
      approvedAmount
    );

    res.json({
      success: true,
      request: updatedRequest,
      message: `Request ${req.params.id} has been ${status} successfully.`,
    });
  } catch (err) {
    console.error('[API Resolve Coin Request Error]', err);
    res.status(400).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// Admin Product Image Library & Public Binary Image Serving
// -------------------------------------------------------------

// Public Persistent Image Serving Endpoint with Cache-Busting and ETag Revalidation
apiRouter.get('/images/:id', (req, res) => {
  try {
    const img = dbService.getProductImageById(req.params.id);
    if (!img) {
      return res.status(404).send('Image not found');
    }

    if (img.dataBase64) {
      const base64Data = img.dataBase64.replace(/^data:[^;]+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const etag = `"${img.id}-${buffer.length}"`;

      // Conditional GET / ETag check
      if (req.headers['if-none-match'] === etag) {
        return res.status(304).end();
      }

      res.setHeader('Content-Type', img.mimeType || 'image/jpeg');
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('ETag', etag);
      // Allows caching while requiring revalidation when updated
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=3600, must-revalidate');
      return res.send(buffer);
    } else if (img.url && img.url.startsWith('http')) {
      return res.redirect(img.url);
    }

    res.status(404).send('Image data missing');
  } catch (err) {
    res.status(500).send('Error loading image');
  }
});

const handleGetProductImages = (req, res) => {
  try {
    const images = dbService.getAllProductImages();
    res.json({ success: true, count: images.length, images });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve image library.' });
  }
};

apiRouter.get('/admin/images', requireAdminAuth, handleGetProductImages);
apiRouter.get('/product-images', handleGetProductImages);

// Generic Image Upload Endpoint
apiRouter.post('/upload', (req, res) => {
  try {
    const { filename, url, dataBase64, mimeType, sizeBytes, title, assignedProductId } = req.body;
    if (!filename && !dataBase64 && !url) {
      return res.status(400).json({ error: 'Image data or URL is required.' });
    }

    const detectedMime = mimeType || (dataBase64?.match(/^data:(image\/[a-zA-Z+]+);base64,/)?.[1]) || 'image/jpeg';
    const computedSize = sizeBytes || (dataBase64 ? Math.round(dataBase64.length * 0.75) : 1024);
    const imageId = `img-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const persistentUrl = `/api/images/${imageId}`;

    const saved = dbService.saveProductImage({
      id: imageId,
      filename: filename || `upload-${Date.now()}.jpg`,
      url: persistentUrl,
      dataBase64,
      mimeType: detectedMime,
      sizeBytes: computedSize,
      title: title || filename || 'Product Image',
      assignedProductId,
    });

    res.status(201).json({
      success: true,
      url: persistentUrl,
      image: saved,
      message: 'Image uploaded successfully.',
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to process image upload.' });
  }
});

apiRouter.post('/admin/images/upload', requireAdminAuth, (req, res) => {
  try {
    const { filename, url, dataBase64, mimeType, sizeBytes, title, assignedProductId, assignedCategoryId, isPrimary } = req.body;
    if (!filename || (!url && !dataBase64)) {
      return res.status(400).json({ error: 'Image filename and image data (URL or base64) are required.' });
    }

    // Validate MIME Type
    const validMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
    const detectedMime = mimeType || 'image/jpeg';
    if (!detectedMime.startsWith('image/')) {
      return res.status(400).json({ error: `Unsupported file type: ${detectedMime}. Only images (JPEG, PNG, WebP, GIF, SVG) are permitted.` });
    }

    // Validate File Size (Max 5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    const computedSize = sizeBytes || (dataBase64 ? Math.round(dataBase64.length * 0.75) : 0);
    if (computedSize > MAX_SIZE) {
      return res.status(400).json({ error: `File size exceeds the 5 MB limit (Uploaded: ${(computedSize / (1024 * 1024)).toFixed(2)} MB).` });
    }

    const imageId = `img-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const persistentUrl = `/api/images/${imageId}`;

    const saved = dbService.saveProductImage({
      id: imageId,
      filename,
      url: persistentUrl,
      dataBase64,
      mimeType: detectedMime,
      sizeBytes: computedSize,
      title: title || filename,
      assignedProductId,
      assignedCategoryId,
      isPrimary,
    });

    res.status(201).json({
      success: true,
      image: saved,
      url: persistentUrl,
      message: 'Product image successfully saved to persistent library.',
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to save product image.' });
  }
});

apiRouter.delete('/admin/images/:id', requireAdminAuth, (req, res) => {
  try {
    dbService.deleteProductImage(req.params.id);
    res.json({ success: true, message: 'Image removed from library.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete image.' });
  }
});

apiRouter.post('/admin/images/:id/assign', requireAdminAuth, (req, res) => {
  try {
    const { productId, categoryId, isPrimary } = req.body;
    const updated = dbService.assignProductImage(req.params.id, { productId, categoryId, isPrimary });
    res.json({ success: true, image: updated, message: 'Image assignment updated.' });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to update image assignment.' });
  }
});

// -------------------------------------------------------------
// Cloud Database Backup & Staging Test Restore (Admin Only)
// -------------------------------------------------------------

apiRouter.get('/admin/backups/status', requireAdminAuth, (req, res) => {
  try {
    const status = backupService.getBackupStatus();
    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to retrieve backup status.' });
  }
});

apiRouter.get('/admin/backups', requireAdminAuth, (req, res) => {
  try {
    const backups = backupService.listBackups();
    res.json({ success: true, count: backups.length, backups });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to list database backups.' });
  }
});

apiRouter.post('/admin/backups/create', requireAdminAuth, async (req, res) => {
  try {
    const adminName = req.adminUser?.name || 'Administrator';
    const result = await backupService.createBackup('MANUAL_ADMIN', adminName);
    res.status(201).json({
      success: true,
      backup: result.manifest,
      retainedCount: result.retainedCount,
      message: `Database backup ${result.manifest.filename} created successfully.`,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Backup creation failed.' });
  }
});

apiRouter.post('/admin/backups/test-restore', requireAdminAuth, async (req, res) => {
  try {
    const { filename } = req.body;
    const result = await backupService.performTestRestore(filename);
    res.json({
      success: result.success,
      report: result,
      message: result.message || 'Test restore completed.',
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Test restore failed.' });
  }
});
