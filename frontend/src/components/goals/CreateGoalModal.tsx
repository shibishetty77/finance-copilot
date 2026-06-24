import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { GoalCreate } from '@/types/goal';

const goalSchema = z.object({
  name: z.string().min(1, 'Goal name is required').max(255),
  target_amount: z.number({ required_error: 'Target amount is required' }).positive('Target amount must be greater than 0'),
  current_amount: z.number().min(0, 'Current amount cannot be negative').optional(),
  target_date: z.string().optional(),
  description: z.string().optional(),
});

type GoalForm = z.infer<typeof goalSchema>;

interface CreateGoalModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: GoalCreate) => void;
  isSubmitting?: boolean;
}

export function CreateGoalModal({ open, onClose, onSubmit, isSubmitting }: CreateGoalModalProps) {
  const form = useForm<GoalForm>({
    resolver: zodResolver(goalSchema),
    defaultValues: {
      name: '',
      target_amount: undefined,
      current_amount: 0,
      target_date: '',
      description: '',
    },
  });

  const handleClose = () => {
    form.reset();
    onClose();
  };

  const handleSubmit = form.handleSubmit((data) => {
    onSubmit({
      name: data.name,
      target_amount: data.target_amount,
      current_amount: data.current_amount ?? 0,
      target_date: data.target_date || undefined,
      description: data.description || undefined,
    });
    form.reset();
  });

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Create Goal"
      description="Set a financial target and track your progress over time."
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-white/60 mb-1.5">Goal Name</label>
          <Input
            placeholder="e.g. Emergency Fund"
            {...form.register('name')}
            error={form.formState.errors.name?.message}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-white/60 mb-1.5">Target Amount (₹)</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="100000"
              {...form.register('target_amount', { valueAsNumber: true })}
              error={form.formState.errors.target_amount?.message}
            />
          </div>
          <div>
            <label className="block text-sm text-white/60 mb-1.5">Current Amount (₹)</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0"
              {...form.register('current_amount', { valueAsNumber: true })}
              error={form.formState.errors.current_amount?.message}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm text-white/60 mb-1.5">Target Date (optional)</label>
          <Input type="date" {...form.register('target_date')} />
        </div>

        <div>
          <label className="block text-sm text-white/60 mb-1.5">Description (optional)</label>
          <Input
            placeholder="What are you saving for?"
            {...form.register('description')}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Goal'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
