import type { HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'gradient';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
}

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export function Card({
  variant = 'default',
  padding = 'md',
  hover = false,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        variant === 'default' && 'fc-card',
        variant === 'glass' && 'fc-glass p-6 shadow-card',
        variant === 'gradient' &&
          'bg-gradient-to-br from-brand-900/40 to-surface-card border border-brand-700/30 rounded-2xl p-6 shadow-card',
        variant !== 'glass' && variant !== 'gradient' && paddingClasses[padding],
        hover && 'hover:-translate-y-0.5 hover:border-brand-500/30 hover:shadow-card-lg cursor-default',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center justify-between mb-4 gap-3', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('text-base font-semibold text-white tracking-tight', className)} {...props}>
      {children}
    </h3>
  );
}
