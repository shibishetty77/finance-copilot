import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface ChartEmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  className?: string;
}

export function ChartEmptyState({ icon, title, description, className }: ChartEmptyStateProps) {
  return (
    <div
      className={cn(
        'h-full min-h-[220px] flex flex-col items-center justify-center text-center',
        'p-8 border border-dashed border-white/10 rounded-2xl bg-white/[0.02]',
        className,
      )}
    >
      <div className="w-14 h-14 rounded-2xl bg-brand-600/10 border border-brand-500/20 flex items-center justify-center mb-4 text-brand-400">
        {icon}
      </div>
      <p className="text-sm font-semibold text-white/80">{title}</p>
      {description && (
        <p className="text-xs text-white/40 mt-2 max-w-[260px] leading-relaxed">{description}</p>
      )}
    </div>
  );
}
