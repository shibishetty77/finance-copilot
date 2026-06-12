import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-6 text-center', className)}>
      {icon && (
        <div className="mb-4 p-4 rounded-2xl bg-brand-600/10 border border-brand-500/20 text-brand-400">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-white/50 max-w-sm leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
