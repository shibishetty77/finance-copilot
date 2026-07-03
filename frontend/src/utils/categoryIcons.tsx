import {
  UtensilsCrossed,
  HeartPulse,
  Home,
  Lightbulb,
  Wallet,
  ShoppingBag,
  Car,
  Film,
  GraduationCap,
  TrendingUp,
  Repeat,
  CircleDollarSign,
  ShoppingCart,
  IndianRupee,
  Laptop,
  Building2,
  Banknote,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface CategoryIconMapping {
  name: string;
  icon: LucideIcon;
}

export const CATEGORY_ICONS: CategoryIconMapping[] = [
  { name: 'Food', icon: UtensilsCrossed },
  { name: 'Groceries', icon: ShoppingCart },
  { name: 'Transport', icon: Car },
  { name: 'Rent', icon: Home },
  { name: 'Utilities', icon: Lightbulb },
  { name: 'Shopping', icon: ShoppingBag },
  { name: 'Entertainment', icon: Film },
  { name: 'Healthcare', icon: HeartPulse },
  { name: 'Education', icon: GraduationCap },
  { name: 'Investments', icon: TrendingUp },
  { name: 'Subscriptions', icon: Repeat },
  { name: 'Miscellaneous', icon: CircleDollarSign },
  { name: 'Income', icon: Wallet },
  { name: 'Salary', icon: Banknote },
  { name: 'Freelance', icon: Laptop },
  { name: 'Business', icon: Building2 },
  { name: 'Other Income', icon: IndianRupee },
];

export function getCategoryIcon(categoryName: string | null | undefined): LucideIcon | undefined {
  if (!categoryName) return undefined;
  const mapping = CATEGORY_ICONS.find(
    (cat) => cat.name.toLowerCase() === categoryName.toLowerCase()
  );
  return mapping?.icon;
}
