import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center animate-fade-in',
        compact ? 'py-10 px-4' : 'py-16 px-6',
        'rounded-2xl border border-dashed border-white/10 bg-white/[0.02]',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {icon && (
        <div className="mb-5 p-5 rounded-2xl bg-brand-600/10 border border-brand-500/20 text-brand-400 animate-scale-in">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-white/50 max-w-md leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
