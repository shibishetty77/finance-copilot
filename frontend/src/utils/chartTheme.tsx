import type { TooltipProps } from 'recharts';
import { formatCurrency } from '@/utils/formatCurrency';

export const CHART_COLORS = {
  income: '#16a34a',   // green-600
  expense: '#dc2626',  // red-600
  brand: '#14b8a6',    // teal-500 — single accent
  teal: '#0d9488',     // teal-600
  grid: 'var(--chart-grid)',
  axis: 'var(--chart-axis)',
  tooltipBg: 'var(--surface-card)',
  tooltipBorder: 'var(--surface-border)',
};

export const PIE_COLORS = [
  '#14b8a6',  // teal-500
  '#0d9488',  // teal-600
  '#0f766e',  // teal-700
  '#16a34a',  // green-600
  '#d97706',  // amber-600
  '#dc2626',  // red-600
  '#2563eb',  // blue-600
  '#475569',  // slate-600
];

export const CHART_AXIS = {
  axisLine: false as const,
  tickLine: false as const,
  tick: { fill: 'var(--chart-axis-color)', fontSize: 11 },
};

export const CHART_MARGIN = { top: 8, right: 8, left: -16, bottom: 0 };

export const CHART_ANIMATION = { duration: 1000, easing: 'ease-out' as const };

// Gradient definitions for charts
export const GRADIENTS = {
  income: { start: '#16a34a', end: '#15803d' },
  expense: { start: '#dc2626', end: '#b91c1c' },
  brand: { start: '#14b8a6', end: '#0d9488' },
  teal: { start: '#0d9488', end: '#0f766e' },
};

// Enhanced tooltip — theme-aware surfaces
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
    <div className="rounded-lg border px-4 py-3 shadow-card-lg animate-scale-in"
         style={{ backgroundColor: 'var(--surface-card)', borderColor: 'var(--surface-border)' }}>
      {label && <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>{label}</p>}
      <div className="space-y-1.5">
        {payload.map((entry, index) => (
          <p key={index} className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span style={{ color: 'var(--text-secondary)' }}>{entry.name}:</span>
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
  return <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{value}</span>;
}

// Common chart props for consistency
export const COMMON_CHART_PROPS = {
  margin: CHART_MARGIN,
  animation: CHART_ANIMATION,
};

// Grid configuration
export const CHART_GRID = {
  stroke: 'var(--surface-border)',
  strokeDasharray: '3 3',
  vertical: false,
  horizontal: true,
};

// Area chart gradient component
export function AreaChartGradient({ color, id }: { color: string; id: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor={color} stopOpacity={0.25} />
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
