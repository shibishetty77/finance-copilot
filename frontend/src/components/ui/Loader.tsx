import { Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg';
  fullscreen?: boolean;
  text?: string;
  className?: string;
}

const sizes = {
  sm: 'w-4 h-4',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
};

export function Loader({ size = 'md', fullscreen = false, text, className }: LoaderProps) {
  const icon = <Loader2 className={cn(sizes[size], 'animate-spin text-brand-500', className)} />;

  if (fullscreen) {
    return (
      <div className="fixed inset-0 bg-surface/80 backdrop-blur-sm z-50 flex items-center justify-center flex-col gap-4">
        {icon}
        {text && <p className="text-white/60 text-sm font-medium">{text}</p>}
      </div>
    );
  }

  return (
    <div className={cn('flex items-center justify-center gap-3', className)}>
      {icon}
      {text && <span className="text-white/60 text-sm">{text}</span>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('fc-skeleton', className)} />;
}

export function StatCardSkeleton() {
  return (
    <div className="fc-card min-h-[132px] flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="w-9 h-9 rounded-xl" />
      </div>
      <Skeleton className="h-8 w-28 mt-auto" />
    </div>
  );
}

export function ChartSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('fc-card min-h-[350px] flex flex-col', className)}>
      <Skeleton className="h-5 w-40 mb-6" />
      <Skeleton className="flex-1 w-full rounded-xl min-h-[240px]" />
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="fc-list-row">
          <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

export function GoalCardSkeleton() {
  return (
    <div className="fc-card space-y-4">
      <div className="flex justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="flex gap-4">
        <Skeleton className="w-16 h-16 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
      </div>
    </div>
  );
}
