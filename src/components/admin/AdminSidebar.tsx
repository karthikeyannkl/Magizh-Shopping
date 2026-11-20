import React from 'react';
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  Layers,
  Image,
  Users,
  Coins,
  CreditCard,
  Building2,
  Receipt,
  Boxes,
  BarChart3,
  Settings,
  Database,
  X,
  ChevronRight,
  ShieldAlert,
  Tag,
} from 'lucide-react';

export type AdminTab =
  | 'dashboard'
  | 'orders'
  | 'products'
  | 'categories'
  | 'gallery'
  | 'banners'
  | 'customers'
  | 'coins'
  | 'payments'
  | 'partners'
  | 'inventory'
  | 'reports'
  | 'settings'
  | 'database';

interface AdminSidebarProps {
  activeTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  badges?: {
    newOrders?: number;
    pendingCoins?: number;
    pendingPartners?: number;
    pendingBills?: number;
    lowStock?: number;
    totalProducts?: number;
    totalImages?: number;
  };
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeTab,
  onSelectTab,
  isOpenMobile,
  onCloseMobile,
  badges = {},
}) => {
  const menuItems = [
    {
      id: 'dashboard' as AdminTab,
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: undefined,
    },
    {
      id: 'orders' as AdminTab,
      label: 'Orders',
      icon: ShoppingBag,
      badge: badges.newOrders && badges.newOrders > 0 ? badges.newOrders : undefined,
      badgeColor: 'bg-red-500 text-white',
    },
    {
      id: 'products' as AdminTab,
      label: 'Products & Variants',
      icon: Package,
      badge: badges.totalProducts ? String(badges.totalProducts) : undefined,
      badgeColor: 'bg-emerald-100 text-emerald-800',
    },
    {
      id: 'categories' as AdminTab,
      label: 'Categories',
      icon: Layers,
      badge: undefined,
    },
    {
      id: 'gallery' as AdminTab,
      label: 'Image Gallery',
      icon: Image,
      badge: badges.totalImages ? String(badges.totalImages) : undefined,
      badgeColor: 'bg-indigo-100 text-indigo-800',
    },
    {
      id: 'banners' as AdminTab,
      label: 'Promotional Banners',
      icon: Tag,
      badge: undefined,
    },
    {
      id: 'customers' as AdminTab,
      label: 'Customers',
      icon: Users,
      badge: undefined,
    },
    {
      id: 'coins' as AdminTab,
      label: 'B5 Coins & Ledger',
      icon: Coins,
      badge: badges.pendingCoins && badges.pendingCoins > 0 ? badges.pendingCoins : undefined,
      badgeColor: 'bg-amber-500 text-white',
    },
    {
      id: 'payments' as AdminTab,
      label: 'Payments & UTR',
      icon: CreditCard,
      badge: undefined,
    },
    {
      id: 'partners' as AdminTab,
      label: 'Partner Franchise',
      icon: Building2,
      badge: badges.pendingPartners && badges.pendingPartners > 0 ? badges.pendingPartners : undefined,
      badgeColor: 'bg-orange-500 text-white',
    },
    {
      id: 'inventory' as AdminTab,
      label: 'Inventory & Stock',
      icon: Boxes,
      badge: badges.lowStock && badges.lowStock > 0 ? `${badges.lowStock} Low` : undefined,
      badgeColor: 'bg-red-100 text-red-700',
    },
    {
      id: 'reports' as AdminTab,
      label: 'Reports & Analytics',
      icon: BarChart3,
      badge: undefined,
    },
    {
      id: 'settings' as AdminTab,
      label: 'Store Settings',
      icon: Settings,
      badge: undefined,
    },
    {
      id: 'database' as AdminTab,
      label: 'Database & Backup',
      icon: Database,
      badge: 'Live',
      badgeColor: 'bg-emerald-600 text-white',
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-xs transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-darkbrown-900 text-cream-100 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-darkbrown-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-500 flex items-center justify-center text-white font-black shadow-md">
              M
            </div>
            <div>
              <h2 className="text-sm font-black text-white tracking-wide uppercase">Magizh Admin</h2>
              <p className="text-[10px] text-amber-400 font-semibold">Management Console</p>
            </div>
          </div>
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-darkbrown-800 transition-colors"
            aria-label="Close Sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1 text-xs font-semibold scrollbar-thin scrollbar-thumb-darkbrown-800">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white font-extrabold shadow-md'
                    : 'text-gray-300 hover:bg-darkbrown-800/80 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-amber-500/80'}`} />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`text-[10px] font-black px-1.5 py-0.5 rounded-full shrink-0 ${
                      item.badgeColor || 'bg-darkbrown-800 text-gray-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer Info */}
        <div className="p-3 border-t border-darkbrown-800 bg-darkbrown-950/60 text-[11px] text-gray-400 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-[10px]">Production Active</span>
          </div>
          <span className="text-[10px] font-mono text-gray-500">v1.2.0</span>
        </div>
      </aside>
    </>
  );
};
