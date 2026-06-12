import { IndianRupee, TrendingUp, Wallet, ArrowUpRight, ArrowDownRight, Sparkles, Plus, PieChart } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Loader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
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
    <Card className="flex-1 min-w-0">
      <CardHeader>
        <p className="text-xs text-white/50 font-medium">{label}</p>
        <div className={`w-8 h-8 rounded-xl ${color} flex items-center justify-center`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
      </CardHeader>
      <div className="text-2xl font-bold text-white tabular-nums">{value}</div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${trend >= 0 ? 'text-income' : 'text-expense'}`}>
          {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {Math.abs(trend)}% vs last month
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

  // Show loading state
  if (summaryLoading || transactionsLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="fc-heading">
              Good {getGreeting()}, {user?.full_name.split(' ')[0]} 👋
            </h1>
            <p className="fc-subheading mt-0.5">{currentMonthYear()} overview</p>
          </div>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-1 no-scrollbar">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="flex-1 min-w-0">
              <CardHeader>
                <Skeleton className="w-8 h-8 rounded-xl" />
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
            <p className="fc-subheading mt-0.5">{currentMonthYear()} overview</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-brand-600/15 border border-brand-500/30">
            <Sparkles className="w-3.5 h-3.5 text-brand-400" />
            <span className="text-xs text-brand-400 font-medium">AI Insights ready</span>
          </div>
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
          <p className="fc-subheading mt-0.5">{currentMonthYear()} overview</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-brand-600/15 border border-brand-500/30">
          <Sparkles className="w-3.5 h-3.5 text-brand-400" />
          <span className="text-xs text-brand-400 font-medium">AI Insights ready</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="flex gap-4 overflow-x-auto pb-1 no-scrollbar">
        <StatCard
          label="Total Income"
          value={formatCurrency(currentMonthData.income)}
          icon={IndianRupee}
          color="bg-income/80"
        />
        <StatCard
          label="Total Expenses"
          value={formatCurrency(currentMonthData.expenses)}
          icon={TrendingUp}
          color="bg-expense/80"
        />
        <StatCard
          label="Savings"
          value={formatCurrency(currentMonthData.savings)}
          icon={Wallet}
          color="bg-purple-600"
        />
        <StatCard
          label="Savings Rate"
          value={`${savingsRate}%`}
          icon={TrendingUp}
          color="bg-brand-600"
        />
        {portfolioSummary && portfolioSummary.holdings_count > 0 && (
          <StatCard
            label="Portfolio Value"
            value={formatCurrency(portfolioSummary.total_portfolio_value)}
            icon={PieChart}
            color="bg-purple-600"
            trend={portfolioSummary.total_gain_loss_percent}
          />
        )}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent transactions */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
            <span className="text-xs text-white/40">View all in Transactions page</span>
          </CardHeader>
          <div className="space-y-2">
            {recentTransactionsData?.items && recentTransactionsData.items.length > 0 ? (
              recentTransactionsData.items.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center gap-4 p-3 rounded-xl hover:bg-surface-hover transition-colors"
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      transaction.type === 'income' ? 'bg-income/20' : 'bg-expense/20'
                    }`}
                  >
                    {transaction.category?.icon ? (
                      <span className="text-lg">{transaction.category.icon}</span>
                    ) : (
                      <IndianRupee className="w-4 h-4 text-white/60" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {transaction.description || transaction.merchant_name || 'Transaction'}
                    </p>
                    <p className="text-xs text-white/50">
                      {formatDate(transaction.transaction_date)}
                      {transaction.category && ` • ${transaction.category.name}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-semibold ${
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
              <p className="text-center text-white/50 py-8">No recent transactions</p>
            )}
          </div>
        </Card>

        {/* AI Health Score placeholder */}
        <Card variant="gradient">
          <CardHeader>
            <CardTitle>Financial Health</CardTitle>
            <Sparkles className="w-4 h-4 text-brand-400" />
          </CardHeader>
          <div className="flex items-center justify-center py-8">
            <div className="relative">
              <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(99,102,241,0.15)" strokeWidth="10" />
                <circle
                  cx="50" cy="50" r="40" fill="none"
                  stroke="url(#scoreGrad)" strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${0.72 * 251.2} 251.2`}
                />
                <defs>
                  <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#a855f7" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
                <span className="text-3xl font-bold text-white">—</span>
                <span className="text-2xs text-white/40">/ 100</span>
              </div>
            </div>
          </div>
          <p className="text-center text-xs text-white/50">
            Add more transactions to generate your AI health score
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
