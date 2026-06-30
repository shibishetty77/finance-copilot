import type { ElementType, ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface InsightCardProps {
  title: string;
  description: string;
  icon?: ElementType;
  accent?: 'brand' | 'income' | 'expense' | 'purple';
  className?: string;
  children?: ReactNode;
}

const accents = {
  brand: 'from-brand-600/20 to-brand-600/5 border-brand-500/20 text-brand-400',
  income: 'from-income/20 to-income/5 border-income/20 text-income',
  expense: 'from-expense/20 to-expense/5 border-expense/20 text-expense',
  purple: 'from-purple-600/20 to-purple-600/5 border-purple-500/20 text-purple-400',
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
          <p className="text-sm text-white/85 leading-relaxed mt-1">{description}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
