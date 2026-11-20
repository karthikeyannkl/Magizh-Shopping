================================================================================
MAGIZH SHOPPING – ONLY CORRECTED FILES PACKAGE
================================================================================
Archive: Magizh_Shopping_Only_Corrected_Files.zip
Generated: 2026-11-20
Status: Fully Verified & Decoupled from B5 Level Tracking
================================================================================

இந்த ZIP தொகுப்பில் கடைசியாக Magizh Shopping-க்காகத் திருத்தப்பட்ட Files மற்றும் 
அதனுடன் தொடர்புடைய புதிய Files மட்டுமே உள்ளன.

இதில் எந்தவொரு தேவையற்ற B5 Level Tracking Files, B5 Cloud Microservice, 
அல்லது முழு திட்டக் கோப்புகளும் சேர்க்கப்படவில்லை.

================================================================================
1. இந்த தொகுப்பில் உள்ள கோப்புகளின் பட்டியல் (LIST OF FILES INCLUDED)
================================================================================

A. கடைசியாக திருத்தப்பட்ட முதன்மைக் கோப்புகள் (MODIFIED CORE FILES):
--------------------------------------------------------------------------------
1.  src/components/common/CustomerHeader.tsx
    - Customer Header-லிருந்து Partner App லிங்க் நீக்கப்பட்டது.
    - Customer பெயர் click ஆகும்படி மாற்றப்பட்டு, 6-பிரிவு Account Dropdown Menu சேர்க்கப்பட்டது.
2.  src/components/common/CustomerFooter.tsx
    - Partner Portal மற்றும் Admin Console லிங்க்குகள் நீக்கப்பட்டன.
3.  src/components/common/BottomNav.tsx
    - வாடிக்கையாளர் பக்கங்களில் Admin/Partner/Sales லிங்க்குகள் வராதபடி guard சேர்க்கப்பட்டது.
4.  src/components/customer/HomePage.tsx
    - Coming Soon தயாரிப்புகளுக்கு விலை, சேமிப்பு, Add to Cart, Buy Now மறைக்கப்பட்டது.
5.  src/components/customer/ProductDetailModal.tsx
    - Coming Soon தயாரிப்புகளுக்கு விலை மறைக்கப்பட்டு "Coming Soon • Available Shortly" banner காட்டப்படுகிறது.
6.  src/components/admin/AdminSidebar.tsx
    - In-Store POS Bills நீக்கப்பட்டு, Customers மற்றும் Payments அடங்கிய 14 Tabs Sidebar.
7.  src/components/admin/AdminPanel.tsx
    - Product Coming Soon Availability Selector & Variant Toggle.
    - 5 தனித்தனி Order Tabs (All, Payment Verify, Processing, Shipping, Cancelled).
    - Status Dropdown நீக்கப்பட்டு Contextual Action Buttons சேர்க்கப்பட்டன.
    - புதிய Customer Directory & Accounts Management பிரிவு.
    - புதிய Payment & UTR Transaction Ledger (1-Click Copy வசதியுடன்).
    - Partner Toggle backend API sync நிரந்தர தீர்வு.
8.  src/services/storage.ts
    - Coming Soon தயாரிப்புகளை cart-ல் சேர்க்க முடியாதபடி தடுப்பு.
9.  server/api.js
    - Coming Soon ஆர்டர்கள் தடுப்பு (HTTP 400).
    - GET /api/admin/customers மற்றும் GET /api/admin/payments endpoints.
    - POST /api/admin/orders/:id/reject-payment endpoint.
    - B5 Cloud API bridge அகற்றப்பட்டு Magizh நேரடி coin lookup இணைக்கப்பட்டது.
10. server/db.js
    - getCustomers() வாடிக்கையாளர் ஆர்டர் aggregation.
    - updatePartnerStatus() status மற்றும் application_status இரண்டையும் sync செய்கிறது.

B. முந்தைய திருத்தங்களில் சேர்க்கப்பட்ட/மேம்படுத்தப்பட்ட கோப்புகள் (COMPANION FILES):
--------------------------------------------------------------------------------
11. src/App.tsx
    - தூய்மையான Magizh Shopping Routing (Customer, Partner, Admin).
    - Level Tracking மற்றும் B5 Cloud imports அகற்றப்பட்டு Pure Shopping ஆக மாற்றப்பட்டது.
12. src/components/common/AdminHeader.tsx
    - Admin தனித்துவ Top Header (Logout & Storefront Jump).
13. src/components/common/AdminAuthGuard.tsx
    - Admin கடவுச்சொல் மற்றும் Session பாதுகாப்பு.
14. src/components/common/PartnerHeader.tsx
    - Franchise Partner கடை Top Header.
15. src/components/common/PartnerAuthGuard.tsx
    - Partner மொபைல் & கடவுச்சொல் Login Guard.
16. src/components/admin/ImageGalleryModal.tsx
    - மறுபயன்பாட்டு Permanent Image Gallery Modal.
17. src/components/admin/ImageUploadField.tsx
    - நேரடி படம் பதிவேற்றம் மற்றும் கேலரி தேர்வு.
18. src/components/customer/PartnerShopsDirectory.tsx
    - வாடிக்கையாளர் அருகிலுள்ள Franchise கடைகளைக் கண்டறியும் பக்கம்.
19. src/components/partner/PartnerDashboard.tsx
    - 100% பாதுகாக்கப்பட்ட In-Store POS Walk-in Billing, Customer Coin கழிவு.
20. src/components/customer/CheckoutFlow.tsx
    - 12-Digit UTR செலுத்துகை சரிபார்ப்பு மற்றும் B5 Coin கழிவு.
21. src/components/customer/OrderHistoryAndTracking.tsx
    - ஆர்டர் வரலாறு மற்றும் டெலிவரி நிலை.
