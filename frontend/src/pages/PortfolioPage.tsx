import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Plus,
  Search,
  Edit2,
  Trash2,
  PieChart,
  Shield,
  IndianRupee,
} from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { PortfolioAllocationChart } from '@/components/portfolio/PortfolioAllocationChart';
import { SectorAllocationChart } from '@/components/portfolio/SectorAllocationChart';
import { TopHoldingsWidget } from '@/components/portfolio/TopHoldingsWidget';
import { PortfolioInsights } from '@/components/portfolio/PortfolioInsights';
import { portfolioApi } from '@/api/portfolio';
import { formatCurrency } from '@/utils/formatDate';
import type { Holding, HoldingUpdate } from '@/types/portfolio';

// ── Form schema ───────────────────────────────────────────────────────────────
const holdingSchema = z.object({
  symbol: z.string().min(1, 'Symbol is required').max(20),
  company_name: z.string().max(255).optional(),
  asset_type: z.enum(['stock', 'mutual_fund', 'etf', 'bond', 'crypto']),
  sector: z.string().max(50).optional(),
  quantity: z.number({ required_error: 'Quantity is required' }).positive('Quantity must be positive'),
  average_buy_price: z.number({ required_error: 'Average buy price is required' }).positive('Average buy price must be positive'),
  current_price: z.number({ required_error: 'Current price is required' }).positive('Current price must be positive'),
  purchase_date: z.string().min(1, 'Purchase date is required'),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

type HoldingForm = z.infer<typeof holdingSchema>;

// ── Summary Card Component ─────────────────────────────────────────────────────
function SummaryCard({
  label,
  value,
  icon: Icon,
  color,
  trend,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  trend?: number;
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
          {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {Math.abs(trend).toFixed(2)}%
        </div>
      )}
    </Card>
  );
}

// ── Score Widget Component ──────────────────────────────────────────────────────
function ScoreWidget({
  title,
  score,
  icon: Icon,
  recommendations,
}: {
  title: string;
  score: number;
  icon: React.ElementType;
  recommendations: string[];
}) {
  const getScoreColor = (s: number) => {
    if (s >= 80) return 'bg-income/20 text-income';
    if (s >= 60) return 'bg-brand-600/20 text-brand-400';
    if (s >= 40) return 'bg-yellow-600/20 text-yellow-400';
    return 'bg-expense/20 text-expense';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <Icon className="w-4 h-4 text-brand-400" />
      </CardHeader>
      <div className="flex items-center justify-center py-4">
        <div className={`w-24 h-24 rounded-full flex items-center justify-center ${getScoreColor(score)}`}>
          <span className="text-3xl font-bold">{score}</span>
        </div>
      </div>
      {recommendations.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs text-white/50 font-medium">Recommendations:</p>
          {recommendations.slice(0, 2).map((rec, i) => (
            <p key={i} className="text-xs text-white/70">• {rec}</p>
          ))}
        </div>
      )}
    </Card>
  );
}

