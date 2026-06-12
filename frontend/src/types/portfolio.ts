/**
 * TypeScript types for portfolio and holdings.
 */

export interface Holding {
  id: string;
  user_id: string;
  symbol: string;
  company_name: string | null;
  asset_type: 'stock' | 'mutual_fund' | 'etf' | 'bond' | 'crypto';
  sector: string | null;
  quantity: number;
  average_buy_price: number;
  current_price: number;
  invested_amount: number;
  current_value: number;
  gain_loss: number;
  gain_loss_percent: number;
  purchase_date: string;
  notes: string | null;
  tags: string[] | null;
  dividend_amount: number | null;
  dividend_date: string | null;
  benchmark_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface HoldingCreate {
  symbol: string;
  company_name?: string;
  asset_type: 'stock' | 'mutual_fund' | 'etf' | 'bond' | 'crypto';
  sector?: string;
  quantity: number;
  average_buy_price: number;
  current_price: number;
  purchase_date: string;
  notes?: string;
  tags?: string[];
}

export interface HoldingUpdate {
  symbol?: string;
  company_name?: string;
  asset_type?: 'stock' | 'mutual_fund' | 'etf' | 'bond' | 'crypto';
  sector?: string;
  quantity?: number;
  average_buy_price?: number;
  current_price?: number;
  purchase_date?: string;
  notes?: string;
  tags?: string[];
}

export interface HoldingFilters {
  asset_type?: string;
  sector?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface HoldingPaginationResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: Holding[];
}

export interface PortfolioSummary {
  total_portfolio_value: number;
  total_invested_amount: number;
  total_gain_loss: number;
  total_gain_loss_percent: number;
  holdings_count: number;
}

export interface AssetAllocation {
  asset_type: string;
  value: number;
  percentage: number;
}

export interface SectorAllocation {
  sector: string;
  value: number;
  percentage: number;
}

export interface PortfolioAllocation {
  asset_allocation: AssetAllocation[];
  sector_allocation: SectorAllocation[];
}

export interface DiversificationScore {
  score: number;
  factors: Record<string, number>;
  recommendations: string[];
}

export interface RiskScore {
  score: number;
  factors: Record<string, number>;
  recommendations: string[];
}

export interface TopPerformer {
  id: string;
  symbol: string;
  company_name: string | null;
  gain_loss_percent: number;
  gain_loss: number;
}

export interface WorstPerformer {
  id: string;
  symbol: string;
  company_name: string | null;
  gain_loss_percent: number;
  gain_loss: number;
}

export interface PerformanceAnalytics {
  top_performer: TopPerformer | null;
  worst_performer: WorstPerformer | null;
  best_sector: string | null;
  worst_sector: string | null;
  biggest_holding: {
    id: string;
    symbol: string;
    company_name: string | null;
    current_value: number;
    percentage: number;
  } | null;
}

export interface Milestone {
  type: string;
  value: number;
  achieved_at: string;
}

export interface MilestonesResponse {
  first_investment: Milestone | null;
  crossed_10k: Milestone | null;
  crossed_50k: Milestone | null;
  crossed_100k: Milestone | null;
  crossed_500k: Milestone | null;
  largest_gain: Milestone | null;
  largest_loss: Milestone | null;
}
