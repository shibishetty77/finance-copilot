import { useMemo } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '@/utils/formatCurrency';
import type { Transaction } from '@/types/transaction';

interface ExpenseCategoryChartProps {
  transactions: Transaction[] | undefined;
}

const COLORS = [
  '#8b5cf6', // purple
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#ec4899', // pink
  '#14b8a6', // teal
  '#6366f1', // indigo
];

function CustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const { name, value, color } = payload[0].payload;
    return (
      <div className="bg-surface border border-white/10 rounded-lg p-3 shadow-lg">
        <p className="text-sm font-semibold" style={{ color }}>{name}</p>
        <p className="text-xs text-white/70 mt-1">Amount: {formatCurrency(value)}</p>
      </div>
    );
  }
  return null;
}

export function ExpenseCategoryChart({ transactions }: ExpenseCategoryChartProps) {
  const chartData = useMemo(() => {
    if (!transactions) return [];

    // Diagnostic: log the first 5 transactions to verify category shape
    console.log('Transaction sample', transactions.slice(0, 5));

    const categoryMap: Record<string, number> = {};
    let totalExpenses = 0;

    transactions.forEach(t => {
      if (t.type === 'expense') {
        // The backend eagerly loads the category relationship.
        // The correct field is t.category.name (CategoryResponse | null).
        const categoryName =
          t.category?.name ??
          (t.category_id !== null ? `Category ${t.category_id}` : 'Uncategorized');

        categoryMap[categoryName] = (categoryMap[categoryName] || 0) + t.amount;
        totalExpenses += t.amount;
      }
    });

    const sortedData = Object.entries(categoryMap)
      .map(([name, value], index) => ({
        name,
        value,
        color: COLORS[index % COLORS.length],
        percentage: totalExpenses > 0 ? ((value / totalExpenses) * 100).toFixed(1) : '0',
      }))
      .sort((a, b) => b.value - a.value);

    return sortedData;
  }, [transactions]);

  const hasData = chartData.length > 0;
  const topCategories = chartData.slice(0, 5);

  return (
    <Card className="h-full min-h-[350px] flex flex-col">
      <CardHeader>
        <CardTitle>Top Spending Categories</CardTitle>
      </CardHeader>
      <div className="flex-1 mt-4 px-4 pb-4">
        {!hasData ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-white/10 rounded-xl bg-white/5">
            <p className="text-sm font-medium text-white/70">No expenses recorded.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full items-center">
            {/* Chart */}
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* List */}
            <div className="space-y-4">
              {topCategories.map((cat, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 font-semibold text-xs text-white/50">
                      #{idx + 1}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white/90">{cat.name}</p>
                      <p className="text-xs text-white/50">{cat.percentage}% of total</p>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-white tabular-nums">
                    {formatCurrency(cat.value)}
                  </p>
                </div>
              ))}
              {chartData.length > 5 && (
                <p className="text-xs text-white/40 pt-2 text-center border-t border-white/5">
                  + {chartData.length - 5} more categories
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
