import { IndianRupee, TrendingUp, Wallet, ArrowUpRight, ArrowDownRight, Plus, PieChart, Sparkles } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Loader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { CategoryIcon } from '@/components/ui/CategoryIcon';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { transactionsApi } from '@/api/transactions';
import { portfolioApi } from '@/api/portfolio';
import { formatCurrency, formatDate } from '@/utils/formatDate';
import { currentMonthYear } from '@/utils/formatDate';
import { useNavigate } from 'react-router-dom';

/** Placeholder stat card used while other phases are not yet built */
function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  color,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  trend?: number;
  color: string;
}) {
  return (
    <Card className="fc-stat-card">
      <CardHeader>
        <p className="fc-label">{label}</p>
        <div className={cn('fc-stat-icon', color)}>
          <Icon className="w-[18px] h-[18px]" strokeWidth={2} />
        </div>
      </CardHeader>
      <div className="fc-stat-value">{value}</div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-1.5 text-xs font-medium ${trend >= 0 ? 'text-income' : 'text-expense'}`}>
          {trend >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
          {Math.abs(trend).toFixed(2)}% vs last month
        </div>
      )}
    </Card>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Fetch monthly summary
  const { data: monthlySummary, isLoading: summaryLoading } = useQuery({
    queryKey: ['transactions-summary'],
    queryFn: () => transactionsApi.getMonthlySummary(),
  });

  // Fetch transactions to check if user has any
  const { data: transactionsData, isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions', { page: 1, page_size: 1 }],
    queryFn: () => transactionsApi.list({ page: 1, page_size: 1 }),
  });

  // Fetch recent transactions for display
  const { data: recentTransactionsData } = useQuery({
    queryKey: ['transactions', { page: 1, page_size: 5 }],
    queryFn: () => transactionsApi.list({ page: 1, page_size: 5 }),
  });

  // Fetch portfolio summary
  const { data: portfolioSummary } = useQuery({
    queryKey: ['portfolio-summary'],
    queryFn: () => portfolioApi.getSummary(),
  });

  const hasTransactions = (transactionsData?.total || 0) > 0;
  const currentMonthData = monthlySummary?.[0] || { income: 0, expenses: 0, savings: 0 };
  const savingsRate = currentMonthData.income > 0
    ? ((currentMonthData.savings / currentMonthData.income) * 100).toFixed(1)
    : '0';

  // Calculate financial health score based on savings rate
  const calculateHealthScore = () => {
    // Only show health score if user has transactions
    if (!hasTransactions) return null;
    
    // If no income this month but has transactions, show 0 score
    if (currentMonthData.income === 0) return 0;
    
    const savingsRateNum = parseFloat(savingsRate);
    // Base score on savings rate: 0% = 0, 20% = 50, 50%+ = 100
    let score = 0;
    if (savingsRateNum >= 50) {
      score = 100;
    } else if (savingsRateNum >= 20) {
      score = 50 + ((savingsRateNum - 20) / 30) * 50;
    } else if (savingsRateNum > 0) {
      score = (savingsRateNum / 20) * 50;
    }
    return Math.round(score);
  };

  const healthScore = calculateHealthScore();
  const healthScorePercentage = healthScore !== null ? (healthScore / 100) * 251.2 : 0;

  // Show loading state
  if (summaryLoading || transactionsLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="fc-heading">
              Good {getGreeting()}, {user?.full_name.split(' ')[0]} 👋
            </h1>
            <p className="fc-subheading">{currentMonthYear()} overview</p>
          </div>
        </div>
        <div className="fc-stat-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="fc-card flex-1 min-w-0">
              <CardHeader>
                <Skeleton className="w-10 h-10 rounded-xl" />
              </CardHeader>
              <Skeleton className="h-8 w-24" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Show empty state if no transactions
  if (!hasTransactions) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="fc-heading">
              Good {getGreeting()}, {user?.full_name.split(' ')[0]} 👋
            </h1>
            <p className="fc-subheading">{currentMonthYear()} overview</p>
          </div>
          <span className="fc-badge-neutral text-xs">AI Insights ready</span>
        </div>

        <EmptyState
          icon={<IndianRupee className="w-12 h-12" />}
          title="No transactions yet"
          description="Start tracking your finances by adding your first transaction"
          action={
            <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => navigate('/transactions')}>
              Add First Transaction
            </Button>
          }
        />
      </div>
    );
  }

  // Show dashboard with transaction data
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="fc-heading">
            Good {getGreeting()}, {user?.full_name.split(' ')[0]} 👋
          </h1>
          <p className="fc-subheading">{currentMonthYear()} overview</p>
        </div>
        <span className="fc-badge-neutral text-xs">AI Insights ready</span>
      </div>

      {/* Stat cards */}
      <div className="fc-stat-grid">
        <StatCard
          label="Total Income"
          value={formatCurrency(currentMonthData.income)}
          icon={IndianRupee}
          color="fc-icon-income"
        />
        <StatCard
          label="Total Expenses"
          value={formatCurrency(currentMonthData.expenses)}
          icon={TrendingUp}
          color="fc-icon-expense"
        />
        <StatCard
          label="Savings"
          value={formatCurrency(currentMonthData.savings)}
          icon={Wallet}
          color="fc-icon-neutral"
        />
        <StatCard
          label="Savings Rate"
          value={`${savingsRate}%`}
          icon={TrendingUp}
          color="fc-icon-brand"
        />
        {portfolioSummary && portfolioSummary.holdings_count > 0 && (
          <StatCard
            label="Portfolio Value"
            value={formatCurrency(portfolioSummary.total_portfolio_value)}
            icon={PieChart}
            color="fc-icon-neutral"
            trend={portfolioSummary.total_gain_loss_percent}
          />
        )}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent transactions */}
        <Card className="lg:col-span-2 fc-card">
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>View all in Transactions page</span>
          </CardHeader>
          <div className="space-y-2">
            {recentTransactionsData?.items && recentTransactionsData.items.length > 0 ? (
              recentTransactionsData.items.map((transaction) => (
                <div
                  key={transaction.id}
                  className="fc-list-row"
                >
                  <CategoryIcon
                    categoryId={transaction.category_id}
                    categoryName={transaction.category?.name}
                    transactionType={transaction.type}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      {transaction.description || transaction.merchant_name || 'Transaction'}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {formatDate(transaction.transaction_date)}
                      {transaction.category && ` • ${transaction.category.name}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-semibold tabular-nums ${
                        transaction.type === 'income' ? 'text-income' : 'text-expense'
                      }`}
                    >
                      {transaction.type === 'income' ? '+' : '-'}
                      {formatCurrency(transaction.amount)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>No recent transactions</p>
            )}
          </div>
        </Card>

        {/* AI Health Score */}
        <Card className="fc-card">
          <CardHeader>
            <CardTitle>Financial Health</CardTitle>
            <Sparkles className="w-4 h-4 text-brand-500" />
          </CardHeader>
          <div className="flex items-center justify-center py-8">
            <div className="relative">
              <svg className="w-32 h-32 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="var(--surface-input)" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r="40" fill="none"
                  stroke={healthScore !== null && healthScore >= 70 ? 'rgb(16 185 129)' : healthScore !== null && healthScore >= 40 ? 'rgb(251 191 36)' : 'rgb(244 63 94)'}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${healthScorePercentage} 251.2`}
                  className="transition-all duration-500 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
                <span className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  {healthScore !== null ? healthScore : '—'}
                </span>
                <span className="text-2xs" style={{ color: 'var(--text-muted)' }}>/ 100</span>
              </div>
            </div>
          </div>
          <p className="text-center text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {healthScore !== null
              ? healthScore >= 70
                ? 'Excellent financial health!'
                : healthScore >= 40
                ? 'Good progress, keep saving!'
                : healthScore === 0
                ? 'No income recorded this month'
                : 'Focus on increasing your savings rate'
              : 'Add more transactions to generate your AI health score'}
          </p>
        </Card>
      </div>
    </div>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
