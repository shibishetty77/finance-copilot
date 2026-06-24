import { Calendar, Target } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency } from '@/utils/formatCurrency';
import { formatDate } from '@/utils/formatDate';
import type { Goal } from '@/types/goal';
import type { TransactionMonthlySummary } from '@/types/transaction';
import {
  estimateCompletionMonths,
  getGoalProgress,
  getGoalRemaining,
  getGoalStatus,
} from '@/utils/goalHelpers';

interface GoalCardProps {
  goal: Goal;
  monthlySummaries?: TransactionMonthlySummary[];
}

function statusVariant(status: ReturnType<typeof getGoalStatus>): 'income' | 'warning' | 'brand' {
  switch (status) {
    case 'Completed':
      return 'income';
    case 'Behind Target':
      return 'warning';
    default:
      return 'brand';
  }
}

export function GoalCard({ goal, monthlySummaries }: GoalCardProps) {
  const progress = getGoalProgress(goal);
  const remaining = getGoalRemaining(goal);
  const status = getGoalStatus(goal);
  const estimatedMonths = estimateCompletionMonths(goal, monthlySummaries);

  return (
    <Card className="p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-brand-600/20 border border-brand-500/20 flex items-center justify-center flex-shrink-0">
            <Target className="w-5 h-5 text-brand-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-white truncate">{goal.name}</h3>
            {goal.description && (
              <p className="text-xs text-white/40 mt-0.5 line-clamp-2">{goal.description}</p>
            )}
          </div>
        </div>
        <Badge variant={statusVariant(status)} dot>
          {status}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-white/40 mb-1">Target Amount</p>
          <p className="text-lg font-bold text-white tabular-nums">{formatCurrency(goal.target_amount)}</p>
        </div>
        <div>
          <p className="text-xs text-white/40 mb-1">Current Progress</p>
          <p className="text-lg font-bold text-brand-400 tabular-nums">
            {formatCurrency(goal.current_amount)} saved
          </p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-white/50">{progress.toFixed(0)}% complete</span>
          <span className="text-xs font-medium text-white/70">{progress.toFixed(0)}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="pt-3 border-t border-surface-border space-y-2">
        {remaining > 0 ? (
          <p className="text-sm text-white/60">
            <span className="text-white font-medium">{formatCurrency(remaining)}</span> remaining
          </p>
        ) : (
          <p className="text-sm text-income font-medium">Goal reached!</p>
        )}

        {estimatedMonths !== null && remaining > 0 && (
          <p className="text-xs text-white/40">
            Estimated completion in {estimatedMonths} month{estimatedMonths !== 1 ? 's' : ''}
          </p>
        )}

        {goal.target_date && (
          <div className="flex items-center gap-1.5 text-xs text-white/40">
            <Calendar className="w-3.5 h-3.5" />
            Target date: {formatDate(goal.target_date)}
          </div>
        )}
      </div>
    </Card>
  );
}
