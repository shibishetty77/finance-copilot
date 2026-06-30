import type { TooltipProps } from 'recharts';
import { formatCurrency } from '@/utils/formatCurrency';

export const CHART_COLORS = {
  income: '#10b981',
  expense: '#f43f5e',
  brand: '#6366f1',
  purple: '#a855f7',
  grid: 'rgba(255,255,255,0.06)',
  axis: 'rgba(255,255,255,0.45)',
  tooltipBg: '#161627',
  tooltipBorder: 'rgba(255,255,255,0.1)',
};

export const PIE_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#f43f5e',
  '#ec4899',
  '#14b8a6',
];

export const CHART_AXIS = {
  axisLine: false as const,
  tickLine: false as const,
  tick: { fill: CHART_COLORS.axis, fontSize: 11 },
};

export const CHART_MARGIN = { top: 8, right: 8, left: -16, bottom: 0 };

export const CHART_ANIMATION = { duration: 1000, easing: 'ease-out' as const };

// Gradient definitions for charts
export const GRADIENTS = {
  income: { start: '#10b981', end: '#059669' },
  expense: { start: '#f43f5e', end: '#e11d48' },
  brand: { start: '#6366f1', end: '#4f46e5' },
  purple: { start: '#a855f7', end: '#9333ea' },
};

// Enhanced tooltip with better styling
export function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: TooltipProps<number, string> & {
  formatter?: (value: number, name: string) => string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-surface-card/95 backdrop-blur-md px-4 py-3 shadow-card-lg animate-scale-in">
      {label && <p className="text-xs font-medium text-white/50 mb-2">{label}</p>}
      <div className="space-y-1.5">
        {payload.map((entry, index) => (
          <p key={index} className="text-sm font-semibold flex items-center gap-2 text-white">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-white/70">{entry.name}:</span>
            {formatter
              ? formatter(entry.value as number, entry.name as string)
              : formatCurrency(entry.value as number)}
          </p>
        ))}
      </div>
    </div>
  );
}

export function ChartLegendFormatter(value: string) {
  return <span className="text-xs text-white/70 font-medium">{value}</span>;
}

// Common chart props for consistency
export const COMMON_CHART_PROPS = {
  margin: CHART_MARGIN,
  animation: CHART_ANIMATION,
};

// Grid configuration
export const CHART_GRID = {
  stroke: CHART_COLORS.grid,
  strokeDasharray: '3 3',
  vertical: true,
  horizontal: true,
};

// Area chart gradient component
export function AreaChartGradient({ color, id }: { color: string; id: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor={color} stopOpacity={0.3} />
        <stop offset="95%" stopColor={color} stopOpacity={0} />
      </linearGradient>
    </defs>
  );
}

// Bar chart gradient component
export function BarChartGradient({ color, id }: { color: string; id: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} />
        <stop offset="100%" stopColor={color} stopOpacity={0.7} />
      </linearGradient>
    </defs>
  );
}
