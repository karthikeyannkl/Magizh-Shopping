import React, { useState, useEffect } from 'react';
import { CustomerHeader } from './components/common/CustomerHeader';
import { PartnerHeader } from './components/common/PartnerHeader';
import { AdminHeader } from './components/common/AdminHeader';
import { CustomerFooter } from './components/common/CustomerFooter';
import { BottomNav } from './components/common/BottomNav';
import { AuthModal } from './components/common/AuthModal';
import { HomePage } from './components/customer/HomePage';
import { ProductDetailModal } from './components/customer/ProductDetailModal';
import { CartPage } from './components/customer/CartPage';
import { CheckoutFlow } from './components/customer/CheckoutFlow';
import { OrderHistoryAndTracking } from './components/customer/OrderHistoryAndTracking';
import { B5CoinWalletPage } from './components/customer/B5CoinWalletPage';
import { CustomerAccount } from './components/customer/CustomerAccount';
import { PartnerDashboard } from './components/partner/PartnerDashboard';
import { AdminPanel } from './components/admin/AdminPanel';
import { PartnerShopsDirectory } from './components/customer/PartnerShopsDirectory';
import { PartnerAuthGuard } from './components/common/PartnerAuthGuard';
import { AdminAuthGuard } from './components/common/AdminAuthGuard';
import { RoyalCelebrationModal, CelebrationData } from './components/common/RoyalCelebrationModal';
import { IntroVideoModal } from './components/common/IntroVideoModal';
import { StorageService, subscribe } from './services/storage';
import { Product, WeightVariant, Coupon, Order, User } from './types';
import { Store, Shield, TrendingUp, Sparkles, Heart, ExternalLink } from 'lucide-react';

// Path-to-Route Mapper
export const getRouteFromPath = (pathname: string): string => {
  const p = (pathname || '/').toLowerCase().trim();
  if (p === '/admin' || p.startsWith('/admin/')) return 'admin';
  if (p === '/partner' || p.startsWith('/partner/')) return 'partner';
  if (p === '/referral' || p.startsWith('/referral/') || p === '/sales' || p.startsWith('/sales/')) return 'wallet';
  if (p === '/cart' || p.startsWith('/cart/')) return 'cart';
  if (p === '/checkout' || p.startsWith('/checkout/')) return 'checkout';
  if (p === '/orders' || p.startsWith('/orders/')) return 'orders';
  if (p === '/wallet' || p.startsWith('/wallet/')) return 'wallet';
  if (p === '/account' || p.startsWith('/account/')) return 'account';
  if (p === '/partner-shops' || p.startsWith('/partner-shops/')) return 'partner-shops';
  if (p === '/categories' || p.startsWith('/categories/')) return 'categories';
  return 'home';
};

