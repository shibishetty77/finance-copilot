import { useMemo } from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import type { Holding } from '@/types/portfolio';

interface PortfolioInsightsProps {
  holdings: Holding[] | undefined;
  totalValue: number;
  diversificationScore: number | undefined;
  riskScore: number | undefined;
  isLoading: boolean;
}

interface Insight {
  type: 'warning' | 'success' | 'info';
  message: string;
}

export function PortfolioInsights({
  holdings,
  totalValue,
  diversificationScore,
  riskScore,
  isLoading,
}: PortfolioInsightsProps) {
  const insights = useMemo(() => {
    const result: Insight[] = [];

    if (!holdings || holdings.length === 0 || totalValue === 0) {
      return result;
    }

    // Check concentration risk (largest holding > 50%)
    let largestHolding = holdings[0];
    let largestPercentage = 0;
    for (const holding of holdings) {
      const percentage = (holding.current_value / totalValue) * 100;
      if (percentage > largestPercentage) {
        largestPercentage = percentage;
        largestHolding = holding;
      }
    }

    if (largestPercentage > 50) {
      result.push({
        type: 'warning',
        message: `Portfolio is heavily concentrated in ${largestHolding.company_name || largestHolding.symbol} (${largestPercentage.toFixed(1)}%). Consider diversifying to reduce risk.`,
      });
    }

    // Check sector concentration (one sector > 60%)
    const sectorMap = new Map<string, number>();
    for (const holding of holdings) {
      const sector = holding.sector || 'Unclassified';
      const current = sectorMap.get(sector) || 0;
      sectorMap.set(sector, current + holding.current_value);
    }

    let maxSectorPercentage = 0;
    let maxSector = '';
    for (const [sector, value] of sectorMap.entries()) {
      const percentage = (value / totalValue) * 100;
      if (percentage > maxSectorPercentage) {
        maxSectorPercentage = percentage;
        maxSector = sector;
      }
    }

    if (maxSectorPercentage > 60) {
      result.push({
        type: 'warning',
        message: `High sector concentration detected in ${maxSector} sector (${maxSectorPercentage.toFixed(1)}%). Consider exploring other sectors.`,
      });
    }

    // Check low diversification
    if (holdings.length < 5) {
      result.push({
        type: 'info',
        message: `You have only ${holdings.length} holdings. Consider adding more for better diversification.`,
      });
    } else {
      result.push({
        type: 'success',
        message: `Good diversification with ${holdings.length} holdings across your portfolio.`,
      });
    }

    // Check diversification score
    if (diversificationScore !== undefined) {
      if (diversificationScore > 70) {
        result.push({
          type: 'success',
          message: `Your portfolio diversification score is excellent (${diversificationScore}/100).`,
        });
      }
    }

    // Check risk score
    if (riskScore !== undefined) {
      if (riskScore > 70) {
        result.push({
          type: 'warning',
          message: `Your portfolio risk score is high (${riskScore}/100). Consider rebalancing to safer assets.`,
        });
      } else if (riskScore < 30) {
        result.push({
          type: 'success',
          message: `Your portfolio has low risk (${riskScore}/100).`,
        });
      }
    }

    return result;
  }, [holdings, totalValue, diversificationScore, riskScore]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Insights</CardTitle>
        </CardHeader>
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="inline-block w-8 h-8 border-4 border-brand-600/30 border-t-brand-600 rounded-full animate-spin" />
            <p className="text-sm text-white/50 mt-4">Analyzing portfolio...</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio Insights</CardTitle>
      </CardHeader>

      <div className="px-4 pb-4 space-y-3">
        {insights.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-white/50">No insights available</p>
          </div>
        ) : (
          insights.map((insight, index) => {
            const isWarning = insight.type === 'warning';
            const isSuccess = insight.type === 'success';

            return (
              <div
                key={index}
                className={`flex items-start gap-3 p-3 rounded-lg ${
                  isWarning
                    ? 'bg-expense/10 border border-expense/20'
                    : isSuccess
                      ? 'bg-income/10 border border-income/20'
                      : 'bg-brand-600/10 border border-brand-500/20'
                }`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {isWarning ? (
                    <AlertCircle className="w-4 h-4 text-expense" />
                  ) : (
                    <CheckCircle className="w-4 h-4 text-income" />
                  )}
                </div>
                <p
                  className={`text-sm ${
                    isWarning
                      ? 'text-expense'
                      : isSuccess
                        ? 'text-income'
                        : 'text-brand-400'
                  }`}
                >
                  {insight.message}
                </p>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
