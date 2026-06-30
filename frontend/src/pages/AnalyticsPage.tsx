import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, PiggyBank, Percent, Plus, Activity } from 'lucide-react';

import { portfolioApi } from '@/api/portfolio';
import { transactionsApi } from '@/api/transactions';

import { Card, CardHeader } from '@/components/ui/Card';
import { Skeleton, Loader } from '@/components/ui/Loader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';

import { formatCurrency, formatPercent } from '@/utils/formatCurrency';

import { IncomeExpenseTrend } from '@/components/analytics/IncomeExpenseTrend';
import { SavingsTrendChart } from '@/components/analytics/SavingsTrendChart';
import { ExpenseCategoryChart } from '@/components/analytics/ExpenseCategoryChart';
import { AnalyticsInsights } from '@/components/analytics/AnalyticsInsights';

function SummaryCard({
  label,
  value,
  icon: Icon,
  color,
  helperText,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  helperText?: string;
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
      {helperText && (
        <p className="mt-2 text-xs text-white/40">{helperText}</p>
      )}
    </Card>
  );
}

export function AnalyticsPage() {
  const navigate = useNavigate();

  // Fetch Monthly Summaries
  const { data: monthlySummaries, isLoading: monthlyLoading } = useQuery({
    queryKey: ['transactions-summary'],
    queryFn: () => transactionsApi.getMonthlySummary(),
  });

  // Fetch Transactions (Max supported page_size = 100)
  const { data: transactionsData, isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions', { page: 1, page_size: 100 }],
    queryFn: () => transactionsApi.list({ page: 1, page_size: 100 }),
  });

  // Fetch Portfolio Summary for insights
  const { data: portfolioSummary, isLoading: portfolioLoading } = useQuery({
    queryKey: ['portfolio-summary'],
    queryFn: () => portfolioApi.getSummary(),
  });

  const isLoading = monthlyLoading || transactionsLoading || portfolioLoading;
  const hasTransactions = transactionsData && transactionsData.total > 0;

  // Compute Totals
  const totals = useMemo(() => {
    if (!monthlySummaries) return { income: 0, expenses: 0, savings: 0 };
    return monthlySummaries.reduce(
      (acc, curr) => {
        acc.income += curr.income;
        acc.expenses += curr.expenses;
        acc.savings += curr.savings;
        return acc;
      },
      { income: 0, expenses: 0, savings: 0 }
    );
  }, [monthlySummaries]);

  const savingsRate = totals.income > 0 ? (totals.savings / totals.income) * 100 : 0;

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="fc-heading">Analytics</h1>
          <p className="fc-subheading">Financial trends and insights</p>
        </div>
        <div className="fc-stat-grid-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="fc-card flex-1 min-w-0">
              <CardHeader><Skeleton className="w-10 h-10 rounded-xl" /></CardHeader>
              <Skeleton className="h-8 w-24" />
            </Card>
          ))}
        </div>
        <div className="h-[400px] flex items-center justify-center">
          <Loader size="lg" text="Loading analytics..." />
        </div>
      </div>
    );
  }

  if (!hasTransactions) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="fc-heading">Analytics</h1>
          <p className="fc-subheading">Financial trends and insights</p>
        </div>
        <EmptyState
          icon={<TrendingUp className="w-12 h-12" />}
          title="No transaction data available yet."
          description="Add your first transaction to start tracking financial trends."
          action={
            <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => navigate('/transactions')}>
              Add Transaction
            </Button>
          }
        />
      </div>
    );
  }

  const hasMoreThanOnePage = transactionsData && transactionsData.total > 100;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h1 className="fc-heading">Analytics</h1>
            <p className="fc-subheading">Financial trends and insights</p>
          </div>
          {hasMoreThanOnePage && (
            <p className="text-xs text-white/40">Analytics are based on recent transactions.</p>
          )}
        </div>
      </div>

      {/* Row 1: Summary Cards */}
      <div className="fc-stat-grid-3">
        <SummaryCard
          label="Total Income"
          value={formatCurrency(totals.income)}
          icon={TrendingUp}
          color="bg-income/80"
        />
        <SummaryCard
          label="Total Expenses"
          value={formatCurrency(totals.expenses)}
          icon={TrendingDown}
          color="bg-expense/80"
        />
        <SummaryCard
          label="Total Savings"
          value={formatCurrency(totals.savings)}
          icon={PiggyBank}
          color="bg-brand-600"
        />
        <SummaryCard
          label="Savings Rate"
          value={totals.income > 0 ? formatPercent(savingsRate) : 'N/A'}
          icon={Percent}
          color="bg-purple-600"
        />
        <SummaryCard
          label="Tracked Transactions"
          value={transactionsData?.total?.toString() || '0'}
          icon={Activity}
          color="bg-brand-500"
          helperText={hasMoreThanOnePage ? "Recent transactions analyzed" : "All transactions analyzed"}
        />
      </div>

      {/* Row 2: Trend Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <IncomeExpenseTrend data={monthlySummaries} />
        <SavingsTrendChart data={monthlySummaries} />
      </div>

      {/* Row 3 & 4: Categories & Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ExpenseCategoryChart transactions={transactionsData?.items} />
        <AnalyticsInsights 
          transactions={transactionsData?.items}
          monthlySummaries={monthlySummaries}
          portfolioSummary={portfolioSummary}
        />
      </div>
    </div>
  );
}
