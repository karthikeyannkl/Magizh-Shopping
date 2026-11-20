import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Coins,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Truck,
  Plus,
  Receipt,
  Sparkles,
  Smartphone,
  Building,
  Banknote,
  Clock,
  Home,
  Briefcase,
  Tag,
  Loader2,
  X,
  Info,
  QrCode,
  ExternalLink,
  Copy,
} from 'lucide-react';
import { StorageService } from '../../services/storage';
import {
  calculateMaxRedemption,
  validateCoinRedemption,
  processCoinDeduction,
  calculateRewardCoins,
  calculateProductWiseMaxRedemption,
  allocateProductWiseRedemption,
} from '../../services/rewardsEngine';
import {
  User,
  Address,
  CartItem,
  Coupon,
  Order,
  PaymentMethod,
  PaymentStatus,
  OrderStatus,
  B5CoinAccount,
} from '../../types';
import { RoyalCelebrationModal, CelebrationData } from '../common/RoyalCelebrationModal';

interface CheckoutFlowProps {
  coupon?: Coupon;
  onOrderSuccess: (order: Order) => void;
  onCancel: () => void;
  onOpenAuth?: () => void;
}

export const CheckoutFlow: React.FC<CheckoutFlowProps> = ({
  coupon,
  onOrderSuccess,
  onCancel,
  onOpenAuth,
}) => {
  const currentUser: User = StorageService.getCurrentUser();
  const cart: CartItem[] = StorageService.getCart();
  const coinRules = StorageService.getCoinRules();
  const [coinAccount, setCoinAccount] = useState<B5CoinAccount>(
    StorageService.getCoinAccount(currentUser.id)
  );

  // Sync live coin balance from server database
  useEffect(() => {
    if (currentUser.id && !currentUser.isGuest) {
      fetch(`/api/customer/profile/${encodeURIComponent(currentUser.id)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.success && data.profile?.coinAccount) {
            setCoinAccount(data.profile.coinAccount);
            StorageService.saveCoinAccount(data.profile.coinAccount);
          }
        })
        .catch(() => {});
    }
  }, [currentUser.id]);

  // Addresses
  const [addresses, setAddresses] = useState<Address[]>(currentUser.addresses || []);
  const [selectedAddressId, setSelectedAddressId] = useState<string>(
    addresses.find((a) => a.isDefault)?.id || addresses[0]?.id || ''
  );
  const [showNewAddressModal, setShowNewAddressModal] = useState(false);
  const [showCelebrationModal, setShowCelebrationModal] = useState(false);
  const [celebrationData, setCelebrationData] = useState<CelebrationData | null>(null);

  // All-India Address Form State
  const [addrName, setAddrName] = useState(currentUser.name || '');
  const [addrPhone, setAddrPhone] = useState(currentUser.mobile || '');
  const [doorNo, setDoorNo] = useState('');
  const [street, setStreet] = useState('');
  const [area, setArea] = useState('');
  const [landmark, setLandmark] = useState('');
  const [pinCode, setPinCode] = useState('600020');
  const [district, setDistrict] = useState('Chennai');
  const [state, setState] = useState('Tamil Nadu');
  const [city, setCity] = useState('Chennai');
  const [selectedPostOffice, setSelectedPostOffice] = useState('');
  const [postOffices, setPostOffices] = useState<string[]>([]);
  const [isPinLoading, setIsPinLoading] = useState(false);
  const [pinLookupSource, setPinLookupSource] = useState<string | null>(null);
  const [addressType, setAddressType] = useState<'Home' | 'Work' | 'Other'>('Home');
  const [addrFormError, setAddrFormError] = useState('');

  // Live PIN code lookup
  useEffect(() => {
    const cleanedPin = pinCode.trim();
    if (cleanedPin.length === 6 && /^\d{6}$/.test(cleanedPin)) {
      setIsPinLoading(true);
      fetch(`/api/pincode/${cleanedPin}`)
        .then((r) => r.json())
        .then((data) => {
          setIsPinLoading(false);
          if (data.success && data.data) {
            setDistrict(data.data.district || '');
            setState(data.data.state || '');
            setCity(data.data.city || data.data.district || '');
            const offices: string[] = Array.isArray(data.data.postOffices)
              ? data.data.postOffices
              : [];
            setPostOffices(offices);
            if (offices.length > 0) {
              setSelectedPostOffice(offices[0]);
            }
            setPinLookupSource(data.data.source || 'verified');
          }
        })
        .catch(() => {
          setIsPinLoading(false);
        });
    } else {
      setPostOffices([]);
      setPinLookupSource(null);
    }
  }, [pinCode]);

  // Calculate pricing
  const merchandiseSubtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

  let couponDiscount = 0;
  if (coupon && merchandiseSubtotal >= coupon.minOrderValue) {
    if (coupon.discountType === 'fixed') {
      couponDiscount = coupon.discountValue;
    } else {
      const discount = (merchandiseSubtotal * coupon.discountValue) / 100;
      couponDiscount = coupon.maxDiscount ? Math.min(discount, coupon.maxDiscount) : discount;
    }
  }

  // Eligible amount for coin redemption (merchandise subtotal after discount, excluding delivery/taxes)
  const eligibleAmount = Math.max(0, merchandiseSubtotal - couponDiscount);
  const deliveryCharge = eligibleAmount >= 500 || eligibleAmount === 0 ? 0 : 40;
  const taxAmount = 0; // Included in MRP

  // B5 Coin Redemption Calculation (Product-Wise Configured Caps)
  const allProducts = StorageService.getProducts(true);
  const { totalMaxCapAllowed, maxRedeemableCoins, breakdown } = calculateProductWiseMaxRedemption(
    cart,
    allProducts,
    coinAccount.availableBalance,
    20
  );
  const maxCapAllowed = totalMaxCapAllowed;

  // User selected coins to redeem (Defaults to maximum allowable or 0)
  const [coinsToRedeem, setCoinsToRedeem] = useState<number>(maxRedeemableCoins);
  const [redemptionError, setRedemptionError] = useState<string>('');

  // Keep in sync when balance or cap changes
  useEffect(() => {
    setCoinsToRedeem((prev) => Math.min(prev, maxRedeemableCoins));
  }, [maxRedeemableCoins]);

  // Payment Selection & UPI Modal State (Issue 6)
  const [paymentConfig] = useState(StorageService.getPaymentConfig());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [upiUtrInput, setUpiUtrInput] = useState('');
  const [upiCopied, setUpiCopied] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);
  const [upiActiveTab, setUpiActiveTab] = useState<'qr' | 'intent'>('qr');
  const [pendingOrderRef, setPendingOrderRef] = useState('');
  const [upiUtrError, setUpiUtrError] = useState<string | null>(null);

  // Recalculate if values change
  useEffect(() => {
    if (coinsToRedeem < 0) {
      setRedemptionError('Redemption coins cannot be negative');
    } else if (coinsToRedeem > coinAccount.availableBalance) {
      setRedemptionError(`Insufficient B5 Coins. You requested ${coinsToRedeem} but only have ${coinAccount.availableBalance} available.`);
    } else if (coinsToRedeem > maxCapAllowed) {
      setRedemptionError(`Redemption exceeds the product-configured cap of ${maxCapAllowed} B5 Coins.`);
    } else {
      setRedemptionError('');
    }
  }, [coinsToRedeem, coinAccount.availableBalance, maxCapAllowed]);

  // Final Calculations
  const coinDiscountAmount = Math.min(coinsToRedeem, maxRedeemableCoins);
  const allocatedProductRedemptions = allocateProductWiseRedemption(breakdown, coinDiscountAmount);
  const finalPayableAmount = Math.max(0, eligibleAmount - coinDiscountAmount + deliveryCharge);
  const estimatedRewardCoins = calculateRewardCoins(eligibleAmount, coinRules);

  const handleApplyMaxCoins = () => {
    setCoinsToRedeem(maxRedeemableCoins);
  };

  const handleSaveAddress = (e: React.FormEvent) => {
    e.preventDefault();
    setAddrFormError('');

    if (!doorNo.trim()) {
      setAddrFormError('Please enter Door / Flat / House number.');
      return;
    }
    if (!street.trim()) {
      setAddrFormError('Please enter Street / Road name.');
      return;
    }
    if (!/^\d{6}$/.test(pinCode.trim())) {
      setAddrFormError('Please enter a valid 6-digit PIN code.');
      return;
    }
    if (!district.trim()) {
      setAddrFormError('Please ensure District is identified via PIN code.');
      return;
    }

    const compiledAddressLine = [
      doorNo.trim(),
      street.trim(),
      area.trim(),
      selectedPostOffice ? `PO: ${selectedPostOffice}` : null,
    ]
      .filter(Boolean)
      .join(', ');

    const createdAddress: Address = {
      id: `addr-${Date.now()}`,
      name: addrName.trim() || currentUser.name,
      phone: addrPhone.trim() || currentUser.mobile,
      addressLine: compiledAddressLine,
      doorNo: doorNo.trim(),
      street: street.trim(),
      area: area.trim(),
      postOffice: selectedPostOffice,
      city: city || district,
      district: district.trim(),
      state: state.trim() || 'Tamil Nadu',
      pinCode: pinCode.trim(),
      landmark: landmark.trim(),
      addressType,
      isDefault: addresses.length === 0,
    };

    const updated = [...addresses, createdAddress];
    setAddresses(updated);
    setSelectedAddressId(createdAddress.id);

    // Save to user
    const updatedUser = { ...currentUser, addresses: updated };
    StorageService.saveUser(updatedUser);
    setShowNewAddressModal(false);
  };

  const executePlaceOrder = (method: PaymentMethod, utrNumber: string = '') => {
    const selectedAddress = addresses.find((a) => a.id === selectedAddressId);
    if (!selectedAddress) {
      alert('Please select or add a delivery address');
      return;
    }

    if (redemptionError) {
      alert(redemptionError);
      return;
    }

    const cleanUtr = (utrNumber || '').trim();
    if (method === 'UPI') {
      if (!cleanUtr) {
        setUpiUtrError('Please enter your 12-digit UPI Reference Number (UTR).');
        return;
      }
      if (!/^[A-Za-z0-9]{12}$/.test(cleanUtr)) {
        setUpiUtrError('UTR must be exactly 12 alphanumeric characters (e.g., 431289104812).');
        return;
      }
      const existing = StorageService.getOrders().find(
        (o) => o.paymentUtr && o.paymentUtr.trim().toUpperCase() === cleanUtr.toUpperCase()
      );
      if (existing) {
        setUpiUtrError(`This UTR (${cleanUtr}) was already submitted for Order #${existing.orderNumber}. Duplicate UTRs are not allowed.`);
        return;
      }
    }

    setUpiUtrError(null);
    setIsProcessing(true);

    setTimeout(() => {
      // 1. Process coin deduction atomically
      const deductionResult = processCoinDeduction(
        coinAccount,
        coinsToRedeem,
        eligibleAmount,
        '',
        coinRules.maxRedemptionCapPercentage
      );

      if (!deductionResult.success) {
        setIsProcessing(false);
        alert(deductionResult.error || 'Failed to redeem coins');
        return;
      }

      const uniqueOrderNumber = pendingOrderRef || `MAG-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

      // 2. Save updated coin account & ledger
      if (deductionResult.transaction) {
        deductionResult.transaction.orderNumber = uniqueOrderNumber;
        StorageService.recordCoinTransaction(deductionResult.transaction);
      }
      StorageService.saveCoinAccount(deductionResult.updatedAccount);
      setCoinAccount(deductionResult.updatedAccount);

      // 3. Assemble and create Order (Issue 6: Strict Payment Pending for UPI)
      const isUpi = method === 'UPI';
      const paymentStatus: PaymentStatus = isUpi
        ? 'PAYMENT_PENDING'
        : (method === 'Cash on Delivery' ? 'Pending' : 'Paid');
      const orderStatus: OrderStatus = isUpi ? 'Pending Payment' : 'Confirmed';

      const newOrder: Order = {
        id: `ord-${Date.now()}`,
        orderNumber: uniqueOrderNumber,
        customerId: currentUser.id,
        customerName: currentUser.name,
        customerPhone: currentUser.mobile,
        shippingAddress: selectedAddress,
        items: cart.map((item) => ({
          productId: item.productId,
          name: item.name,
          variantWeight: item.variantWeight,
          price: item.price,
          quantity: item.quantity,
          total: item.price * item.quantity,
          image: item.image,
        })),
        merchandiseSubtotal,
        couponCode: coupon?.code,
        couponDiscount,
        eligibleMerchandiseAmount: eligibleAmount,
        coinsRedeemed: coinsToRedeem,
        coinDiscountAmount,
        deliveryCharge,
        taxAmount,
        finalPayableAmount,
        paymentMethod: method,
        paymentStatus,
        orderStatus,
        paymentUtr: utrNumber || undefined,
        rewardCoinsEarned: estimatedRewardCoins,
        rewardCoinsCredited: false,
        productCoinRedemptions: allocatedProductRedemptions.map((b) => ({
          productId: b.productId,
          productName: b.productName,
          itemSubtotal: b.itemSubtotal,
          percentage: b.percentage,
          maxCoins: b.maxCoinsForProduct,
          coinsRedeemed: b.coinsAllocated,
        })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        timeline: [
          {
            status: orderStatus,
            timestamp: new Date().toISOString(),
            note: isUpi
              ? `Order placed via UPI. Submitted UTR: ${utrNumber || 'Pending verification'}. Payment pending Admin verification.`
              : `Order placed via ${method}. Payment status: ${paymentStatus}.`,
          },
        ],
      };

      StorageService.createOrder(newOrder);
      StorageService.clearCart();
      setIsProcessing(false);
      setShowUpiModal(false);
      setConfirmedOrder(newOrder);
      setCelebrationData({
        type: 'order_success',
        orderNumber: newOrder.orderNumber,
        orderAmount: newOrder.finalPayableAmount,
        coinsUsed: newOrder.coinsRedeemed,
        amountSaved: newOrder.coinDiscountAmount + newOrder.couponDiscount,
      });
      setShowCelebrationModal(true);
      onOrderSuccess(newOrder);
    }, 600);
  };

  const handlePlaceOrder = () => {
    const selectedAddress = addresses.find((a) => a.id === selectedAddressId);
    if (!selectedAddress) {
      alert('Please select or add a delivery address');
      return;
    }

    if (redemptionError) {
      alert(redemptionError);
      return;
    }

    if (paymentMethod === 'UPI') {
      const orderRef = pendingOrderRef || `MAG-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
      setPendingOrderRef(orderRef);
      setShowUpiModal(true);
      return;
    }

    executePlaceOrder(paymentMethod, '');
  };

  // Guard: Login required for checkout (Guests can browse, but cannot checkout or submit orders)
  if (!currentUser.id || currentUser.isGuest) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-6 animate-in fade-in">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center mx-auto shadow-md">
          <ShieldCheck className="w-9 h-9" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-black text-darkbrown-900">
            Login Required to Complete Order
          </h2>
          <p className="text-xs text-gray-600 leading-relaxed max-w-sm mx-auto">
            Guest users can freely browse products and categories. Please log in or register with your mobile number to add your delivery address, redeem B5 Coins, and proceed with secure checkout.
          </p>
        </div>
        <div className="pt-2 flex flex-col gap-2.5 max-w-xs mx-auto">
          <button
            onClick={() => onOpenAuth ? onOpenAuth() : onCancel()}
            className="w-full py-3 bg-gradient-to-r from-magizh-800 to-magizh-900 hover:from-magizh-900 hover:to-magizh-950 text-white rounded-2xl text-xs sm:text-sm font-black shadow-md flex items-center justify-center gap-2"
          >
            <span>Log In / Register with Mobile</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={onCancel}
            className="w-full py-2.5 bg-cream-100 hover:bg-cream-200 text-darkbrown-800 rounded-2xl text-xs font-bold"
          >
            Return to Cart
          </button>
        </div>
      </div>
    );
  }

  // If order confirmed, show celebration & receipt view
  if (confirmedOrder) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 pb-24 text-center space-y-6 animate-in zoom-in-95">
        <RoyalCelebrationModal
          isOpen={showCelebrationModal}
          data={celebrationData}
          onClose={() => setShowCelebrationModal(false)}
          onNavigateOrders={() => onOrderSuccess(confirmedOrder)}
          onContinueShopping={() => onOrderSuccess(confirmedOrder)}
        />
        <div
          className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto shadow-lg ${
            confirmedOrder.paymentStatus === 'PAYMENT_PENDING'
              ? 'bg-amber-100 text-amber-700 animate-pulse'
              : 'bg-emerald-100 text-emerald-700 animate-bounce'
          }`}
        >
          {confirmedOrder.paymentStatus === 'PAYMENT_PENDING' ? (
            <Clock className="w-12 h-12" />
          ) : (
            <CheckCircle2 className="w-12 h-12" />
          )}
        </div>

        <div>
          {confirmedOrder.paymentStatus === 'PAYMENT_PENDING' ? (
            <span className="text-xs font-black uppercase tracking-wider text-amber-900 bg-amber-100 border border-amber-300 px-3.5 py-1.5 rounded-full inline-flex items-center gap-1.5 shadow-2xs">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>UPI Payment Pending Admin Verification</span>
            </span>
          ) : (
            <span className="text-xs font-black uppercase tracking-wider text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full">
              Order Confirmed &bull; {confirmedOrder.paymentMethod}
            </span>
          )}

          <h1 className="text-2xl sm:text-3xl font-black text-darkbrown-900 mt-2">
            Nandri! Order #{confirmedOrder.orderNumber} Placed
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-1 max-w-md mx-auto">
            {confirmedOrder.paymentStatus === 'PAYMENT_PENDING'
              ? 'Your UPI transaction reference (UTR) has been recorded. Store administrator will verify the payment and confirm dispatch.'
              : 'We are preparing your fresh farm millets and organic groceries for dispatch.'}
          </p>
        </div>

        {/* Order Receipt Box */}
        <div className="bg-white rounded-3xl border border-cream-300 p-5 sm:p-6 text-left shadow-card space-y-4">
          <div className="flex justify-between items-center border-b border-cream-200 pb-3">
            <div>
              <span className="text-xs text-gray-500">Order Number</span>
              <p className="text-sm font-black font-mono text-darkbrown-900">
                {confirmedOrder.orderNumber}
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-gray-500">Estimated Delivery</span>
              <p className="text-xs font-bold text-emerald-800">2-3 Business Days</p>
            </div>
          </div>

          {/* Items brief */}
          <div className="space-y-2 border-b border-cream-200 pb-3">
            {confirmedOrder.items.map((it, idx) => (
              <div key={idx} className="flex justify-between text-xs">
                <span className="text-darkbrown-900 font-semibold truncate max-w-[200px] sm:max-w-xs">
                  {it.quantity}x {it.name} ({it.variantWeight})
                </span>
                <span className="font-bold text-darkbrown-800">₹{it.total}</span>
              </div>
            ))}
          </div>

          {/* Pricing summary */}
          <div className="space-y-1.5 text-xs text-gray-700 border-b border-cream-200 pb-3">
            <div className="flex justify-between">
              <span>Merchandise Subtotal</span>
              <span className="font-bold">₹{confirmedOrder.merchandiseSubtotal}</span>
            </div>
            {confirmedOrder.couponDiscount > 0 && (
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Coupon ({confirmedOrder.couponCode})</span>
                <span>-₹{confirmedOrder.couponDiscount}</span>
              </div>
            )}
            {confirmedOrder.coinsRedeemed > 0 && (
              <div className="flex justify-between text-b5-700 font-bold">
                <span>B5 Coins Redeemed (1 Coin = ₹1)</span>
                <span>-₹{confirmedOrder.coinsRedeemed}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Delivery Charge</span>
              <span>{confirmedOrder.deliveryCharge === 0 ? 'FREE' : `₹${confirmedOrder.deliveryCharge}`}</span>
            </div>
            <div className="flex justify-between text-sm font-black text-darkbrown-900 pt-1">
              <span>Amount ({confirmedOrder.paymentMethod})</span>
              <span className="text-magizh-900">₹{confirmedOrder.finalPayableAmount}</span>
            </div>
            {confirmedOrder.paymentUtr && (
              <div className="flex justify-between items-center text-xs text-blue-900 font-bold bg-blue-50 p-2.5 rounded-xl border border-blue-200 mt-2">
                <span>Submitted UPI Reference (UTR):</span>
                <span className="font-mono text-xs">{confirmedOrder.paymentUtr}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-xs font-bold pt-1.5">
              <span>Payment Status:</span>
              <span
                className={`px-2.5 py-0.5 rounded-md text-[11px] font-black uppercase ${
                  confirmedOrder.paymentStatus === 'PAYMENT_PENDING'
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : 'bg-emerald-100 text-emerald-900'
                }`}
              >
                {confirmedOrder.paymentStatus}
              </span>
            </div>
          </div>

          {/* Rewards Notice */}
          <div className="bg-gradient-to-r from-b5-50 to-amber-50 border border-b5-200 rounded-2xl p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-b5-600 text-white flex items-center justify-center shrink-0 shadow-inner">
              <Coins className="w-5 h-5" />
            </div>
            <div className="text-xs">
              <span className="font-black text-b5-900 block">
                +{confirmedOrder.rewardCoinsEarned} B5 Coins Pending!
              </span>
              <span className="text-darkbrown-700">
                Reward coins will be credited into your wallet as soon as the package is delivered.
              </span>
            </div>
          </div>

          {/* Delivery Address */}
          <div className="text-xs text-gray-600">
            <span className="font-bold text-darkbrown-900 block">Delivering To:</span>
            <p>{confirmedOrder.shippingAddress.name} ({confirmedOrder.shippingAddress.phone})</p>
            <p>{confirmedOrder.shippingAddress.addressLine}, {confirmedOrder.shippingAddress.district} - {confirmedOrder.shippingAddress.pinCode}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => onOrderSuccess(confirmedOrder)}
            className="flex-1 py-3 bg-magizh-800 hover:bg-magizh-900 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2"
          >
            <Truck className="w-4 h-4" />
            <span>Track Live Order Status</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 pb-28 space-y-6">
      {/* Checkout Progress Stepper */}
      <div className="bg-white rounded-2xl border border-cream-300 p-4 shadow-2xs">
        <div className="flex items-center justify-between text-xs font-bold text-darkbrown-900">
          <div className="flex items-center gap-1.5 text-magizh-800">
            <span className="w-5 h-5 rounded-full bg-magizh-800 text-white flex items-center justify-center text-[10px]">1</span>
            <span>Cart</span>
          </div>
          <div className="h-0.5 w-8 bg-magizh-700" />
          <div className="flex items-center gap-1.5 text-magizh-800 font-extrabold">
            <span className="w-5 h-5 rounded-full bg-magizh-800 text-white flex items-center justify-center text-[10px]">2</span>
            <span>Address & B5 Coins</span>
          </div>
          <div className="h-0.5 w-8 bg-cream-300" />
          <div className="flex items-center gap-1.5 text-gray-400">
            <span className="w-5 h-5 rounded-full bg-cream-300 text-gray-600 flex items-center justify-center text-[10px]">3</span>
            <span>Payment</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Address & Payment Selection */}
        <div className="lg:col-span-2 space-y-5">
          {/* Step 6: Select Delivery Address */}
          <div className="bg-white rounded-2xl border border-cream-300 p-4 sm:p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-cream-200 pb-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-magizh-700" />
                <h3 className="text-xs sm:text-sm font-extrabold text-darkbrown-900 uppercase tracking-tight">
                  Delivery Address
                </h3>
              </div>
              <button
                onClick={() => setShowNewAddressModal(true)}
                className="text-xs font-bold text-magizh-800 hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add New</span>
              </button>
            </div>

            {addresses.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-xs text-gray-500 mb-2">No saved address found</p>
                <button
                  onClick={() => setShowNewAddressModal(true)}
                  className="px-4 py-2 bg-magizh-800 text-white rounded-xl text-xs font-bold"
                >
                  Add Address Now
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {addresses.map((addr) => (
                  <label
                    key={addr.id}
                    className={`block p-3 rounded-xl border cursor-pointer transition-all ${
                      selectedAddressId === addr.id
                        ? 'border-magizh-700 bg-magizh-50/60 ring-2 ring-magizh-600/30'
                        : 'border-cream-300 hover:border-cream-400 bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        type="radio"
                        name="deliveryAddress"
                        checked={selectedAddressId === addr.id}
                        onChange={() => setSelectedAddressId(addr.id)}
                        className="mt-1 text-magizh-700 focus:ring-magizh-600"
                      />
                      <div className="text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-darkbrown-900">{addr.name}</span>
                          <span className="text-gray-500 font-mono">({addr.phone})</span>
                          {addr.isDefault && (
                            <span className="bg-cream-200 text-darkbrown-800 text-[10px] font-bold px-1.5 py-0.2 rounded">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-gray-600 mt-0.5">{addr.addressLine}</p>
                        <p className="text-gray-500 text-[11px]">
                          {addr.district}, {addr.state} - <span className="font-mono font-bold">{addr.pinCode}</span>
                        </p>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Step 8: B5 COIN REDEMPTION ENGINE */}
          <div className="bg-gradient-to-br from-b5-50 via-white to-amber-50 rounded-2xl border-2 border-b5-300 p-4 sm:p-5 shadow-soft space-y-4">
            <div className="flex items-center justify-between border-b border-b5-200 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-b5-600 text-white flex items-center justify-center font-black shadow-sm">
                  <Coins className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-extrabold text-b5-900 uppercase tracking-tight">
                    Redeem B5 Coins
                  </h3>
                  <span className="text-[11px] text-darkbrown-700 block">
                    1 B5 Coin = ₹1 Redemption Discount
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-gray-500 block uppercase font-bold">Your Balance</span>
                <span className="text-sm font-black text-b5-700">
                  {coinAccount.availableBalance} Coins
                </span>
              </div>
            </div>

            {/* Product-Wise Cap Breakdown Card */}
            <div className="bg-white/80 rounded-xl p-3 border border-b5-200 text-xs space-y-2.5">
              <div className="flex justify-between items-center text-[11px] border-b border-cream-200 pb-1.5">
                <span className="font-extrabold text-darkbrown-900">Product-Wise Redemption Limits</span>
                <span className="text-[10px] bg-b5-100 text-b5-900 font-black px-2 py-0.5 rounded-full">
                  1 B5 Coin = ₹1
                </span>
              </div>

              <div className="space-y-1.5">
                {breakdown.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-[11px] bg-cream-50/60 px-2 py-1.5 rounded-lg border border-cream-200">
                    <div className="truncate max-w-[200px] sm:max-w-xs">
                      <span className="font-bold text-darkbrown-900">{item.productName}</span>
                      <span className="text-gray-500 font-mono text-[10px] block">
                        ₹{item.itemSubtotal} &bull; {item.percentage}% Max Coin Cap
                      </span>
                    </div>
                    <span className="font-black text-b5-800 font-mono text-xs shrink-0">
                      Up to {item.maxCoinsForProduct} Coins
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center text-[11px] pt-1 border-t border-cream-200">
                <span className="text-gray-600 font-semibold">Total Cart Coin Cap:</span>
                <span className="font-extrabold text-b5-800 font-mono">{maxCapAllowed} Coins</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="font-bold text-darkbrown-900">Your Available Balance:</span>
                <span className="font-extrabold text-darkbrown-900 font-mono">{coinAccount.availableBalance} Coins</span>
              </div>
              <div className="flex justify-between items-center text-[11px] pt-1 border-t border-cream-200">
                <span className="font-black text-darkbrown-900">Maximum Coins You Can Redeem Now:</span>
                <span className="font-black text-emerald-800 font-mono text-xs">
                  {maxRedeemableCoins} Coins (₹{maxRedeemableCoins})
                </span>
              </div>
            </div>

            {/* Slider & Input Controls */}
            {maxRedeemableCoins > 0 ? (
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-darkbrown-800">
                    Coins to Redeem:
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-b5-800">₹</span>
                    <input
                      type="number"
                      min={0}
                      max={maxRedeemableCoins}
                      value={coinsToRedeem}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setCoinsToRedeem(Math.max(0, val));
                      }}
                      className="w-24 text-center font-mono font-bold text-sm py-1 border border-b5-300 rounded-lg focus:ring-2 focus:ring-b5-600 focus:outline-none"
                    />
                  </div>
                </div>

                <input
                  type="range"
                  min={0}
                  max={maxRedeemableCoins}
                  value={coinsToRedeem}
                  onChange={(e) => setCoinsToRedeem(Number(e.target.value))}
                  className="w-full accent-b5-600 cursor-pointer"
                />

                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    onClick={handleApplyMaxCoins}
                    className="flex-1 py-1.5 bg-b5-600 hover:bg-b5-700 text-white rounded-lg font-bold shadow-2xs transition-all"
                  >
                    Use Max ({maxRedeemableCoins} Coins)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCoinsToRedeem(Math.floor(maxRedeemableCoins / 2))}
                    className="flex-1 py-1.5 bg-cream-200 hover:bg-cream-300 text-darkbrown-900 rounded-lg font-semibold transition-all"
                  >
                    Use 50% ({Math.floor(maxRedeemableCoins / 2)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCoinsToRedeem(0)}
                    className="px-3 py-1.5 border border-cream-300 hover:bg-cream-100 text-gray-600 rounded-lg font-semibold"
                  >
                    Clear
                  </button>
                </div>

                {redemptionError && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>{redemptionError}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 bg-amber-50 rounded-xl text-xs text-amber-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                <span>
                  {coinAccount.availableBalance === 0
                    ? 'You currently have 0 B5 Coins. Place this order to start earning reward coins!'
                    : 'Eligible merchandise subtotal is ₹0.'}
                </span>
              </div>
            )}
          </div>

          {/* Step 9: Choose Payment Method */}
          <div className="bg-white rounded-2xl border border-cream-300 p-4 sm:p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-cream-200 pb-2">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-magizh-700" />
                <h3 className="text-xs sm:text-sm font-extrabold text-darkbrown-900 uppercase tracking-tight">
                  Choose Payment Method
                </h3>
              </div>
              <span className="text-[10px] font-bold text-magizh-900 bg-cream-200 px-2 py-0.5 rounded">
                Store Verified Payment
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              <label
                className="flex items-center justify-between p-3.5 rounded-xl border border-magizh-700 bg-magizh-50 ring-2 ring-magizh-600/30 font-bold cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="paymentMethod"
                    checked={true}
                    readOnly
                    className="text-magizh-700 focus:ring-magizh-600"
                  />
                  <Smartphone className="w-4 h-4 text-magizh-800 shrink-0" />
                  <span className="text-xs text-darkbrown-900">UPI (Google Pay / PhonePe / Paytm / BHIM / QR)</span>
                </div>
                <span className="text-[10px] text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full font-bold">
                  UPI Exclusive
                </span>
              </label>
            </div>

            {paymentMethod === 'UPI' && (
              <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3 text-xs space-y-1.5 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-emerald-700" />
                    <span>Store Merchant UPI ID: {paymentConfig.merchantUpiId || 'magizhcafee-3@okhdfcbank'}</span>
                  </span>
                  <span className="bg-emerald-200/80 text-emerald-900 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Intent &amp; QR
                  </span>
                </div>
                <p className="text-[11px] text-gray-600">
                  When you proceed, you will get the UPI App direct pay button, live store QR code, and UTR entry form. The order will be placed as <strong>PAYMENT_PENDING</strong> until verified by store admin.
                </p>
              </div>
            )}

            <div className="text-[11px] text-gray-500 bg-cream-50 p-2.5 rounded-xl border border-cream-200 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                256-bit secure mock payment transaction. No real credit/debit card charge in demo environment.
              </span>
            </div>
          </div>
        </div>

        {/* Right: Order Summary & Confirm Button */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-cream-300 p-4 sm:p-5 shadow-2xs space-y-4 sticky top-20">
            <h3 className="text-xs font-black text-darkbrown-900 uppercase tracking-tight border-b border-cream-200 pb-2">
              Payment Summary
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Merchandise Subtotal</span>
                <span className="font-bold text-darkbrown-900">₹{merchandiseSubtotal}</span>
              </div>

              {couponDiscount > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Coupon Discount ({coupon?.code})</span>
                  <span>-₹{couponDiscount}</span>
                </div>
              )}

              <div className="flex justify-between text-gray-600">
                <span>Eligible Merchandise</span>
                <span className="font-bold text-darkbrown-900">₹{eligibleAmount}</span>
              </div>

              {coinsToRedeem > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-b5-700 font-black">
                    <span>B5 Coins Redeemed</span>
                    <span>-₹{coinDiscountAmount}</span>
                  </div>
                  {allocatedProductRedemptions.some((a) => a.coinsAllocated > 0) && (
                    <div className="bg-b5-50/70 p-2 rounded-lg border border-b5-200 text-[10px] space-y-1 text-gray-600">
                      <div className="font-bold text-darkbrown-900 border-b border-b5-200 pb-0.5">
                        Product-Wise Deduction:
                      </div>
                      {allocatedProductRedemptions.filter((a) => a.coinsAllocated > 0).map((a, i) => (
                        <div key={i} className="flex justify-between text-darkbrown-800">
                          <span className="truncate max-w-[150px]">{a.productName} ({a.percentage}%):</span>
                          <span className="font-mono font-bold text-b5-800">-{a.coinsAllocated} Coins</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between text-gray-600">
                <span>Delivery Charge</span>
                <span>{deliveryCharge === 0 ? <strong className="text-emerald-700">FREE</strong> : `₹${deliveryCharge}`}</span>
              </div>

              <div className="flex justify-between text-gray-600">
                <span>Taxes & GST</span>
                <span className="text-gray-400">Included</span>
              </div>

              <div className="border-t border-cream-200 pt-2.5 flex justify-between items-baseline">
                <div>
                  <span className="text-sm font-black text-darkbrown-900 block">Final Payable Amount</span>
                  <span className="text-[10px] text-gray-500">via {paymentMethod}</span>
                </div>
                <span className="text-xl font-black text-magizh-900">
                  ₹{finalPayableAmount}
                </span>
              </div>
            </div>

            {/* Estimated Reward Coins Pill */}
            <div className="bg-gradient-to-r from-b5-50 to-amber-50 border border-b5-200 rounded-xl p-2.5 text-xs flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-b5-600 shrink-0" />
              <div className="text-[11px] leading-tight">
                <span className="font-bold text-b5-900">+{estimatedRewardCoins} B5 Coins</span> will be credited after order delivery.
              </div>
            </div>

            {/* Confirm Order Button */}
            <button
              onClick={handlePlaceOrder}
              disabled={isProcessing || !!redemptionError || addresses.length === 0}
              className="w-full py-3.5 bg-gradient-to-r from-magizh-700 via-magizh-800 to-magizh-900 hover:from-magizh-800 hover:to-magizh-950 text-white rounded-2xl text-xs sm:text-sm font-black shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <Clock className="w-4 h-4 animate-spin" />
                  <span>Processing Payment...</span>
                </>
              ) : (
                <>
                  <span>Confirm Order &bull; Pay ₹{finalPayableAmount}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <button
              onClick={onCancel}
              className="w-full text-center text-xs text-gray-500 hover:text-darkbrown-800 font-semibold"
            >
              Return to Cart
            </button>
          </div>
        </div>
      </div>

      {/* Add New Address Modal */}
      {showNewAddressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-darkbrown-950/60 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-cream-300 w-full max-w-lg p-5 sm:p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-cream-200 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-darkbrown-900">Add New Delivery Address</h3>
                <p className="text-[11px] text-gray-500">All-India delivery supported with automatic PIN code detection</p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewAddressModal(false)}
                className="p-1 text-gray-400 hover:text-darkbrown-800 rounded-full hover:bg-cream-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {addrFormError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{addrFormError}</span>
              </div>
            )}

            <form onSubmit={handleSaveAddress} className="space-y-3.5 text-xs">
              {/* Address Type Selector */}
              <div>
                <label className="block font-semibold text-darkbrown-800 mb-1.5">Address Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Home', 'Work', 'Other'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setAddressType(type)}
                      className={`py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 font-bold transition-all ${
                        addressType === type
                          ? 'bg-magizh-900 text-white border-magizh-900 shadow-xs'
                          : 'bg-white text-gray-700 border-cream-300 hover:bg-cream-50'
                      }`}
                    >
                      {type === 'Home' && <Home className="w-3.5 h-3.5" />}
                      {type === 'Work' && <Briefcase className="w-3.5 h-3.5" />}
                      {type === 'Other' && <Tag className="w-3.5 h-3.5" />}
                      <span>{type}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Recipient Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-darkbrown-800 mb-1">Recipient Name *</label>
                  <input
                    type="text"
                    value={addrName}
                    onChange={(e) => setAddrName(e.target.value)}
                    className="w-full p-2.5 border border-cream-300 rounded-xl focus:ring-2 focus:ring-magizh-700 focus:outline-none"
                    placeholder="Full Name"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-darkbrown-800 mb-1">Phone Number (10 digits) *</label>
                  <input
                    type="tel"
                    maxLength={10}
                    value={addrPhone}
                    onChange={(e) => setAddrPhone(e.target.value.replace(/\D/g, ''))}
                    className="w-full p-2.5 border border-cream-300 rounded-xl font-mono focus:ring-2 focus:ring-magizh-700 focus:outline-none"
                    placeholder="9876543210"
                    required
                  />
                </div>
              </div>

              {/* Door No & Street */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block font-semibold text-darkbrown-800 mb-1">Door / Flat No *</label>
                  <input
                    type="text"
                    value={doorNo}
                    onChange={(e) => setDoorNo(e.target.value)}
                    placeholder="12/A, Flat 3B"
                    className="w-full p-2.5 border border-cream-300 rounded-xl focus:ring-2 focus:ring-magizh-700 focus:outline-none"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-darkbrown-800 mb-1">Street / Road *</label>
                  <input
                    type="text"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="South Mada Street, Anna Nagar"
                    className="w-full p-2.5 border border-cream-300 rounded-xl focus:ring-2 focus:ring-magizh-700 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Area & Landmark */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-darkbrown-800 mb-1">Area / Locality</label>
                  <input
                    type="text"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="Adyar / Gandhi Nagar"
                    className="w-full p-2.5 border border-cream-300 rounded-xl focus:ring-2 focus:ring-magizh-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-darkbrown-800 mb-1">Landmark</label>
                  <input
                    type="text"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    placeholder="Opposite Pillayar Kovil"
                    className="w-full p-2.5 border border-cream-300 rounded-xl focus:ring-2 focus:ring-magizh-700 focus:outline-none"
                  />
                </div>
              </div>

              {/* PIN Code & Auto Lookup */}
              <div>
                <label className="block font-semibold text-darkbrown-800 mb-1 flex items-center justify-between">
                  <span>6-Digit PIN Code *</span>
                  {isPinLoading && (
                    <span className="text-[11px] text-magizh-700 flex items-center gap-1 font-normal">
                      <Loader2 className="w-3 h-3 animate-spin" /> Looking up district...
                    </span>
                  )}
                  {pinLookupSource && !isPinLoading && (
                    <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> PIN Verified
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 600020"
                  className="w-full p-2.5 border border-cream-300 rounded-xl font-mono text-sm font-bold text-darkbrown-900 focus:ring-2 focus:ring-magizh-700 focus:outline-none"
                  required
                />
              </div>

              {/* Post Office Selection */}
              {postOffices.length > 0 && (
                <div>
                  <label className="block font-semibold text-darkbrown-800 mb-1">
                    Select Post Office / Delivery Hub
                  </label>
                  <select
                    value={selectedPostOffice}
                    onChange={(e) => setSelectedPostOffice(e.target.value)}
                    className="w-full p-2.5 border border-cream-300 rounded-xl bg-white text-darkbrown-900 focus:ring-2 focus:ring-magizh-700 focus:outline-none"
                  >
                    {postOffices.map((po, idx) => (
                      <option key={idx} value={po}>
                        {po}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* State and District (Auto-populated from PIN code) */}
              <div className="grid grid-cols-2 gap-2.5 bg-cream-50 p-3 rounded-2xl border border-cream-200">
                <div>
                  <span className="text-[11px] font-semibold text-gray-500 block">District</span>
                  <input
                    type="text"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="w-full p-1.5 mt-0.5 bg-white border border-cream-300 rounded-lg text-xs font-bold text-darkbrown-900 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-gray-500 block">State</span>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full p-1.5 mt-0.5 bg-white border border-cream-300 rounded-lg text-xs font-bold text-darkbrown-900 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewAddressModal(false)}
                  className="flex-1 py-2.5 bg-cream-100 hover:bg-cream-200 text-darkbrown-800 rounded-xl font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-magizh-900 hover:bg-magizh-950 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all"
                >
                  Save Delivery Address
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPI Payment Modal (Section 5 & 6: Dual-Mode QR & Intent, NPCI Compliant, Mobile Responsive) */}
      {showUpiModal && (() => {
        const cleanUpiRef = (pendingOrderRef || `MAG${Date.now()}`).replace(/[^a-zA-Z0-9]/g, '').slice(0, 32);
        const merchantVpa = paymentConfig.merchantUpiId || 'magizhcafee-3@okhdfcbank';
        const merchantName = paymentConfig.merchantName || 'Magizh Shopping';
        const upiUri = `upi://pay?pa=${encodeURIComponent(merchantVpa)}&pn=${encodeURIComponent(merchantName)}&mc=5411&am=${finalPayableAmount.toFixed(2)}&tr=${cleanUpiRef}&tn=Order${cleanUpiRef}&cu=INR`;
        const qrUrl = paymentConfig.qrImageUrl || `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(upiUri)}`;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-darkbrown-950/75 backdrop-blur-xs overflow-hidden animate-in fade-in">
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-cream-300 w-full max-w-md max-h-[88dvh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
              {/* Pinned Sticky Header */}
              <div className="flex items-center justify-between border-b border-cream-200 px-4 sm:px-6 py-3 bg-white shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-800">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-extrabold text-darkbrown-900 leading-tight">
                      UPI Payment
                    </h3>
                    <p className="text-[10px] text-gray-500">Google Pay • PhonePe • Paytm • BHIM</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowUpiModal(false)}
                  className="p-1.5 text-gray-400 hover:text-darkbrown-800 rounded-full hover:bg-cream-100 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Modal Content Body */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3.5 space-y-3 overscroll-contain text-xs">
                {/* Amount & Merchant Overview Card */}
                <div className="bg-gradient-to-br from-emerald-50 via-cream-50 to-amber-50/40 p-3 rounded-2xl border border-emerald-200/80 space-y-2">
                  <div className="flex justify-between items-baseline">
                    <span className="text-gray-600 font-semibold text-xs">Payable Amount:</span>
                    <span className="text-xl sm:text-2xl font-black text-magizh-900 font-mono tracking-tight">
                      ₹{finalPayableAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] pt-1.5 border-t border-emerald-200/60">
                    <span className="text-gray-600">Merchant UPI ID:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold font-mono text-emerald-900 bg-white/80 px-1.5 py-0.5 rounded border border-emerald-200">
                        {merchantVpa}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(merchantVpa);
                          setUpiCopied(true);
                          setTimeout(() => setUpiCopied(false), 2000);
                        }}
                        className="text-[10px] bg-emerald-800 text-white font-bold px-2 py-0.5 rounded hover:bg-emerald-900 transition-colors flex items-center gap-1 shadow-2xs"
                      >
                        <Copy className="w-2.5 h-2.5" />
                        <span>{upiCopied ? 'Copied!' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-gray-500">
                    <span>Order Reference: <strong className="font-mono text-darkbrown-800">{pendingOrderRef}</strong></span>
                    <span>Merchant: <strong className="text-darkbrown-800">{merchantName}</strong></span>
                  </div>
                </div>

                {/* Dual-Mode Selector Tabs: QR Code (Default) vs Direct App */}
                <div className="grid grid-cols-2 p-1 bg-cream-100 rounded-xl gap-1 border border-cream-200">
                  <button
                    type="button"
                    onClick={() => setUpiActiveTab('qr')}
                    className={`py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      upiActiveTab === 'qr'
                        ? 'bg-white text-magizh-900 shadow-xs border border-cream-200/60'
                        : 'text-gray-600 hover:text-darkbrown-900'
                    }`}
                  >
                    <QrCode className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Scan UPI QR (Recommended)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUpiActiveTab('intent')}
                    className={`py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      upiActiveTab === 'intent'
                        ? 'bg-white text-magizh-900 shadow-xs border border-cream-200/60'
                        : 'text-gray-600 hover:text-darkbrown-900'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5 text-b5-700" />
                    <span>Open UPI App</span>
                  </button>
                </div>

                {/* TAB 1: Scan UPI QR Code View */}
                {upiActiveTab === 'qr' && (
                  <div className="bg-white border border-cream-300 rounded-2xl p-3.5 text-center space-y-2.5 shadow-2xs animate-in fade-in">
                    <div className="inline-block p-2 bg-white rounded-xl border border-cream-200 shadow-inner">
                      <img
                        src={qrUrl}
                        alt="Magizh Shopping UPI QR Code"
                        className="w-40 h-40 sm:w-44 sm:h-44 mx-auto object-contain rounded"
                        loading="eager"
                      />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-darkbrown-900">
                        Scan with Google Pay, PhonePe, Paytm, or BHIM
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        Amount ₹{finalPayableAmount.toFixed(2)} and Merchant Details are pre-filled
                      </p>
                    </div>
                    <div className="bg-emerald-50 text-emerald-800 text-[10px] rounded-lg p-2 border border-emerald-200 text-left flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                      <span>
                        <strong>Recommended:</strong> QR scanner scanning bypasses external browser app risk warnings. If on the same phone, take a screenshot of this QR and scan it inside Paytm or Google Pay scanner.
                      </span>
                    </div>
                  </div>
                )}

                {/* TAB 2: Direct UPI App Launch View */}
                {upiActiveTab === 'intent' && (
                  <div className="space-y-2.5 animate-in fade-in">
                    <a
                      href={upiUri}
                      className="w-full py-3 bg-gradient-to-r from-emerald-700 to-emerald-800 hover:from-emerald-800 hover:to-emerald-900 text-white rounded-xl text-xs sm:text-sm font-black shadow-md flex items-center justify-center gap-2 transition-all"
                    >
                      <Smartphone className="w-4 h-4" />
                      <span>Launch UPI App (GPay / PhonePe / Paytm)</span>
                      <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                    </a>

                    {/* NPCI & Paytm Risk Policy Advisory */}
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-[11px] text-amber-900 space-y-1">
                      <p className="font-bold flex items-center gap-1 text-amber-950">
                        <Info className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                        <span>Paytm &amp; NPCI Risk Policy Notice:</span>
                      </p>
                      <p className="text-[10px] leading-relaxed text-amber-900">
                        If Paytm or Google Pay displays <em>&ldquo;This payment may fail as per UPI Risk Policy to safeguard your account&rdquo;</em>, this is a standard third-party browser security restriction. Simply switch to the <strong>&ldquo;Scan UPI QR&rdquo;</strong> tab above to scan the QR directly, or copy the Merchant UPI ID: <strong>{merchantVpa}</strong> into your UPI app.
                      </p>
                    </div>
                  </div>
                )}

                {/* UTR Input Section */}
                <div className="bg-cream-50/70 border border-cream-200 rounded-2xl p-3 space-y-1.5">
                  <label className="block font-bold text-darkbrown-900 text-xs">
                    Enter 12-Digit UPI Reference Number (UTR) *
                  </label>
                  <input
                    type="text"
                    maxLength={16}
                    value={upiUtrInput}
                    onChange={(e) => setUpiUtrInput(e.target.value.replace(/[^0-9a-zA-Z]/g, ''))}
                    placeholder="e.g. 431289104812"
                    className="w-full px-3 py-2 bg-white border border-cream-300 rounded-xl font-mono font-bold text-xs focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                  />
                  <div className="flex justify-between items-center text-[10px] text-gray-500 pt-0.5">
                    <span>Found under payment receipt details in GPay / PhonePe / Paytm</span>
                    <span className="font-mono">{upiUtrInput.length}/12</span>
                  </div>
                  {upiUtrError && (
                    <div className="p-2 bg-red-100 border border-red-300 rounded-lg text-red-800 text-[11px] font-bold">
                      {upiUtrError}
                    </div>
                  )}
                </div>

                {/* Verification Notice */}
                <div className="text-[10px] text-gray-500 leading-tight text-center px-1">
                  Orders are placed as <strong>PAYMENT PENDING</strong>. Store administrator verifies your 12-digit UTR in bank statements before dispatching your package.
                </div>
              </div>

              {/* Pinned Sticky Footer Actions */}
              <div className="px-4 sm:px-6 py-3 border-t border-cream-200 bg-white shrink-0 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowUpiModal(false)}
                  className="w-1/3 py-2.5 bg-cream-100 hover:bg-cream-200 text-gray-700 rounded-xl text-xs font-bold transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => executePlaceOrder('UPI', upiUtrInput)}
                  disabled={isProcessing}
                  className="w-2/3 py-2.5 bg-gradient-to-r from-magizh-800 to-magizh-900 hover:from-magizh-900 hover:to-magizh-950 text-white rounded-xl text-xs font-black shadow-md flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                >
                  {isProcessing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>Submit &amp; Place Order</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
