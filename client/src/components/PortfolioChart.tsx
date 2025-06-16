import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface PortfolioData {
  timestamp: string;
  totalValue: number;
  btcValue: number;
  ethValue: number;
  altValue: number;
}

interface AssetAllocation {
  name: string;
  symbol: string;
  value: number;
  percentage: number;
  color: string;
}

interface PortfolioChartProps {
  portfolioHistory: PortfolioData[];
  assetAllocation: AssetAllocation[];
  timeframe: string;
}

export default function PortfolioChart({ portfolioHistory, assetAllocation, timeframe }: PortfolioChartProps) {
  const formatValue = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercentage = (value: number): string => {
    return `${value.toFixed(2)}%`;
  };

  const portfolioChange = useMemo(() => {
    if (portfolioHistory.length < 2) return { amount: 0, percentage: 0 };
    
    const latest = portfolioHistory[portfolioHistory.length - 1];
    const previous = portfolioHistory[0];
    const amount = latest.totalValue - previous.totalValue;
    const percentage = (amount / previous.totalValue) * 100;
    
    return { amount, percentage };
  }, [portfolioHistory]);

  const isPositive = portfolioChange.percentage >= 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Portfolio Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Portfolio Performance
            <span className={`text-sm font-medium flex items-center gap-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {isPositive ? '+' : ''}{formatPercentage(portfolioChange.percentage)}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-sm font-medium text-gray-600 border-b pb-2">
              <div>Asset</div>
              <div>Value</div>
              <div>Change</div>
            </div>
            {portfolioHistory.length > 0 && (
              <>
                <div className="grid grid-cols-3 gap-4 py-2">
                  <div className="font-medium">Total Portfolio</div>
                  <div className="font-semibold">{formatValue(portfolioHistory[portfolioHistory.length - 1].totalValue)}</div>
                  <div className={`font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                    {formatValue(portfolioChange.amount)}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 py-2 border-t">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                    Bitcoin Holdings
                  </div>
                  <div>{formatValue(portfolioHistory[portfolioHistory.length - 1].btcValue)}</div>
                  <div className="text-orange-600 text-sm">45% allocation</div>
                </div>
                <div className="grid grid-cols-3 gap-4 py-2 border-t">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    Ethereum Holdings
                  </div>
                  <div>{formatValue(portfolioHistory[portfolioHistory.length - 1].ethValue)}</div>
                  <div className="text-blue-600 text-sm">30% allocation</div>
                </div>
                <div className="grid grid-cols-3 gap-4 py-2 border-t">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                    Other Assets
                  </div>
                  <div>{formatValue(portfolioHistory[portfolioHistory.length - 1].altValue)}</div>
                  <div className="text-purple-600 text-sm">25% allocation</div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Asset Allocation Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Asset Allocation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {assetAllocation.map((asset, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded-full" 
                    style={{ backgroundColor: asset.color }}
                  ></div>
                  <div>
                    <p className="font-medium">{asset.name}</p>
                    <p className="text-sm text-gray-500">{asset.symbol}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatValue(asset.value)}</p>
                  <p className="text-sm text-gray-500">{formatPercentage(asset.percentage)}</p>
                </div>
              </div>
            ))}
          </div>
          
          {/* Portfolio Summary Stats */}
          <div className="mt-6 pt-4 border-t">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Total Value</p>
                <p className="font-semibold text-lg">
                  {portfolioHistory.length > 0 ? formatValue(portfolioHistory[portfolioHistory.length - 1].totalValue) : '$0'}
                </p>
              </div>
              <div>
                <p className="text-gray-500">24h Change</p>
                <p className={`font-semibold text-lg ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {isPositive ? '+' : ''}{formatPercentage(portfolioChange.percentage)}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}