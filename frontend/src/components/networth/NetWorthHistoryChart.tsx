import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, TooltipProps } from 'recharts';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatCurrency, formatCurrencyCompact } from '@/utils/formatCurrency';
import type { TransactionMonthlySummary } from '@/types/transaction';

interface NetWorthHistoryChartProps {
  monthlySummaries: TransactionMonthlySummary[] | undefined;
}

// Custom tooltip for dark theme
function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-surface-card border border-surface-border rounded-xl p-4 shadow-card-lg">
        <p className="text-xs font-medium text-white/50 mb-2">{label}</p>
        <p className="text-sm font-semibold text-brand-400">
          {formatCurrency(payload[0].value as number)}
        </p>
      </div>
    );
  }
  return null;
}

export function NetWorthHistoryChart({ monthlySummaries }: NetWorthHistoryChartProps) {
  // Compute cumulative savings from historical data
  const chartData = useMemo(() => {
    if (!monthlySummaries || monthlySummaries.length === 0) return [];

    // Sort ascending by month string (e.g. "2026-06")
    const sorted = [...monthlySummaries].sort((a, b) => a.month.localeCompare(b.month));

    let cumulative = 0;
    return sorted.map((s) => {
      cumulative += s.savings;
      // Format month from "2026-06" to "Jun 2026"
      const date = new Date(`${s.month}-01T00:00:00Z`);
      const formattedMonth = new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' }).format(date);
      
      return {
        month: formattedMonth,
        value: cumulative,
      };
    });
  }, [monthlySummaries]);

  if (!chartData || chartData.length === 0) {
    return (
      <Card className="fc-card h-full flex flex-col min-h-[350px]">
        <CardHeader>
          <CardTitle>Savings Growth Trend</CardTitle>
          <p className="text-xs text-white/40 mt-1">Based on historical savings data.</p>
        </CardHeader>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-white/40">Not enough data to display trend.</p>
        </div>
      </Card>
    );
  }

  const hasEnoughData = chartData.length >= 2;

  return (
    <Card className="fc-card h-full">
      <CardHeader>
        <CardTitle>Savings Growth Trend</CardTitle>
      </CardHeader>
      <div className="h-[300px] mt-4 px-4 pb-4">
        {!hasEnoughData ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-surface-border rounded-xl bg-white/5">
            <p className="text-sm font-medium text-white/70">More monthly transaction data is needed to display trends.</p>
            <p className="text-xs text-white/40 mt-1">Add transactions across multiple months to see your growth.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis 
                dataKey="month" 
                stroke="#ffffff50" 
                fontSize={12} 
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="#ffffff50" 
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => formatCurrencyCompact(val)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke="#8b5cf6" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorValue)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
