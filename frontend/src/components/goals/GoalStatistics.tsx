import { useMemo } from 'react';
import { BarChart2 } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatCurrency } from '@/utils/formatCurrency';
import type { Goal } from '@/types/goal';
import { computeGoalStats } from '@/utils/goalHelpers';

interface GoalStatisticsProps {
  goals: Goal[];
}

export function GoalStatistics({ goals }: GoalStatisticsProps) {
  const stats = useMemo(() => computeGoalStats(goals), [goals]);

  const totalSaved = useMemo(
    () => goals.reduce((sum, g) => sum + g.current_amount, 0),
    [goals],
  );

  const rows = [
    { label: 'Total saved', value: formatCurrency(totalSaved) },
    { label: 'Total target', value: formatCurrency(stats.totalTargetValue) },
    { label: 'Completed', value: `${stats.completedCount} goals` },
    { label: 'Active', value: `${stats.activeGoals} goals` },
  ];

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Goal Statistics</CardTitle>
        <BarChart2 className="w-4 h-4 text-white/40" strokeWidth={2} />
      </CardHeader>
      <div className="grid grid-cols-2 gap-3">
        {rows.map((row) => (
          <div
            key={row.label}
            className="p-3 rounded-xl bg-white/[0.02] border border-surface-border"
          >
            <p className="text-xs text-white/40 mb-1">{row.label}</p>
            <p className="text-sm font-semibold text-white tabular-nums">{row.value}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
