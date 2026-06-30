import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ArrowLeftRight,
  TrendingUp,
  Target,
  BarChart3,
  MessageSquareText,
  IndianRupee,
  Wallet,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useUIStore } from '@/store/uiStore';
import { useAuth } from '@/hooks/useAuth';

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/transactions', icon: ArrowLeftRight, label: 'Transactions' },
  { to: '/portfolio', icon: TrendingUp, label: 'Portfolio' },
  { to: '/networth', icon: Wallet, label: 'Net Worth' },
  { to: '/goals', icon: Target, label: 'Goals' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/ai-chat', icon: MessageSquareText, label: 'AI Assistant' },
];

export function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const { user } = useAuth();
  const initials = user?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'FC';

  return (
    <aside
      className={cn(
        'fixed top-0 left-0 h-full z-30 flex flex-col',
        'bg-surface-card/95 backdrop-blur-xl border-r border-surface-border',
        'transition-all duration-300 ease-out shadow-card',
        sidebarOpen ? 'w-64' : 'w-[68px]',
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-surface-border shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center shrink-0 shadow-glow transition-transform duration-300 ease-out hover:scale-105">
          <IndianRupee className="w-5 h-5 text-white" strokeWidth={2} />
        </div>
        {sidebarOpen && (
          <div className="animate-fade-in overflow-hidden">
            <span className="font-bold text-white text-sm block leading-tight">Finance</span>
            <span className="text-gradient font-bold text-sm leading-tight">Copilot</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto no-scrollbar" aria-label="Main navigation">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn('sidebar-link', isActive && 'active', !sidebarOpen && 'justify-center px-2.5')
            }
            title={!sidebarOpen ? label : undefined}
          >
            <Icon className="w-5 h-5 shrink-0 transition-transform duration-200 group-hover:scale-110" strokeWidth={2} />
            {sidebarOpen && <span className="truncate animate-fade-in">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Profile */}
      {sidebarOpen && user && (
        <div className="px-3 py-3 mx-3 mb-2 rounded-xl bg-surface-hover/50 border border-surface-border animate-fade-in hover:bg-surface-hover transition-colors duration-200 ease-out">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-glow">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.full_name}</p>
              <p className="text-xs text-white/40 truncate">{user.email}</p>
            </div>
          </div>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={toggleSidebar}
        className={cn(
          'flex items-center gap-2 p-4 border-t border-surface-border',
          'text-white/40 hover:text-white hover:bg-surface-hover active:bg-surface-hover/80 transition-all duration-200 ease-out text-sm font-medium',
          !sidebarOpen && 'justify-center',
        )}
        aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        {sidebarOpen ? (
          <>
            <ChevronLeft className="w-4 h-4 transition-transform duration-200" strokeWidth={2} />
            <span className="animate-fade-in">Collapse</span>
          </>
        ) : (
          <ChevronRight className="w-4 h-4 transition-transform duration-200" strokeWidth={2} />
        )}
      </button>
    </aside>
  );
}
