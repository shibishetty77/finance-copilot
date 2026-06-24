import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Sparkles } from 'lucide-react';
import type { Holding, PortfolioSummary } from '@/types/portfolio';
import type { TransactionMonthlySummary } from '@/types/transaction';

interface GrowthInsightsProps {
  holdings: Holding[] | undefined;
  portfolioSummary: PortfolioSummary | undefined;
  monthlySummaries: TransactionMonthlySummary[] | undefined;
}

export function GrowthInsights({ holdings, portfolioSummary, monthlySummaries }: GrowthInsightsProps) {
  const insights: string[] = [];

  // Generate data-backed insights
  
  if (holdings && holdings.length > 0 && portfolioSummary && portfolioSummary.total_portfolio_value > 0) {
    const largestHolding = [...holdings].sort((a, b) => b.current_value - a.current_value)[0];
    if (largestHolding) {
      const percentage = ((largestHolding.current_value / portfolioSummary.total_portfolio_value) * 100).toFixed(1);
      insights.push(`Largest holding (${largestHolding.symbol}) contributes ${percentage}% of portfolio assets.`);
    }

    insights.push(`Portfolio contains ${holdings.length} tracked holding${holdings.length !== 1 ? 's' : ''}.`);
    
    // Group by sector
    const sectorMap: Record<string, number> = {};
    holdings.forEach(h => {
      const sector = h.sector || 'Other';
      sectorMap[sector] = (sectorMap[sector] || 0) + h.current_value;
    });
    
    const topSector = Object.entries(sectorMap).sort((a, b) => b[1] - a[1])[0];
    if (topSector && topSector[1] > 0) {
      const sectorPercentage = ((topSector[1] / portfolioSummary.total_portfolio_value) * 100).toFixed(1);
      insights.push(`${topSector[0]} sector accounts for ${sectorPercentage}% of portfolio value.`);
    }
  }

  if (monthlySummaries && monthlySummaries.length > 0) {
    // Current month savings rate
    const sorted = [...monthlySummaries].sort((a, b) => a.month.localeCompare(b.month));
    const currentMonth = sorted[sorted.length - 1];
    if (currentMonth.income > 0) {
      const savingsRate = ((currentMonth.savings / currentMonth.income) * 100).toFixed(1);
      insights.push(`Current savings rate is ${savingsRate}%.`);
    }

    if (sorted.length >= 2) {
      const prevMonth = sorted[sorted.length - 2];
      if (prevMonth.savings > 0) {
        const savingsGrowth = ((currentMonth.savings - prevMonth.savings) / prevMonth.savings) * 100;
        if (savingsGrowth > 0) {
          insights.push(`Monthly savings increased ${savingsGrowth.toFixed(1)}% vs last month.`);
        } else if (savingsGrowth < 0) {
          insights.push(`Monthly savings decreased ${Math.abs(savingsGrowth).toFixed(1)}% vs last month.`);
        }
      }
    }

    // Portfolio vs Annual Expenses
    if (portfolioSummary && portfolioSummary.total_portfolio_value > 0) {
      // Average monthly expense from recent history
      const totalExpenses = sorted.reduce((sum, m) => sum + m.expenses, 0);
      const avgMonthlyExpense = totalExpenses / sorted.length;
      if (avgMonthlyExpense > 0) {
        const annualExpenses = avgMonthlyExpense * 12;
        const ratio = (portfolioSummary.total_portfolio_value / annualExpenses).toFixed(1);
        insights.push(`Portfolio value is ${ratio} times estimated annual expenses.`);
      }
    }
  }

  // Cap at 6 insights
  const finalInsights = insights.slice(0, 6);

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Growth Insights</CardTitle>
          <Sparkles className="w-4 h-4 text-brand-400" />
        </div>
      </CardHeader>
      <div className="px-6 pb-6 space-y-4">
        {finalInsights.length > 0 ? (
          finalInsights.map((insight, index) => (
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
