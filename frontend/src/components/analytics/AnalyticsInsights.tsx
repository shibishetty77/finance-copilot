import { useMemo } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Sparkles } from 'lucide-react';
import type { Transaction, TransactionMonthlySummary } from '@/types/transaction';
import type { PortfolioSummary } from '@/types/portfolio';
import { formatCurrency } from '@/utils/formatCurrency';

interface AnalyticsInsightsProps {
  transactions: Transaction[] | undefined;
  monthlySummaries: TransactionMonthlySummary[] | undefined;
  portfolioSummary: PortfolioSummary | undefined;
}

export function AnalyticsInsights({ transactions, monthlySummaries, portfolioSummary }: AnalyticsInsightsProps) {
  const insights = useMemo(() => {
    const generated: string[] = [];

    // 1. Category insights
    if (transactions && transactions.length > 0) {
      const categoryMap: Record<string, number> = {};
      let totalExpenses = 0;
      transactions.forEach(t => {
        if (t.type === 'expense') {
          // The backend eagerly loads the category relationship.
          // The correct field is t.category.name (CategoryResponse | null).
          const cat =
            t.category?.name ??
            (t.category_id !== null ? `Category ${t.category_id}` : 'Uncategorized');

          categoryMap[cat] = (categoryMap[cat] || 0) + t.amount;
          totalExpenses += t.amount;
        }
      });

      const categories = Object.entries(categoryMap).sort((a, b) => b[1] - a[1]);
      if (categories.length > 0 && totalExpenses > 0) {
        const topCategory = categories[0];
        // Only output insight if we have a real category name (not a fallback)
        if (topCategory[0] !== 'Uncategorized' && !topCategory[0].startsWith('Category ')) {
          const percentage = ((topCategory[1] / totalExpenses) * 100).toFixed(1);
          generated.push(`${topCategory[0]} accounts for ${percentage}% of total spending.`);
        }
      }
    }

    // 2. Month-over-month and savings rate
    if (monthlySummaries && monthlySummaries.length > 0) {
      const sorted = [...monthlySummaries].sort((a, b) => a.month.localeCompare(b.month));
      const currentMonth = sorted[sorted.length - 1];

      // Savings rate
      if (currentMonth.income > 0) {
        const savingsRate = ((currentMonth.savings / currentMonth.income) * 100).toFixed(1);
        generated.push(`Current savings rate is ${savingsRate}%.`);
        
        // Expense Ratio
        const expenseRatio = ((currentMonth.expenses / currentMonth.income) * 100).toFixed(1);
        generated.push(`Expenses represent ${expenseRatio}% of income.`);
      }
      
      // Monthly Surplus
      const surplus = currentMonth.income - currentMonth.expenses;
      if (surplus !== 0) {
        generated.push(`Current monthly surplus is ${formatCurrency(surplus)}.`);
      }

      // MoM Expenses
      if (sorted.length >= 2) {
        const prevMonth = sorted[sorted.length - 2];
        if (prevMonth.expenses > 0) {
          const expenseChange = ((currentMonth.expenses - prevMonth.expenses) / prevMonth.expenses) * 100;
          if (expenseChange > 0) {
            generated.push(`Expenses increased ${expenseChange.toFixed(1)}% month-over-month.`);
          } else if (expenseChange < 0) {
            generated.push(`Expenses decreased ${Math.abs(expenseChange).toFixed(1)}% month-over-month.`);
          }
        }
      }

      // Portfolio vs Expenses — use total assets (holdings + cumulative savings)
      if (portfolioSummary && portfolioSummary.total_portfolio_value > 0) {
        const cashBalance = sorted.reduce((sum, m) => sum + m.savings, 0);
        const totalAssets = portfolioSummary.total_portfolio_value + Math.max(cashBalance, 0);

        const monthsWithExpenses = sorted.filter((m) => m.expenses > 0);
        const expenseMonths = monthsWithExpenses.length > 0 ? monthsWithExpenses : sorted;
        const totalExpensesHist = expenseMonths.reduce((sum, m) => sum + m.expenses, 0);
        const avgMonthlyExpense = totalExpensesHist / expenseMonths.length;

        if (avgMonthlyExpense > 0) {
          const monthsCovered = totalAssets / avgMonthlyExpense;
          generated.push(
            `Portfolio value covers ${monthsCovered >= 10 ? Math.round(monthsCovered) : monthsCovered.toFixed(1)} months of average expenses.`,
          );
        }
      }
    }

    return generated.slice(0, 6);
  }, [transactions, monthlySummaries, portfolioSummary]);

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Analytics Insights</CardTitle>
          <Sparkles className="w-4 h-4 text-brand-400" />
        </div>
      </CardHeader>
      <div className="px-6 pb-6 space-y-4">
        {insights.length > 0 ? (
          insights.map((insight, index) => (
            <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-brand-900/10 border border-brand-500/10">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-2 flex-shrink-0" />
              <p className="text-sm text-white/80 leading-relaxed">{insight}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-white/40">Not enough data to generate insights.</p>
        )}
      </div>
    </Card>
  );
}
