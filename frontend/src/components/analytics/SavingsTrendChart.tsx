import { useMemo } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, TooltipProps } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { formatCurrency, formatCurrencyCompact } from '@/utils/formatCurrency';
import type { TransactionMonthlySummary } from '@/types/transaction';

interface SavingsTrendChartProps {
  data: TransactionMonthlySummary[] | undefined;
}

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-surface border border-white/10 rounded-lg p-3 shadow-lg">
        <p className="text-xs font-medium text-white/50 mb-1">{label}</p>
        <p className="text-sm font-semibold text-brand-400">
          Savings: {formatCurrency(payload[0].value as number)}
        </p>
      </div>
    );
  }
  return null;
}

export function SavingsTrendChart({ data }: SavingsTrendChartProps) {
  const chartData = useMemo(() => {
    if (!data) return [];
    const sorted = [...data].sort((a, b) => a.month.localeCompare(b.month));
    return sorted.map((s) => {
      const date = new Date(`${s.month}-01T00:00:00Z`);
      return {
        month: new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' }).format(date),
        Savings: s.savings,
      };
    });
  }, [data]);

  const hasEnoughData = chartData.length >= 2;

  return (
    <Card className="h-full min-h-[350px] flex flex-col">
      <CardHeader>
        <CardTitle>Monthly Savings Trend</CardTitle>
      </CardHeader>
      <div className="flex-1 mt-4 px-4 pb-4">
        {!hasEnoughData ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-white/10 rounded-xl bg-white/5">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
              <TrendingUp className="w-6 h-6 text-white/40" />
            </div>
            <p className="text-sm font-medium text-white/70">Not enough data yet</p>
            <p className="text-xs text-white/40 mt-1 max-w-[200px]">Add transactions across multiple months to unlock trend analysis.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorSavings" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff10" />
              <XAxis 
                dataKey="month" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#ffffff50', fontSize: 12 }} 
                dy={10} 
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#ffffff50', fontSize: 12 }} 
                tickFormatter={(val) => formatCurrencyCompact(val)} 
              />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey="Savings" 
                stroke="#3b82f6" 
                strokeWidth={3} 
                fillOpacity={1} 
                fill="url(#colorSavings)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
