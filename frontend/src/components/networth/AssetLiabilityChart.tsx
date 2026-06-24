import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatCurrency } from '@/utils/formatCurrency';

interface AssetLiabilityChartProps {
  totalAssets: number;
  totalLiabilities: number;
}

const COLORS = {
  assets: '#10b981', // emerald-500
  liabilities: '#ef4444', // red-500
};

export function AssetLiabilityChart({ totalAssets, totalLiabilities }: AssetLiabilityChartProps) {
  const data = [
    { name: 'Assets', value: totalAssets, color: COLORS.assets },
    { name: 'Liabilities', value: totalLiabilities, color: COLORS.liabilities },
  ];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const { name, value, color } = payload[0].payload;
      return (
        <div className="bg-surface border border-white/10 rounded-lg p-3 shadow-lg">
          <p className="text-sm font-semibold" style={{ color }}>{name}</p>
          <p className="text-xs text-white/70 mt-1">Value: {formatCurrency(value)}</p>
        </div>
      );
    }
    return null;
  };

  const total = totalAssets + totalLiabilities;
  const showEmpty = total === 0;

  // Render 100/0 instead of awkwardly rendering if liabilities=0
  const chartData =
    totalLiabilities === 0 && totalAssets > 0
      ? [
          { name: 'Assets', value: totalAssets, color: COLORS.assets },
          // Render a tiny sliver for 0 liabilities to avoid Recharts failing or rendering blank, or just omit if Recharts handles 0 nicely. Actually Recharts skips 0 value completely.
          // To ensure it shows in legend, keep the 0 value.
          { name: 'Liabilities', value: totalLiabilities, color: COLORS.liabilities },
        ]
      : data;

  return (
    <Card className="h-full flex flex-col min-h-[350px]">
      <CardHeader>
        <CardTitle>Asset vs Liability</CardTitle>
        <p className="text-xs text-white/40 mt-1">Debt tracking will be available in a future release.</p>
      </CardHeader>
      <div className="flex-1 px-4 pb-4">
        {showEmpty ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-white/40">No assets or liabilities to display</p>
          </div>
        ) : (
          <div className="flex flex-col h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  verticalAlign="bottom" 
                  height={36} 
                  formatter={(value) => <span className="text-sm text-white/80">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-white/70">Assets:</span>
                <span className="font-medium text-white">{formatCurrency(totalAssets)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-white/70">Liabilities:</span>
                <span className="font-medium text-white">{formatCurrency(totalLiabilities)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
