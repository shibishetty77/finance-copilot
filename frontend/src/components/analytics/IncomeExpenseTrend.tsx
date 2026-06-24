import { useMemo } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, TooltipProps } from 'recharts';
import { LineChart as LineChartIcon } from 'lucide-react';
import { formatCurrency, formatCurrencyCompact } from '@/utils/formatCurrency';
import type { TransactionMonthlySummary } from '@/types/transaction';

interface IncomeExpenseTrendProps {
  data: TransactionMonthlySummary[] | undefined;
}

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-surface border border-white/10 rounded-lg p-3 shadow-lg">
        <p className="text-xs font-medium text-white/50 mb-2">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm font-semibold flex items-center gap-2 mt-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            {entry.name}: {formatCurrency(entry.value as number)}
          </p>
        ))}
      </div>
    );
  }
  return null;
}

export function IncomeExpenseTrend({ data }: IncomeExpenseTrendProps) {
  const chartData = useMemo(() => {
    if (!data) return [];
    const sorted = [...data].sort((a, b) => a.month.localeCompare(b.month));
    return sorted.map((s) => {
      const date = new Date(`${s.month}-01T00:00:00Z`);
      return {
        month: new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' }).format(date),
        Income: s.income,
        Expenses: s.expenses,
      };
    });
  }, [data]);

  const hasEnoughData = chartData.length >= 2;

  return (
    <Card className="h-full min-h-[350px] flex flex-col">
      <CardHeader>
        <CardTitle>Income vs Expense Trend</CardTitle>
      </CardHeader>
      <div className="flex-1 mt-4 px-4 pb-4">
        {!hasEnoughData ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-white/10 rounded-xl bg-white/5">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-3">
              <LineChartIcon className="w-6 h-6 text-white/40" />
            </div>
            <p className="text-sm font-medium text-white/70">Not enough data yet</p>
            <p className="text-xs text-white/40 mt-1 max-w-[200px]">Add transactions across multiple months to unlock trend analysis.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
              <Legend 
                verticalAlign="bottom" 
                height={36} 
                formatter={(value) => <span className="text-sm text-white/80">{value}</span>}
              />
              <Line 
                type="monotone" 
                dataKey="Income" 
                stroke="#10b981" 
                strokeWidth={3} 
                dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }} 
                activeDot={{ r: 6 }} 
              />
              <Line 
                type="monotone" 
                dataKey="Expenses" 
                stroke="#ef4444" 
                strokeWidth={3} 
                dot={{ r: 4, fill: '#ef4444', strokeWidth: 0 }} 
                activeDot={{ r: 6 }} 
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
