import type { HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

type BadgeVariant = 'default' | 'income' | 'expense' | 'warning' | 'info' | 'brand';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
}

const variants: Record<BadgeVariant, string> = {
  default: 'bg-surface-input text-secondary border border-surface-border',
  income:  'bg-income/10 text-income border border-income/25',
  expense: 'bg-expense/10 text-expense border border-expense/25',
  warning: 'bg-warning/10 text-warning border border-warning/25',
  info:    'bg-info/10 text-info border border-info/25',
  brand:   'bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/25',
};

export function Badge({ variant = 'default', dot = false, className, children, ...props }: BadgeProps) {
  return (
    <span className={cn('fc-badge', variants[variant], className)} {...props}>
      {dot && (
        <span className={cn('w-1.5 h-1.5 rounded-full', {
          'bg-white/70': variant === 'default',
          'bg-income': variant === 'income',
          'bg-expense': variant === 'expense',
          'bg-warning': variant === 'warning',
          'bg-info': variant === 'info',
          'bg-brand-400': variant === 'brand',
        })} />
      )}
      {children}
    </span>
  );
}
