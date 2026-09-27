import type { ElementType, ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface InsightCardProps {
  title: string;
  description: string;
  icon?: ElementType;
  accent?: 'brand' | 'income' | 'expense' | 'neutral';
  className?: string;
  children?: ReactNode;
}

const accents = {
  brand:   'from-brand-500/10 to-brand-500/5 border-brand-500/20 text-brand-600 dark:text-brand-400',
  income:  'from-income/10 to-income/5 border-income/20 text-income',
  expense: 'from-expense/10 to-expense/5 border-expense/20 text-expense',
  neutral: 'from-surface-input to-surface-input border-surface-border text-secondary',
};

export function InsightCard({
  title,
  description,
  icon: Icon,
  accent = 'brand',
  className,
  children,
}: InsightCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-gradient-to-br p-4 transition-all duration-200',
        'hover:-translate-y-0.5 hover:shadow-card',
        accents[accent],
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4" strokeWidth={2} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{title}</p>
          <p className="text-sm leading-relaxed mt-1" style={{ color: 'var(--text-secondary)' }}>{description}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
