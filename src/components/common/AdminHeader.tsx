import React from 'react';
import { Shield, LogOut, ArrowLeft, ShieldCheck } from 'lucide-react';
import { StorageService } from '../../services/storage';

interface AdminHeaderProps {
  onNavigateStorefront: () => void;
  onLogout: () => void;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  onNavigateStorefront,
  onLogout,
}) => {
  const handleLogoutClick = () => {
    if (window.confirm('Are you sure you want to log out of the Administrator Console?')) {
      StorageService.adminLogout();
      onLogout();
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-gradient-to-r from-red-950 via-darkbrown-900 to-stone-900 text-white shadow-md border-b border-red-900/60 w-full overflow-hidden">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-2">
        {/* Left: Admin Portal Brand & Clearance Badge */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-red-700 to-red-900 flex items-center justify-center text-white shadow-inner shrink-0 border border-red-500/30">
            <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-extrabold text-xs sm:text-base tracking-tight text-white truncate">
                MAGIZH ADMIN
              </span>
              <span className="text-[9px] font-black uppercase tracking-wider bg-red-800/80 text-red-200 border border-red-600/50 px-1.5 py-0.2 rounded-full hidden sm:flex items-center gap-1">
                <ShieldCheck className="w-2.5 h-2.5 text-red-300" />
                <span>Super Admin</span>
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-stone-300 font-medium truncate hidden xs:block">
              Magizh Administrator &bull; <span className="font-mono text-white">admin@magizh.in</span>
            </p>
          </div>
        </div>

        {/* Right: Return to Storefront & Admin Logout */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Return to Customer Storefront */}
          <button
            onClick={onNavigateStorefront}
            className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-stone-300 hover:text-white bg-white/10 hover:bg-white/15 px-3 py-1.5 rounded-xl border border-white/10 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Storefront</span>
          </button>

          {/* Visible Admin Logout Button */}
          <button
            onClick={handleLogoutClick}
            className="flex items-center gap-1 text-[11px] sm:text-xs font-bold text-red-200 hover:text-white bg-red-900/90 hover:bg-red-800 px-2.5 sm:px-3 py-1.5 rounded-xl border border-red-700 transition-colors shadow-2xs"
            title="Log out of Admin Console"
          >
            <LogOut className="w-3.5 h-3.5 text-red-300 shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};
