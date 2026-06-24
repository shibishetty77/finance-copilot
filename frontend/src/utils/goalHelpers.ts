import type { Goal, GoalStats, GoalStatus } from '@/types/goal';
import type { TransactionMonthlySummary } from '@/types/transaction';

export function getGoalProgress(goal: Goal): number {
  if (goal.target_amount <= 0) return 0;
  return Math.min((goal.current_amount / goal.target_amount) * 100, 100);
}

export function getGoalRemaining(goal: Goal): number {
  return Math.max(goal.target_amount - goal.current_amount, 0);
}

export function getGoalStatus(goal: Goal): GoalStatus {
  if (goal.current_amount >= goal.target_amount) return 'Completed';
  if (goal.target_date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(goal.target_date);
    if (target < today) return 'Behind Target';
  }
  return 'On Track';
}

export function computeGoalStats(goals: Goal[]): GoalStats {
  const totalGoals = goals.length;
  const completedCount = goals.filter((g) => g.current_amount >= g.target_amount).length;
  const activeGoals = totalGoals - completedCount;
  const totalTargetValue = goals.reduce((sum, g) => sum + g.target_amount, 0);
  const weightedNumerator = goals.reduce(
    (sum, g) => sum + Math.min(g.current_amount, g.target_amount),
    0,
  );
  const overallProgress =
    totalTargetValue > 0 ? (weightedNumerator / totalTargetValue) * 100 : 0;

  return {
    totalGoals,
    activeGoals,
    totalTargetValue,
    overallProgress,
    completedCount,
  };
}

export function estimateCompletionMonths(
  goal: Goal,
  monthlySummaries: TransactionMonthlySummary[] | undefined,
): number | null {
  const remaining = getGoalRemaining(goal);
  if (remaining <= 0) return null;

  if (!monthlySummaries || monthlySummaries.length === 0) return null;

  const sorted = [...monthlySummaries].sort((a, b) => a.month.localeCompare(b.month));
  const monthsWithSavings = sorted.filter((m) => m.savings > 0);
  const savingsMonths = monthsWithSavings.length > 0 ? monthsWithSavings : sorted;
  const totalSavings = savingsMonths.reduce((sum, m) => sum + m.savings, 0);
  const avgMonthlySavings = totalSavings / savingsMonths.length;

  if (avgMonthlySavings <= 0) return null;
  return Math.ceil(remaining / avgMonthlySavings);
}

export function getClosestGoal(goals: Goal[]): Goal | null {
  const active = goals.filter((g) => g.current_amount < g.target_amount);
  if (active.length === 0) return null;
  return [...active].sort((a, b) => getGoalProgress(b) - getGoalProgress(a))[0];
}
