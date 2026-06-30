import { useMemo } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { ProgressRing } from '@/components/ui/ProgressRing';
import type { Goal } from '@/types/goal';
import { computeGoalStats, getGoalProgress } from '@/utils/goalHelpers';

interface GoalProgressOverviewProps {
  goals: Goal[];
}

export function GoalProgressOverview({ goals }: GoalProgressOverviewProps) {
  const stats = useMemo(() => computeGoalStats(goals), [goals]);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Progress Overview</CardTitle>
      </CardHeader>
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <ProgressRing progress={stats.overallProgress} size={96} label="Overall" />
        <div className="flex-1 w-full space-y-3">
          {goals.slice(0, 4).map((goal) => (
            <div key={goal.id}>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-white/70 truncate pr-2">{goal.name}</span>
                <span className="text-white/50 tabular-nums shrink-0">
                  {getGoalProgress(goal).toFixed(0)}%
                </span>
              </div>
              <div className="fc-progress-bar">
                <div
                  className="fc-progress-fill"
                  style={{ width: `${getGoalProgress(goal)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
