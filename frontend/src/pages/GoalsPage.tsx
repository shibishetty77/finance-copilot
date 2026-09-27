import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Target, Plus, TrendingUp, CheckCircle2, IndianRupee } from 'lucide-react';

import { goalsApi } from '@/api/goals';
import { transactionsApi } from '@/api/transactions';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { Loader, Skeleton } from '@/components/ui/Loader';
import { Modal } from '@/components/ui/Modal';
import { CreateGoalModal } from '@/components/goals/CreateGoalModal';
import { GoalCard } from '@/components/goals/GoalCard';
import { GoalsInsights } from '@/components/goals/GoalsInsights';
import { formatCurrency } from '@/utils/formatCurrency';
import { computeGoalStats } from '@/utils/goalHelpers';
import type { GoalCreate, Goal, GoalUpdate } from '@/types/goal';

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
          <Icon className="w-[18px] h-[18px]" strokeWidth={2} />
        </div>
      </CardHeader>
      <div className="fc-stat-value">{value}</div>
    </Card>
  );
}

export function GoalsPage() {
  const qc = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);

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

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: GoalUpdate }) => goalsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] });
      setIsEditOpen(false);
      setSelectedGoal(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => goalsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] });
      setIsDeleteOpen(false);
      setSelectedGoal(null);
    },
  });

  const openEditModal = (goal: Goal) => {
    setSelectedGoal(goal);
    setIsEditOpen(true);
  };

  const openDeleteModal = (goal: Goal) => {
    setSelectedGoal(goal);
    setIsDeleteOpen(true);
  };

  const handleDelete = () => {
    if (selectedGoal) {
      deleteMutation.mutate(selectedGoal.id);
    }
  };

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
          color="fc-icon-brand"
        />
        <SummaryCard
          label="Active Goals"
          value={stats.activeGoals.toString()}
          icon={TrendingUp}
          color="fc-icon-brand"
        />
        <SummaryCard
          label="Total Target Value"
          value={formatCurrency(stats.totalTargetValue)}
          icon={IndianRupee}
          color="fc-icon-neutral"
        />
        <SummaryCard
          label="Overall Progress"
          value={`${stats.overallProgress.toFixed(0)}%`}
          icon={CheckCircle2}
          color="fc-icon-income"
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
              <GoalCard
                key={goal.id}
                goal={goal}
                monthlySummaries={monthlySummaries}
                onEdit={openEditModal}
                onDelete={openDeleteModal}
              />
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

      {/* Edit Goal Modal */}
      <Modal
        open={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setSelectedGoal(null);
        }}
        title="Edit Goal"
      >
        <form onSubmit={(e: React.FormEvent) => {
          e.preventDefault();
          if (selectedGoal) {
            const updateData: GoalUpdate = {};
            if (selectedGoal.name) updateData.name = selectedGoal.name;
            if (selectedGoal.target_amount !== undefined) updateData.target_amount = selectedGoal.target_amount;
            if (selectedGoal.current_amount !== undefined) updateData.current_amount = selectedGoal.current_amount;
            if (selectedGoal.target_date) updateData.target_date = selectedGoal.target_date;
            if (selectedGoal.description !== undefined && selectedGoal.description !== null) updateData.description = selectedGoal.description;
            updateMutation.mutate({
              id: selectedGoal.id,
              data: updateData
            });
          }
        }} className="space-y-4">
          <div>
            <label className="fc-field-label">Goal Name</label>
            <Input
              value={selectedGoal?.name || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedGoal(prev => prev ? { ...prev, name: e.target.value } : null)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="fc-field-label">Target Amount (₹)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={selectedGoal?.target_amount || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedGoal(prev => prev ? { ...prev, target_amount: parseFloat(e.target.value) || 0 } : null)}
              />
            </div>
            <div>
              <label className="fc-field-label">Current Amount (₹)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={selectedGoal?.current_amount || ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedGoal(prev => prev ? { ...prev, current_amount: parseFloat(e.target.value) || 0 } : null)}
              />
            </div>
          </div>
          <div>
            <label className="fc-field-label">Target Date (optional)</label>
            <Input
              type="date"
              value={selectedGoal?.target_date?.split('T')[0] || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedGoal(prev => prev ? { ...prev, target_date: e.target.value } : null)}
            />
          </div>
          <div>
            <label className="fc-field-label">Description (optional)</label>
            <Input
              value={selectedGoal?.description || ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSelectedGoal(prev => prev ? { ...prev, description: e.target.value } : null)}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => {
              setIsEditOpen(false);
              setSelectedGoal(null);
            }}>
              Cancel
            </Button>
            <Button type="submit" loading={updateMutation.isPending}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
          setSelectedGoal(null);
        }}
        title="Delete Goal"
        description="Are you sure you want to delete this goal? This action cannot be undone."
      >
        <div className="flex gap-3 justify-end mt-6">
          <Button
            variant="secondary"
            onClick={() => {
              setIsDeleteOpen(false);
              setSelectedGoal(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            loading={deleteMutation.isPending}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
