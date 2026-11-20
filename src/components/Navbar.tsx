import { useState } from 'react';
import { LogOut, Menu, Shield, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type ActivePage = 'catalog' | 'detail' | 'downloads' | 'admin';

interface NavbarProps {
  activePage: ActivePage;
  onNavigate: (page: ActivePage) => void;
  onOpenAuth: () => void;
}

export function Navbar({ activePage, onNavigate, onOpenAuth }: NavbarProps) {
  const { user, isAdminUnlocked, signOutUser } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const navItems: { id: ActivePage; label: string }[] = [
    { id: 'catalog', label: 'Catalog' },
    { id: 'downloads', label: 'My Downloads' },
  ];

  const handleNavClick = (id: ActivePage) => {
    onNavigate(id);
    setMobileOpen(false);
    setAccountMenuOpen(false);
  };

  const displayName =
    user?.displayName ||
    user?.email?.split('@')[0] ||
    (isAdminUnlocked ? 'Account' : '');

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-zinc-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-element brand wordmark */}
        <button
          type="button"
          onClick={() => handleNavClick('catalog')}
          className="text-lg font-extrabold tracking-tight text-zinc-950 hover:text-emerald-700 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-600"
        >
          DroidVault
        </button>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-600"
        >
          {navItems.map((item) => {
            const isActive =
              activePage === item.id ||
              (activePage === 'detail' && item.id === 'catalog');
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
                  isActive
                    ? 'text-zinc-950 border-emerald-600 font-semibold'
                    : 'border-transparent hover:text-zinc-950 hover:border-zinc-300'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Account action (plus always-visible Admin button ONLY after unlocking) */}
        <div className="flex items-center gap-2.5 shrink-0">
          {isAdminUnlocked && (
            <button
              type="button"
              onClick={() => handleNavClick('admin')}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                activePage === 'admin'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-zinc-950 text-white hover:bg-zinc-800'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              Admin
            </button>
          )}

          {user || isAdminUnlocked ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setAccountMenuOpen((prev) => !prev)}
                className="px-3.5 py-2 text-xs sm:text-sm font-semibold text-zinc-900 bg-zinc-100 hover:bg-zinc-200/80 rounded-lg transition-colors whitespace-nowrap shrink-0 max-w-[150px] truncate"
              >
                {displayName}
              </button>
              {accountMenuOpen && (
                <div className="absolute right-0 mt-2 w-60 bg-white border border-zinc-200 rounded-xl shadow-lg p-3 z-50">
                  <div className="pb-2.5 mb-2.5 border-b border-zinc-100">
                    <p className="text-sm font-semibold text-zinc-950 truncate">
                      {displayName}
                    </p>
                    {user?.email && (
                      <p className="text-xs text-zinc-500 truncate mt-0.5">
                        {user.email}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      void signOutUser();
                      if (activePage === 'admin') {
                        onNavigate('catalog');
                      }
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Sign In
            </button>
          )}

          <button
            type="button"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMobileOpen((prev) => !prev)}
            className="md:hidden p-2 text-zinc-700 hover:text-zinc-950 rounded-lg hover:bg-zinc-100"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-zinc-200 bg-white px-4 py-3 space-y-1">
          {navItems.map((item) => {
            const isActive =
              activePage === item.id ||
              (activePage === 'detail' && item.id === 'catalog');
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`w-full text-left px-3 py-2.5 text-sm rounded-lg transition-colors ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-800 font-semibold'
                    : 'text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                {item.label}
              </button>
            );
          })}

          {isAdminUnlocked && (
            <button
              type="button"
              onClick={() => handleNavClick('admin')}
              className={`w-full flex items-center gap-2 text-left px-3 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                activePage === 'admin'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-zinc-950 text-white'
              }`}
            >
              <Shield className="w-4 h-4" />
              Admin
            </button>
          )}
        </div>
      )}
    </header>
  );
}
