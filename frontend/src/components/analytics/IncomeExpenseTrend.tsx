import { useMemo } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { ChartEmptyState } from '@/components/ui/ChartEmptyState';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { LineChart as LineChartIcon } from 'lucide-react';
import { formatCurrencyCompact } from '@/utils/formatCurrency';
import {
  CHART_ANIMATION,
  CHART_AXIS,
  CHART_COLORS,
  CHART_MARGIN,
  ChartLegendFormatter,
  ChartTooltip,
} from '@/utils/chartTheme';
import type { TransactionMonthlySummary } from '@/types/transaction';

interface IncomeExpenseTrendProps {
  data: TransactionMonthlySummary[] | undefined;
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
    <Card className="fc-card h-full min-h-[350px] flex flex-col">
      <CardHeader>
        <CardTitle>Income vs Expense Trend</CardTitle>
      </CardHeader>
      <div className="flex-1 min-h-[280px] px-2 pb-2">
        {!hasEnoughData ? (
          <ChartEmptyState
            icon={<LineChartIcon className="w-6 h-6" strokeWidth={1.5} />}
            title="Not enough data yet"
            description="Add transactions across multiple months to unlock trend analysis."
          />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={CHART_MARGIN}>
              <defs>
                <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS.income} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={CHART_COLORS.income} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_COLORS.grid} />
              <XAxis dataKey="month" {...CHART_AXIS} dy={8} />
              <YAxis
                {...CHART_AXIS}
                tickFormatter={(val) => formatCurrencyCompact(val)}
              />
              <Tooltip content={<ChartTooltip />} />
              <Legend verticalAlign="bottom" height={40} formatter={ChartLegendFormatter} />
              <Line
                type="monotone"
                dataKey="Income"
                stroke={CHART_COLORS.income}
                strokeWidth={2.5}
                dot={{ r: 3, fill: CHART_COLORS.income, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                animationDuration={CHART_ANIMATION.duration}
              />
              <Line
                type="monotone"
                dataKey="Expenses"
                stroke={CHART_COLORS.expense}
                strokeWidth={2.5}
                dot={{ r: 3, fill: CHART_COLORS.expense, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                animationDuration={CHART_ANIMATION.duration}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
