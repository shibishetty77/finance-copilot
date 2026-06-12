import { Link } from 'react-router-dom';
import { Bell, Search, Sun, Moon, LogOut, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUIStore } from '@/store/uiStore';
import { useState, useRef, useEffect } from 'react';
import { cn } from '@/utils/cn';

export function TopBar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useUIStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const initials = user?.full_name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase() ?? 'U';

  return (
    <header className="h-16 flex items-center gap-4 px-6 border-b border-surface-border bg-surface-card/50 backdrop-blur-xl">
      {/* Search bar */}
      <div className="flex-1 max-w-xs relative hidden sm:block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <input
          type="text"
          placeholder="Search transactions..."
          className="fc-input pl-9 py-2 text-xs h-9"
          aria-label="Search transactions"
        />
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="fc-btn-ghost p-2 rounded-lg"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Notifications */}
        <button className="fc-btn-ghost p-2 rounded-lg relative" aria-label="Notifications">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-500 rounded-full" />
        </button>

        {/* User avatar menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2.5 ml-1 pl-3 border-l border-surface-border"
            aria-label="User menu"
          >
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-white leading-tight">{user?.full_name}</p>
              <p className="text-2xs text-white/40 leading-tight">{user?.email}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
              {initials}
            </div>
          </button>

          {/* Dropdown */}
          {menuOpen && (
            <div className="absolute right-0 top-12 w-52 bg-surface-card border border-surface-border rounded-xl shadow-card-lg animate-slide-down z-50">
              <div className="p-3 border-b border-surface-border">
                <p className="text-xs font-semibold text-white truncate">{user?.full_name}</p>
                <p className="text-2xs text-white/40 truncate">{user?.email}</p>
              </div>
              <div className="p-2 space-y-0.5">
                <Link
                  to="/profile"
                  onClick={() => setMenuOpen(false)}
                  className={cn('flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-white/70 hover:text-white hover:bg-surface-hover transition-colors')}
                >
                  <User className="w-4 h-4" /> Profile
                </Link>
                <button
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-expense/80 hover:text-expense hover:bg-expense/10 transition-colors"
                  onClick={() => { setMenuOpen(false); void logout(); }}
                >
                  <LogOut className="w-4 h-4" /> Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
