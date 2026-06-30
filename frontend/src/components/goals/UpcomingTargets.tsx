import { useMemo } from 'react';
import { Clock } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatCurrency } from '@/utils/formatCurrency';
import type { Goal } from '@/types/goal';
import type { TransactionMonthlySummary } from '@/types/transaction';
import { estimateCompletionMonths, getGoalRemaining } from '@/utils/goalHelpers';

interface UpcomingTargetsProps {
  goals: Goal[];
  monthlySummaries?: TransactionMonthlySummary[];
}

export function UpcomingTargets({ goals, monthlySummaries }: UpcomingTargetsProps) {
  const upcoming = useMemo(() => {
    return [...goals]
      .filter((g) => g.current_amount < g.target_amount)
      .map((g) => ({
        goal: g,
        remaining: getGoalRemaining(g),
        months: estimateCompletionMonths(g, monthlySummaries),
      }))
      .sort((a, b) => {
        if (a.months === null) return 1;
        if (b.months === null) return -1;
        return a.months - b.months;
      })
      .slice(0, 4);
  }, [goals, monthlySummaries]);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Upcoming Targets</CardTitle>
        <Clock className="w-4 h-4 text-white/40" strokeWidth={2} />
      </CardHeader>
      {upcoming.length === 0 ? (
        <p className="text-sm text-white/40 text-center py-8">All goals completed!</p>
      ) : (
        <div className="space-y-3">
          {upcoming.map(({ goal, remaining, months }) => (
            <div
              key={goal.id}
              className="flex items-center justify-between gap-3 p-3 rounded-xl hover:bg-surface-hover transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{goal.name}</p>
                <p className="text-xs text-white/40 mt-0.5">
                  {formatCurrency(remaining)} to go
                  {months !== null && ` · ~${months} mo`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
