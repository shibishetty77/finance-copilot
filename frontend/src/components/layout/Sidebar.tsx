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

const NAV_ITEMS = [
  { to: '/dashboard',    icon: LayoutDashboard,    label: 'Dashboard' },
  { to: '/transactions', icon: ArrowLeftRight,      label: 'Transactions' },
  { to: '/portfolio',    icon: TrendingUp,          label: 'Portfolio' },
  { to: '/networth',     icon: Wallet,              label: 'Net Worth' },
  { to: '/goals',        icon: Target,              label: 'Goals' },
  { to: '/analytics',    icon: BarChart3,           label: 'Analytics' },
  { to: '/ai-chat',      icon: MessageSquareText,   label: 'AI Assistant' },
];

export function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useUIStore();

  return (
    <aside
      className={cn(
        'fixed top-0 left-0 h-full z-30 flex flex-col',
        'bg-surface-card border-r border-surface-border',
        'transition-all duration-300 ease-in-out',
        sidebarOpen ? 'w-64' : 'w-[68px]',
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-surface-border shrink-0">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-purple-600 flex items-center justify-center shrink-0 shadow-glow">
          <IndianRupee className="w-5 h-5 text-white" />
        </div>
        {sidebarOpen && (
          <div className="animate-fade-in overflow-hidden">
            <span className="font-bold text-white text-sm block leading-tight">Finance</span>
            <span className="text-gradient font-bold text-sm leading-tight">Copilot</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto no-scrollbar">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn('sidebar-link', isActive && 'active', !sidebarOpen && 'justify-center px-3')
            }
            title={!sidebarOpen ? label : undefined}
          >
            <Icon className="w-5 h-5 shrink-0" />
            {sidebarOpen && (
              <span className="truncate animate-fade-in">{label}</span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={toggleSidebar}
        className={cn(
          'flex items-center gap-2 p-4 border-t border-surface-border',
          'text-white/40 hover:text-white transition-colors text-sm font-medium',
          !sidebarOpen && 'justify-center',
        )}
        aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        {sidebarOpen ? (
          <>
            <ChevronLeft className="w-4 h-4" />
            <span className="animate-fade-in">Collapse</span>
          </>
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
      </button>
    </aside>
  );
}
