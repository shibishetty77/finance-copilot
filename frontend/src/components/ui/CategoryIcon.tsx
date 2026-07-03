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
      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110 ${
        transactionType === 'income' ? 'bg-income/20' : 'bg-expense/20'
      }`}
    >
      {LucideIcon ? (
        <LucideIcon className="w-5 h-5 text-white/80" strokeWidth={2} />
      ) : (
        <IndianRupee className="w-5 h-5 text-white/60" strokeWidth={2} />
      )}
    </div>
  );
}
