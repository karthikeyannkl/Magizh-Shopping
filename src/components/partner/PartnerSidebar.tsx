import React from 'react';
import {
  LayoutDashboard,
  Receipt,
  Clock,
  CheckCircle2,
  Coins,
  Settings,
  Store,
  X,
  ChevronRight,
  LogOut,
  Sparkles,
  Phone,
} from 'lucide-react';
import { PartnerShop } from '../../types';

export type PartnerTab =
  | 'overview'
  | 'billing'
  | 'pending'
  | 'history'
  | 'monthlyCoinReport'
  | 'settings';

interface PartnerSidebarProps {
  activeTab: PartnerTab;
  onSelectTab: (tab: PartnerTab) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  currentShop: PartnerShop | null;
  pendingBillsCount: number;
  onLogout: () => void;
}

export const PartnerSidebar: React.FC<PartnerSidebarProps> = ({
  activeTab,
  onSelectTab,
  isOpenMobile,
  onCloseMobile,
  currentShop,
  pendingBillsCount,
  onLogout,
}) => {
  const navItems: { id: PartnerTab; label: string; subLabel: string; icon: any; badge?: number }[] = [
    {
      id: 'overview',
      label: 'Store Overview',
      subLabel: 'KPIs & Sales Summary',
      icon: LayoutDashboard,
    },
    {
      id: 'billing',
      label: 'Counter POS Billing',
      subLabel: 'Generate In-Store Bill',
      icon: Receipt,
    },
    {
      id: 'pending',
      label: 'Pending Approvals',
      subLabel: 'Verify Customer Payments',
      icon: Clock,
      badge: pendingBillsCount > 0 ? pendingBillsCount : undefined,
    },
    {
      id: 'history',
      label: 'Settled Transactions',
      subLabel: 'Approved Receipts Ledger',
      icon: CheckCircle2,
    },
    {
      id: 'monthlyCoinReport',
      label: 'Monthly Coin Report',
      subLabel: 'Ledger, 5% Rewards & Sales',
      icon: Coins,
    },
    {
      id: 'settings',
      label: 'Store Settings',
      subLabel: 'UPI QR & Bank Details',
      icon: Settings,
    },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white text-darkbrown-900 border-r border-cream-300">
      {/* Partner Store Brand Header */}
      <div className="p-5 border-b border-cream-200 bg-gradient-to-br from-magizh-900 via-magizh-800 to-darkbrown-900 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 text-darkbrown-950 flex items-center justify-center font-black shadow-md">
              <Store className="w-5 h-5 text-darkbrown-950" />
            </div>
            <div className="min-w-0">
              <h2 className="font-extrabold text-sm text-white tracking-tight truncate">
                {currentShop?.shopName || 'Magizh Partner POS'}
              </h2>
              <span className="text-[10px] font-mono text-amber-300 block">
                {currentShop?.partnerCode || 'MAG-PTR-STORE'}
              </span>
            </div>
          </div>
          {isOpenMobile && (
            <button
              onClick={onCloseMobile}
              className="p-1 rounded-lg text-cream-200 hover:text-white hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {currentShop && (
          <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] text-cream-200">
            <span className="truncate">{currentShop.ownerName}</span>
            <span className="bg-emerald-500/30 text-emerald-300 border border-emerald-400/30 px-2 py-0.5 rounded-full font-bold text-[9px] uppercase">
              {currentShop.district}
            </span>
          </div>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => {
                onSelectTab(item.id);
                if (isOpenMobile) onCloseMobile();
              }}
              className={`w-full flex items-center justify-between p-3 rounded-2xl text-left transition-all group ${
                isActive
                  ? 'bg-gradient-to-r from-magizh-900 to-magizh-800 text-white shadow-md'
                  : 'hover:bg-cream-100/70 text-darkbrown-800'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`p-2 rounded-xl transition-colors ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-cream-100 text-magizh-800 group-hover:bg-magizh-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-black block truncate leading-tight">
                    {item.label}
                  </span>
                  <span
                    className={`text-[10px] block truncate mt-0.5 ${
                      isActive ? 'text-cream-200' : 'text-gray-500'
                    }`}
                  >
                    {item.subLabel}
                  </span>
                </div>
              </div>

              {item.badge !== undefined ? (
                <span className="bg-red-500 text-white font-mono font-bold text-[10px] px-2 py-0.5 rounded-full animate-pulse shadow-xs shrink-0">
                  {item.badge}
                </span>
              ) : (
                <ChevronRight
                  className={`w-4 h-4 shrink-0 transition-transform ${
                    isActive ? 'text-amber-400' : 'text-gray-300 group-hover:translate-x-0.5'
                  }`}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Store Footer Controls */}
      <div className="p-3 border-t border-cream-200 bg-cream-50/60 space-y-2">
        <div className="flex items-center justify-between text-[11px] text-gray-500 px-2">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="font-bold text-emerald-800">Live POS Synced</span>
          </span>
          <span className="font-mono text-[10px] text-gray-400">v2.5</span>
        </div>

        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border border-red-200 text-red-700 bg-red-50/50 hover:bg-red-100/60 text-xs font-bold transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Exit Partner Portal</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen z-20">
        {sidebarContent}
      </aside>

      {/* Mobile Backdrop & Drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs animate-in fade-in"
            onClick={onCloseMobile}
          />
          <div className="fixed inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl z-50 animate-in slide-in-from-left duration-300">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