22. src/components/customer/CustomerAccount.tsx
    - வாடிக்கையாளர் சுயவிவரம் மற்றும் முகவரி மேலாளர்.
23. src/components/customer/B5CoinWalletPage.tsx
    - வாடிக்கையாளர் B5 Coin இருப்பு, பரிவர்த்தனை வரலாறு, 1 Coin = ₹1 விதிகள்.

================================================================================
2. ORIGINAL PROJECT-ல் இந்த கோப்புகளை எங்கு வைக்க வேண்டும்? (HOW TO APPLY)
================================================================================
இந்த ZIP-ல் உள்ள கோப்புகள் ஏற்கெனவே உங்கள் திட்டத்தின் சரியான Folder Structure-ல் 
அமைக்கப்பட்டுள்ளன:

Original Project Folder:
[PROJECT_ROOT]
  ├── server/
  │     ├── api.js                <-- Replace server/api.js
  │     └── db.js                 <-- Replace server/db.js
  └── src/
        ├── App.tsx               <-- Replace src/App.tsx
        ├── services/
        │     └── storage.ts      <-- Replace src/services/storage.ts
        └── components/
              ├── admin/
              │     ├── AdminPanel.tsx
              │     ├── AdminSidebar.tsx
              │     ├── ImageGalleryModal.tsx
              │     └── ImageUploadField.tsx
              ├── common/
              │     ├── CustomerHeader.tsx
              │     ├── CustomerFooter.tsx
              │     ├── BottomNav.tsx
              │     ├── AdminHeader.tsx
              │     ├── AdminAuthGuard.tsx
              │     ├── PartnerHeader.tsx
              │     └── PartnerAuthGuard.tsx
              ├── customer/
              │     ├── HomePage.tsx
              │     ├── ProductDetailModal.tsx
              │     ├── CheckoutFlow.tsx
              │     ├── OrderHistoryAndTracking.tsx
              │     ├── CustomerAccount.tsx
              │     ├── B5CoinWalletPage.tsx
              │     └── PartnerShopsDirectory.tsx
              └── partner/
                    └── PartnerDashboard.tsx

வழிமுறை:
1. உங்கள் Original Project-ஐ முதலில் ஒரு Backup எடுத்துக்கொள்ளவும்.
2. இந்த ZIP-ஐ unzip செய்து, அதிலுள்ள 'src' மற்றும் 'server' கோப்புறைகளை 
   உங்கள் Original Project-ன் மூல அடைவில் (Project Root) Overwrite செய்யவும்.

================================================================================
3. புதிய DEPENDENCIES தேவையா? (DEPENDENCY CHECK)
================================================================================
எந்தவொரு புதிய External NPM Package-ம் தேவையில்லை!
ஏற்கெனவே உங்கள் திட்டத்தில் உள்ள standard dependencies மட்டுமே போதுமானது:
- react & react-dom
- lucide-react (Icons)
- express, cors, dotenv
- sql.js (WebAssembly SQLite)

================================================================================
4. எந்த FILES-ஐ மாற்றவோ அழிக்கவோ கூடாது? (DO NOT MODIFY / DO NOT TOUCH)
================================================================================
கீழே உள்ள கோப்புகளை எக்காரணம் கொண்டும் மாற்றவோ அழிக்கவோ கூடாது:
1. server/data/magizh.sqlite (உண்மையான Customer Data, Orders, Products, Coin Accounts)
2. server/data/backup-status.json
3. public/images/ மற்றும் public/uploads/ (அனைத்து 15 தயாரிப்பு புகைப்படங்கள்)
4. package.json மற்றும் package-lock.json
5. tsconfig.json, vite.config.ts, tailwind.config.js, index.html

================================================================================
5. மாற்றிய பிறகு என்னென்ன TEST செய்ய வேண்டும்? (POST-UPDATE VERIFICATION)
================================================================================
கோப்புகளை மாற்றிய பிறகு கீழ்க்கண்டவற்றைச் சரிபார்க்கவும்:

1. Terminal Build Test:
   npm run build
   --> Zero errors-டன் விநாடிகளில் build நிறைவடைய வேண்டும்.

2. Customer Header Check:
   - Header-ல் "Partner App" லிங்க் இல்லை என்பதை உறுதிப்படுத்தவும்.
   - Profile-ல் வாடிக்கையாளர் பெயர் Click ஆகி 6 Options உள்ள Account Menu வருகிறதா என்று பார்க்கவும்.

3. Coming Soon Product Check:
   - Admin-ல் ஒரு தயாரிப்பை "Coming Soon" என மாற்றவும்.
   - வாடிக்கையாளர் முகப்புப் பக்கத்தில் விலை மற்றும் Add to Cart மறைந்து "Coming Soon" Badge வருகிறதா எனப் பார்க்கவும்.

4. Admin Orders Pipeline Check:
   - Orders பக்கத்தில் 5 Tabs (All, Payment Verify, Processing, Shipping, Cancelled) உள்ளதா எனப் பார்க்கவும்.
   - പഴയ Status Dropdown இல்லாமல் Confirm / Reject பட்டன்கள் வருகிறதா எனப் பார்க்கவும்.

5. Admin Customers & Payments Check:
   - Admin Sidebar-ல் Customers கிளிக் செய்து வாடிக்கையாளர்கள் பட்டியல் வருகிறதா எனப் பார்க்கவும்.
   - Payments கிளிக் செய்து UTR Copy வசதி இயங்குகிறதா எனப் பார்க்கவும்.

6. B5 Coin Wallet Check:
   - வாடிக்கையாளர் Coin Balance சரியாகக் காட்டப்படுகிறதா என்று பார்க்கவும்.
================================================================================
