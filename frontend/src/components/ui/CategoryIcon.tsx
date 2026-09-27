import { IndianRupee } from 'lucide-react';
import { getCategoryIcon } from '@/utils/categoryIcons';
import { getCategoryById } from '@/utils/categorize';

interface CategoryIconProps {
  categoryId?: number | null;
  categoryName?: string | null;
  transactionType?: 'income' | 'expense';
}

export function CategoryIcon({ categoryId, categoryName, transactionType = 'expense' }: CategoryIconProps) {
  // Get category name from API or local list
  const catName = categoryName || getCategoryById(categoryId)?.name;
  const LucideIcon = getCategoryIcon(catName);

  return (
    <div
      className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
        transactionType === 'income'
          ? 'bg-income/10'
          : 'bg-expense/10'
      }`}
    >
      {LucideIcon ? (
        <LucideIcon
          className={`w-5 h-5 ${
            transactionType === 'income' ? 'text-income' : 'text-expense'
          }`}
          strokeWidth={2}
        />
      ) : (
        <IndianRupee
          className={`w-5 h-5 ${
            transactionType === 'income' ? 'text-income' : 'text-expense'
          }`}
          strokeWidth={2}
        />
      )}
    </div>
  );
}