// Route-to-Path Mapper
export const getPathFromRoute = (route: string): string => {
  switch (route) {
    case 'admin':
    case 'admin-orders':
    case 'test-suite':
      return '/admin';
    case 'partner':
    case 'partner-orders':
    case 'partner-inventory':
      return '/partner';
    case 'referral':
    case 'sales':
      return '/wallet';
    case 'cart':
      return '/cart';
    case 'checkout':
      return '/checkout';
    case 'orders':
      return '/orders';
    case 'wallet':
      return '/wallet';
    case 'account':
      return '/account';
    case 'partner-shops':
      return '/partner-shops';
    case 'categories':
      return '/categories';
    case 'home':
    default:
      return '/';
  }
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<User>(() => StorageService.getCustomerUser());
  
  // Initialize route directly from browser URL so refreshing opens the exact route
  const [currentTab, setCurrentTab] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return getRouteFromPath(window.location.pathname);
    }
    return 'home';
  });

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [checkoutCoupon, setCheckoutCoupon] = useState<Coupon | undefined>(undefined);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [returnToCheckoutAfterLogin, setReturnToCheckoutAfterLogin] = useState(false);
  const [cartCount, setCartCount] = useState(
    StorageService.getCart().reduce((acc, it) => acc + it.quantity, 0)
  );
  const [coinBalance, setCoinBalance] = useState(
    StorageService.getCoinAccount(currentUser.id).availableBalance
  );

  // Royal Celebration Modal State
  const [globalCelebration, setGlobalCelebration] = useState<CelebrationData | null>(null);
  const [isCelebrationOpen, setIsCelebrationOpen] = useState(false);

  // Intro Brand Video Modal State (Shows once per session on home entry)
  const [showIntroVideo, setShowIntroVideo] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        return !sessionStorage.getItem('magizh_intro_shown') && (window.location.pathname === '/' || window.location.pathname === '');
      } catch {
        return false;
      }
    }
    return false;
  });

  // Initial live synchronization with authoritative server backend
  useEffect(() => {
    StorageService.syncFromBackend();
  }, []);

  // Poll or check unread coin credit notifications for current customer
  useEffect(() => {
    if (currentUser && currentUser.role === 'customer' && currentUser.mobile) {
      fetch(`/api/customer/unread-notifications?customerId=${encodeURIComponent(currentUser.id)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.success && Array.isArray(data.notifications) && data.notifications.length > 0) {
            const unread = data.notifications[0];
            setGlobalCelebration({
              type: 'coin_credit',
              title: 'B5 Coins Arrived in Your Wallet!',
              message: unread.reason,
              coinsCredited: unread.coins,
              previousBalance: unread.previousBalance,
              newBalance: unread.newBalance,
              notificationId: unread.id,
            });
            setIsCelebrationOpen(true);
          }
        })
        .catch(() => {});
    }
  }, [currentUser.id, currentUser.mobile]);

  const handleCloseCelebration = () => {
    setIsCelebrationOpen(false);
    if (globalCelebration?.notificationId) {
      fetch(`/api/customer/notifications/${globalCelebration.notificationId}/mark-viewed`, {
        method: 'POST',
      }).catch(() => {});
    }
    setGlobalCelebration(null);
  };

  // Sync tab navigation with browser history & route-aware scroll restoration
  const navigateTo = (tab: string) => {
    // Protected tabs that strictly require customer login
    const protectedTabs = ['wallet', 'orders', 'partner-shops'];
    if (protectedTabs.includes(tab) && !StorageService.isAuthenticated()) {
      setAuthModalOpen(true);
      return;
    }

    setCurrentTab(tab);
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    const targetPath = getPathFromRoute(tab);
    if (typeof window !== 'undefined' && window.location.pathname !== targetPath) {
      window.history.pushState({ tab }, '', targetPath);
    }
  };

  // Browser Back / Forward Button Listener
  useEffect(() => {
    const handlePopState = () => {
      const route = getRouteFromPath(window.location.pathname);
      setCurrentTab(route);
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Guarantee route-aware scroll restoration on every view/tab change
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [currentTab]);

  // Sync storage subscriptions
  useEffect(() => {
    const unsubUser = subscribe('currentUserChanged', (u: User) => {
      setCurrentUser(u);
      setCoinBalance(StorageService.getCoinAccount(u.id).availableBalance);
    });
    const unsubCart = subscribe('cartChanged', (c) => {
      setCartCount(c.reduce((acc: number, it: any) => acc + it.quantity, 0));
    });
    const unsubCoin = subscribe('coinAccountChanged', () => {
      setCoinBalance(StorageService.getCoinAccount(currentUser.id).availableBalance);
    });

    return () => {
      unsubUser();
      unsubCart();
      unsubCoin();
    };
  }, [currentUser.id]);

  const handleAddToCart = (product: Product, variant: WeightVariant, quantity: number) => {
    StorageService.addToCart({
      productId: product.id,
      variantWeight: variant.weight,
      quantity,
      price: variant.price,
      originalPrice: variant.originalPrice,
      name: product.name,
      image: product.images[0],
      category: product.category,
    });
  };

  const handleBuyNow = (product: Product, variant: WeightVariant, quantity: number) => {
    handleAddToCart(product, variant, quantity);
    setSelectedProduct(null);
    // Buy Now strictly navigates to Cart / Order Review & Coupon stage
    navigateTo('cart');
  };

  const handleProceedToCheckout = (coupon?: Coupon) => {
    setCheckoutCoupon(coupon);
    if (!StorageService.isAuthenticated()) {
      setReturnToCheckoutAfterLogin(true);
      setAuthModalOpen(true);
      return;
    }
    navigateTo('checkout');
  };

  const handleOrderSuccess = (order: Order) => {
    navigateTo('orders');
  };

  // Render Page Content based on Route & Role Guard
  const renderContent = () => {
    // 4. /admin — Admin Login and Administration Dashboard
    if (currentTab === 'admin' || currentTab === 'admin-orders' || currentTab === 'test-suite') {
      return (
        <AdminAuthGuard
          currentUser={currentUser}
          onLoginSuccess={(_adminUser) => {
            // Admin portal session is isolated in StorageService.setAdminUser
          }}
          onNavigateStorefront={() => navigateTo('home')}
        >
          <AdminPanel />
        </AdminAuthGuard>
      );
    }

    // 2. /partner — Partner Login and Partner Dashboard
    if (currentTab === 'partner' || currentTab === 'partner-orders' || currentTab === 'partner-inventory') {
      return (
        <PartnerAuthGuard
          currentUser={currentUser}
          onLoginSuccess={(_partnerUser) => {
            // Partner portal session is isolated in StorageService.setPartnerUser
          }}
          onNavigateStorefront={() => navigateTo('home')}
        >
          <PartnerDashboard />
        </PartnerAuthGuard>
      );
    }

    // 1. / — Customer Shopping Website and Sub-Views
    switch (currentTab) {
      case 'cart':
        return (
          <CartPage
            onProceedToCheckout={handleProceedToCheckout}
            onContinueShopping={() => navigateTo('home')}
          />
        );
      case 'checkout':
        return (
          <CheckoutFlow
            coupon={checkoutCoupon}
            onOrderSuccess={handleOrderSuccess}
            onCancel={() => navigateTo('cart')}
            onOpenAuth={() => {
              setReturnToCheckoutAfterLogin(true);
              setAuthModalOpen(true);
            }}
          />
        );
      case 'orders':
        if (!StorageService.isAuthenticated()) {
          return (
            <div className="max-w-md mx-auto my-12 p-6 sm:p-8 bg-white rounded-3xl border border-cream-300 text-center space-y-4 shadow-xl">
              <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto shadow-inner">
                <Store className="w-8 h-8 text-amber-700" />
              </div>
              <h2 className="text-lg font-black text-darkbrown-900">Sign In to View Your Orders</h2>
              <p className="text-xs text-gray-600">Track shipments, live delivery timelines, and view tax invoices by signing in.</p>
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="w-full py-3 bg-magizh-800 hover:bg-magizh-900 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all"
              >
                Sign In to Your Account
              </button>
            </div>
          );
        }
        return <OrderHistoryAndTracking onContinueShopping={() => navigateTo('home')} />;
      case 'wallet':
        if (!StorageService.isAuthenticated()) {
          return (
            <div className="max-w-md mx-auto my-12 p-6 sm:p-8 bg-white rounded-3xl border border-cream-300 text-center space-y-4 shadow-xl">
              <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto shadow-inner">
                <TrendingUp className="w-8 h-8 text-amber-700" />
              </div>
              <h2 className="text-lg font-black text-darkbrown-900">Sign In to Access Your B5 Wallet</h2>
              <p className="text-xs text-gray-600">View available coin balance, transaction ledger, and special loyalty rewards.</p>
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all"
              >
                Sign In to View Wallet
              </button>
            </div>
          );
        }
        return (
          <B5CoinWalletPage
            onStartShopping={() => navigateTo('home')}
            onNavigateReferral={() => navigateTo('referral')}
          />
        );
      case 'account':
        return (
          <CustomerAccount
            onNavigateOrders={() => navigateTo('orders')}
            onNavigateWallet={() => navigateTo('wallet')}
            onNavigateReferral={() => navigateTo('referral')}
            onOpenAuth={() => setAuthModalOpen(true)}
          />
        );
      case 'partner-shops':
        if (!StorageService.isAuthenticated()) {
          return (
            <div className="max-w-md mx-auto my-12 p-6 sm:p-8 bg-white rounded-3xl border border-cream-300 text-center space-y-4 shadow-xl">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto shadow-inner">
                <Store className="w-8 h-8 text-emerald-800" />
              </div>
              <h2 className="text-lg font-black text-darkbrown-900">Sign In for Partner Shopping</h2>
              <p className="text-xs text-gray-600">Please sign in to locate authorized franchise shops and redeem your B5 Coins in-store.</p>
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="w-full py-3 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all"
              >
                Sign In to Continue
              </button>
            </div>
          );
        }
        return <PartnerShopsDirectory key={currentUser.id} onBackToShopping={() => navigateTo('home')} />;
      case 'categories':
      case 'home':
      default:
        return (
          <HomePage
            onSelectProduct={(p) => setSelectedProduct(p)}
            onAddToCart={handleAddToCart}
            onBuyNow={handleBuyNow}
            onNavigateCategory={() => navigateTo('home')}
            onNavigatePartnerShops={() => {
              if (!StorageService.isAuthenticated()) {
                setAuthModalOpen(true);
              } else {
                navigateTo('partner-shops');
              }
            }}
          />
        );
    }
  };

  const relatedProducts = selectedProduct
    ? StorageService.getProducts().filter((p) => p.id !== selectedProduct.id && p.category === selectedProduct.category)
    : [];

  const isAdminRoute =
    currentTab === 'admin' || currentTab === 'admin-orders' || currentTab === 'test-suite';
  const isPartnerRoute =
    currentTab === 'partner' ||
    currentTab === 'partner-orders' ||
    currentTab === 'partner-inventory';
  const isCustomerRoute = !isAdminRoute && !isPartnerRoute;

  return (
    <div className="min-h-screen flex flex-col bg-cream-100 text-darkbrown-900 selection:bg-magizh-100 selection:text-magizh-900">
      {/* Route-Specific Authenticated Layout Headers */}
      {isAdminRoute && (
        <AdminHeader
          onNavigateStorefront={() => navigateTo('home')}
          onLogout={() => {
            StorageService.adminLogout();
            navigateTo('admin');
          }}
        />
      )}

      {isPartnerRoute && (
        <PartnerHeader
          onNavigateStorefront={() => navigateTo('home')}
          onLogout={() => {
            StorageService.partnerLogout();
            navigateTo('partner');
          }}
        />
      )}

      {isCustomerRoute && (
        <CustomerHeader
          currentTab={currentTab}
          onNavigate={(tab) => navigateTo(tab)}
          onOpenAuth={() => setAuthModalOpen(true)}
          onLogout={() => {
            StorageService.customerLogout();
            setCurrentUser(StorageService.getCurrentUser());
          }}
        />
      )}

      {/* Main Dynamic View */}
      <main className="flex-1 w-full">{renderContent()}</main>

      {/* Customer Footer (Strictly isolated to Customer view, never on Partner or Admin) */}
      {isCustomerRoute && <CustomerFooter onNavigate={navigateTo} />}

      {/* Product Detail Modal */}
      <ProductDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={handleAddToCart}
        onBuyNow={handleBuyNow}
        relatedProducts={relatedProducts}
        onSelectProduct={(p) => setSelectedProduct(p)}
      />

      {/* Customer Registration & Login Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => {
          setAuthModalOpen(false);
          setReturnToCheckoutAfterLogin(false);
        }}
        onSuccess={(u) => {
          setCurrentUser(u);
          setCoinBalance(StorageService.getCoinAccount(u.id).availableBalance);
          fetch(`/api/customer/profile/${encodeURIComponent(u.id)}`)
            .then((r) => r.json())
            .then((d) => {
              if (d.success && d.profile?.coinAccount) {
                StorageService.saveCoinAccount(d.profile.coinAccount);
                setCoinBalance(d.profile.coinAccount.availableBalance);
                if (d.profile?.recentTransactions) {
                  StorageService.setCoinTransactions(d.profile.recentTransactions);
                }
              }
            })
            .catch(() => {});
          if (returnToCheckoutAfterLogin) {
            setReturnToCheckoutAfterLogin(false);
            navigateTo('checkout');
          }
        }}
        onRegistrationSuccess={(registeredUser) => {
          setCurrentUser(registeredUser);
          const currentBal = StorageService.getCoinAccount(registeredUser.id).availableBalance;
          setCoinBalance(currentBal);
          setGlobalCelebration({
            type: 'registration_success',
            customerName: registeredUser.name,
            customerCode: registeredUser.customerCode || 'MAG-CUST',
            coinsCredited: 0,
            newBalance: currentBal,
          });
          setIsCelebrationOpen(true);
          if (returnToCheckoutAfterLogin) {
            setReturnToCheckoutAfterLogin(false);
            navigateTo('checkout');
          }
        }}
      />

      {/* Intro Brand Reveal Video Modal */}
      {showIntroVideo && <IntroVideoModal onFinish={() => setShowIntroVideo(false)} />}

      {/* Royal Celebration Modal */}
      <RoyalCelebrationModal
        isOpen={isCelebrationOpen}
        data={globalCelebration}
        onClose={handleCloseCelebration}
        onNavigateOrders={() => {
          handleCloseCelebration();
          navigateTo('orders');
        }}
        onNavigateWallet={() => {
          handleCloseCelebration();
          navigateTo('wallet');
        }}
        onContinueShopping={() => {
          handleCloseCelebration();
          navigateTo('home');
        }}
      />

      {/* Mobile Bottom Navigation (Isolated strictly to Customer Shopping view) */}
      {isCustomerRoute && (
        <BottomNav
          currentTab={currentTab}
          onNavigate={(tab) => navigateTo(tab)}
          role={currentUser.role}
          cartCount={cartCount}
          coinBalance={coinBalance}
        />
      )}
    </div>
  );
}
