import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ArrowLeftRight,
  TrendingUp,
  Target,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/utils/cn';

const MOBILE_NAV = [
  { to: '/dashboard',    icon: LayoutDashboard, label: 'Home' },
  { to: '/transactions', icon: ArrowLeftRight,  label: 'Spends' },
  { to: '/portfolio',    icon: TrendingUp,      label: 'Portfolio' },
  { to: '/goals',        icon: Target,          label: 'Goals' },
  { to: '/analytics',   icon: BarChart3,        label: 'Analytics' },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface-card/90 backdrop-blur-xl border-t border-surface-border z-30 md:hidden">
      <div className="flex">
        {MOBILE_NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center flex-1 py-2 gap-0.5',
                'text-white/40 hover:text-white transition-colors text-2xs font-medium',
                isActive && 'text-brand-400',
              )
            }
          >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
