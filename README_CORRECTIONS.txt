================================================================================
MAGIZH SHOPPING - ONLY CORRECTED FILES PACKAGE
Generated Date: 2026-11-21 23:09:47
================================================================================

This archive contains ONLY the files modified and created for the latest Magizh
Shopping corrections round:

1. WEBSITE INTRO VIDEO:
   - public/magizh_intro.mp4 (Full authentic opening video)
   - public/magizh_logo.jpg (Fallback brand logo)
   - src/components/common/IntroVideoModal.tsx (Zero skip/close, full screen, aspect ratio preserved)
   - src/App.tsx (Seamless entry and sessionStorage isolation)

2. B5 COIN TRANSACTION HISTORY (-50 in Red):
   - src/components/customer/B5CoinWalletPage.tsx (Strict isDebit, text-rose-600, minus sign)
   - src/services/storage.ts (Debit transaction recording)
   - server/db.js (Debit transaction persistence in SQLite coin_ledger)

3. PARTNER STORE IMAGES (Up to 4 Photos):
   - server/db.js (store_images_json column, updatePartnerStoreImages)
   - server/api.js (POST /partners/:id/store-images)
   - src/types/index.ts (storeImages in PartnerShop interface)
   - src/components/partner/PartnerDashboard.tsx (Upload, preview, replace, delete 4 images)
   - src/components/customer/PartnerShopsDirectory.tsx (4-image responsive showcase gallery)

4. ADMIN ORDERS CROSS-DEVICE LIVE SYNC:
   - server/api.js (GET /api/orders with strict no-cache headers)
   - src/components/admin/AdminPanel.tsx (Authoritative live DB polling every 4s, Live Sync button)

5. DATABASE ARCHITECTURE & SQLITE PERSISTENCE:
   - server/data/magizh.sqlite (Authoritative persistent SQLite database with verified customer accounts)
   - dist/ (Fresh production build bundle)
================================================================================
