import { Sparkles } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import type { Goal } from '@/types/goal';
import { computeGoalStats, getClosestGoal } from '@/utils/goalHelpers';

interface GoalsInsightsProps {
  goals: Goal[];
}

export function GoalsInsights({ goals }: GoalsInsightsProps) {
  const stats = computeGoalStats(goals);
  const closest = getClosestGoal(goals);
  const insights: string[] = [];

  if (closest) {
    insights.push(`${closest.name} is your closest goal.`);
  }

  if (stats.totalGoals > 0) {
    insights.push(
      `You have completed ${stats.completedCount} of ${stats.totalGoals} goal${stats.totalGoals !== 1 ? 's' : ''}.`,
    );
    insights.push(
      `You are ${stats.overallProgress.toFixed(0)}% toward your total goal value.`,
    );
  }

  const behindCount = goals.filter((g) => {
    if (g.current_amount >= g.target_amount || !g.target_date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(g.target_date) < today;
  }).length;

  if (behindCount > 0) {
    insights.push(
      `${behindCount} goal${behindCount !== 1 ? 's are' : ' is'} behind the target date.`,
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Goals Insights</CardTitle>
          <Sparkles className="w-4 h-4 text-brand-400" />
        </div>
      </CardHeader>
      <div className="px-6 pb-6 space-y-4">
        {insights.length > 0 ? (
          insights.map((insight, index) => (
            <div
              key={index}
              className="flex items-start gap-3 p-3 rounded-lg bg-brand-900/10 border border-brand-500/10"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-2 flex-shrink-0" />
              <p className="text-sm text-white/80 leading-relaxed">{insight}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-white/40">Create goals to unlock personalized insights.</p>
        )}
      </div>
    </Card>
  );
}
