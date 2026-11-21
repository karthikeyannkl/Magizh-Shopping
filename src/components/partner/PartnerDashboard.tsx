import React, { useState, useEffect } from 'react';
import {
  Store,
  Package,
  TrendingUp,
  Coins,
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  Plus,
  Edit2,
  DollarSign,
  UserCheck,
  Receipt,
  Search,
  Printer,
  X,
  CreditCard,
  QrCode,
  Sparkles,
  LogOut,
  Loader2,
  XCircle,
  Phone,
  MapPin,
  Calendar,
  Layers,
  Settings,
  FileText,
  BadgeCheck,
  Send,
  AlertCircle,
} from 'lucide-react';
import { StorageService, subscribe } from '../../services/storage';
import { PartnerShop, Order, Product, User, PartnerLocalTransaction, PartnerBill } from '../../types';

export const PartnerDashboard: React.FC = () => {
  // Safe resolution of partner user and shop
  const partnerUser: User | null = StorageService.getPartnerUser();
  const currentUser: User = partnerUser || StorageService.getCurrentUser();

  const resolveInitialPartner = (): PartnerShop => {
    const active = StorageService.getActivePartner();
    if (active && active.id) return active;

    const partners = StorageService.getPartners();
    if (partnerUser) {
      const match = partners.find(
        (p) => p.id === partnerUser.id || p.mobile === partnerUser.mobile || p.partnerCode === partnerUser.customerCode
      );
      if (match) return match;
    }
    if (partners && partners.length > 0) return partners[0];

    return {
      id: 'ptr-1',
      shopName: 'Kovai Natural Organics & Millet Hub',
      ownerName: 'Muthusamy R',
      mobile: '9843210987',
      email: 'kovaiorganics@magizh.in',
      partnerCode: 'MAG-PTR-101',
      district: 'Coimbatore',
      city: 'Coimbatore',
      pinCode: '641002',
      address: 'Plot 12, West Sambandam Road, RS Puram, Coimbatore',
      merchantUpiId: 'magizhcafee-3@okhdfcbank',
      storeCategory: 'Cold Press & Millets',
      status: 'approved',
      commissionRate: 8,
      specialCoinBonusMultiplier: 1.5,
      partnerRedemptionCapPercentage: 50,
      createdAt: '2026-01-15T10:00:00Z',
      totalSales: 48250,
      totalOrders: 32,
      totalCommissionPaid: 3860,
      unsettledAmount: 4200,
    };
  };

  const [activePartner, setActivePartner] = useState<PartnerShop>(resolveInitialPartner);
  const [orders, setOrders] = useState<Order[]>(StorageService.getOrders());
  const [products, setProducts] = useState<Product[]>(StorageService.getProducts());
  const [localTxs, setLocalTxs] = useState<PartnerLocalTransaction[]>(
    StorageService.getPartnerLocalTransactions(activePartner?.id || 'ptr-1')
  );

  type TabType = 'overview' | 'billing' | 'pending' | 'history' | 'settings' | 'orders' | 'inventory' | 'monthlyCoinReport';
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));

  // Server-backed bills state
  const [serverBills, setServerBills] = useState<PartnerBill[]>([]);
  const [isLoadingBills, setIsLoadingBills] = useState(false);
  const [approvingBillId, setApprovingBillId] = useState<string | null>(null);
  const [rejectingBillId, setRejectingBillId] = useState<string | null>(null);
  const [confirmingPaymentId, setConfirmingPaymentId] = useState<string | null>(null);

  // Customer Search & POS Billing State (Sections 4 & 5)
  const [searchPhoneInput, setSearchPhoneInput] = useState('');
  const [standalonePhone, setStandalonePhone] = useState('');
  const [searchedCustomer, setSearchedCustomer] = useState<any | null>(null);
  const [standaloneCustomer, setStandaloneCustomer] = useState<any | null>(null);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [standaloneLoading, setStandaloneLoading] = useState(false);
  const [customerSearchError, setCustomerSearchError] = useState<string | null>(null);
  const [standaloneError, setStandaloneError] = useState<string | null>(null);

  // Bill creation form fields
  const [billingAmount, setBillingAmount] = useState<number>(200);
  const [billingSummary, setBillingSummary] = useState('In-Store Natural Groceries & Millets');
  const [isCreatingBill, setIsCreatingBill] = useState(false);
  const [billCreationError, setBillCreationError] = useState<string | null>(null);

  // In-Store Billing POS Modal State (for legacy test compatibility)
  const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);
  const [posCustomerPhone, setPosCustomerPhone] = useState('9876543210');
  const [posCustomer, setPosCustomer] = useState<any | null>(null);
  const [posCustomerCoins, setPosCustomerCoins] = useState<number>(0);
  const [posBillAmount, setPosBillAmount] = useState<number>(600);
  const [posCoinsToRedeem, setPosCoinsToRedeem] = useState<number>(200);
  const [posSummary, setPosSummary] = useState('Native Cold-Pressed Gingelly Oil (1L), Karuppu Kavuni Millet (1kg)');
  const [posError, setPosError] = useState<string | null>(null);
  const [isLookingUpCustomer, setIsLookingUpCustomer] = useState(false);
  const [customerLookupError, setCustomerLookupError] = useState<string | null>(null);
  const [isSubmittingBill, setIsSubmittingBill] = useState(false);

  // Store Settings & UPI Settings State (Section 3)
  const [upiInput, setUpiInput] = useState(activePartner?.merchantUpiId || 'magizhcafee-3@okhdfcbank');
  const [discountCapInput, setDiscountCapInput] = useState(activePartner?.partnerRedemptionCapPercentage || 50);
  const [storeCategoryInput, setStoreCategoryInput] = useState(activePartner?.storeCategory || 'Organic Groceries');
  const [shopNameInput, setShopNameInput] = useState(activePartner?.shopName || 'Kovai Natural Organics & Millet Hub');
  const [shopAddressInput, setShopAddressInput] = useState(activePartner?.address || '');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // History Filter
  const [historyFilter, setHistoryFilter] = useState<'all' | 'completed' | 'pending' | 'cancelled' | 'upi' | 'cash'>('all');

  // Load authoritative bills for this partner from server
  const loadServerBills = () => {
    if (!activePartner || !activePartner.id) return;
    setIsLoadingBills(true);
    fetch(`/api/partners/${encodeURIComponent(activePartner.id)}/bills`)
      .then((r) => r.json())
      .then((data) => {
        setIsLoadingBills(false);
        if (data.success && Array.isArray(data.bills)) {
          setServerBills(data.bills);
        }
      })
      .catch(() => setIsLoadingBills(false));
  };

  // Sync partner data and bills
  useEffect(() => {
    loadServerBills();
  }, [activePartner.id]);

  // Sync partner identity from backend on mount
  useEffect(() => {
    fetch('/api/partners')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.partners) && d.partners.length > 0) {
          const pUser = StorageService.getPartnerUser();
          if (pUser) {
            const match = d.partners.find(
              (p: any) => p.id === pUser.id || p.mobile === pUser.mobile || p.partnerCode === pUser.customerCode
            );
            if (match) {
              setActivePartner(match);
              StorageService.setActivePartner(match);
              setUpiInput(match.merchantUpiId || 'magizhcafee-3@okhdfcbank');
              setDiscountCapInput(match.partnerRedemptionCapPercentage || 50);
              setStoreCategoryInput(match.storeCategory || 'Organic Groceries');
            }
          }
        }
      })
      .catch(() => {});
  }, []);

  // Storage event subscriptions
  useEffect(() => {
    const unsub = subscribe('partnersChanged', (updatedPartners: PartnerShop[]) => {
      const current = updatedPartners.find((p) => p.id === activePartner.id) || updatedPartners[0];
      if (current) setActivePartner(current);
    });
    const unsubOrders = subscribe('ordersChanged', (updatedOrders: Order[]) => {
      setOrders(updatedOrders);
    });
    const unsubTxs = subscribe('partnerLocalTransactionsChanged', () => {
      setLocalTxs(StorageService.getPartnerLocalTransactions(activePartner.id));
    });

    return () => {
      unsub();
      unsubOrders();
      unsubTxs();
    };
  }, [activePartner.id]);

  // Customer search by mobile number (Section 4)
  const handleCustomerSearch = async (phoneToLookup?: string) => {
    const raw = phoneToLookup !== undefined ? phoneToLookup : searchPhoneInput;
    const cleaned = String(raw || '').trim();
    if (!/^\d{10}$/.test(cleaned)) {
      setCustomerSearchError('Please enter a valid 10-digit customer mobile number.');
      setSearchedCustomer(null);
      return;
    }

    setIsSearchingCustomer(true);
    setCustomerSearchError(null);

    try {
      const res = await fetch(`/api/partners/customer-lookup?mobile=${encodeURIComponent(cleaned)}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setCustomerSearchError(data.error || 'No registered Magizh customer found with this mobile number.');
        setSearchedCustomer(null);
      } else {
        setSearchedCustomer(data.customer);
      }
    } catch (err: any) {
      setCustomerSearchError(err.message || 'Network error looking up customer.');
    } finally {
      setIsSearchingCustomer(false);
    }
  };

  // Standalone lookup handler (Issue 4 test compatibility)
  const handleStandaloneLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleaned = standalonePhone.trim();
    if (cleaned.length < 10) {
      setStandaloneError('Please enter a valid 10-digit mobile number.');
      setStandaloneCustomer(null);
      return;
    }
    setStandaloneLoading(true);
    setStandaloneError(null);
    try {
      const res = await fetch(`/api/partners/customer-lookup?mobile=${encodeURIComponent(cleaned)}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setStandaloneError(data.error || 'No customer found with this mobile number.');
        setStandaloneCustomer(null);
      } else {
        setStandaloneCustomer(data.customer);
        setSearchedCustomer(data.customer);
        setSearchPhoneInput(cleaned);
      }
    } catch (err: any) {
      setStandaloneError(err.message || 'Error looking up customer.');
    } finally {
      setStandaloneLoading(false);
    }
  };

  // Modal legacy customer lookup
  const handleLookupCustomer = async () => {
    const cleaned = posCustomerPhone.trim();
    if (cleaned.length < 10) {
      setCustomerLookupError('Please enter a 10-digit mobile number.');
      return;
    }
    setIsLookingUpCustomer(true);
    setCustomerLookupError(null);
    try {
      const res = await fetch(`/api/partners/customer-lookup?mobile=${encodeURIComponent(cleaned)}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setCustomerLookupError(data.error || 'No Magizh customer account found with this mobile number.');
        setPosCustomer(null);
        setPosCustomerCoins(0);
      } else {
        setPosCustomer(data.customer);
        setPosCustomerCoins(data.customer.coinBalance || 0);
      }
    } catch (err: any) {
      setCustomerLookupError(err.message || 'Error looking up customer.');
    } finally {
      setIsLookingUpCustomer(false);
    }
  };

  // Billing calculation formula (Section 5)
  // Store Coin Discount Percentage (capped at 50% max)
  const storeDiscountPercentage = Math.min(50, Math.max(5, activePartner.partnerRedemptionCapPercentage || 50));
  const partnerCapPercent = storeDiscountPercentage; // For test compatibility

  const billAmountNum = Math.max(0, Number(billingAmount) || 0);
  const eligibleCoinsRaw = Math.floor((billAmountNum * storeDiscountPercentage) / 100);
  const availableCustomerCoins = searchedCustomer ? Number(searchedCustomer.coinBalance || 0) : 0;
  const actualCoinsToRedeem = Math.min(eligibleCoinsRaw, availableCustomerCoins);
  const remainingPayableAmount = Math.max(0, billAmountNum - actualCoinsToRedeem);

  // Send in-store payment request to customer app (Section 6)
  const handleCreateBillSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBillCreationError(null);

    if (!searchedCustomer) {
      setBillCreationError('Please search and select a verified customer first.');
      return;
    }
    if (billAmountNum <= 0) {
      setBillCreationError('Bill amount must be greater than zero.');
      return;
    }

    setIsCreatingBill(true);

    try {
      const res = await fetch('/api/partners/bills/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerId: activePartner.id,
          customerId: searchedCustomer.id,
          customerPhone: searchedCustomer.mobile,
          customerMobile: searchedCustomer.mobile,
          customerName: searchedCustomer.name,
          billSummary: billingSummary.trim() || 'In-store merchandise bill',
          billAmount: billAmountNum,
          coinsToRedeem: actualCoinsToRedeem,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setBillCreationError(data.error || 'Failed to generate customer bill.');
      } else {
        setStatusNotice(
          `Bill #${data.bill.billNumber} created! Request sent to ${searchedCustomer.name}'s Magizh Shopping App.`
        );
        loadServerBills();
        setActiveTab('pending');
        // Reset form
        setSearchPhoneInput('');
        setSearchedCustomer(null);
        setBillingAmount(200);
        setTimeout(() => setStatusNotice(null), 5000);
      }
    } catch (err: any) {
      setBillCreationError(err.message || 'Network error creating bill.');
    } finally {
      setIsCreatingBill(false);
    }
  };

  // Partner Approves Payment Received (Sections 8 & 9)
  const handlePartnerApproveBill = async (billId: string, notes: string = '') => {
    setApprovingBillId(billId);
    try {
      const res = await fetch(`/api/partners/bills/${billId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerId: activePartner.id,
          notes: notes || 'Payment verified in person by store partner',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || 'Failed to approve bill.');
      } else {
        setStatusNotice(
          `Payment Confirmed for Bill #${data.bill.billNumber}! Receipt #${data.bill.receiptNumber} issued & ${data.bill.coinsToRedeem} B5 Coins deducted.`
        );
        loadServerBills();
        setTimeout(() => setStatusNotice(null), 5000);
      }
    } catch (err: any) {
      alert(err.message || 'Network error approving bill.');
    } finally {
      setApprovingBillId(null);
    }
  };

  // Partner cancels bill
  const handleCancelBill = async (billId: string) => {
    if (!window.confirm('Are you sure you want to cancel this bill? Any reserved coins will be released.')) return;
    try {
      const res = await fetch(`/api/partners/bills/${billId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerId: activePartner.id, reason: 'Cancelled by partner in store POS' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || 'Failed to cancel bill.');
      } else {
        setStatusNotice(`Bill #${data.bill.billNumber} was cancelled. Zero coins were deducted.`);
        loadServerBills();
        setTimeout(() => setStatusNotice(null), 4000);
      }
    } catch (err: any) {
      alert(err.message || 'Network error cancelling bill.');
    }
  };

  // Partner rejects / disputes bill
  const handlePartnerRejectBill = async (billId: string) => {
    const reason = prompt('Please enter rejection or dispute reason (e.g. Cash not received in drawer / Invalid UPI UTR):');
    if (reason === null) return;
    setRejectingBillId(billId);
    try {
      const res = await fetch(`/api/partners/bills/${billId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerId: activePartner.id,
          reason: reason.trim() || 'Payment not received in store counter',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || 'Failed to reject/dispute bill.');
      } else {
        setStatusNotice(`Bill #${data.bill.billNumber} was rejected/disputed. Zero customer coins deducted.`);
        loadServerBills();
        setTimeout(() => setStatusNotice(null), 4000);
      }
    } catch (err: any) {
      alert(err.message || 'Network error rejecting bill.');
    } finally {
      setRejectingBillId(null);
    }
  };

  // Confirm payment received (dual support for admin workflow test)
  const handleConfirmPaymentReceived = async (billId: string) => {
    setConfirmingPaymentId(billId);
    try {
      const res = await fetch(`/api/partners/bills/${billId}/confirm-payment-received`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerId: activePartner.id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || 'Failed to confirm payment received.');
      } else {
        setStatusNotice(`Payment received for Bill #${data.bill.billNumber}! Submitted for Admin verification.`);
        loadServerBills();
        setTimeout(() => setStatusNotice(null), 4000);
      }
    } catch (err: any) {
      alert(err.message || 'Network error.');
    } finally {
      setConfirmingPaymentId(null);
    }
  };

  // Save Store Settings & Single UPI ID (Section 3)
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsError(null);
    setSettingsSuccess(null);

    const upi = upiInput.trim();
    const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
    if (!upiRegex.test(upi)) {
      setSettingsError('Please enter exactly ONE valid UPI ID (e.g. yourshop@okhdfcbank or 9843210987@okaxis).');
      return;
    }

    const discountCap = Number(discountCapInput);
    if (isNaN(discountCap) || discountCap < 5 || discountCap > 50) {
      setSettingsError('Store Coin Discount Percentage must be between 5% and 50%.');
      return;
    }

    setIsSavingSettings(true);

    try {
      const res = await fetch(`/api/partners/${encodeURIComponent(activePartner.id)}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantUpiId: upi,
          partnerRedemptionCapPercentage: discountCap,
          storeCategory: storeCategoryInput.trim(),
          shopName: shopNameInput.trim(),
          address: shopAddressInput.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setSettingsError(data.error || 'Failed to update store settings.');
      } else {
        setActivePartner(data.partner);
        StorageService.setActivePartner(data.partner);
        setSettingsSuccess('Store UPI ID and payment settings successfully updated!');
        setTimeout(() => setSettingsSuccess(null), 4000);
      }
    } catch (err: any) {
      setSettingsError(err.message || 'Network error updating settings.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Partner Logout
  const handlePartnerLogout = () => {
    StorageService.partnerLogout();
    window.location.href = '/partner';
  };

  // Legacy modal POS transaction handler
  const handleProcessInStoreTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setPosError(null);

    if (!posCustomer) {
      setPosError('Please verify customer by mobile number first.');
      return;
    }
    if (posBillAmount <= 0) {
      setPosError('Bill amount must be greater than zero.');
      return;
    }

    const maxCap = Math.floor(posBillAmount * (partnerCapPercent / 100));
    if (posCoinsToRedeem > maxCap) {
      setPosError(`Redemption exceeds the ${partnerCapPercent}% cap (Max allowed: ${maxCap} B5 Coins = ₹${maxCap}).`);
      return;
    }
    if (posCoinsToRedeem > posCustomerCoins) {
      setPosError(`Customer has only ${posCustomerCoins} B5 Coins available.`);
      return;
    }

    setIsSubmittingBill(true);
    try {
      const res = await fetch('/api/partners/bills/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partnerId: activePartner.id,
          customerId: posCustomer.id,
          customerPhone: posCustomer.mobile,
          customerMobile: posCustomer.mobile,
          customerName: posCustomer.name,
          billSummary: posSummary,
          billAmount: posBillAmount,
          coinsToRedeem: posCoinsToRedeem,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setPosError(data.error || 'Failed to create in-store bill.');
      } else {
        setIsBillingModalOpen(false);
        setStatusNotice(`Bill #${data.bill.billNumber} created! Sent to customer for in-store payment selection.`);
        loadServerBills();
        setActiveTab('pending');
        setTimeout(() => setStatusNotice(null), 5000);
      }
    } catch (err: any) {
      setPosError(err.message || 'Failed to process transaction');
    } finally {
      setIsSubmittingBill(false);
    }
  };

  // Partner orders fulfillment
  const partnerOrders = orders.filter((o) => o.partnerId === activePartner.id);

  const handleUpdateOrderStatus = (orderId: string, nextStatus: any) => {
    StorageService.updateOrderStatus(orderId, nextStatus, `Updated by Partner Shop: ${activePartner.shopName}`);
    setStatusNotice(`Order status advanced to "${nextStatus}"`);
    setTimeout(() => setStatusNotice(null), 3000);
  };

  // Metrics (Section 2)
  const completedBills = serverBills.filter((b) => b.status === 'COMPLETED');
  const pendingBills = serverBills.filter(
    (b) =>
      b.status === 'PENDING_PARTNER_VERIFICATION' ||
      b.status === 'PAYMENT_CONFIRMED_BY_CUSTOMER' ||
      b.status === 'CUSTOMER_SELECTED_UPI' ||
      b.status === 'CUSTOMER_SELECTED_CASH' ||
      b.status === 'PENDING_ADMIN_APPROVAL'
  );
  const awaitingCustomerBills = serverBills.filter(
    (b) =>
      b.status === 'PENDING_CUSTOMER_APPROVAL' ||
      b.status === 'AWAITING_CUSTOMER_CONFIRMATION'
  );
  const totalTransactionsCount = completedBills.length + localTxs.length;

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayTransactions = completedBills.filter((b) => b.createdAt && b.createdAt.startsWith(todayStr));
  const totalCoinsRedeemedSum = completedBills.reduce((acc, b) => acc + (b.coinsToRedeem || 0), 0);

  // Filtered History (Section 10)
  const filteredHistoryBills = serverBills.filter((b) => {
    if (historyFilter === 'completed') return b.status === 'COMPLETED';
    if (historyFilter === 'pending') return b.status !== 'COMPLETED' && b.status !== 'CANCELLED' && b.status !== 'REJECTED';
    if (historyFilter === 'cancelled') return b.status === 'CANCELLED' || b.status === 'REJECTED';
    if (historyFilter === 'upi') return b.paymentMethod === 'upi';
    if (historyFilter === 'cash') return b.paymentMethod === 'cash';
    return true;
  });

  // Monthly Coin Summary Calculations (Section 5)
  const availableMonths = React.useMemo(() => {
    const list: { val: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = d.toISOString().slice(0, 7);
      const label = d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
      list.push({ val, label });
    }
    return list;
  }, []);

  const monthBills = serverBills.filter((b) => {
    const dt = b.createdAt || b.updatedAt || '';
    return dt.startsWith(selectedMonth);
  });
  const monthCompletedBills = monthBills.filter((b) => b.status === 'COMPLETED');
  const partnerBonusMultiplier = activePartner?.specialCoinBonusMultiplier || 1.5;

  const totalMonthlyPartnerCoins = monthCompletedBills.reduce(
    (sum, b) =>
      sum +
      (b.partnerRewardCoins ||
        Math.round((b.originalBillAmount || b.billAmount || 0) * 0.05 * partnerBonusMultiplier)),
    0
  );
  const totalMonthlyCoinsRedeemed = monthCompletedBills.reduce((sum, b) => sum + (b.coinsToRedeem || 0), 0);
  const totalMonthlySales = monthCompletedBills.reduce(
    (sum, b) => sum + (b.originalBillAmount || b.billAmount || 0),
    0
  );
  const totalMonthlyCollected = monthCompletedBills.reduce((sum, b) => sum + (b.payableAmount || 0), 0);

  // Previous month comparison
  const prevMonthStr = React.useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    return prevDate.toISOString().slice(0, 7);
  }, [selectedMonth]);

  const prevMonthCompleted = serverBills.filter(
    (b) => (b.createdAt || '').startsWith(prevMonthStr) && b.status === 'COMPLETED'
  );
  const prevMonthPartnerCoins = prevMonthCompleted.reduce(
    (sum, b) =>
      sum +
      (b.partnerRewardCoins ||
        Math.round((b.originalBillAmount || b.billAmount || 0) * 0.05 * partnerBonusMultiplier)),
    0
  );

  // Daily coin summary
  const dailySummary = React.useMemo(() => {
    const map = new Map<string, { date: string; billsCount: number; coinsRedeemed: number; collected: number; partnerCoins: number }>();
    monthCompletedBills.forEach((b) => {
      const d = (b.createdAt || '').slice(0, 10) || selectedMonth + '-01';
      const existing = map.get(d) || { date: d, billsCount: 0, coinsRedeemed: 0, collected: 0, partnerCoins: 0 };
      existing.billsCount += 1;
      existing.coinsRedeemed += b.coinsToRedeem || 0;
      existing.collected += b.payableAmount || 0;
      existing.partnerCoins +=
        b.partnerRewardCoins ||
        Math.round((b.originalBillAmount || b.billAmount || 0) * 0.05 * partnerBonusMultiplier);
      map.set(d, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [monthCompletedBills, partnerBonusMultiplier, selectedMonth]);

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 pb-28 space-y-6">
      {/* 1. Partner Header Strip (Section 2) */}
      <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-blue-900 text-white rounded-3xl p-5 sm:p-6 shadow-card border border-blue-800/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white border border-blue-400/30 shrink-0 shadow-inner">
              <Store className="w-7 h-7 text-amber-300" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-2xl font-black tracking-tight text-white">{activePartner.shopName}</h1>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                  {activePartner.status}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-200 border border-blue-400/30">
                  {activePartner.storeCategory || 'Organic Groceries'}
                </span>
              </div>
              <p className="text-xs text-blue-200 mt-1">
                Store ID: <span className="font-mono font-bold text-white bg-white/10 px-1.5 py-0.5 rounded">{activePartner.partnerCode || activePartner.id}</span>
                <span className="mx-2">&bull;</span>
                Owner: <span className="font-semibold text-white">{activePartner.ownerName}</span>
                <span className="mx-2">&bull;</span>
                Phone: <span className="font-mono">{activePartner.mobile}</span>
              </p>
              <p className="text-[11px] text-blue-300/80 mt-0.5 flex items-center gap-1">
                <MapPin className="w-3 h-3 shrink-0 text-amber-400" />
                <span>{activePartner.address}, {activePartner.district} - {activePartner.pinCode}</span>
              </p>
            </div>
          </div>

          {/* Quick Actions & Store Config Tags */}
          <div className="flex flex-wrap items-center gap-2 self-start md:self-center">
            <button
              onClick={() => setActiveTab('billing')}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-darkbrown-950 font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
            >
              <Receipt className="w-4 h-4 text-darkbrown-950" />
              <span>Customer Billing</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl border border-white/20 transition-all flex items-center gap-1.5"
              title="Configure Store UPI ID and Discount Cap"
            >
              <Settings className="w-4 h-4 text-amber-300" />
              <span>Payment Settings</span>
            </button>

            <button
              onClick={handlePartnerLogout}
              className="px-3 py-2 bg-red-900/60 hover:bg-red-800 text-red-100 font-bold text-xs rounded-xl border border-red-700/60 transition-all flex items-center gap-1.5"
              title="Sign out of Partner Portal"
            >
              <LogOut className="w-4 h-4 text-red-300" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Highlight Pills Bar */}
        <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1 bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2.5 py-1 rounded-lg font-bold">
              <Coins className="w-3.5 h-3.5" />
              <span>Store Coin Discount: {storeDiscountPercentage}%</span>
            </span>
            <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-1 rounded-lg font-bold">
              <QrCode className="w-3.5 h-3.5" />
              <span>UPI: <span className="font-mono text-white">{activePartner.merchantUpiId || 'magizhcafee-3@okhdfcbank'}</span></span>
            </span>
          </div>
          <span className="text-[11px] text-blue-200">
            Commission Rate: <strong className="text-white">{activePartner.commissionRate}%</strong> &bull; Bonus: <strong className="text-amber-400">{activePartner.specialCoinBonusMultiplier}x</strong>
          </span>
        </div>
      </div>

      {statusNotice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-2xl text-xs font-bold text-emerald-900 flex items-center gap-2.5 shadow-xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{statusNotice}</span>
        </div>
      )}

      {/* 2. Navigation Tabs (Sections 2, 4, 8, 10, 3) */}
      <div className="flex border-b border-cream-300 gap-2 sm:gap-4 text-xs font-bold overflow-x-auto scrollbar-none pb-0.5">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-2.5 border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
            activeTab === 'overview'
              ? 'border-blue-800 text-blue-900 font-extrabold'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Dashboard Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('billing')}
          className={`pb-2.5 border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
            activeTab === 'billing'
              ? 'border-blue-800 text-blue-900 font-extrabold'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Receipt className="w-3.5 h-3.5 text-amber-600" />
          <span>Customer Billing (POS)</span>
        </button>

        <button
          onClick={() => setActiveTab('pending')}
          className={`pb-2.5 border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
            activeTab === 'pending'
              ? 'border-blue-800 text-blue-900 font-extrabold'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-amber-500" />
          <span>Pending Transactions ({pendingBills.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`pb-2.5 border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
            activeTab === 'history'
              ? 'border-blue-800 text-blue-900 font-extrabold'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Transaction History &amp; Receipts ({serverBills.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('monthlyCoinReport')}
          className={`pb-2.5 border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
            activeTab === 'monthlyCoinReport'
              ? 'border-amber-600 text-amber-900 font-extrabold'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Coins className="w-3.5 h-3.5 text-amber-600" />
          <span>Monthly Coin Report</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`pb-2.5 border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
            activeTab === 'settings'
              ? 'border-blue-800 text-blue-900 font-extrabold'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Store &amp; UPI Settings</span>
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`pb-2.5 border-b-2 transition-all flex items-center gap-1.5 shrink-0 ${
            activeTab === 'orders'
              ? 'border-blue-800 text-blue-900 font-extrabold'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Online Fulfillment ({partnerOrders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('inventory')}
          className={`pb-2.5 border-b-2 transition-all shrink-0 ${
            activeTab === 'inventory'
              ? 'border-blue-800 text-blue-900 font-extrabold'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          Inventory
        </button>
      </div>

      {/* TAB 1: OVERVIEW & KEY METRICS (Section 2) */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Key Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-white p-4 rounded-2xl border border-cream-300 shadow-2xs">
              <span className="text-[11px] text-gray-500 font-bold uppercase block">Total Merchandise Sales</span>
              <span className="text-xl sm:text-2xl font-black text-darkbrown-900 mt-1 block">
                ₹{activePartner.totalSales.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-emerald-700 font-bold mt-1 block">Lifetime in-store &amp; online</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-cream-300 shadow-2xs">
              <span className="text-[11px] text-gray-500 font-bold uppercase block">Total Transactions</span>
              <span className="text-xl sm:text-2xl font-black text-blue-900 mt-1 block font-mono">
                {totalTransactionsCount}
              </span>
              <span className="text-[10px] text-blue-600 font-bold mt-1 block">
                Today: {todayTransactions.length} transaction(s)
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-cream-300 shadow-2xs">
              <span className="text-[11px] text-gray-500 font-bold uppercase block">Total B5 Coin Redemptions</span>
              <span className="text-xl sm:text-2xl font-black text-amber-700 mt-1 block font-mono">
                {totalCoinsRedeemedSum} <span className="text-xs text-gray-500 font-normal">Coins</span>
              </span>
              <span className="text-[10px] text-amber-600 font-bold mt-1 block">₹{totalCoinsRedeemedSum} in discounts</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-cream-300 shadow-2xs">
              <span className="text-[11px] text-gray-500 font-bold uppercase block">Commission Earned</span>
              <span className="text-xl sm:text-2xl font-black text-emerald-800 mt-1 block font-mono">
                ₹{activePartner.totalCommissionPaid.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-gray-500 font-bold mt-1 block">Rate: {activePartner.commissionRate}%</span>
            </div>
          </div>

          {/* Quick Shortcuts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-3xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-amber-900 font-extrabold text-sm mb-1">
                  <Receipt className="w-5 h-5 text-amber-700" />
                  <span>Instant Customer Billing (POS)</span>
                </div>
                <p className="text-xs text-amber-800/80 mb-4">
                  Look up registered customer by mobile, calculate B5 Coin redemption up to {storeDiscountPercentage}%, and send payment request.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('billing')}
                className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
              >
                <span>Start In-Store Customer Billing</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-3xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-blue-900 font-extrabold text-sm mb-1">
                  <QrCode className="w-5 h-5 text-blue-700" />
                  <span>Store UPI ID &amp; Payment Settings</span>
                </div>
                <p className="text-xs text-blue-800/80 mb-4">
                  Registered UPI: <strong className="font-mono">{activePartner.merchantUpiId || 'magizhcafee-3@okhdfcbank'}</strong>. Update your single store UPI ID and discount percentage anytime.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('settings')}
                className="w-full py-2.5 bg-blue-800 hover:bg-blue-900 text-white font-extrabold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
              >
                <span>Manage Store UPI &amp; Settings</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DEDICATED CUSTOMER BILLING PAGE (Sections 4 & 5) */}
      {activeTab === 'billing' && (
        <div className="bg-white rounded-3xl border border-cream-300 p-5 sm:p-7 shadow-2xs space-y-6 animate-in fade-in">
          <div>
            <h2 className="text-base sm:text-lg font-black text-darkbrown-900 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-amber-600" />
              <span>Customer In-Store Billing &amp; Coin Redemption</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Enter customer mobile number, calculate eligible B5 Coins at {storeDiscountPercentage}%, and dispatch payment request.
            </p>
          </div>

          {/* STEP 1: CUSTOMER SEARCH (Section 4) */}
          <div className="bg-cream-50/70 border border-cream-300 rounded-2xl p-4 sm:p-5 space-y-3">
            <span className="text-[11px] font-black uppercase text-gray-500 tracking-wider block">
              Step 1: Look Up Registered Customer
            </span>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Phone className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
                <input
                  type="tel"
                  maxLength={10}
                  value={searchPhoneInput}
                  onChange={(e) => setSearchPhoneInput(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCustomerSearch();
                    }
                  }}
                  placeholder="Enter 10-digit customer mobile number..."
                  className="w-full pl-10 pr-3 py-2 bg-white border border-cream-300 rounded-xl text-xs font-mono font-bold text-darkbrown-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <button
                type="button"
                onClick={() => handleCustomerSearch()}
                disabled={isSearchingCustomer}
                className="px-5 py-2 bg-blue-900 hover:bg-blue-800 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
              >
                {isSearchingCustomer ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                <span>Search Customer</span>
              </button>
            </div>

            {customerSearchError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{customerSearchError}</span>
              </div>
            )}

            {/* Customer Details Display Card */}
            {searchedCustomer && (
              <div className="bg-white border-2 border-emerald-500/40 rounded-2xl p-4 shadow-xs animate-in zoom-in-95">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-900 flex items-center justify-center font-black text-sm shrink-0">
                      <UserCheck className="w-5 h-5 text-emerald-700" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-darkbrown-900">{searchedCustomer.name}</span>
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Verified Member
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Customer ID: <span className="font-mono font-bold text-darkbrown-900">{searchedCustomer.customerCode || searchedCustomer.id}</span>
                        <span className="mx-2">&bull;</span>
                        Mobile: <span className="font-mono font-semibold">{searchedCustomer.mobile}</span>
                      </p>
                    </div>
                  </div>

                  {/* Available Coin Balance Card */}
                  <div className="bg-amber-50 border border-amber-200 px-4 py-2.5 rounded-xl text-right sm:text-right shrink-0">
                    <span className="text-[10px] text-amber-800 font-bold uppercase block">Available B5 Coins</span>
                    <div className="flex items-center justify-end gap-1.5 mt-0.5">
                      <Coins className="w-4 h-4 text-amber-600" />
                      <span className="text-lg font-black text-amber-900 font-mono">
                        {searchedCustomer.coinBalance}
                      </span>
                      <span className="text-xs text-amber-700 font-bold">Coins (= ₹{searchedCustomer.coinBalance})</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* STEP 2: BILL AMOUNT & AUTOMATIC CALCULATION (Section 5) */}
          <form onSubmit={handleCreateBillSubmit} className="space-y-5">
            <span className="text-[11px] font-black uppercase text-gray-500 tracking-wider block">
              Step 2: Enter Bill &amp; Calculate Coin Discount
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Actual Customer Bill Amount (₹) *
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-xs font-bold text-gray-500">₹</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={billingAmount}
                    onChange={(e) => setBillingAmount(Math.max(0, Number(e.target.value)))}
                    placeholder="e.g. 200"
                    className="w-full pl-8 pr-3 py-2 bg-cream-50 border border-cream-300 rounded-xl text-sm font-black text-darkbrown-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    required
                  />
                </div>
                <span className="text-[10px] text-gray-500 mt-1 block">
                  Original merchandise or grocery purchase total
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Purchased Items / Bill Summary
                </label>
                <input
                  type="text"
                  value={billingSummary}
                  onChange={(e) => setBillingSummary(e.target.value)}
                  placeholder="e.g. Native Gingelly Oil (1L), Foxtail Millet (1kg)"
                  className="w-full px-3 py-2 bg-cream-50 border border-cream-300 rounded-xl text-xs font-semibold text-darkbrown-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <span className="text-[10px] text-gray-500 mt-1 block">
                  Item details shown to customer on receipt
                </span>
              </div>
            </div>

            {/* LIVE CALCULATION BREAKDOWN MATRIX */}
            <div className="bg-gradient-to-br from-cream-100 to-amber-50/50 border border-amber-200 rounded-2xl p-4 sm:p-5 space-y-3">
              <span className="text-xs font-extrabold text-darkbrown-900 block border-b border-amber-200/60 pb-2">
                Live POS Coin Discount Breakdown
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 text-center">
                <div className="bg-white p-2.5 rounded-xl border border-cream-200 shadow-2xs">
                  <span className="text-[10px] text-gray-500 font-bold uppercase block">Original Bill</span>
                  <span className="text-sm font-black text-darkbrown-900 mt-0.5 block">₹{billAmountNum}</span>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-cream-200 shadow-2xs">
                  <span className="text-[10px] text-gray-500 font-bold uppercase block">Store Discount</span>
                  <span className="text-sm font-black text-blue-900 mt-0.5 block">{storeDiscountPercentage}%</span>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-cream-200 shadow-2xs">
                  <span className="text-[10px] text-gray-500 font-bold uppercase block">Eligible Coins</span>
                  <span className="text-sm font-black text-amber-700 mt-0.5 block font-mono">{eligibleCoinsRaw}</span>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-cream-200 shadow-2xs">
                  <span className="text-[10px] text-gray-500 font-bold uppercase block">Customer Coins</span>
                  <span className="text-sm font-black text-amber-800 mt-0.5 block font-mono">{availableCustomerCoins}</span>
                </div>

                <div className="bg-amber-100/70 p-2.5 rounded-xl border border-amber-300 shadow-2xs">
                  <span className="text-[10px] text-amber-900 font-black uppercase block">Coins Redeemed</span>
                  <span className="text-sm font-black text-amber-900 mt-0.5 block font-mono">
                    {actualCoinsToRedeem} <span className="text-[10px] font-normal">(-₹{actualCoinsToRedeem})</span>
                  </span>
                </div>

                <div className="bg-emerald-950 p-2.5 rounded-xl text-white shadow-sm">
                  <span className="text-[10px] text-emerald-300 font-black uppercase block">Final Payable</span>
                  <span className="text-sm sm:text-base font-black text-amber-300 mt-0.5 block">
                    ₹{remainingPayableAmount}
                  </span>
                </div>
              </div>

              {actualCoinsToRedeem < eligibleCoinsRaw && searchedCustomer && (
                <p className="text-[11px] text-amber-800 font-semibold bg-amber-100/60 p-2 rounded-lg flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Customer only has {availableCustomerCoins} B5 Coins. Redeeming {actualCoinsToRedeem} coins, and the remaining payable is ₹{remainingPayableAmount}.</span>
                </p>
              )}
            </div>

            {billCreationError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{billCreationError}</span>
              </div>
            )}

            {/* Submit Action Button */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={isCreatingBill || !searchedCustomer || billAmountNum <= 0}
                className="w-full sm:w-auto px-7 py-3 bg-gradient-to-r from-emerald-800 via-emerald-700 to-magizh-800 hover:from-emerald-900 hover:to-magizh-900 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isCreatingBill ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 text-amber-300" />
                )}
                <span>Send Payment Request to Customer (₹{remainingPayableAmount})</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: PENDING TRANSACTIONS & PAYMENT APPROVAL (Section 8 & 9) */}
      {activeTab === 'pending' && (
        <div className="bg-white rounded-3xl border border-cream-300 p-5 shadow-2xs space-y-6 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-cream-200 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-darkbrown-900 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-600" />
                  <span>Pending In-Store Bills &amp; Payment Approval</span>
                </h2>
                <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                  {pendingBills.length} Ready for Cashier
                </span>
                {awaitingCustomerBills.length > 0 && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                    {awaitingCustomerBills.length} Awaiting Customer
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Customer confirmed payments appear here. Verify cash or bank alert with UTR, then click confirm to complete transaction and deduct B5 Coins.
              </p>
            </div>
            <button
              onClick={loadServerBills}
              disabled={isLoadingBills}
              className="text-xs font-bold text-blue-800 hover:text-blue-900 flex items-center gap-1 self-start sm:self-center bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{isLoadingBills ? 'Refreshing...' : 'Refresh Bills'}</span>
            </button>
          </div>

          {/* SECTION 1: VERIFIED BILLS READY FOR CASHIER CONFIRMATION */}
          {pendingBills.length === 0 ? (
            <div className="py-10 text-center bg-cream-50/50 rounded-2xl border border-cream-200 text-xs text-gray-500 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="font-bold text-darkbrown-900 text-sm">No Pending Transactions Awaiting Verification</p>
              <p>All customer bills have been verified and processed by the cashier.</p>
              <button
                onClick={() => setActiveTab('billing')}
                className="mt-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-darkbrown-950 font-black rounded-xl text-xs shadow-xs"
              >
                Create New Customer Bill
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-xs font-bold text-darkbrown-900 flex items-center gap-1.5 text-emerald-800">
                <BadgeCheck className="w-4 h-4 text-emerald-600" />
                <span>Customer Confirmed — Action Required by Cashier ({pendingBills.length})</span>
              </div>

              {pendingBills.map((bill) => {
                const isUpi = bill.paymentMethod === 'upi' || bill.status === 'CUSTOMER_SELECTED_UPI';
                const isCash = bill.paymentMethod === 'cash' || bill.status === 'CUSTOMER_SELECTED_CASH';
                const hasUtr = !!bill.utrNumber;

                return (
                  <div
                    key={bill.id}
                    className="p-4 sm:p-5 rounded-2xl border-2 border-emerald-300 bg-gradient-to-r from-emerald-50/40 via-white to-amber-50/20 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    {/* Bill Detailed Information (All 8 Fields) */}
                    <div className="space-y-2 flex-1">
                      {/* 1. Bill #, 2. Customer Name, 3. Mobile */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-black text-blue-950 bg-blue-100 border border-blue-300 px-2.5 py-1 rounded-lg shadow-2xs">
                          #{bill.billNumber}
                        </span>
                        <span className="font-black text-sm text-darkbrown-900">
                          {bill.customerName}
                        </span>
                        <span className="font-mono text-xs text-gray-600 bg-cream-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Phone className="w-3 h-3 text-gray-500" />
                          {bill.customerPhone}
                        </span>
                        {/* 7. Payment Method Badge */}
                        <span
                          className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                            isUpi
                              ? 'bg-blue-100 text-blue-900 border-blue-400'
                              : 'bg-emerald-100 text-emerald-900 border-emerald-400'
                          }`}
                        >
                          {isUpi ? 'Payment: GPay / UPI' : 'Payment: Cash at Store'}
                        </span>
                      </div>

                      {/* 4. Bill Amount, 5. Coins Redeemed, 6. Amount Received */}
                      <div className="flex flex-wrap items-center gap-3 text-xs pt-1">
                        <span className="text-gray-600 bg-white px-2.5 py-1 rounded-lg border border-cream-300">
                          Total Bill: <strong className="text-darkbrown-900 font-black">₹{bill.originalBillAmount || bill.billAmount}</strong>
                        </span>
                        <span className="text-amber-900 bg-amber-50 border border-amber-300 px-2.5 py-1 rounded-lg font-bold">
                          Coins Redeemed: <strong className="font-mono">{bill.coinsToRedeem}</strong> (-₹{bill.coinsToRedeem})
                        </span>
                        <span className="text-emerald-900 bg-emerald-100 border-2 border-emerald-400 px-3 py-1 rounded-lg font-black text-sm">
                          Amount Received: <strong className="text-base text-emerald-950">₹{bill.payableAmount}</strong>
                        </span>
                      </div>

                      {/* 7. UPI UTR Details (if UPI) */}
                      {isUpi && (
                        <div className="flex items-center gap-2 text-xs bg-blue-50/80 border border-blue-200 px-3 py-1.5 rounded-xl">
                          <QrCode className="w-4 h-4 text-blue-700 shrink-0" />
                          <span className="font-bold text-blue-900">UPI Ref / UTR:</span>
                          {hasUtr ? (
                            <span className="font-mono font-black text-blue-950 bg-white px-2 py-0.5 rounded border border-blue-300 tracking-wider">
                              {bill.utrNumber}
                            </span>
                          ) : (
                            <span className="italic text-gray-500">Not provided by customer (Check bank SMS / app notification)</span>
                          )}
                        </div>
                      )}

                      {/* 8. Transaction Date & Time & Confirmation Status */}
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-500 pt-0.5">
                        <span className="flex items-center gap-1 font-semibold">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          Created: {bill.createdAt ? new Date(bill.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                        </span>
                        {bill.customerConfirmedAt && (
                          <span className="flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            <BadgeCheck className="w-3 h-3 text-emerald-600" />
                            Customer Confirmed: {new Date(bill.customerConfirmedAt).toLocaleTimeString('en-IN', { timeStyle: 'short' })}
                          </span>
                        )}
                        {bill.itemsSummary && (
                          <span className="text-gray-400 italic">
                            Items: {bill.itemsSummary}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Cashier Action Buttons */}
                    <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row items-stretch sm:items-center gap-2 shrink-0 pt-2 md:pt-0">
                      {/* Confirm Payment Received Button */}
                      <button
                        onClick={() =>
                          handlePartnerApproveBill(
                            bill.id,
                            isUpi
                              ? bill.utrNumber
                                ? `UPI confirmed with UTR ${bill.utrNumber}`
                                : 'UPI payment confirmed in store'
                              : 'Cash received in hand at store counter'
                          )
                        }
                        disabled={approvingBillId === bill.id || rejectingBillId === bill.id}
                        className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-green-700 hover:from-emerald-700 hover:to-green-800 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        {approvingBillId === bill.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-white" />
                        )}
                        <span>Confirm Payment Received (₹{bill.payableAmount})</span>
                      </button>

                      {/* Reject / Dispute Payment Button */}
                      <button
                        onClick={() => handlePartnerRejectBill(bill.id)}
                        disabled={approvingBillId === bill.id || rejectingBillId === bill.id}
                        className="px-3.5 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1 disabled:opacity-50"
                        title="Reject payment if cash/UPI was not received"
                      >
                        {rejectingBillId === bill.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-red-600" />
                        )}
                        <span>Reject / Dispute</span>
                      </button>

                      {/* Cancel Bill Button */}
                      <button
                        onClick={() => handleCancelBill(bill.id)}
                        disabled={approvingBillId === bill.id || rejectingBillId === bill.id}
                        className="px-2.5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold text-xs rounded-xl border border-gray-300 transition-all flex items-center justify-center"
                        title="Cancel this bill and release customer coins"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* SECTION 2: BILLS AWAITING CUSTOMER CONFIRMATION */}
          {awaitingCustomerBills.length > 0 && (
            <div className="mt-6 border-t border-cream-200 pt-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-black text-darkbrown-900 uppercase tracking-wide">
                    Bills Awaiting Customer Payment Confirmation ({awaitingCustomerBills.length})
                  </h3>
                </div>
                <span className="text-[11px] text-gray-500">
                  Waiting for customer to tap &quot;I Have Paid Cash&quot; or &quot;I Have Completed UPI Payment&quot;
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {awaitingCustomerBills.map((b) => (
                  <div
                    key={b.id}
                    className="p-3.5 bg-cream-50/60 border border-cream-300 rounded-2xl flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-blue-900 bg-blue-100 px-2 py-0.5 rounded text-[11px]">
                          #{b.billNumber}
                        </span>
                        <span className="font-bold text-darkbrown-900">{b.customerName}</span>
                        <span className="font-mono text-gray-500 text-[11px]">({b.customerPhone})</span>
                      </div>
                      <div className="text-[11px] text-gray-600 mt-1 flex items-center gap-2">
                        <span>Payable: <strong className="text-emerald-800">₹{b.payableAmount}</strong></span>
                        <span>&bull;</span>
                        <span>Coins: <strong className="text-amber-800">{b.coinsToRedeem}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-1 rounded-lg">
                        Customer Checkout Open
                      </span>
                      <button
                        onClick={() => handleCancelBill(b.id)}
                        className="text-gray-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50"
                        title="Cancel Bill"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: TRANSACTION HISTORY & REPORTS (Section 10) */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-3xl border border-cream-300 p-5 shadow-2xs space-y-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cream-200 pb-3">
            <div>
              <h2 className="text-base font-black text-darkbrown-900 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-b5-600" />
                <span>Store Transaction History &amp; Receipts</span>
              </h2>
              <p className="text-xs text-gray-500">
                Audit trail of completed, pending, and cancelled in-store customer bills.
              </p>
            </div>

            {/* Filter buttons */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {(['all', 'completed', 'pending', 'cancelled', 'upi', 'cash'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setHistoryFilter(filter)}
                  className={`px-2.5 py-1 rounded-lg font-bold capitalize transition-all ${
                    historyFilter === filter
                      ? 'bg-blue-900 text-white shadow-2xs'
                      : 'bg-cream-100 text-gray-600 hover:bg-cream-200'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {filteredHistoryBills.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-500">
              No transactions found matching the selected filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-cream-200 text-gray-500 font-bold uppercase text-[10px]">
                    <th className="py-2.5 px-3">Bill / Receipt</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Bill Amount</th>
                    <th className="py-2.5 px-3">Coins Redeemed</th>
                    <th className="py-2.5 px-3">Amount Received</th>
                    <th className="py-2.5 px-3">Payment</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-100">
                  {filteredHistoryBills.map((b) => (
                    <tr key={b.id} className="hover:bg-cream-50/60 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-950">
                        <div>#{b.billNumber}</div>
                        {b.receiptNumber && (
                          <span className="text-[10px] text-emerald-700 block font-normal">
                            Receipt: {b.receiptNumber}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-darkbrown-900 block">{b.customerName}</span>
                        <span className="text-[10px] text-gray-500 font-mono">{b.customerPhone}</span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-darkbrown-900">
                        ₹{b.originalBillAmount || b.billAmount}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-amber-700">
                        {b.coinsToRedeem} Coins
                      </td>
                      <td className="py-2.5 px-3 font-mono font-black text-emerald-800">
                        ₹{b.payableAmount}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded-full bg-cream-100 text-darkbrown-800">
                          {b.paymentMethod || 'In-Store'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                            b.status === 'COMPLETED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : b.status === 'CANCELLED' || b.status === 'REJECTED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-gray-500 whitespace-nowrap">
                        {b.createdAt ? new Date(b.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB: PARTNER MONTHLY COIN REPORT (Section 5) */}
      {activeTab === 'monthlyCoinReport' && (
        <div className="bg-white rounded-3xl border border-cream-300 p-5 sm:p-6 shadow-2xs space-y-6 animate-in fade-in">
          {/* Header & Month Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-cream-200 pb-4">
            <div>
              <h2 className="text-base sm:text-lg font-black text-darkbrown-900 flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-600" />
                <span>Partner Monthly Coin Ledger &amp; Earnings Summary</span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Audit trail of partner reward coins earned (5% × {partnerBonusMultiplier} multiplier), customer coins redeemed, and store transactions.
              </p>
            </div>

            {/* 1. Month Selector */}
            <div className="flex items-center gap-2 bg-cream-50 p-1.5 rounded-2xl border border-cream-300 self-start sm:self-center">
              <Calendar className="w-4 h-4 text-amber-700 ml-2" />
              <label htmlFor="partner-month-select" className="text-xs font-bold text-gray-700">Month:</label>
              <select
                id="partner-month-select"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-white px-3 py-1.5 rounded-xl border border-cream-300 text-xs font-bold text-darkbrown-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {availableMonths.map((m) => (
                  <option key={m.val} value={m.val}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2 & 6. Monthly Summary Cards (KPIs) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            {/* Card 1: Total Partner Coins */}
            <div className="p-4 bg-gradient-to-br from-amber-500/15 via-amber-50 to-orange-50/20 border-2 border-amber-300 rounded-2xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase text-amber-900">Partner Coins Earned</span>
                <Coins className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-2xl font-black text-amber-950 font-mono">
                {totalMonthlyPartnerCoins.toLocaleString('en-IN')}
              </p>
              <p className="text-[10px] text-amber-800 font-semibold">
                5% commission × {partnerBonusMultiplier} multiplier
              </p>
            </div>

            {/* Card 2: Customer Coins Redeemed */}
            <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50/30 border border-blue-200 rounded-2xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase text-blue-900">Coins Redeemed</span>
                <TrendingUp className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-2xl font-black text-blue-950 font-mono">
                {totalMonthlyCoinsRedeemed.toLocaleString('en-IN')}
              </p>
              <p className="text-[10px] text-blue-700 font-semibold">
                Customer savings at counter: ₹{totalMonthlyCoinsRedeemed.toLocaleString('en-IN')}
              </p>
            </div>

            {/* Card 3: Total Sales Volume */}
            <div className="p-4 bg-cream-50/80 border border-cream-300 rounded-2xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase text-darkbrown-800">Total In-Store Sales</span>
                <Receipt className="w-4 h-4 text-darkbrown-600" />
              </div>
              <p className="text-2xl font-black text-darkbrown-900 font-mono">
                ₹{totalMonthlySales.toLocaleString('en-IN')}
              </p>
              <p className="text-[10px] text-gray-500">
                {monthCompletedBills.length} completed transactions
              </p>
            </div>

            {/* Card 4: Store Cash / UPI Collected */}
            <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase text-emerald-900">Cash / UPI Collected</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-black text-emerald-950 font-mono">
                ₹{totalMonthlyCollected.toLocaleString('en-IN')}
              </p>
              <p className="text-[10px] text-emerald-700 font-semibold">
                Directly received by cashier
              </p>
            </div>
          </div>

          {/* 7. Previous Month Comparison */}
          <div className="p-3.5 bg-gradient-to-r from-cream-50 to-amber-50/30 border border-cream-300 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-700 shrink-0" />
              <span className="font-bold text-darkbrown-900">
                Previous Month Comparison ({prevMonthStr}):
              </span>
              <span className="text-gray-600">
                {prevMonthCompleted.length} transactions, {prevMonthPartnerCoins} partner coins earned.
              </span>
            </div>
            <div className="font-mono font-bold text-xs">
              {totalMonthlyPartnerCoins >= prevMonthPartnerCoins ? (
                <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                  +{totalMonthlyPartnerCoins - prevMonthPartnerCoins} Coins vs Prev Month
                </span>
              ) : (
                <span className="text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                  -{prevMonthPartnerCoins - totalMonthlyPartnerCoins} Coins vs Prev Month
                </span>
              )}
            </div>
          </div>

          {/* 5. Daily Coin Summary */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-darkbrown-900 uppercase tracking-wide flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-600" />
                <span>Daily Coin Summary &amp; POS Settlements</span>
              </h3>
              <span className="text-[11px] text-gray-500">
                {dailySummary.length} Active Days
              </span>
            </div>

            {dailySummary.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-500 bg-cream-50/50 rounded-xl border border-cream-200">
                No verified transactions recorded for this month.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-cream-200">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-cream-100/60 border-b border-cream-200 text-gray-600 font-bold uppercase text-[10px]">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Bills Count</th>
                      <th className="py-2.5 px-3">Customer Coins Redeemed</th>
                      <th className="py-2.5 px-3">Amount Collected (₹)</th>
                      <th className="py-2.5 px-3">Partner Reward Coins</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream-100">
                    {dailySummary.map((row) => (
                      <tr key={row.date} className="hover:bg-cream-50/60">
                        <td className="py-2.5 px-3 font-mono font-bold text-darkbrown-900">
                          {new Date(row.date).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-gray-700">
                          {row.billsCount} bills
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-amber-800">
                          {row.coinsRedeemed} Coins
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-emerald-800">
                          ₹{row.collected.toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-black text-amber-950 bg-amber-50/50">
                          +{row.partnerCoins} Coins
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 3 & 4. Per-Bill & Customer-Wise Transaction Details */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-darkbrown-900 uppercase tracking-wide flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-700" />
                <span>Per-Bill &amp; Customer-Wise Transaction Breakdown ({monthCompletedBills.length})</span>
              </h3>
            </div>

            {monthCompletedBills.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-500 bg-cream-50/50 rounded-xl border border-cream-200">
                No completed bills found for {selectedMonth}.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-cream-200">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-cream-100/60 border-b border-cream-200 text-gray-600 font-bold uppercase text-[10px]">
                      <th className="py-2.5 px-3">Bill / Receipt</th>
                      <th className="py-2.5 px-3">Customer Details</th>
                      <th className="py-2.5 px-3">Original Bill</th>
                      <th className="py-2.5 px-3">Coins Redeemed</th>
                      <th className="py-2.5 px-3">Cashier Collected</th>
                      <th className="py-2.5 px-3">Partner Reward</th>
                      <th className="py-2.5 px-3">Payment Method</th>
                      <th className="py-2.5 px-3">Date &amp; Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream-100">
                    {monthCompletedBills.map((b) => {
                      const reward =
                        b.partnerRewardCoins ||
                        Math.round((b.originalBillAmount || b.billAmount || 0) * 0.05 * partnerBonusMultiplier);

                      return (
                        <tr key={b.id} className="hover:bg-cream-50/60">
                          <td className="py-2.5 px-3 font-mono font-bold text-blue-950">
                            <div>#{b.billNumber}</div>
                            {b.receiptNumber && (
                              <span className="text-[10px] text-emerald-700 block font-normal">
                                {b.receiptNumber}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-darkbrown-900 block">{b.customerName}</span>
                            <span className="text-[10px] text-gray-500 font-mono">{b.customerPhone}</span>
                          </td>
                          <td className="py-2.5 px-3 font-bold text-darkbrown-900">
                            ₹{b.originalBillAmount || b.billAmount}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-amber-700">
                            {b.coinsToRedeem} Coins
                          </td>
                          <td className="py-2.5 px-3 font-mono font-black text-emerald-800">
                            ₹{b.payableAmount}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-black text-amber-900 bg-amber-50/40">
                            +{reward} Coins
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded-full bg-cream-100 text-darkbrown-800 block w-max">
                              {b.paymentMethod || 'In-Store'}
                            </span>
                            {b.utrNumber && (
                              <span className="font-mono text-[9px] text-blue-900 block mt-0.5">
                                UTR: {b.utrNumber}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-gray-500 whitespace-nowrap">
                            {b.createdAt ? new Date(b.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: DEDICATED STORE REGISTRATION & UPI SETTINGS (Section 3) */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-3xl border border-cream-300 p-5 sm:p-7 shadow-2xs space-y-6 animate-in fade-in">
          <div>
            <h2 className="text-base sm:text-lg font-black text-darkbrown-900 flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-700" />
              <span>Store Configuration &amp; Merchant UPI Settings</span>
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Every store registers exactly ONE UPI ID. Customer in-store payments are directed straight to your registered UPI ID.
            </p>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Partner Store Name
                </label>
                <input
                  type="text"
                  value={shopNameInput}
                  onChange={(e) => setShopNameInput(e.target.value)}
                  className="w-full px-3 py-2 bg-cream-50 border border-cream-300 rounded-xl text-xs font-bold text-darkbrown-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Store Category
                </label>
                <input
                  type="text"
                  value={storeCategoryInput}
                  onChange={(e) => setStoreCategoryInput(e.target.value)}
                  placeholder="e.g. Organic Groceries & Millets"
                  className="w-full px-3 py-2 bg-cream-50 border border-cream-300 rounded-xl text-xs font-bold text-darkbrown-900 focus:outline-none focus:ring-2 focus:ring-blue-700"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Store Owner Name (Registered)
                </label>
                <input
                  type="text"
                  value={activePartner.ownerName}
                  disabled
                  className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-xl text-xs text-gray-600 font-bold cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Registered Mobile Number
                </label>
                <input
                  type="text"
                  value={activePartner.mobile}
                  disabled
                  className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-xl text-xs font-mono text-gray-600 font-bold cursor-not-allowed"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Store Address
                </label>
                <input
                  type="text"
                  value={shopAddressInput}
                  onChange={(e) => setShopAddressInput(e.target.value)}
                  className="w-full px-3 py-2 bg-cream-50 border border-cream-300 rounded-xl text-xs text-darkbrown-900 focus:outline-none focus:ring-2 focus:ring-blue-700 font-semibold"
                  required
                />
              </div>
            </div>

            {/* SINGLE UPI ID CONFIGURATION (Section 3) */}
            <div className="bg-gradient-to-br from-blue-50/70 to-indigo-50/40 border-2 border-blue-200 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-blue-950 flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-blue-700" />
                    <span>Store Merchant UPI ID &amp; QR Code (Exactly One UPI ID)</span>
                  </h3>
                  <p className="text-xs text-blue-900/80 mt-0.5">
                    Customer UPI payments for in-store bills are routed exclusively to this UPI ID.
                  </p>
                </div>
                <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2 py-0.5 rounded-full uppercase shrink-0">
                  Direct Settlement
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div>
                  <label className="block text-xs font-bold text-blue-950 mb-1">
                    Store UPI ID (VPA) *
                  </label>
                  <input
                    type="text"
                    value={upiInput}
                    onChange={(e) => setUpiInput(e.target.value.trim())}
                    placeholder="e.g. kovaiorganics@okhdfcbank"
                    className="w-full px-3 py-2.5 bg-white border border-blue-300 rounded-xl text-xs font-mono font-bold text-darkbrown-900 focus:outline-none focus:ring-2 focus:ring-blue-600 shadow-2xs"
                    required
                  />
                  <span className="text-[10px] text-gray-500 mt-1 block">
                    Must be in standard UPI format (e.g. mobile@bank or shopname@upi).
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-blue-950 mb-1">
                    Store B5 Coin Discount Cap Percentage (%) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="5"
                      max="50"
                      value={discountCapInput}
                      onChange={(e) => setDiscountCapInput(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-blue-300 rounded-xl text-xs font-mono font-bold text-darkbrown-900 focus:outline-none focus:ring-2 focus:ring-blue-600 shadow-2xs"
                      required
                    />
                    <span className="absolute right-3.5 top-2 text-xs font-bold text-gray-500">%</span>
                  </div>
                  <span className="text-[10px] text-gray-500 mt-1 block">
                    Maximum bill percentage customer can redeem using B5 Coins (5% to 50%).
                  </span>
                </div>
              </div>

              {/* Dynamic QR Code Preview */}
              <div className="bg-white p-4 rounded-xl border border-blue-100 flex flex-col sm:flex-row items-center gap-4">
                <div className="w-24 h-24 bg-cream-50 border border-blue-200 rounded-xl p-2 flex items-center justify-center shrink-0 shadow-inner">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                      `upi://pay?pa=${encodeURIComponent(upiInput || 'magizhcafee-3@okhdfcbank')}&pn=${encodeURIComponent(activePartner.shopName)}&cu=INR`
                    )}`}
                    alt="Store UPI QR Code"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="text-xs text-gray-600 space-y-1">
                  <span className="font-extrabold text-blue-950 block">Live Store UPI QR Preview</span>
                  <p className="text-[11px]">
                    Payee: <strong className="text-darkbrown-900">{activePartner.shopName}</strong>
                  </p>
                  <p className="text-[11px]">
                    VPA: <strong className="font-mono text-blue-800">{upiInput}</strong>
                  </p>
                  <span className="text-[10px] text-emerald-700 font-bold block pt-1">
                    &bull; Scanning this QR inside GPay/PhonePe pays directly to your store account.
                  </span>
                </div>
              </div>
            </div>

            {settingsError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{settingsError}</span>
              </div>
            )}

            {settingsSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{settingsSuccess}</span>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSavingSettings}
                className="px-6 py-2.5 bg-blue-900 hover:bg-blue-800 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isSavingSettings ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-amber-300" />
                )}
                <span>Save Store Settings &amp; UPI ID</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 6: ONLINE FULFILLMENT ORDERS */}
      {activeTab === 'orders' && (
        <div className="bg-white rounded-3xl border border-cream-300 p-5 shadow-2xs space-y-4 animate-in fade-in">
          <h2 className="text-base font-black text-darkbrown-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-700" />
            <span>Online Orders Assigned to {activePartner.shopName} ({partnerOrders.length})</span>
          </h2>
          {partnerOrders.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-500">
              No online fulfillment orders currently assigned to your store.
            </div>
          ) : (
            <div className="space-y-3">
              {partnerOrders.map((ord) => (
                <div key={ord.id} className="p-4 rounded-2xl border border-cream-200 bg-cream-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="font-mono font-bold text-darkbrown-900">Order #{ord.id}</span>
                    <p className="text-gray-600 mt-0.5">Amount: ₹{ord.finalPayableAmount} &bull; Customer: {ord.customerName}</p>
                    <span className="text-[10px] font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full inline-block mt-1">
                      {ord.orderStatus}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {ord.orderStatus === 'Confirmed' && (
                      <button
                        onClick={() => handleUpdateOrderStatus(ord.id, 'Packed')}
                        className="px-3 py-1.5 bg-blue-800 text-white font-bold text-xs rounded-xl"
                      >
                        Mark Packed
                      </button>
                    )}
                    {ord.orderStatus === 'Packed' && (
                      <button
                        onClick={() => handleUpdateOrderStatus(ord.id, 'Shipped')}
                        className="px-3 py-1.5 bg-emerald-800 text-white font-bold text-xs rounded-xl"
                      >
                        Mark Shipped
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 7: INVENTORY */}
      {activeTab === 'inventory' && (
        <div className="bg-white rounded-3xl border border-cream-300 p-5 shadow-2xs space-y-4 animate-in fade-in">
          <h2 className="text-base font-black text-darkbrown-900">Store Inventory &amp; Stock Levels</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {products.slice(0, 9).map((p) => (
              <div key={p.id} className="p-3.5 rounded-2xl border border-cream-200 bg-cream-50/40 text-xs space-y-1">
                <span className="font-bold text-darkbrown-900 block truncate">{p.name}</span>
                <span className="text-[11px] text-gray-500 block">{p.category}</span>
                <span className="text-[11px] font-mono text-emerald-800 font-bold block">
                  Stock: {p.variants[0]?.stock || 25} units
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legacy Modal POS In-Store Billing (Preserved for tests) */}
      {isBillingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-darkbrown-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-cream-300 w-full max-w-lg overflow-hidden animate-in zoom-in-95">
            <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base">In-Store B5 Coin POS Billing</h3>
                <p className="text-xs text-blue-200">{activePartner.shopName}</p>
              </div>
              <button
                onClick={() => setIsBillingModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleProcessInStoreTransaction} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-gray-700 font-bold mb-1">Customer Mobile Number *</label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={posCustomerPhone}
                    onChange={(e) => setPosCustomerPhone(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleLookupCustomer();
                      }
                    }}
                    placeholder="Enter 10-digit mobile number"
                    className="flex-1 p-2 bg-cream-50 border border-cream-300 rounded-xl font-bold"
                  />
                  <button
                    type="button"
                    onClick={handleLookupCustomer}
                    disabled={isLookingUpCustomer}
                    className="px-3 py-2 bg-blue-800 text-white rounded-xl font-bold flex items-center gap-1"
                  >
                    {isLookingUpCustomer ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                    <span>Lookup</span>
                  </button>
                </div>
                {customerLookupError && (
                  <p className="text-[11px] text-red-600 font-bold mt-1">{customerLookupError}</p>
                )}
                {posCustomer && (
                  <p className="text-[11px] text-emerald-800 font-bold mt-1">
                    Customer: {posCustomer.name} &bull; Coins: {posCustomerCoins}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">Bill Amount (₹) *</label>
                <input
                  type="number"
                  min="1"
                  value={posBillAmount}
                  onChange={(e) => {
                    const amt = Number(e.target.value);
                    setPosBillAmount(amt);
                    const cap = Math.floor(amt * (partnerCapPercent / 100));
                    setPosCoinsToRedeem(Math.min(posCustomerCoins, cap));
                  }}
                  className="w-full p-2 bg-cream-50 border border-cream-300 rounded-xl font-bold"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">
                  B5 Coins to Redeem (Max {partnerCapPercent}%: ₹{Math.floor(posBillAmount * (partnerCapPercent / 100))}) *
                </label>
                <input
                  type="number"
                  min="0"
                  max={Math.floor(posBillAmount * (partnerCapPercent / 100))}
                  value={posCoinsToRedeem}
                  onChange={(e) => setPosCoinsToRedeem(Number(e.target.value))}
                  className="w-full p-2 bg-cream-50 border border-cream-300 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1">Item Purchase Summary</label>
                <input
                  type="text"
                  value={posSummary}
                  onChange={(e) => setPosSummary(e.target.value)}
                  className="w-full p-2 bg-cream-50 border border-cream-300 rounded-xl"
                />
              </div>

              {posError && (
                <p className="text-[11px] text-red-600 font-bold bg-red-50 p-2 rounded-xl border border-red-200">
                  {posError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-cream-200">
                <button
                  type="button"
                  onClick={() => setIsBillingModalOpen(false)}
                  className="px-4 py-2 border border-cream-300 text-gray-700 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBill || !posCustomer}
                  className="px-4 py-2 bg-gradient-to-r from-b5-600 to-amber-600 text-white rounded-xl font-extrabold flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmittingBill ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Receipt className="w-3.5 h-3.5" />}
                  <span>Generate In-Store Bill</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
