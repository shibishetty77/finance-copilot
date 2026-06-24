import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { IndianRupee, TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight, Plus } from 'lucide-react';

import { portfolioApi } from '@/api/portfolio';
import { transactionsApi } from '@/api/transactions';
import { Card, CardHeader } from '@/components/ui/Card';
import { Skeleton, Loader } from '@/components/ui/Loader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';

import { formatCurrency, formatPercent } from '@/utils/formatCurrency';
import { currentMonthYear } from '@/utils/formatDate';

import { NetWorthHistoryChart } from '@/components/networth/NetWorthHistoryChart';
import { AssetLiabilityChart } from '@/components/networth/AssetLiabilityChart';
import { GrowthInsights } from '@/components/networth/GrowthInsights';
import { PortfolioAllocationChart } from '@/components/portfolio/PortfolioAllocationChart';

// ── Summary Card Component ─────────────────────────────────────────────────────
function SummaryCard({
  label,
  value,
  icon: Icon,
  color,
  trend,
  helperText,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  trend?: number;
  helperText?: string;
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
      {helperText && (
        <p className="text-xs text-white/40 mt-1">{helperText}</p>
      )}
      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${trend >= 0 ? 'text-income' : 'text-expense'}`}>
          {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {Math.abs(trend).toFixed(2)}% vs last month
        </div>
      )}
    </Card>
  );
}

export function NetWorthPage() {
  const navigate = useNavigate();

  // Fetch portfolio data
  const { data: portfolioSummary, isLoading: summaryLoading } = useQuery({
    queryKey: ['portfolio-summary'],
    queryFn: () => portfolioApi.getSummary(),
  });

  const { data: holdingsData, isLoading: holdingsLoading } = useQuery({
    queryKey: ['holdings', { asset_type: '', sector: '', search: '', page: 1, page_size: 20 }],
    queryFn: () => portfolioApi.listHoldings({ asset_type: '', sector: '', search: '', page: 1, page_size: 20 }),
  });

  // Fetch transactions data
  const { data: monthlySummaries, isLoading: monthlyLoading } = useQuery({
    queryKey: ['transactions-summary'],
    queryFn: () => transactionsApi.getMonthlySummary(),
  });

  const { data: transactionsData, isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions', { page: 1, page_size: 1 }],
    queryFn: () => transactionsApi.list({ page: 1, page_size: 1 }),
  });

  const isLoading = summaryLoading || holdingsLoading || monthlyLoading || transactionsLoading;

  // Calculate Cash Balance (cumulative savings)
  const cashBalance = useMemo(() => {
    if (!monthlySummaries) return 0;
    return monthlySummaries.reduce((sum, current) => sum + current.savings, 0);
  }, [monthlySummaries]);

  // Calculations
  const portfolioValue = portfolioSummary?.total_portfolio_value || 0;
  const totalAssets = cashBalance + portfolioValue;
  const totalLiabilities = 0; // MVP Requirement: Liabilities = 0
  const netWorth = totalAssets - totalLiabilities;

  // Calculate Monthly Growth %
  const monthlyGrowth = useMemo(() => {
    if (!monthlySummaries || monthlySummaries.length < 2) return null;
    
    // Sort chronologically
    const sorted = [...monthlySummaries].sort((a, b) => a.month.localeCompare(b.month));
    const currentMonth = sorted[sorted.length - 1];
    const prevMonth = sorted[sorted.length - 2];

    if (prevMonth.savings === 0) return 0;
    return ((currentMonth.savings - prevMonth.savings) / Math.abs(prevMonth.savings)) * 100;
  }, [monthlySummaries]);

  const hasHoldings = (holdingsData?.total || 0) > 0;
  const hasTransactions = (transactionsData?.total || 0) > 0;
  const showEmptyState = !hasHoldings && !hasTransactions && !isLoading;

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="fc-heading">Net Worth</h1>
          <p className="fc-subheading mt-0.5">{currentMonthYear()} overview</p>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-1 no-scrollbar">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="flex-1 min-w-0">
              <CardHeader><Skeleton className="w-8 h-8 rounded-xl" /></CardHeader>
              <Skeleton className="h-8 w-24" />
            </Card>
          ))}
        </div>
        <div className="h-[400px] flex items-center justify-center">
          <Loader size="lg" text="Loading net worth data..." />
        </div>
      </div>
    );
  }

  if (showEmptyState) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="fc-heading">Net Worth</h1>
          <p className="fc-subheading mt-0.5">{currentMonthYear()} overview</p>
        </div>
        <EmptyState
          icon={<IndianRupee className="w-12 h-12" />}
          title="Start building your net worth"
          description="Track your assets, liabilities, and overall financial growth by adding your data."
          action={
            <div className="flex items-center gap-4 justify-center">
              <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => navigate('/portfolio')}>
                Add Holding
              </Button>
              <Button variant="secondary" leftIcon={<Plus className="w-4 h-4" />} onClick={() => navigate('/transactions')}>
                Add Transaction
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="fc-heading">Net Worth</h1>
        <p className="fc-subheading mt-0.5">{currentMonthYear()} overview</p>
      </div>

      {/* Row 1: Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Net Worth"
          value={formatCurrency(netWorth)}
          icon={IndianRupee}
          color="bg-purple-600"
          helperText="Net Worth = Assets − Liabilities"
        />
        <SummaryCard
          label="Total Assets"
          value={formatCurrency(totalAssets)}
          icon={Wallet}
          color="bg-brand-600"
        />
        <SummaryCard
          label="Liabilities"
          value={formatCurrency(totalLiabilities)}
          icon={TrendingDown}
          color="bg-expense/80"
          helperText="Debt tracking coming soon"
        />
        <SummaryCard
          label="Monthly Growth"
          value={monthlyGrowth !== null ? formatPercent(monthlyGrowth) : 'N/A'}
          icon={TrendingUp}
          color="bg-income/80"
          trend={monthlyGrowth !== null ? monthlyGrowth : undefined}
          helperText={monthlyGrowth === null ? "Need 2+ months of history" : undefined}
        />
      </div>

      {/* Row 2: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <NetWorthHistoryChart monthlySummaries={monthlySummaries} />
        </div>
        <div>
          <AssetLiabilityChart totalAssets={totalAssets} totalLiabilities={totalLiabilities} />
        </div>
      </div>

      {/* Row 3: Allocation and Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PortfolioAllocationChart 
            holdings={holdingsData?.items} 
            totalValue={portfolioValue} 
            isLoading={false} 
          />
        </div>
        <div>
          <GrowthInsights 
            holdings={holdingsData?.items} 
            portfolioSummary={portfolioSummary} 
            monthlySummaries={monthlySummaries} 
          />
        </div>
      </div>
    </div>
  );
}
