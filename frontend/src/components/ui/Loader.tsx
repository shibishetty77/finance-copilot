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

/** Skeleton loading placeholder */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-surface-input',
        className,
      )}
    />
  );
}
