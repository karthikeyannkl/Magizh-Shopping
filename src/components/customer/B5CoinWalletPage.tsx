import React, { useState, useEffect } from 'react';
import {
  Coins,
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  RotateCcw,
  Clock,
  Sparkles,
  ShieldCheck,
  Send,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Calendar,
  XCircle,
  FileText,
  Info,
} from 'lucide-react';
import { StorageService, subscribe } from '../../services/storage';
import { B5CoinAccount, B5Transaction, CoinRuleConfig, User, ManualCoinRequest } from '../../types';

interface B5CoinWalletPageProps {
  onStartShopping: () => void;
  onNavigateReferral: () => void;
}

export const B5CoinWalletPage: React.FC<B5CoinWalletPageProps> = ({
  onStartShopping,
  onNavigateReferral,
}) => {
  const currentUser: User = StorageService.getCurrentUser();
  const [coinAccount, setCoinAccount] = useState<B5CoinAccount>(
    StorageService.getCoinAccount(currentUser.id)
  );
  const [transactions, setTransactions] = useState<B5Transaction[]>(
    StorageService.getCoinTransactions(currentUser.id)
  );
  const [rules, setRules] = useState<CoinRuleConfig>(StorageService.getCoinRules());
  
  // Manual Coin Credit Requests & Form State
  const [customerRequests, setCustomerRequests] = useState<ManualCoinRequest[]>(() => {
    return StorageService.getManualCoinRequests().filter(
      (r) => r.customerId === currentUser.id || r.customerPhone === currentUser.mobile
    );
  });
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [reqName, setReqName] = useState(currentUser.name || '');
  const [reqPhone, setReqPhone] = useState(currentUser.mobile || '');
  const [reqEmail, setReqEmail] = useState(currentUser.email || '');
  const [reqB5Id, setReqB5Id] = useState('');
  const [requestCoins, setRequestCoins] = useState(50);
  const [requestReason, setRequestReason] = useState('');
  const [requestNotice, setRequestNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadRequests = () => {
    // Try backend API first, fall back to localStorage
    if (currentUser.id) {
      fetch(`/api/customer/coin-requests?customerId=${encodeURIComponent(currentUser.id)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.success && Array.isArray(data.requests)) {
            setCustomerRequests(data.requests);
          } else {
            const local = StorageService.getManualCoinRequests().filter(
              (r) => r.customerId === currentUser.id || r.customerPhone === currentUser.mobile
            );
            setCustomerRequests(local);
          }
        })
        .catch(() => {
          const local = StorageService.getManualCoinRequests().filter(
            (r) => r.customerId === currentUser.id || r.customerPhone === currentUser.mobile
          );
          setCustomerRequests(local);
        });
    }
  };

  useEffect(() => {
    loadRequests();

    const unsubCoin = subscribe('coinAccountChanged', () => {
      setCoinAccount(StorageService.getCoinAccount(currentUser.id));
    });
    const unsubTx = subscribe('coinTransactionsChanged', () => {
      setTransactions(StorageService.getCoinTransactions(currentUser.id));
    });
    const unsubRules = subscribe('coinRulesChanged', (newRules: CoinRuleConfig) => {
      setRules(newRules);
    });
    const unsubRequests = subscribe('manualCoinRequestsChanged', () => {
      loadRequests();
    });

    return () => {
      unsubCoin();
      unsubTx();
      unsubRules();
      unsubRequests();
    };
  }, [currentUser.id]);

  const handleManualRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestReason.trim()) return;
    if (requestCoins <= 0) return;

    setIsSubmitting(true);
    try {
      StorageService.createManualCoinRequest({
        customerId: currentUser.id,
        customerName: reqName.trim() || currentUser.name,
        customerPhone: reqPhone.trim() || currentUser.mobile,
        customerEmail: reqEmail.trim() || currentUser.email,
        b5Id: reqB5Id.trim(),
        coins: requestCoins,
        reason: requestReason.trim(),
        requestedBy: currentUser.name,
      });

      setShowRequestModal(false);
      setRequestReason('');
      setReqB5Id('');
      setRequestNotice('Coin credit request submitted! Magizh Admin will manually verify and approve.');
      loadRequests();
      setTimeout(() => setRequestNotice(null), 5000);
    } catch (err: any) {
      alert(err.message || 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTxTypeInfo = (type: B5Transaction['type']) => {
    switch (type) {
      case 'credit':
      case 'manual_credit':
      case 'referral_bonus':
        return { label: 'Credit', icon: ArrowDownLeft, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
      case 'debit':
        return { label: 'Redeemed', icon: ArrowUpRight, color: 'text-b5-700 bg-b5-50 border-b5-200' };
      case 'reversal':
        return { label: 'Reversal', icon: RotateCcw, color: 'text-purple-700 bg-purple-50 border-purple-200' };
      case 'pending':
        return { label: 'Pending', icon: Clock, color: 'text-amber-700 bg-amber-50 border-amber-200' };
      default:
        return { label: 'Txn', icon: Coins, color: 'text-gray-700 bg-gray-50 border-gray-200' };
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-4 pb-28 space-y-6">
      {/* Wallet Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cream-300 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-2xl font-black text-darkbrown-900">
              B5 Coin Rewards Wallet
            </h1>
            <span className="text-xs bg-b5-600 text-white font-black px-2 py-0.5 rounded-full uppercase">
              1 Coin = ₹1
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Customer ID: <span className="font-mono font-bold text-darkbrown-900">{currentUser.customerCode}</span>
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowRequestModal(true)}
            className="px-3 py-2 bg-white hover:bg-cream-100 text-b5-800 border border-b5-300 rounded-xl text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Request Coins</span>
          </button>
          <button
            onClick={onStartShopping}
            className="px-4 py-2 bg-magizh-800 hover:bg-magizh-900 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            Shop & Redeem
          </button>
        </div>
      </div>

      {requestNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-2xl text-xs font-bold text-emerald-900 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{requestNotice}</span>
        </div>
      )}

      {/* Main Balance Hero Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-b5-700 via-b5-600 to-amber-700 text-white p-6 sm:p-8 shadow-card border border-b5-400">
        <div className="absolute top-0 right-0 -mr-10 -mt-10 w-44 h-44 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-cream-200 uppercase tracking-widest">
              <Coins className="w-4 h-4 text-amber-200" />
              <span>Available Spendable Balance</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl sm:text-5xl font-black tracking-tight text-white">
                {coinAccount.availableBalance}
              </span>
              <span className="text-lg font-bold text-cream-200">
                B5 Coins (= ₹{coinAccount.availableBalance})
              </span>
            </div>
            <p className="text-xs text-cream-200/90 max-w-md pt-1">
              Redeem up to {rules.maxRedemptionCapPercentage}% of eligible merchandise order value directly at checkout.
            </p>
          </div>

          <div className="bg-black/25 backdrop-blur-md p-3.5 rounded-2xl border border-white/15 text-xs space-y-2 shrink-0">
            <div className="flex justify-between gap-6 text-cream-200">
              <span>Total Earned:</span>
              <span className="font-bold text-white font-mono">+{coinAccount.totalEarned}</span>
            </div>
            <div className="flex justify-between gap-6 text-cream-200">
              <span>Total Redeemed:</span>
              <span className="font-bold text-white font-mono">-{coinAccount.totalRedeemed}</span>
            </div>
            <div className="flex justify-between gap-6 text-cream-200">
              <span>Pending Credits:</span>
              <span className="font-bold text-amber-300 font-mono">+{coinAccount.pendingBalance}</span>
            </div>
            {coinAccount.reversedBalance > 0 && (
              <div className="flex justify-between gap-6 text-cream-200">
                <span>Reversed:</span>
                <span className="font-bold text-red-300 font-mono">-{coinAccount.reversedBalance}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Crucial 50% Rule & Earning Rules Box */}
      <div className="bg-white rounded-2xl border border-cream-300 p-4 sm:p-5 shadow-2xs space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-magizh-700" />
          <h2 className="text-xs sm:text-sm font-extrabold text-darkbrown-900 uppercase tracking-tight">
            Configured B5 Coin Usage & Reward Rules
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-cream-50 rounded-xl border border-cream-200 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
              1. 50% Redemption Cap Rule
            </span>
            <p className="text-darkbrown-900 font-bold">
              Pay max {rules.maxRedemptionCapPercentage}% of order
            </p>
            <p className="text-[11px] text-gray-600">
              e.g. For ₹1,000 eligible merchandise, you can redeem max ₹500 coins.
            </p>
          </div>

          <div className="p-3 bg-cream-50 rounded-xl border border-cream-200 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
              2. Earning Rate on Purchase
            </span>
            <p className="text-darkbrown-900 font-bold">
              {rules.earningPercentage}% Coins on orders &ge; ₹{rules.minQualifyingOrderAmount}
            </p>
            <p className="text-[11px] text-gray-600">
              Credited automatically once the order status is marked "Completed".
            </p>
          </div>

          <div className="p-3 bg-cream-50 rounded-xl border border-cream-200 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
              3. Referral Rewards
            </span>
            <p className="text-darkbrown-900 font-bold">
              +{rules.referralRewardCoins} Coins per Qualified Friend
            </p>
            <button
              onClick={onNavigateReferral}
              className="text-[11px] text-b5-700 font-bold hover:underline"
            >
              View Referral Dashboard &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* Transaction History Ledger */}
      <div className="bg-white rounded-3xl border border-cream-300 p-4 sm:p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-cream-200 pb-3">
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-darkbrown-900">
              Coin Ledger & Transaction History
            </h2>
            <p className="text-xs text-gray-500">Every B5 Coin movement is audited and recorded</p>
          </div>
          <span className="text-xs font-mono font-bold text-gray-500">
            {transactions.length} records
          </span>
        </div>

        {transactions.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">No coin transactions yet</p>
        ) : (
          <div className="space-y-2.5">
            {transactions.map((tx) => {
              const info = getTxTypeInfo(tx.type);
              const Icon = info.icon;
              const isPositive = tx.type === 'credit' || tx.type === 'manual_credit' || tx.type === 'referral_bonus' || tx.type === 'reversal';

              return (
                <div
                  key={tx.id}
                  className="p-3 rounded-2xl border border-cream-200 hover:border-cream-300 bg-cream-50/40 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${info.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-darkbrown-900">{tx.reason}</span>
                        {tx.orderNumber && (
                          <span className="font-mono text-[10px] bg-white border border-cream-300 px-1.5 py-0.2 rounded text-gray-600">
                            {tx.orderNumber}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        {new Date(tx.timestamp).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`font-black font-mono text-sm sm:text-base block ${
                        isPositive ? 'text-emerald-700' : 'text-b5-700'
                      }`}
                    >
                      {isPositive ? '+' : '-'}{tx.amount} B5
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono">
                      Bal: {tx.balanceAfter}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Customer Coin Credit Requests History (Phase 1) */}
      <div className="bg-white rounded-3xl border border-cream-300 p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-cream-200 pb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-b5-700" />
            <div>
              <h2 className="text-sm font-extrabold text-darkbrown-900">
                My Coin Credit Requests
              </h2>
              <p className="text-[11px] text-gray-500">
                Manual coin requests submitted for Magizh Administrator approval
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowRequestModal(true)}
            className="px-3 py-1.5 bg-b5-50 hover:bg-b5-100 text-b5-800 border border-b5-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>New Request</span>
          </button>
        </div>

        {customerRequests.length === 0 ? (
          <div className="text-center py-6 text-gray-400 space-y-1">
            <Coins className="w-8 h-8 mx-auto opacity-30 text-darkbrown-400" />
            <p className="text-xs">No coin credit requests submitted yet.</p>
            <p className="text-[11px] text-gray-400">
              Zero automatic welcome coins are credited. You can submit a manual request anytime.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {customerRequests.map((req) => (
              <div
                key={req.id}
                className="p-3.5 rounded-2xl border border-cream-300 bg-cream-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-darkbrown-900 bg-white px-2 py-0.5 rounded border border-cream-300">
                      {req.id}
                    </span>
                    <span className="font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                      {req.coins} B5 Coins Requested
                    </span>
                    {req.status === 'pending' && (
                      <span className="inline-flex items-center gap-1 font-bold text-amber-800 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-full text-[10px]">
                        <Clock className="w-3 h-3 text-amber-600" />
                        Pending Admin Review
                      </span>
                    )}
                    {req.status === 'approved' && (
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded-full text-[10px]">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Approved (+{req.approvedAmount ?? req.coins} Coins Credited)
                      </span>
                    )}
                    {req.status === 'rejected' && (
                      <span className="inline-flex items-center gap-1 font-bold text-red-800 bg-red-50 border border-red-300 px-2 py-0.5 rounded-full text-[10px]">
                        <XCircle className="w-3 h-3 text-red-600" />
                        Rejected
                      </span>
                    )}
                  </div>
                  <p className="text-gray-700">
                    <strong className="text-darkbrown-900">Reason:</strong> {req.reason}
                  </p>
                  {req.b5Id && (
                    <p className="text-[11px] text-gray-500 font-mono">
                      B5 ID Ref: <span className="font-semibold">{req.b5Id}</span>
                    </p>
                  )}
                  {req.adminNotes && (
                    <p className="text-[11px] text-gray-600 bg-white/70 p-1.5 rounded-lg border border-cream-200">
                      <strong className="text-darkbrown-800">Admin Remarks:</strong> {req.adminNotes}
                    </p>
                  )}
                </div>

                <div className="text-left sm:text-right text-[11px] text-gray-400 shrink-0">
                  <p>Requested: {new Date(req.requestedAt).toLocaleDateString('en-IN')}</p>
                  {req.resolvedAt && (
                    <p className="text-gray-500">
                      Resolved: {new Date(req.resolvedAt).toLocaleDateString('en-IN')}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manual Coin Request Modal (Phase 1: Captures all required details) */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-darkbrown-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-cream-300 w-full max-w-lg p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="border-b border-cream-200 pb-3">
              <h3 className="text-base font-extrabold text-darkbrown-900 flex items-center gap-2">
                <Coins className="w-5 h-5 text-b5-600" />
                <span>Submit Coin Credit Request</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Magizh Shopping Admin manually reviews and approves coin credits. No automatic welcome coins are issued.
              </p>
            </div>

            <form onSubmit={handleManualRequest} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. Customer Name */}
                <div>
                  <label className="block font-bold text-darkbrown-800 mb-1">
                    Customer Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={reqName}
                    onChange={(e) => setReqName(e.target.value)}
                    placeholder="Full Name"
                    className="w-full p-2.5 border border-cream-300 rounded-xl bg-cream-50/50 font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-b5-500"
                    required
                  />
                </div>

                {/* 2. Registered Mobile */}
                <div>
                  <label className="block font-bold text-darkbrown-800 mb-1">
                    Registered Mobile <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={reqPhone}
                    onChange={(e) => setReqPhone(e.target.value)}
                    placeholder="10-digit mobile number"
                    pattern="[0-9]{10}"
                    className="w-full p-2.5 border border-cream-300 rounded-xl bg-cream-50/50 font-mono font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-b5-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 3. Email */}
                <div>
                  <label className="block font-bold text-darkbrown-800 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={reqEmail}
                    onChange={(e) => setReqEmail(e.target.value)}
                    placeholder="customer@example.com"
                    className="w-full p-2.5 border border-cream-300 rounded-xl bg-cream-50/50 font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-b5-500"
                  />
                </div>

                {/* 4. B5 ID (Manual Reference Only) */}
                <div>
                  <label className="block font-bold text-darkbrown-800 mb-1">
                    B5 ID (Manual Reference)
                  </label>
                  <input
                    type="text"
                    value={reqB5Id}
                    onChange={(e) => setReqB5Id(e.target.value)}
                    placeholder="e.g. B5-88492"
                    className="w-full p-2.5 border border-cream-300 rounded-xl bg-cream-50/50 font-mono font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-b5-500"
                  />
                  <span className="text-[10px] text-gray-500 block mt-0.5">
                    For manual verification by Magizh Admin only. No external API is accessed.
                  </span>
                </div>
              </div>

              {/* 5. Requested Coin Amount */}
              <div>
                <label className="block font-bold text-darkbrown-800 mb-1">
                  Requested Coin Amount (1 Coin = ₹1) <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    value={requestCoins}
                    onChange={(e) => setRequestCoins(Math.max(1, parseInt(e.target.value) || 0))}
                    className="w-32 p-2.5 border border-cream-300 rounded-xl font-mono font-black text-sm text-b5-800 bg-cream-50/50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-b5-500"
                    required
                  />
                  <div className="flex gap-1.5">
                    {[50, 100, 200, 500].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setRequestCoins(preset)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                          requestCoins === preset
                            ? 'bg-b5-600 text-white border-b5-700'
                            : 'bg-white hover:bg-cream-100 text-darkbrown-800 border-cream-300'
                        }`}
                      >
                        +{preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 6. Request Reason */}
              <div>
                <label className="block font-bold text-darkbrown-800 mb-1">
                  Reason for Coin Request <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={requestReason}
                  onChange={(e) => setRequestReason(e.target.value)}
                  placeholder="e.g. Festival goodwill campaign voucher exchange, promotional credit, or community event credit"
                  className="w-full p-2.5 border border-cream-300 rounded-xl bg-cream-50/50 font-medium focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-b5-500"
                  required
                />
              </div>

              {/* Informational note */}
              <div className="p-3 bg-cream-50 border border-cream-300 rounded-xl flex items-start gap-2 text-[11px] text-gray-600">
                <Info className="w-4 h-4 text-b5-700 shrink-0 mt-0.5" />
                <span>
                  Requests are reviewed by Magizh Shopping Administrators. Once approved, coins are atomically credited to your spendable balance and logged in your transaction ledger.
                </span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRequestModal(false)}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-cream-100 hover:bg-cream-200 text-darkbrown-800 rounded-xl font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-b5-600 hover:bg-b5-700 text-white rounded-xl font-black shadow-sm transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Submitting...' : 'Submit Request'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