export function PortfolioPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    asset_type: '',
    sector: '',
    search: '',
    page: 1,
    page_size: 20,
  });
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedHolding, setSelectedHolding] = useState<Holding | null>(null);

  // Fetch holdings
  const { data: holdingsData, isLoading: holdingsLoading } = useQuery({
    queryKey: ['holdings', filters],
    queryFn: () => portfolioApi.listHoldings(filters),
  });

  // Fetch portfolio summary
  const { data: summary } = useQuery({
    queryKey: ['portfolio-summary'],
    queryFn: () => portfolioApi.getSummary(),
  });


  // Fetch diversification score
  const { data: diversification } = useQuery({
    queryKey: ['portfolio-diversification'],
    queryFn: () => portfolioApi.getDiversificationScore(),
  });

  // Fetch risk score
  const { data: risk } = useQuery({
    queryKey: ['portfolio-risk'],
    queryFn: () => portfolioApi.getRiskScore(),
  });

  // Create holding mutation
  const createMutation = useMutation({
    mutationFn: portfolioApi.createHolding,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holdings'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-summary'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-allocation'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-diversification'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-risk'] });
      setIsAddModalOpen(false);
    },
  });

  // Update holding mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: HoldingUpdate }) => {
      console.log('[UPDATE HOLDING] Mutation function called with id:', id, 'data:', data);
      return portfolioApi.updateHolding(id, data);
    },
    onSuccess: (result) => {
      console.log('[UPDATE HOLDING] Mutation succeeded, result:', result);
      queryClient.invalidateQueries({ queryKey: ['holdings'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-summary'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-allocation'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-diversification'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-risk'] });
      setIsEditModalOpen(false);
    },
    onError: (error) => {
      console.error('[UPDATE HOLDING] Mutation failed:', error);
    },
  });

  // Delete holding mutation
  const deleteMutation = useMutation({
    mutationFn: portfolioApi.deleteHolding,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holdings'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-summary'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-allocation'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-diversification'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio-risk'] });
      setIsDeleteModalOpen(false);
    },
  });

  // Form setup
  const form = useForm<HoldingForm>({
    resolver: zodResolver(holdingSchema),
    defaultValues: {
      symbol: '',
      company_name: '',
      asset_type: 'stock',
      sector: '',
      quantity: undefined as unknown as number,
      average_buy_price: undefined as unknown as number,
      current_price: undefined as unknown as number,
      purchase_date: new Date().toISOString().split('T')[0],
      notes: '',
      tags: [],
    },
  });

  const openAddModal = () => {
    setSelectedHolding(null);
    form.reset({
      symbol: '',
      company_name: '',
      asset_type: 'stock',
      sector: '',
      quantity: undefined as unknown as number,
      average_buy_price: undefined as unknown as number,
      current_price: undefined as unknown as number,
      purchase_date: new Date().toISOString().split('T')[0],
      notes: '',
      tags: [],
    });
    setIsAddModalOpen(true);
  };

  const openEditModal = (holding: Holding) => {
    setSelectedHolding(holding);
    form.reset({
      symbol: holding.symbol,
      company_name: holding.company_name || '',
      asset_type: holding.asset_type,
      sector: holding.sector || '',
      quantity: holding.quantity,
      average_buy_price: holding.average_buy_price,
      current_price: holding.current_price,
      purchase_date: holding.purchase_date.split('T')[0],
      notes: holding.notes || '',
      tags: holding.tags || [],
    });
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (holding: Holding) => {
    setSelectedHolding(holding);
    setIsDeleteModalOpen(true);
  };

  const handleFilterChange = (key: string, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  };

  const onSubmit = (data: HoldingForm) => {
    console.log('[UPDATE HOLDING] Form submit triggered');
    console.log('[UPDATE HOLDING] selectedHolding:', selectedHolding);
    console.log('[UPDATE HOLDING] Form data:', data);
    if (selectedHolding) {
      console.log('[UPDATE HOLDING] Calling updateMutation with id:', selectedHolding.id);
      // Convert HoldingForm to HoldingUpdate (all fields optional)
      const updateData: HoldingUpdate = {};
      if (data.symbol) updateData.symbol = data.symbol;
      if (data.company_name) updateData.company_name = data.company_name;
      if (data.asset_type) updateData.asset_type = data.asset_type;
      if (data.sector) updateData.sector = data.sector;
      if (data.quantity) updateData.quantity = data.quantity;
      if (data.average_buy_price) updateData.average_buy_price = data.average_buy_price;
      if (data.current_price) updateData.current_price = data.current_price;
      if (data.purchase_date) updateData.purchase_date = data.purchase_date;
      if (data.notes) updateData.notes = data.notes;
      if (data.tags) updateData.tags = data.tags;
      console.log('[UPDATE HOLDING] Converted update data:', updateData);
      updateMutation.mutate({ id: selectedHolding.id, data: updateData });
    } else {
      console.log('[UPDATE HOLDING] Calling createMutation');
      createMutation.mutate(data);
    }
  };

  const handleDelete = () => {
    if (selectedHolding) {
      deleteMutation.mutate(selectedHolding.id);
    }
  };


  const hasHoldings = !holdingsLoading && holdingsData && holdingsData.total > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="fc-heading">Portfolio</h1>
          <p className="fc-subheading mt-0.5">Track your investments</p>
        </div>
        <Button
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={openAddModal}
        >
          Add Holding
        </Button>
      </div>

      {/* Empty State */}
      {!hasHoldings && (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="mb-4 p-4 rounded-2xl bg-brand-600/10 border border-brand-500/20 text-brand-400">
            <Wallet className="w-12 h-12" />
          </div>
          <h3 className="text-base font-semibold text-white mb-2">No holdings yet</h3>
          <p className="text-sm text-white/50 max-w-sm leading-relaxed">
            Start tracking your investments by adding your first holding
          </p>
          <div className="mt-6">
            <Button leftIcon={<Plus className="w-4 h-4" />} onClick={openAddModal}>
              Add First Holding
            </Button>
          </div>
        </div>
      )}

      {/* Portfolio Content */}
      {hasHoldings && (
        <>
          {/* Summary Cards */}
          <div className="flex gap-4 overflow-x-auto pb-1 no-scrollbar">
        <SummaryCard
          label="Portfolio Value"
          value={summary ? formatCurrency(summary.total_portfolio_value) : '₹0'}
          icon={Wallet}
          color="bg-brand-600"
        />
        <SummaryCard
          label="Invested Amount"
          value={summary ? formatCurrency(summary.total_invested_amount) : '₹0'}
          icon={IndianRupee}
          color="bg-purple-600"
        />
        <SummaryCard
          label="Gain/Loss"
          value={summary ? formatCurrency(summary.total_gain_loss) : '₹0'}
          icon={(summary?.total_gain_loss ?? 0) >= 0 ? TrendingUp : TrendingDown}
          color={(summary?.total_gain_loss ?? 0) >= 0 ? 'bg-income/80' : 'bg-expense/80'}
          trend={summary?.total_gain_loss_percent}
        />
        <SummaryCard
          label="Holdings"
          value={summary ? summary.holdings_count.toString() : '0'}
          icon={PieChart}
          color="bg-brand-600"
        />
      </div>

      {/* Portfolio Allocation Chart */}
      {hasHoldings && (
        <PortfolioAllocationChart
          holdings={holdingsData?.items}
          totalValue={summary?.total_portfolio_value ?? 0}
          isLoading={holdingsLoading}
        />
      )}

      {/* Sector Allocation + Top Holdings Row */}
      {hasHoldings && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SectorAllocationChart
            holdings={holdingsData?.items}
            totalValue={summary?.total_portfolio_value ?? 0}
            isLoading={holdingsLoading}
          />
          <TopHoldingsWidget
            holdings={holdingsData?.items}
            isLoading={holdingsLoading}
          />
        </div>
      )}

      {/* Portfolio Insights */}
      {hasHoldings && (
        <PortfolioInsights
          holdings={holdingsData?.items}
          totalValue={summary?.total_portfolio_value ?? 0}
          diversificationScore={diversification?.score}
          riskScore={risk?.score}
          isLoading={holdingsLoading}
        />
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Holdings Table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Holdings</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                placeholder="Search holdings..."
                leftIcon={<Search className="w-4 h-4" />}
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
              />
              <Select
                placeholder="Asset Type"
                value={filters.asset_type}
                onChange={(e) => handleFilterChange('asset_type', e.target.value)}
                options={[
                  { value: '', label: 'All Types' },
                  { value: 'stock', label: 'Stock' },
                  { value: 'mutual_fund', label: 'Mutual Fund' },
                  { value: 'etf', label: 'ETF' },
                  { value: 'bond', label: 'Bond' },
                  { value: 'crypto', label: 'Crypto' },
                ]}
              />
              <Select
                placeholder="Sector"
                value={filters.sector}
                onChange={(e) => handleFilterChange('sector', e.target.value)}
                options={[
                  { value: '', label: 'All Sectors' },
                  { value: 'Technology', label: 'Technology' },
                  { value: 'Finance', label: 'Finance' },
                  { value: 'Healthcare', label: 'Healthcare' },
                  { value: 'Energy', label: 'Energy' },
                ]}
              />
            </div>

            {/* Holdings Table */}
            <div className="space-y-2">
              {holdingsLoading ? (
                <p className="text-center text-white/50 py-8">Loading...</p>
              ) : (
                holdingsData?.items.map((holding) => (
                  <div
                    key={holding.id}
                    className="p-4 rounded-xl border border-white/10 hover:border-white/20 hover:bg-surface-hover transition-all"
                  >
                    {/* Header Row: Symbol, Company */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0 pr-4">
                        <p className="text-sm font-semibold text-white">{holding.symbol}</p>
                        <p className="text-xs text-white/50 mt-0.5">
                          {holding.company_name}
                        </p>
                      </div>
                    </div>

                    {/* Asset Type and Sector Row */}
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="brand" className="text-xs">
                        {holding.asset_type.charAt(0).toUpperCase() + holding.asset_type.slice(1).replace('_', ' ')}
                      </Badge>
                      {holding.sector && (
                        <Badge variant="default" className="text-xs">
                          {holding.sector}
                        </Badge>
                      )}
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-4 gap-4 mb-3 pb-3 border-b border-white/5">
                      <div>
                        <p className="text-xs text-white/50 font-medium mb-1">Quantity</p>
                        <p className="text-sm font-semibold text-white">{holding.quantity.toLocaleString('en-IN')}</p>
                      </div>
                      <div>
                        <p className="text-xs text-white/50 font-medium mb-1">Avg Buy Price</p>
                        <p className="text-sm font-semibold text-white">{formatCurrency(holding.average_buy_price)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-white/50 font-medium mb-1">Current Price</p>
                        <p className="text-sm font-semibold text-white">{formatCurrency(holding.current_price)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-white/50 font-medium mb-1">Current Value</p>
                        <p className="text-sm font-semibold text-white">{formatCurrency(holding.current_value)}</p>
                      </div>
                    </div>

                    {/* Footer Row: Gain/Loss and Actions */}
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p
                          className={`text-sm font-semibold ${
                            holding.gain_loss >= 0 ? 'text-income' : 'text-expense'
                          }`}
                        >
                          {holding.gain_loss >= 0 ? '+' : ''}
                          {formatCurrency(holding.gain_loss)}
                          <span className="text-xs font-medium ml-2">
                            ({holding.gain_loss >= 0 ? '+' : ''}{holding.gain_loss_percent.toFixed(2)}%)
                          </span>
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<Edit2 className="w-3 h-3" />}
                          onClick={() => openEditModal(holding)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<Trash2 className="w-3 h-3" />}
                          onClick={() => openDeleteModal(holding)}
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination */}
            {holdingsData && holdingsData.total_pages > 1 && (
              <div className="flex justify-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={filters.page === 1}
                  onClick={() => handlePageChange(filters.page - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-white/50">
                  Page {filters.page} of {holdingsData.total_pages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={filters.page === holdingsData.total_pages}
                  onClick={() => handlePageChange(filters.page + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </Card>

        {/* Scores */}
        <div className="space-y-4">
          {diversification && (
            <ScoreWidget
              title="Diversification Score"
              score={diversification.score}
              icon={PieChart}
              recommendations={diversification.recommendations}
            />
          )}
          {risk && (
            <ScoreWidget
              title="Risk Score"
              score={risk.score}
              icon={Shield}
              recommendations={risk.recommendations}
            />
          )}
        </div>
      </div>
        </>
      )}

      {/* Add Holding Modal */}
      <Modal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Holding"
      >
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {form.formState.errors && Object.keys(form.formState.errors).length > 0 && (
            <div className="p-3 rounded-lg bg-expense/10 border border-expense/30 text-expense text-sm">
              <p className="font-semibold mb-1">Validation Errors:</p>
              {Object.entries(form.formState.errors).map(([field, error]) => (
                <p key={field} className="text-xs">
                  {field}: {error?.message}
                </p>
              ))}
            </div>
          )}
          <Input label="Symbol" {...form.register('symbol')} placeholder="e.g., RELIANCE" />
          <Input label="Company Name" {...form.register('company_name')} placeholder="e.g., Reliance Industries" />
          <Select
            label="Asset Type"
            {...form.register('asset_type')}
            options={[
              { value: 'stock', label: 'Stock' },
              { value: 'mutual_fund', label: 'Mutual Fund' },
              { value: 'etf', label: 'ETF' },
              { value: 'bond', label: 'Bond' },
              { value: 'crypto', label: 'Crypto' },
            ]}
          />
          <Input label="Sector" {...form.register('sector')} placeholder="e.g., Technology" />
          <Input label="Quantity" type="number" step="0.0001" {...form.register('quantity', { valueAsNumber: true })} />
          <Input label="Average Buy Price" type="number" step="0.01" {...form.register('average_buy_price', { valueAsNumber: true })} />
          <Input label="Current Price" type="number" step="0.01" {...form.register('current_price', { valueAsNumber: true })} />
          <Input label="Purchase Date" type="date" {...form.register('purchase_date')} />
          <Input label="Notes" {...form.register('notes')} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              Add Holding
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Holding Modal */}
      <Modal
        open={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Holding"
      >
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {form.formState.errors && Object.keys(form.formState.errors).length > 0 && (
            <div className="p-3 rounded-lg bg-expense/10 border border-expense/30 text-expense text-sm">
              <p className="font-semibold mb-1">Validation Errors:</p>
              {Object.entries(form.formState.errors).map(([field, error]) => (
                <p key={field} className="text-xs">
                  {field}: {error?.message}
                </p>
              ))}
            </div>
          )}
          <Input label="Symbol" {...form.register('symbol')} />
          <Input label="Company Name" {...form.register('company_name')} />
          <Select
            label="Asset Type"
            {...form.register('asset_type')}
            options={[
              { value: 'stock', label: 'Stock' },
              { value: 'mutual_fund', label: 'Mutual Fund' },
              { value: 'etf', label: 'ETF' },
              { value: 'bond', label: 'Bond' },
              { value: 'crypto', label: 'Crypto' },
            ]}
          />
          <Input label="Sector" {...form.register('sector')} />
          <Input label="Quantity" type="number" step="0.0001" {...form.register('quantity', { valueAsNumber: true })} />
          <Input label="Average Buy Price" type="number" step="0.01" {...form.register('average_buy_price', { valueAsNumber: true })} />
          <Input label="Current Price" type="number" step="0.01" {...form.register('current_price', { valueAsNumber: true })} />
          <Input label="Purchase Date" type="date" {...form.register('purchase_date')} />
          <Input label="Notes" {...form.register('notes')} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={updateMutation.isPending}>
              Update Holding
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Holding"
      >
        <div className="space-y-4">
          <p className="text-white/70">
            Are you sure you want to delete {selectedHolding?.symbol}? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsDeleteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              loading={deleteMutation.isPending}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
