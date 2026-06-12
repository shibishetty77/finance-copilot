import { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer,
  TooltipProps,
} from 'recharts';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatCurrency } from '@/utils/formatDate';
import type { Holding } from '@/types/portfolio';

interface PortfolioAllocationChartProps {
  holdings: Holding[] | undefined;
  totalValue: number;
  isLoading: boolean;
}

// Color palette matching Finance Copilot theme
const COLORS = [
  '#8b5cf6', // purple-500
  '#06b6d4', // cyan-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#6366f1', // indigo-500
  '#ec4899', // pink-500
  '#14b8a6', // teal-500
  '#f97316', // orange-500
  '#06b6d4', // cyan-600
];

// Custom tooltip with dark theme styling
function CustomTooltip({ active, payload }: TooltipProps<number, string>) {
  if (active && payload && payload.length) {
    const data = payload[0].payload as AllocationData;
    return (
      <div className="bg-surface border border-white/10 rounded-lg p-3 shadow-lg">
        <p className="text-sm font-semibold text-white">{data.symbol}</p>
        <p className="text-xs text-white/70 mt-1">
          Value: {formatCurrency(data.value)}
        </p>
        <p className="text-xs text-brand-400 font-medium mt-1">
          {data.percentage.toFixed(2)}%
        </p>
      </div>
    );
  }
  return null;
}

interface AllocationData {
  symbol: string;
  value: number;
  percentage: number;
}

export function PortfolioAllocationChart({
  holdings,
  totalValue,
  isLoading,
}: PortfolioAllocationChartProps) {
  // Calculate allocation data from holdings
  const allocationData = useMemo(() => {
    if (!holdings || holdings.length === 0 || totalValue === 0) {
      return [];
    }

    return holdings.map((holding) => ({
      symbol: holding.symbol,
      value: holding.current_value,
      percentage: (holding.current_value / totalValue) * 100,
    }));
  }, [holdings, totalValue]);

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Allocation</CardTitle>
        </CardHeader>
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="inline-block w-8 h-8 border-4 border-brand-600/30 border-t-brand-600 rounded-full animate-spin" />
            <p className="text-sm text-white/50 mt-4">Loading allocation...</p>
          </div>
        </div>
      </Card>
    );
  }

  // Empty state
  if (!holdings || holdings.length === 0 || totalValue === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Allocation</CardTitle>
        </CardHeader>
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <p className="text-sm text-white/50">No holdings to display</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Portfolio Allocation</CardTitle>
            <p className="text-xs text-white/50 mt-1">
              Distribution by current value
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/50 font-medium mb-1">Total Value</p>
            <p className="text-lg font-bold text-brand-400">
              {formatCurrency(totalValue)}
            </p>
          </div>
        </div>
      </CardHeader>

      <div className="px-4 pb-4">
        {/* Responsive pie chart */}
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={allocationData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ symbol, percentage }) =>
                `${symbol} ${percentage.toFixed(1)}%`
              }
              outerRadius={80}
              innerRadius={50}
              fill="#8884d8"
              dataKey="value"
            >
              {allocationData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="bottom"
              height={36}
              formatter={(value, entry) => {
                const data = entry.payload as AllocationData;
                return `${data.symbol} (${data.percentage.toFixed(1)}%)`;
              }}
              wrapperStyle={{
                paddingTop: '16px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Allocation table */}
        <div className="mt-6 space-y-2">
          <p className="text-xs font-medium text-white/50 uppercase tracking-wider">
            Breakdown
          </p>
          <div className="space-y-2">
            {allocationData.map((item, index) => (
              <div key={item.symbol} className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <p className="text-sm font-medium text-white">{item.symbol}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-white">
                    {item.percentage.toFixed(2)}%
                  </p>
                  <p className="text-xs text-white/50">
                    {formatCurrency(item.value)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
