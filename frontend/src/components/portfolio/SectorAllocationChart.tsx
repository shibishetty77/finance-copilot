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

interface SectorAllocationChartProps {
  holdings: Holding[] | undefined;
  totalValue: number;
  isLoading: boolean;
}

const COLORS = [
  '#8b5cf6', // purple-500
  '#06b6d4', // cyan-500
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#6366f1', // indigo-500
  '#ec4899', // pink-500
  '#14b8a6', // teal-500
];

function CustomTooltip({ active, payload }: TooltipProps<number, string>) {
  if (active && payload && payload.length) {
    const data = payload[0].payload as SectorData;
    return (
      <div className="bg-surface border border-white/10 rounded-lg p-3 shadow-lg">
        <p className="text-sm font-semibold text-white">{data.sector}</p>
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

interface SectorData {
  sector: string;
  value: number;
  percentage: number;
}

export function SectorAllocationChart({
  holdings,
  totalValue,
  isLoading,
}: SectorAllocationChartProps) {
  const allocationData = useMemo(() => {
    if (!holdings || holdings.length === 0 || totalValue === 0) {
      return [];
    }

    // Group by sector
    const sectorMap = new Map<string, number>();
    holdings.forEach((holding) => {
      const sector = holding.sector || 'Unclassified';
      const current = sectorMap.get(sector) || 0;
      sectorMap.set(sector, current + holding.current_value);
    });

    // Convert to array
    return Array.from(sectorMap.entries()).map(([sector, value]) => ({
      sector,
      value,
      percentage: (value / totalValue) * 100,
    }));
  }, [holdings, totalValue]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sector Allocation</CardTitle>
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

  if (!holdings || holdings.length === 0 || totalValue === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sector Allocation</CardTitle>
        </CardHeader>
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <p className="text-sm text-white/50">No sectors to display</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sector Allocation</CardTitle>
      </CardHeader>

      <div className="px-4 pb-4">
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={allocationData}
              cx="50%"
              cy="50%"
              outerRadius={70}
              innerRadius={40}
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
              formatter={(_, entry) => {
                const data = entry.payload as unknown as SectorData;
                return `${data.sector} (${data.percentage.toFixed(1)}%)`;
              }}
              wrapperStyle={{
                paddingTop: '16px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Breakdown table */}
        <div className="mt-6 space-y-2">
          <p className="text-xs font-medium text-white/50 uppercase tracking-wider">
            Breakdown
          </p>
          <div className="space-y-2">
            {allocationData.map((item, index) => (
              <div
                key={item.sector}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <p className="text-sm font-medium text-white">{item.sector}</p>
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
