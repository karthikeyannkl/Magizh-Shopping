import React, { useState, useEffect } from 'react';
import {
  Store,
  MapPin,
  Search,
  Coins,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Receipt,
  AlertCircle,
  X,
  Phone,
  Sparkles,
  QrCode,
  Smartphone,
  Banknote,
  Clock,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  CreditCard,
  XCircle,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react';
import { StorageService, subscribe } from '../../services/storage';
import { PartnerShop, PartnerBill, User } from '../../types';

interface PartnerShopsDirectoryProps {
  onBackToShopping: () => void;
}

export const PartnerShopsDirectory: React.FC<PartnerShopsDirectoryProps> = ({ onBackToShopping }) => {
  const [currentUser, setCurrentUser] = useState<User>(() => StorageService.getCustomerUser());
  const [partners, setPartners] = useState<PartnerShop[]>(StorageService.getApprovedPartners());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('All');
  const [coinBalance, setCoinBalance] = useState(
    StorageService.getCoinAccount(currentUser?.id || '').availableBalance
  );

  // In-Store Live Bills State (from Server DB)
  const [pendingBills, setPendingBills] = useState<PartnerBill[]>([]);
  const [activeBillModal, setActiveBillModal] = useState<PartnerBill | null>(null);
  const [selectedPaymentMode, setSelectedPaymentMode] = useState<'upi' | 'cash' | null>(null);
  const [isUpdatingPaymentMode, setIsUpdatingPaymentMode] = useState(false);
  const [completedBillReceipt, setCompletedBillReceipt] = useState<PartnerBill | null>(null);
  const [upiUtrInput, setUpiUtrInput] = useState('');
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // In-Store Estimate Calculator State
  const [activeShopForPay, setActiveShopForPay] = useState<PartnerShop | null>(null);
  const [billAmount, setBillAmount] = useState<number>(500);
  const [coinsToRedeem, setCoinsToRedeem] = useState<number>(0);

  // Store View Modal & Purchase History State
  const [selectedStoreModal, setSelectedStoreModal] = useState<PartnerShop | null>(null);
  const [activeStoreImageIdx, setActiveStoreImageIdx] = useState(0);
  const [directoryViewMode, setDirectoryViewMode] = useState<'shops' | 'history'>('shops');
  const [pastBills, setPastBills] = useState<PartnerBill[]>([]);

  const fetchPastBills = async () => {
    if (!currentUser || !currentUser.id || currentUser.isGuest) return;
    try {
      const res = await fetch(
        `/api/customer/all-bills?customerId=${encodeURIComponent(currentUser.id)}&mobile=${encodeURIComponent(
          currentUser.mobile || ''
        )}&_t=${Date.now()}`,
        { cache: 'no-store' }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.bills)) {
          const completed = data.bills.filter((b: PartnerBill) => b.status === 'COMPLETED');
          setPastBills(completed);
        }
      }
    } catch {}
  };

  // Fetch pending bills for this customer from authoritative backend
  const fetchPendingBills = async () => {
    if (!currentUser || !currentUser.id || currentUser.isGuest) {
      setPendingBills([]);
      return;
    }
    try {
      const res = await fetch(
        `/api/customer/pending-bills?customerId=${encodeURIComponent(currentUser.id)}&mobile=${encodeURIComponent(
          currentUser.mobile || ''
        )}&_t=${Date.now()}`,
        { cache: 'no-store' }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.bills)) {
          // Strict account isolation: verify bill belongs to this customer ID or phone
          const customerBills = data.bills.filter((b: PartnerBill) => {
            const matchId = b.customerId && b.customerId === currentUser.id;
            const matchPhone = currentUser.mobile && b.customerPhone === currentUser.mobile;
            return matchId || matchPhone;
          });
          setPendingBills(customerBills);

          // If a modal bill is currently open, refresh its state or detect completion
          if (activeBillModal) {
            const updated = customerBills.find((b: PartnerBill) => b.id === activeBillModal.id);
            if (updated) {
              if (updated.status === 'COMPLETED') {
                setCompletedBillReceipt(updated);
                setActiveBillModal(null);
                setCoinBalance(StorageService.getCoinAccount(currentUser.id).availableBalance);
              } else {
                setActiveBillModal(updated);
              }
            } else {
              // Direct single bill check in case it transitioned to completed
              fetch(`/api/customer/bills/${activeBillModal.id}?_t=${Date.now()}`, { cache: 'no-store' })
                .then((r) => r.json())
                .then((singleData) => {
                  if (singleData.success && singleData.bill) {
                    const isForThisUser =
                      singleData.bill.customerId === currentUser.id ||
                      (currentUser.mobile && singleData.bill.customerPhone === currentUser.mobile);
                    if (isForThisUser) {
                      if (singleData.bill.status === 'COMPLETED') {
                        setCompletedBillReceipt(singleData.bill);
                        setActiveBillModal(null);
                        setCoinBalance(StorageService.getCoinAccount(currentUser.id).availableBalance);
                      } else {
                        setActiveBillModal(singleData.bill);
                      }
                    }
                  }
                })
                .catch(() => {});
            }
          }
        }
      }
    } catch {
      // Background sync fail silent
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchPendingBills();
    fetchPastBills();

    // Poll every 2.5 seconds for instant status synchronization
    const interval = setInterval(fetchPendingBills, 2500);

    const unsubUser = subscribe('currentUserChanged', (u: User) => {
      const activeUser = u || StorageService.getCustomerUser();
      setCurrentUser(activeUser);
      setCoinBalance(StorageService.getCoinAccount(activeUser?.id || '').availableBalance);
      // Immediately clear old bills
      setPendingBills([]);
      setActiveBillModal(null);
      setCompletedBillReceipt(null);
    });

    const unsubPartners = subscribe('partnersChanged', () => {
      setPartners(StorageService.getApprovedPartners());
    });
    const unsubCoin = subscribe('coinAccountChanged', () => {
      const activeUser = StorageService.getCustomerUser();
      setCoinBalance(StorageService.getCoinAccount(activeUser?.id || '').availableBalance);
    });

    return () => {
      clearInterval(interval);
      unsubUser();
      unsubPartners();
      unsubCoin();
    };
  }, [currentUser?.id, currentUser?.mobile, activeBillModal?.id]);

  const districts = ['All', ...new Set(partners.map((p) => p.district))];

  const filteredPartners = partners.filter((p) => {
    const matchesSearch =
      p.shopName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.partnerCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.pinCode.includes(searchQuery) ||
      p.address.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDistrict = selectedDistrict === 'All' || p.district === selectedDistrict;
    return matchesSearch && matchesDistrict;
  });

  // Calculate local redemption cap for the active shop calculator
  const partnerCapPercent = activeShopForPay
    ? Math.min(50, activeShopForPay.partnerRedemptionCapPercentage || 50)
    : 50;
  const maxCapAmount = Math.floor(billAmount * (partnerCapPercent / 100));
  const maxSpendableCoins = Math.min(coinBalance, maxCapAmount);

  const handleOpenCalculator = (shop: PartnerShop) => {
    setActiveShopForPay(shop);
    setBillAmount(500);
    const initialCoins = Math.min(
      coinBalance,
      Math.floor(500 * (Math.min(50, shop.partnerRedemptionCapPercentage || 50) / 100))
    );
    setCoinsToRedeem(initialCoins);
  };

  const handleBillAmountChange = (amount: number) => {
    setBillAmount(amount);
    const newMaxCap = Math.floor(amount * (partnerCapPercent / 100));
    setCoinsToRedeem(Math.min(coinBalance, newMaxCap));
  };

  // Select Payment Option locally (Option A: UPI/GPay, Option B: Cash at Store)
  const handleSelectPaymentMethod = (method: 'upi' | 'cash') => {
    setSelectedPaymentMode(method);
    setConfirmError(null);
  };

  // Customer Confirmation Action (I Have Paid Cash / I Have Completed UPI Payment)
  const handleConfirmCustomerPayment = async (method: 'upi' | 'cash') => {
    if (!activeBillModal) return;
    setIsConfirmingPayment(true);
    setConfirmError(null);
    try {
      const res = await fetch(`/api/customer/bills/${activeBillModal.id}/confirm-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: currentUser.id,
          paymentMethod: method,
          utrNumber: method === 'upi' ? upiUtrInput.trim() : '',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setConfirmError(data.error || 'Failed to submit payment confirmation.');
      } else {
        setActiveBillModal(data.bill);
        fetchPendingBills();
      }
    } catch (err: any) {
      setConfirmError(err.message || 'Network error confirming payment.');
    } finally {
      setIsConfirmingPayment(false);
    }
  };

  // Helper to generate UPI URI according to NPCI specifications
  const getUpiUrl = (bill: PartnerBill) => {
    const shop = partners.find((p) => p.id === bill.partnerId);
    const storeUpi = bill.merchantUpiId || shop?.merchantUpiId || 'magizhcafee-3@okhdfcbank';
    const pn = encodeURIComponent(bill.partnerName || shop?.shopName || 'Magizh Partner');
    const tr = encodeURIComponent(bill.billNumber.replace(/[^A-Za-z0-9]/g, ''));
    const tn = encodeURIComponent(`Bill ${bill.billNumber} Magizh`);
    const am = Number(bill.payableAmount).toFixed(2);
    return `upi://pay?pa=${encodeURIComponent(storeUpi)}&pn=${pn}&am=${am}&cu=INR&tr=${tr}&tn=${tn}&mc=5411`;
  };

  // Helper to get QR code image URL
  const getQrImageUrl = (bill: PartnerBill) => {
    const upiUri = getUpiUrl(bill);
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=${encodeURIComponent(upiUri)}`;
  };

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 pb-28 space-y-6">
      {/* Directory Banner Header */}
      <div className="bg-gradient-to-r from-magizh-900 via-magizh-800 to-darkbrown-900 text-white rounded-3xl p-5 sm:p-7 shadow-card border border-magizh-700/50">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-b5-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Authorized Franchise Network
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black mt-1">
              Magizh Partner Stores
            </h1>
            <p className="text-xs text-cream-200 mt-1 max-w-md">
              Visit approved partner organic grocery stores across Tamil Nadu. Redeem your B5 Coins in-store (up to 50% cap) and pay the rest in cash or UPI.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/20 text-center shrink-0">
            <span className="text-[10px] text-cream-200 uppercase font-bold block">Your Available Coins</span>
            <div className="flex items-center justify-center gap-1.5 mt-0.5">
              <Coins className="w-5 h-5 text-b5-400" />
              <span className="text-2xl font-black text-white font-mono">{coinBalance}</span>
            </div>
            <span className="text-[10px] text-amber-300 font-bold block">1 B5 Coin = ₹1 Discount</span>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="mt-5 pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search partner store by name, area, or PIN code..."
              className="w-full pl-10 pr-3 py-2 text-xs text-darkbrown-900 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-magizh-400"
            />
          </div>

          <select
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            className="w-full px-3 py-2 text-xs text-darkbrown-900 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-magizh-400 font-bold"
          >
            {districts.map((d) => (
              <option key={d} value={d}>
                {d === 'All' ? 'All Districts' : d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* SECTION 6: PENDING IN-STORE PAYMENT REQUESTS */}
      {pendingBills.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <h2 className="text-sm font-black text-darkbrown-900 uppercase tracking-wide">
                Active Store Billing Requests ({pendingBills.length})
              </h2>
            </div>
            <button
              onClick={fetchPendingBills}
              className="text-xs text-magizh-800 font-bold flex items-center gap-1 hover:underline"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3.5">
            {pendingBills.map((bill) => {
              const discountPercent =
                bill.billAmount > 0
                  ? Math.round((bill.coinsToRedeem / bill.billAmount) * 100)
                  : 0;
              const isUpiSelected = bill.status === 'CUSTOMER_SELECTED_UPI';
              const isCashSelected = bill.status === 'CUSTOMER_SELECTED_CASH';

              return (
                <div
                  key={bill.id}
                  className="bg-white rounded-3xl border-2 border-amber-400/80 shadow-md p-5 space-y-4 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-cream-200">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-black">
                        <Store className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-black text-base text-darkbrown-900">
                            {bill.partnerName}
                          </h3>
                          <span className="bg-amber-100 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Bill #{bill.billNumber}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">
                          Cashier generated this bill for your in-store purchase
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {bill.status === 'COMPLETED' ? (
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Payment Completed &amp; Verified</span>
                        </span>
                      ) : bill.status === 'REJECTED' || bill.status === 'CANCELLED' ? (
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          <span>Payment Disputed / Rejected</span>
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-orange-100 text-orange-800 border border-orange-200 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-orange-600 animate-spin" />
                          <span>
                            {bill.status === 'PENDING_PARTNER_VERIFICATION' || bill.status === 'PAYMENT_CONFIRMED_BY_CUSTOMER'
                              ? 'Waiting for Cashier Verification'
                              : isUpiSelected
                              ? 'UPI Selected (Awaiting Confirmation)'
                              : isCashSelected
                              ? 'Cash Selected (Awaiting Confirmation)'
                              : 'Pending Your Payment'}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bill Financial Breakdown */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-cream-50 p-3.5 rounded-2xl border border-cream-200 text-xs">
                    <div>
                      <span className="text-[10px] text-gray-500 uppercase font-bold block">
                        Original Bill
                      </span>
                      <span className="text-sm font-black text-darkbrown-900 font-mono">
                        ₹{bill.billAmount}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-b5-700 uppercase font-bold block">
                        Coins Redeemed
                      </span>
                      <span className="text-sm font-black text-b5-700 font-mono flex items-center gap-1">
                        <Coins className="w-3.5 h-3.5" />
                        {bill.coinsToRedeem} B5
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 uppercase font-bold block">
                        Discount Cap %
                      </span>
                      <span className="text-sm font-black text-darkbrown-900 font-mono">
                        {discountPercent}% OFF
                      </span>
                    </div>
                    <div className="bg-emerald-50 p-2 rounded-xl border border-emerald-200">
                      <span className="text-[10px] text-emerald-800 uppercase font-black block">
                        Net Payable
                      </span>
                      <span className="text-base font-black text-emerald-800 font-mono">
                        ₹{bill.payableAmount}
                      </span>
                    </div>
                  </div>

                  {/* Action Button Section: Completed bills get View Receipt; Never show Proceed to Pay on Completed! */}
                  {bill.status === 'COMPLETED' ? (
                    <div className="flex items-center justify-between pt-1">
                      <p className="text-xs text-emerald-700 font-medium">
                        Receipt <strong>#{bill.receiptNumber || 'STORE-RCPT'}</strong> issued. Payment verified by cashier.
                      </p>
                      <button
                        onClick={() => setCompletedBillReceipt(bill)}
                        className="px-5 py-2.5 bg-gradient-to-r from-emerald-700 to-emerald-800 hover:from-emerald-800 hover:to-emerald-900 text-white text-xs font-black rounded-xl shadow-md transition-all flex items-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                        <span>View Store Receipt</span>
                      </button>
                    </div>
                  ) : bill.status === 'REJECTED' || bill.status === 'CANCELLED' ? (
                    <div className="flex items-center justify-between pt-1">
                      <p className="text-xs text-rose-700 font-medium">
                        Bill was rejected or cancelled by partner cashier. Zero coins deducted.
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between pt-1">
                      <p className="text-xs text-gray-600">
                        {bill.status === 'PENDING_PARTNER_VERIFICATION' || bill.status === 'PAYMENT_CONFIRMED_BY_CUSTOMER'
                          ? 'Payment confirmed by you. Waiting for cashier to approve.'
                          : 'Choose to pay via GPay / UPI or Cash at counter.'}
                      </p>
                      <button
                        onClick={() => {
                          setActiveBillModal(bill);
                          setSelectedPaymentMode(
                            bill.paymentMethod === 'cash' ? 'cash' : 'upi'
                          );
                          setUpiUtrInput(bill.utrNumber || '');
                        }}
                        className="px-5 py-2.5 bg-gradient-to-r from-magizh-800 to-magizh-900 hover:from-magizh-900 hover:to-black text-white text-xs font-black rounded-xl shadow-md transition-all flex items-center gap-2"
                      >
                        {bill.status === 'PENDING_PARTNER_VERIFICATION' || bill.status === 'PAYMENT_CONFIRMED_BY_CUSTOMER' ? (
                          <>
                            <Clock className="w-4 h-4 text-amber-400" />
                            <span>View Status (₹{bill.payableAmount})</span>
                          </>
                        ) : (
                          <>
                            <CreditCard className="w-4 h-4 text-b5-400" />
                            <span>Proceed to Pay (₹{bill.payableAmount})</span>
                            <ChevronRight className="w-4 h-4" />
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 7: CUSTOMER PAYMENT OPTIONS MODAL (GPAY / UPI vs CASH AT STORE) */}
      {activeBillModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-darkbrown-950/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-cream-300 w-full max-w-xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-magizh-900 via-magizh-800 to-darkbrown-900 text-white p-5 sticky top-0 z-10">
              <button
                onClick={() => setActiveBillModal(null)}
                className="absolute top-4 right-4 text-cream-200 hover:text-white p-1 rounded-full hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-b5-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-b5-300">
                  Store Counter Checkout
                </span>
              </div>
              <h3 className="text-lg font-black mt-0.5">{activeBillModal.partnerName}</h3>
              <p className="text-xs text-cream-200">
                Bill #{activeBillModal.billNumber} &bull; Net Payable: ₹{activeBillModal.payableAmount}
              </p>
            </div>

            <div className="p-5 space-y-5">
              {/* Bill Details Summary Card */}
              <div className="bg-cream-50 p-4 rounded-2xl border border-cream-200 space-y-2 text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>Store Name:</span>
                  <span className="font-bold text-darkbrown-900">{activeBillModal.partnerName}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Bill Reference Number:</span>
                  <span className="font-mono font-bold text-darkbrown-900">{activeBillModal.billNumber}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Original Purchase Amount:</span>
                  <span className="font-mono font-bold text-darkbrown-900">₹{activeBillModal.billAmount}</span>
                </div>
                <div className="flex justify-between text-b5-800 font-bold">
                  <span>B5 Coins Redeemed (1 B5 = ₹1):</span>
                  <span className="font-mono">-₹{activeBillModal.coinsToRedeem} ({activeBillModal.coinsToRedeem} Coins)</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Discount Applied:</span>
                  <span className="font-bold text-emerald-700">
                    {Math.round((activeBillModal.coinsToRedeem / activeBillModal.billAmount) * 100)}% Discount
                  </span>
                </div>
                <div className="flex justify-between text-base font-black text-magizh-900 pt-2 border-t border-cream-300">
                  <span>Remaining Payable Amount:</span>
                  <span className="text-lg text-emerald-800 font-mono">₹{activeBillModal.payableAmount}</span>
                </div>
              </div>

              {/* Payment Selection Tab Options (Option A vs Option B) */}
              {(() => {
                const isCompleted = activeBillModal.status === 'COMPLETED';
                const isConfirmed =
                  activeBillModal.status === 'PENDING_PARTNER_VERIFICATION' ||
                  activeBillModal.status === 'PAYMENT_CONFIRMED_BY_CUSTOMER';
                const isRejected =
                  activeBillModal.status === 'REJECTED' ||
                  activeBillModal.status === 'CANCELLED';

                if (isCompleted) {
                  return (
                    <div className="p-5 bg-emerald-50 rounded-2xl border-2 border-emerald-300 text-xs text-emerald-950 space-y-4 animate-in fade-in">
                      <div className="flex items-center gap-2 font-black text-sm text-emerald-900">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        <span>Payment Completed &amp; Verified by Store Cashier</span>
                      </div>
                      <div className="bg-white/90 p-4 rounded-xl border border-emerald-200 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Official Receipt:</span>
                          <span className="font-mono font-black text-emerald-900">
                            {activeBillModal.receiptNumber || 'RCPT-ISSUED'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Payment Mode:</span>
                          <span className="font-bold uppercase text-darkbrown-900">
                            {activeBillModal.paymentMethod || 'COUNTER'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Total Paid to Store:</span>
                          <span className="font-mono font-black text-emerald-800">
                            ₹{activeBillModal.payableAmount}
                          </span>
                        </div>
                        <div className="flex justify-between text-b5-800 font-bold pt-1 border-t border-emerald-200">
                          <span>B5 Coins Redeemed:</span>
                          <span className="font-mono">{activeBillModal.coinsToRedeem} B5 Coins (Deducted)</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-emerald-800 leading-relaxed">
                        This bill has been verified and settled. You do not need to make any further payment.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setCompletedBillReceipt(activeBillModal);
                          setActiveBillModal(null);
                        }}
                        className="w-full py-3 px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-2 transition-all"
                      >
                        <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                        <span>View Full Store Receipt</span>
                      </button>
                    </div>
                  );
                }

                if (isRejected) {
                  return (
                    <div className="p-4 bg-rose-50 rounded-2xl border border-rose-300 text-xs text-rose-900 space-y-2 animate-in fade-in">
                      <div className="flex items-center gap-2 font-black text-sm text-rose-900">
                        <XCircle className="w-5 h-5 text-rose-600" />
                        <span>Payment Disputed / Rejected by Partner Cashier</span>
                      </div>
                      <p className="text-[11px] text-rose-800">
                        Reason: {activeBillModal.rejectionReason || 'Payment was not verified by the cashier'}. Zero B5 Coins were deducted from your wallet.
                      </p>
                    </div>
                  );
                }

                if (isConfirmed) {
                  return (
                    <div className="p-5 bg-amber-50 rounded-2xl border-2 border-amber-300 text-xs text-amber-950 space-y-3 animate-in fade-in">
                      <div className="flex items-center gap-2 font-black text-sm text-amber-900">
                        <Clock className="w-5 h-5 text-amber-600 animate-spin" />
                        <span>Waiting for Partner Cashier Verification</span>
                      </div>
                      <div className="bg-white/80 p-3.5 rounded-xl border border-amber-200 space-y-1.5">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Confirmed Payment Method:</span>
                          <span className="font-black uppercase text-darkbrown-900">{activeBillModal.paymentMethod || 'UPI'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Amount Paid to Store:</span>
                          <span className="font-mono font-black text-emerald-800">₹{activeBillModal.payableAmount}</span>
                        </div>
                        {activeBillModal.utrNumber && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">UPI Reference / UTR:</span>
                            <span className="font-mono font-bold text-blue-900">{activeBillModal.utrNumber}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-b5-800 font-bold pt-1 border-t border-amber-200">
                          <span>Coins Reserved:</span>
                          <span>{activeBillModal.coinsToRedeem} B5 Coins (will be debited upon cashier approval)</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        The store cashier is reviewing your payment. As soon as the cashier verifies, your official receipt will appear automatically.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="block text-xs font-black text-darkbrown-900 uppercase tracking-wider">
                        Step 1: Choose Payment Method:
                      </label>

                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => handleSelectPaymentMethod('upi')}
                          className={`p-3.5 rounded-2xl border-2 text-left transition-all flex flex-col justify-between gap-2 ${
                            selectedPaymentMode === 'upi' || activeBillModal.paymentMethod === 'upi'
                              ? 'border-blue-700 bg-blue-50 shadow-sm'
                              : 'border-cream-300 hover:border-blue-300 bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <Smartphone className="w-5 h-5 text-blue-800" />
                            <span className="text-[10px] font-black uppercase text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full">
                              Instant
                            </span>
                          </div>
                          <div>
                            <div className="text-xs font-black text-darkbrown-900">
                              Option A: GPay / UPI
                            </div>
                            <div className="text-[10px] text-gray-500">
                              Scan QR or open UPI app
                            </div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSelectPaymentMethod('cash')}
                          className={`p-3.5 rounded-2xl border-2 text-left transition-all flex flex-col justify-between gap-2 ${
                            selectedPaymentMode === 'cash' || activeBillModal.paymentMethod === 'cash'
                              ? 'border-emerald-700 bg-emerald-50 shadow-sm'
                              : 'border-cream-300 hover:border-emerald-300 bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <Banknote className="w-5 h-5 text-emerald-700" />
                            <span className="text-[10px] font-black uppercase text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                              Counter
                            </span>
                          </div>
                          <div>
                            <div className="text-xs font-black text-darkbrown-900">
                              Option B: Cash at Store
                            </div>
                            <div className="text-[10px] text-gray-500">
                              Pay cash directly to cashier
                            </div>
                          </div>
                        </button>
                      </div>
                    </div>

                    {confirmError && (
                      <div className="p-3 bg-red-50 border border-red-200 text-red-900 rounded-xl text-xs font-bold">
                        {confirmError}
                      </div>
                    )}

                    {/* PAYMENT OPTION A: GPAY / UPI DETAILS */}
                    {selectedPaymentMode === 'upi' && (
                      <div className="p-4 bg-gradient-to-br from-blue-50/70 to-indigo-50/70 rounded-2xl border border-blue-200 space-y-4 animate-in fade-in">
                        <div className="flex items-center gap-2">
                          <QrCode className="w-5 h-5 text-blue-700" />
                          <h4 className="text-xs font-black text-blue-900 uppercase tracking-wider">
                            Option A: GPay / UPI Dynamic QR &amp; Direct Pay
                          </h4>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-xl border border-blue-100 shadow-2xs">
                          {/* Dynamic QR Code */}
                          <div className="shrink-0 text-center">
                            <img
                              src={getQrImageUrl(activeBillModal)}
                              alt="Store UPI QR Code"
                              className="w-36 h-36 rounded-lg border border-gray-200 mx-auto shadow-xs"
                            />
                            <span className="text-[9px] text-gray-500 font-bold block mt-1">
                              Scan with GPay / PhonePe / Paytm
                            </span>
                          </div>

                          {/* Store UPI Details */}
                          <div className="space-y-2 text-xs flex-1 w-full">
                            <div>
                              <span className="text-[10px] text-gray-500 uppercase font-bold block">
                                Store's Registered UPI ID
                              </span>
                              <span className="font-mono font-black text-sm text-blue-950 bg-blue-50 px-2.5 py-1 rounded-lg inline-block border border-blue-200 select-all">
                                {activeBillModal.merchantUpiId || 'magizhcafee-3@okhdfcbank'}
                              </span>
                            </div>

                            <div>
                              <span className="text-[10px] text-gray-500 uppercase font-bold block">
                                Prefilled Payable Amount
                              </span>
                              <span className="text-lg font-black text-emerald-800 font-mono">
                                ₹{Number(activeBillModal.payableAmount).toFixed(2)}
                              </span>
                            </div>

                            {/* Direct GPay / UPI App Button */}
                            <a
                              href={getUpiUrl(activeBillModal)}
                              className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-2 transition-all"
                            >
                              <Smartphone className="w-4 h-4" />
                              <span>Open GPay / Any UPI App</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>

                        {/* UPI UTR Input Field */}
                        <div className="space-y-1">
                          <label className="text-[11px] font-black text-blue-950 uppercase tracking-wide block">
                            UPI Transaction Reference / UTR Number:
                          </label>
                          <input
                            type="text"
                            value={upiUtrInput}
                            onChange={(e) => setUpiUtrInput(e.target.value)}
                            placeholder="Enter 12-digit UTR / Transaction Ref ID from your UPI app"
                            className="w-full px-3.5 py-2.5 bg-white border border-blue-300 rounded-xl font-mono text-xs text-darkbrown-900 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                          />
                          <p className="text-[10px] text-blue-800">
                            Available in your GPay / PhonePe payment success screen.
                          </p>
                        </div>

                        {/* Customer Confirmation Button */}
                        <button
                          type="button"
                          onClick={() => handleConfirmCustomerPayment('upi')}
                          disabled={isConfirmingPayment}
                          className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-emerald-700 hover:from-blue-800 hover:to-emerald-800 text-white rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                        >
                          {isConfirmingPayment ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 text-emerald-300" />}
                          <span>I Have Completed UPI Payment (₹{activeBillModal.payableAmount})</span>
                        </button>
                      </div>
                    )}

                    {/* PAYMENT OPTION B: CASH AT THE STORE */}
                    {selectedPaymentMode === 'cash' && (
                      <div className="p-4 bg-gradient-to-br from-emerald-50/70 to-teal-50/70 rounded-2xl border border-emerald-200 space-y-4 animate-in fade-in">
                        <div className="flex items-center gap-2">
                          <Banknote className="w-5 h-5 text-emerald-700" />
                          <h4 className="text-xs font-black text-emerald-900 uppercase tracking-wider">
                            Option B: Cash Payment at Store Counter
                          </h4>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-emerald-100 space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-600 font-medium">Exact Cash to Hand Over:</span>
                            <span className="text-xl font-black text-emerald-800 font-mono">
                              ₹{activeBillModal.payableAmount}
                            </span>
                          </div>

                          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-950 space-y-1">
                            <p className="font-bold">Instructions for Customer:</p>
                            <p className="text-[11px] text-emerald-900">
                              Please hand <strong>₹{activeBillModal.payableAmount}</strong> cash to the counter cashier. After paying, click the confirmation button below.
                            </p>
                          </div>
                        </div>

                        {/* Customer Confirmation Button */}
                        <button
                          type="button"
                          onClick={() => handleConfirmCustomerPayment('cash')}
                          disabled={isConfirmingPayment}
                          className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-700 to-teal-800 hover:from-emerald-800 hover:to-teal-900 text-white rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                        >
                          {isConfirmingPayment ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 text-emerald-200" />}
                          <span>I Have Paid Cash (₹{activeBillModal.payableAmount})</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveBillModal(null)}
                  className="px-4 py-2 border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-bold"
                >
                  Close Window
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 9: CELEBRATION RECEIPT MODAL (WHEN COMPLETED) */}
      {completedBillReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-darkbrown-950/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-cream-300 w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="bg-gradient-to-r from-emerald-800 to-emerald-950 text-white p-6 text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-white/20 text-white flex items-center justify-center mx-auto shadow-md">
                <CheckCircle2 className="w-8 h-8 text-emerald-300" />
              </div>
              <h3 className="text-xl font-black">Payment Confirmed!</h3>
              <p className="text-xs text-emerald-100">
                Receipt Issued &bull; B5 Coins Deducted Atomically
              </p>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="bg-cream-50 p-4 rounded-2xl border border-cream-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Receipt Number:</span>
                  <span className="font-mono font-black text-darkbrown-900">
                    {completedBillReceipt.receiptNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Store Name:</span>
                  <span className="font-bold text-darkbrown-900">
                    {completedBillReceipt.partnerName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Bill Number:</span>
                  <span className="font-mono">{completedBillReceipt.billNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Original Bill:</span>
                  <span className="font-bold">₹{completedBillReceipt.billAmount}</span>
                </div>
                <div className="flex justify-between text-b5-700 font-black">
                  <span>B5 Coins Used:</span>
                  <span>-₹{completedBillReceipt.coinsToRedeem} ({completedBillReceipt.coinsToRedeem} Coins)</span>
                </div>
                <div className="flex justify-between text-emerald-800 font-black pt-2 border-t border-cream-300">
                  <span>Amount Paid:</span>
                  <span className="text-sm font-mono">₹{completedBillReceipt.payableAmount}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Payment Method:</span>
                  <span className="font-bold uppercase">{completedBillReceipt.paymentMethod || 'UPI'}</span>
                </div>
              </div>

              <button
                onClick={() => setCompletedBillReceipt(null)}
                className="w-full py-2.5 bg-magizh-800 hover:bg-magizh-900 text-white rounded-xl font-bold"
              >
                Close Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIRECTORY VIEW MODE TABS: BROWSE STORES vs PURCHASE HISTORY */}
      <div className="flex items-center gap-2 border-b border-cream-200 pb-3">
        <button
          onClick={() => setDirectoryViewMode('shops')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 ${
            directoryViewMode === 'shops'
              ? 'bg-magizh-900 text-white shadow-md'
              : 'bg-white text-gray-700 border border-cream-300 hover:bg-cream-50'
          }`}
        >
          <Store className="w-4 h-4 text-b5-400" />
          <span>Browse Partner Stores ({filteredPartners.length})</span>
        </button>

        <button
          onClick={() => {
            setDirectoryViewMode('history');
            fetchPastBills();
          }}
          className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 ${
            directoryViewMode === 'history'
              ? 'bg-magizh-900 text-white shadow-md'
              : 'bg-white text-gray-700 border border-cream-300 hover:bg-cream-50'
          }`}
        >
          <Receipt className="w-4 h-4 text-b5-400" />
          <span>My In-Store Purchase History ({pastBills.length})</span>
        </button>
      </div>

      {/* VIEW MODE 1: PARTNER SHOPS DIRECTORY */}
      {directoryViewMode === 'shops' ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-sm font-extrabold text-darkbrown-900">
              Approved Stores Near You ({filteredPartners.length})
            </h2>
            <button
              onClick={onBackToShopping}
              className="text-xs font-bold text-magizh-800 hover:underline"
            >
              &larr; Return to Online Shopping
            </button>
          </div>

          {filteredPartners.length === 0 ? (
            <div className="bg-white rounded-2xl border border-cream-300 p-8 text-center text-xs text-gray-500">
              No partner shops found matching your search.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPartners.map((shop) => (
                <div
                  key={shop.id}
                  className="bg-white rounded-3xl border border-cream-300 hover:border-magizh-500/50 p-5 shadow-2xs hover:shadow-soft transition-all space-y-3 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-900 flex items-center justify-center font-bold shrink-0">
                          <Store className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-extrabold text-sm text-darkbrown-900 leading-tight">
                            {shop.shopName}
                          </h3>
                          <span className="font-mono text-[10px] text-gray-500 font-bold">
                            Partner ID: {shop.partnerCode}
                          </span>
                        </div>
                      </div>
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                        Approved Store
                      </span>
                    </div>

                    <p className="text-xs text-gray-600 mt-2 flex items-start gap-1.5">
                      <MapPin className="w-4 h-4 text-magizh-700 shrink-0 mt-0.5" />
                      <span>{shop.address}, {shop.district} - <strong>{shop.pinCode}</strong></span>
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                      <span className="bg-b5-50 text-b5-800 border border-b5-200 px-2 py-0.5 rounded-lg font-bold">
                        Redeem up to {shop.partnerRedemptionCapPercentage || 50}% Coins
                      </span>
                      <span className="bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-lg font-bold flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-600" />
                        {shop.specialCoinBonusMultiplier || 1.5}x Coin Bonus
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-cream-200 flex items-center justify-between gap-3">
                    <div className="text-[11px] text-gray-500 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-gray-400" />
                      <span>+91 {shop.mobile}</span>
                    </div>

                    {/* View Store Option (Coin Collector replaced with View Store Details) */}
                    <button
                      onClick={() => setSelectedStoreModal(shop)}
                      className="px-4 py-2 bg-gradient-to-r from-magizh-800 to-magizh-900 hover:from-magizh-900 hover:to-black text-white rounded-xl text-xs font-black shadow-sm transition-all flex items-center gap-1.5"
                    >
                      <Store className="w-3.5 h-3.5 text-b5-400" />
                      <span>View Store Details</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* VIEW MODE 2: CUSTOMER IN-STORE PURCHASE HISTORY */
        <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <div>
              <h2 className="text-sm font-extrabold text-darkbrown-900 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-700" />
                <span>My In-Store Purchase History ({pastBills.length})</span>
              </h2>
              <p className="text-xs text-gray-500">
                Permanent ledger of all your completed in-store partner purchases and B5 Coin savings.
              </p>
            </div>
            <button
              onClick={() => setDirectoryViewMode('shops')}
              className="text-xs font-bold text-magizh-800 hover:underline"
            >
              &larr; Back to Stores Directory
            </button>
          </div>

          {pastBills.length === 0 ? (
            <div className="bg-white rounded-3xl border border-cream-300 p-8 text-center text-xs text-gray-500 space-y-2">
              <Store className="w-10 h-10 text-gray-300 mx-auto" />
              <p className="font-bold text-darkbrown-900">No in-store purchases recorded yet</p>
              <p className="text-[11px]">When you shop at any Magizh Partner store, your verified bills and receipts will be permanently archived here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pastBills.map((b) => (
                <div
                  key={b.id}
                  className="bg-white rounded-2xl border border-cream-300 p-4 shadow-2xs space-y-3 text-xs hover:border-emerald-300 transition-all"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cream-200 pb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                        <Store className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-extrabold text-sm text-darkbrown-900 block">
                          {b.partnerName}
                        </span>
                        <span className="font-mono text-[11px] text-gray-500">
                          Bill #{b.billNumber} &bull; {new Date(b.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} at {new Date(b.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{b.receiptNumber || 'Verified Receipt'}</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-cream-50 p-3 rounded-xl border border-cream-200">
                    <div>
                      <span className="text-[10px] text-gray-500 block">Original Bill</span>
                      <span className="text-xs font-black text-darkbrown-900">₹{b.originalBillAmount || b.billAmount}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-b5-700 block font-bold">Coins Redeemed</span>
                      <span className="text-xs font-black text-b5-700">-{b.coinsToRedeem} B5 Coins</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-700 block font-bold">Paid at Store</span>
                      <span className="text-sm font-black text-emerald-800">₹{b.payableAmount}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-500 block">Payment Mode</span>
                      <span className="text-xs font-black uppercase text-darkbrown-900">{b.paymentMethod || 'COUNTER'}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-1">
                    <span className="text-[11px] text-gray-500">
                      Payment verified and closed by cashier.
                    </span>
                    <button
                      onClick={() => setCompletedBillReceipt(b)}
                      className="px-4 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <Receipt className="w-3.5 h-3.5 text-emerald-300" />
                      <span>View Store Receipt</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL: VIEW STORE DETAILS MODAL */}
      {selectedStoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-darkbrown-950/75 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-cream-300 w-full max-w-lg overflow-hidden animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-magizh-900 via-magizh-800 to-darkbrown-900 text-white p-5 relative">
              <button
                onClick={() => setSelectedStoreModal(null)}
                className="absolute top-4 right-4 text-cream-200 hover:text-white p-1 rounded-full hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-b5-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-b5-300">
                  Authorized Partner Franchise Store
                </span>
              </div>
              <h3 className="text-xl font-black mt-1">{selectedStoreModal.shopName}</h3>
              <p className="text-xs text-cream-200">
                Partner Code: {selectedStoreModal.partnerCode} &bull; {selectedStoreModal.district}
              </p>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Store Photo / 4-Image Showcase Gallery */}
              {selectedStoreModal.storeImages && selectedStoreModal.storeImages.filter(Boolean).length > 0 ? (
                <div className="space-y-2">
                  <div className="relative rounded-2xl overflow-hidden bg-black h-48 sm:h-56 w-full border border-cream-300 shadow-md">
                    <img
                      src={selectedStoreModal.storeImages[activeStoreImageIdx] || selectedStoreModal.storeImages[0]}
                      alt={`${selectedStoreModal.shopName} Photo`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2.5 right-2.5 bg-black/70 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md">
                      <ImageIcon className="w-3 h-3 text-amber-300" />
                      <span>{activeStoreImageIdx + 1} / {selectedStoreModal.storeImages.filter(Boolean).length}</span>
                    </div>
                  </div>

                  {/* Thumbnails row (Up to 4 images) */}
                  {selectedStoreModal.storeImages.filter(Boolean).length > 1 && (
                    <div className="grid grid-cols-4 gap-2">
                      {selectedStoreModal.storeImages.filter(Boolean).map((imgUrl, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setActiveStoreImageIdx(idx)}
                          className={`relative h-14 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                            activeStoreImageIdx === idx
                              ? 'border-emerald-600 ring-2 ring-emerald-300 shadow-sm'
                              : 'border-cream-300 opacity-70 hover:opacity-100'
                          }`}
                        >
                          <img
                            src={imgUrl}
                            alt={`Thumbnail ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-900 to-darkbrown-900 h-36 flex items-center justify-center text-white border border-cream-300 shadow-inner">
                  <div className="text-center space-y-1">
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mx-auto shadow-md">
                      <Store className="w-6 h-6 text-emerald-300" />
                    </div>
                    <h4 className="font-extrabold text-sm">{selectedStoreModal.shopName}</h4>
                    <p className="text-[11px] text-cream-200">Traditional Organic Millets, Oils &amp; Authentic Groceries</p>
                  </div>
                </div>
              )}

              {/* Store Address & Contact */}
              <div className="bg-cream-50 p-4 rounded-2xl border border-cream-200 space-y-2.5">
                <div className="flex items-start gap-2 text-darkbrown-900">
                  <MapPin className="w-4 h-4 text-magizh-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Store Location &amp; Address:</span>
                    <p className="text-gray-600 mt-0.5 leading-relaxed">
                      {selectedStoreModal.address}, {selectedStoreModal.district} - <strong>{selectedStoreModal.pinCode}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-cream-200">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-emerald-700" />
                    <span className="font-bold text-darkbrown-900">+91 {selectedStoreModal.mobile}</span>
                  </div>
                  <a
                    href={`tel:+91${selectedStoreModal.mobile}`}
                    className="px-3 py-1 bg-emerald-800 text-white rounded-lg text-[11px] font-bold hover:bg-emerald-900"
                  >
                    Call Store
                  </a>
                </div>
              </div>

              {/* B5 Coin Privilege Info */}
              <div className="bg-gradient-to-br from-b5-50 to-amber-50 p-4 rounded-2xl border border-b5-200 space-y-2">
                <h4 className="font-black text-darkbrown-900 uppercase text-[11px] flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-b5-600" />
                  <span>B5 Coin Benefits at this Store:</span>
                </h4>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-white p-2.5 rounded-xl border border-b5-200">
                    <span className="text-gray-500 block text-[10px]">Redemption Cap</span>
                    <span className="font-black text-b5-900 text-sm">Up to {selectedStoreModal.partnerRedemptionCapPercentage || 50}%</span>
                    <span className="text-[9px] text-gray-500 block">Use B5 Coins for up to half bill</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-b5-200">
                    <span className="text-gray-500 block text-[10px]">Bonus Multiplier</span>
                    <span className="font-black text-amber-900 text-sm">{selectedStoreModal.specialCoinBonusMultiplier || 1.5}x Multiplier</span>
                    <span className="text-[9px] text-gray-500 block">Earn extra coins on visits</span>
                  </div>
                </div>
              </div>

              {/* In-Store Available Items / Highlights */}
              <div className="border border-cream-200 p-3.5 rounded-2xl space-y-1.5">
                <span className="font-bold text-darkbrown-900 block text-[11px]">In-Store Products &amp; Offerings:</span>
                <div className="flex flex-wrap gap-1.5">
                  {['Pure Stone-Ground Podi', 'Cold-Pressed Groundnut Oil', 'Foxtail Millet Noodles', 'A2 Desi Cow Ghee', 'Traditional Palm Jaggery', 'Native Health Mixes'].map((item, idx) => (
                    <span key={idx} className="bg-cream-100 text-darkbrown-800 text-[10px] font-medium px-2 py-0.5 rounded-md">
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedStoreModal(null)}
                  className="w-full py-2.5 bg-magizh-900 hover:bg-black text-white font-bold rounded-xl text-xs"
                >
                  Close Store Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};