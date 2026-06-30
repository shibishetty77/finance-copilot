import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Target, Plus, TrendingUp, CheckCircle2, IndianRupee } from 'lucide-react';

import { goalsApi } from '@/api/goals';
import { transactionsApi } from '@/api/transactions';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Loader, Skeleton } from '@/components/ui/Loader';
import { CreateGoalModal } from '@/components/goals/CreateGoalModal';
import { GoalCard } from '@/components/goals/GoalCard';
import { GoalsInsights } from '@/components/goals/GoalsInsights';
import { formatCurrency } from '@/utils/formatCurrency';
import { computeGoalStats } from '@/utils/goalHelpers';
import type { GoalCreate } from '@/types/goal';

function SummaryCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card className="fc-stat-card">
      <CardHeader>
        <p className="fc-label">{label}</p>
        <div className={`fc-stat-icon ${color}`}>
          <Icon className="w-5 h-5 text-white" strokeWidth={2} />
        </div>
      </CardHeader>
      <div className="fc-stat-value">{value}</div>
    </Card>
  );
}

export function GoalsPage() {
  const qc = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: goals, isLoading } = useQuery({
    queryKey: ['goals'],
    queryFn: () => goalsApi.list(),
  });

  const { data: monthlySummaries } = useQuery({
    queryKey: ['transactions-summary'],
    queryFn: () => transactionsApi.getMonthlySummary(),
  });

  const stats = useMemo(() => computeGoalStats(goals ?? []), [goals]);

  const createMutation = useMutation({
    mutationFn: (data: GoalCreate) => goalsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] });
      setIsCreateOpen(false);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="fc-heading">Goals</h1>
            <p className="fc-subheading">Track progress toward your financial goals</p>
          </div>
        </div>
        <div className="fc-stat-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="fc-card flex-1 min-w-0">
              <CardHeader><Skeleton className="w-10 h-10 rounded-xl" /></CardHeader>
              <Skeleton className="h-8 w-24" />
            </Card>
          ))}
        </div>
        <div className="h-[300px] flex items-center justify-center">
          <Loader size="lg" text="Loading goals..." />
        </div>
      </div>
    );
  }

  const hasGoals = goals && goals.length > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="fc-heading">Goals</h1>
          <p className="fc-subheading">Track progress toward your financial goals</p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setIsCreateOpen(true)}>
          Create Goal
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="fc-stat-grid">
        <SummaryCard
          label="Total Goals"
          value={stats.totalGoals.toString()}
          icon={Target}
          color="bg-brand-600"
        />
        <SummaryCard
          label="Active Goals"
          value={stats.activeGoals.toString()}
          icon={TrendingUp}
          color="bg-brand-500"
        />
        <SummaryCard
          label="Total Target Value"
          value={formatCurrency(stats.totalTargetValue)}
          icon={IndianRupee}
          color="bg-purple-600"
        />
        <SummaryCard
          label="Overall Progress"
          value={`${stats.overallProgress.toFixed(0)}%`}
          icon={CheckCircle2}
          color="bg-income/80"
        />
      </div>

      {!hasGoals ? (
        <EmptyState
          icon={<Target className="w-12 h-12" />}
          title="No goals created yet"
          description="Set financial targets and track your progress toward what matters most."
          action={
            <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setIsCreateOpen(true)}>
              Create your first financial goal
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
            {goals.map((goal) => (
              <GoalCard key={goal.id} goal={goal} monthlySummaries={monthlySummaries} />
            ))}
          </div>
          <div>
            <GoalsInsights goals={goals} />
          </div>
        </div>
      )}

      <CreateGoalModal
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={(data) => createMutation.mutate(data)}
        isSubmitting={createMutation.isPending}
      />
    </div>
  );
}
