/**
 * TypeScript types for financial goals.
 */

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoalCreate {
  name: string;
  target_amount: number;
  current_amount?: number;
  target_date?: string;
  description?: string;
}

export interface GoalUpdate {
  name?: string;
  target_amount?: number;
  current_amount?: number;
  target_date?: string;
  description?: string;
}

export type GoalStatus = 'Completed' | 'On Track' | 'Behind Target';

export interface GoalStats {
  totalGoals: number;
  activeGoals: number;
  totalTargetValue: number;
  overallProgress: number;
  completedCount: number;
}
