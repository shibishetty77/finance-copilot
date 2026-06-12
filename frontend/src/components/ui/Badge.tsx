import type { HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

type BadgeVariant = 'default' | 'income' | 'expense' | 'warning' | 'info' | 'brand';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
}

const variants: Record<BadgeVariant, string> = {
  default: 'bg-white/10 text-white/70',
  income:  'bg-income/15 text-income border border-income/30',
  expense: 'bg-expense/15 text-expense border border-expense/30',
  warning: 'bg-warning/15 text-warning border border-warning/30',
  info:    'bg-info/15 text-info border border-info/30',
  brand:   'bg-brand-600/20 text-brand-400 border border-brand-500/30',
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
