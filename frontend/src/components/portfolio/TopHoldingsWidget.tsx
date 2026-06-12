import { useMemo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatCurrency } from '@/utils/formatDate';
import type { Holding } from '@/types/portfolio';

interface TopHoldingsWidgetProps {
  holdings: Holding[] | undefined;
  isLoading: boolean;
}

export function TopHoldingsWidget({
  holdings,
  isLoading,
}: TopHoldingsWidgetProps) {
  const topHoldings = useMemo(() => {
    if (!holdings || holdings.length === 0) {
      return [];
    }

    return holdings
      .sort((a, b) => b.current_value - a.current_value)
      .slice(0, 5);
  }, [holdings]);

  const totalValue = useMemo(() => {
    if (!holdings) return 0;
    return holdings.reduce((sum, h) => sum + h.current_value, 0);
  }, [holdings]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Holdings</CardTitle>
        </CardHeader>
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="inline-block w-8 h-8 border-4 border-brand-600/30 border-t-brand-600 rounded-full animate-spin" />
            <p className="text-sm text-white/50 mt-4">Loading...</p>
          </div>
        </div>
      </Card>
    );
  }

  if (!holdings || holdings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Holdings</CardTitle>
        </CardHeader>
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <p className="text-sm text-white/50">No holdings yet</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Holdings</CardTitle>
      </CardHeader>

      <div className="px-4 pb-4 space-y-3">
        {topHoldings.map((holding, index) => {
          const percentage = totalValue > 0 
            ? (holding.current_value / totalValue) * 100 
            : 0;
          const isGain = holding.gain_loss >= 0;

          return (
            <div
              key={holding.id}
              className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-brand-400">
                    #{index + 1}
                  </span>
                  <p className="text-sm font-semibold text-white truncate">
                    {holding.symbol}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-white/50">
                    {holding.asset_type} {holding.sector && `• ${holding.sector}`}
                  </p>
                </div>
              </div>

              <div className="text-right ml-4">
                <p className="text-sm font-bold text-white">
                  {percentage.toFixed(1)}%
                </p>
                <p className="text-xs text-white/50 mb-1">
                  {formatCurrency(holding.current_value)}
                </p>
                <div
                  className={`flex items-center gap-1 justify-end text-xs font-medium ${
                    isGain ? 'text-income' : 'text-expense'
                  }`}
                >
                  {isGain ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  <span>
                    {isGain ? '+' : ''}
                    {holding.gain_loss_percent.toFixed(2)}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
