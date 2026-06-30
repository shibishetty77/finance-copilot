import type { ElementType, ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { cn } from '@/utils/cn';

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon: ElementType;
  color: string;
  trend?: number;
  helperText?: string;
  className?: string;
  delay?: number;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  color,
  trend,
  helperText,
  className,
  delay = 0,
}: StatCardProps) {
  return (
    <Card
      hover
      className={cn('flex-1 min-w-0 min-h-[132px] flex flex-col animate-slide-up', className)}
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'both' }}
    >
      <CardHeader className="mb-3">
        <p className="text-xs font-medium text-white/50 uppercase tracking-wide">{label}</p>
        <div
          className={cn(
            'w-9 h-9 rounded-xl flex items-center justify-center shadow-sm',
            color,
          )}
        >
          <Icon className="w-[18px] h-[18px] text-white" strokeWidth={2} />
        </div>
      </CardHeader>
      <div className="text-2xl font-bold text-white tabular-nums tracking-tight mt-auto">
        {value}
      </div>
      {helperText && <p className="mt-2 text-xs text-white/40">{helperText}</p>}
      {trend !== undefined && (
        <div
          className={cn(
            'flex items-center gap-1 mt-2 text-xs font-medium',
            trend >= 0 ? 'text-income' : 'text-expense',
          )}
        >
          {trend >= 0 ? (
            <ArrowUpRight className="w-3.5 h-3.5" strokeWidth={2} />
          ) : (
            <ArrowDownRight className="w-3.5 h-3.5" strokeWidth={2} />
          )}
          {Math.abs(trend).toFixed(1)}% vs last month
        </div>
      )}
    </Card>
  );
}
