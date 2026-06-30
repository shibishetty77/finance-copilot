import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'avatar' | 'card' | 'rect';
  width?: string;
  height?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rect',
  width,
  height,
}) => {
  const baseClasses = 'fc-skeleton';
  
  const variantClasses = {
    text: 'fc-skeleton-text',
    avatar: 'fc-skeleton-avatar',
    card: 'fc-skeleton-card',
    rect: '',
  };

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
};

interface CardSkeletonProps {
  showIcon?: boolean;
  showSubtitle?: boolean;
}

export const CardSkeleton: React.FC<CardSkeletonProps> = ({ showIcon = true, showSubtitle = true }) => (
  <div className="fc-card animate-fade-in" aria-hidden="true">
    <div className="flex items-start justify-between mb-4">
      {showIcon && <Skeleton variant="avatar" />}
      <div className="flex-1 ml-4">
        <Skeleton variant="text" className="w-24 mb-2" />
        {showSubtitle && <Skeleton variant="text" className="w-16" />}
      </div>
    </div>
    <Skeleton variant="text" className="w-32 h-8 mb-2" />
    <Skeleton variant="text" className="w-20 h-5" />
  </div>
);

interface StatGridSkeletonProps {
  count?: number;
}

export const StatGridSkeleton: React.FC<StatGridSkeletonProps> = ({ count = 4 }) => (
  <div className="fc-stat-grid">
    {Array.from({ length: count }).map((_, i) => (
      <CardSkeleton key={i} />
    ))}
  </div>
);

interface ListRowSkeletonProps {
  count?: number;
}

export const ListRowSkeleton: React.FC<ListRowSkeletonProps> = ({ count = 5 }) => (
  <div className="space-y-2" aria-hidden="true">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="fc-list-row">
        <Skeleton variant="avatar" />
        <div className="flex-1">
          <Skeleton variant="text" className="w-32 mb-2" />
          <Skeleton variant="text" className="w-24" />
        </div>
        <Skeleton variant="text" className="w-20" />
      </div>
    ))}
  </div>
);

interface ChartSkeletonProps {
  height?: string;
}

export const ChartSkeleton: React.FC<ChartSkeletonProps> = ({ height = '300px' }) => (
  <div className="fc-card animate-fade-in" aria-hidden="true">
    <Skeleton variant="rect" height={height} />
  </div>
);
