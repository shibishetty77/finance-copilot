import { useMemo } from 'react';
import { Calendar } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatDate } from '@/utils/formatDate';
import type { Goal } from '@/types/goal';
import { getGoalProgress, getGoalStatus } from '@/utils/goalHelpers';

interface GoalTimelineProps {
  goals: Goal[];
}

export function GoalTimeline({ goals }: GoalTimelineProps) {
  const timeline = useMemo(
    () =>
      [...goals]
        .filter((g) => g.target_date)
        .sort((a, b) => (a.target_date! > b.target_date! ? 1 : -1))
        .slice(0, 5),
    [goals],
  );

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Goal Timeline</CardTitle>
        <Calendar className="w-4 h-4 text-white/40" strokeWidth={2} />
      </CardHeader>
      {timeline.length === 0 ? (
        <p className="text-sm text-white/40 text-center py-8">
          Add target dates to see your goal timeline.
        </p>
      ) : (
        <div className="space-y-3">
          {timeline.map((goal, idx) => {
            const status = getGoalStatus(goal);
            return (
              <div
                key={goal.id}
                className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-surface-border"
              >
                <div className="flex flex-col items-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-brand-500" />
                  {idx < timeline.length - 1 && (
                    <div className="w-px h-8 bg-surface-border mt-1" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-white truncate">{goal.name}</p>
                    <Badge
                      variant={status === 'Completed' ? 'income' : status === 'Behind Target' ? 'warning' : 'brand'}
                    >
                      {getGoalProgress(goal).toFixed(0)}%
                    </Badge>
                  </div>
                  <p className="text-xs text-white/40 mt-1">{formatDate(goal.target_date!)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
