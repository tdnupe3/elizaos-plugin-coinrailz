import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
  timeframe: '24h' | '7d' | '30d' | '1y';
}

const COLORS = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#c3ddfd', '#dbeafe'];

export default function PortfolioChart({ portfolioHistory, assetAllocation, timeframe }: PortfolioChartProps) {
  const formatValue = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercentage = (value: number) => `${value.toFixed(1)}%`;

  const totalPortfolioValue = useMemo(() => {
    return assetAllocation.reduce((sum, asset) => sum + asset.value, 0);
  }, [assetAllocation]);

  const portfolioChange = useMemo(() => {
    if (portfolioHistory.length < 2) return { amount: 0, percentage: 0 };
    
    const latest = portfolioHistory[portfolioHistory.length - 1];
    const previous = portfolioHistory[0];
    const amount = latest.totalValue - previous.totalValue;
    const percentage = (amount / previous.totalValue) * 100;
    
    return { amount, percentage };
  }, [portfolioHistory]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="text-sm font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {`${entry.name}: ${formatValue(entry.value)}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const PieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border rounded shadow-lg">
          <p className="font-medium">{data.name} ({data.symbol})</p>
          <p className="text-sm">{formatValue(data.value)}</p>
          <p className="text-sm">{formatPercentage(data.percentage)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Portfolio Performance Chart */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Portfolio Performance ({timeframe})</span>
            <div className="text-right">
              <div className="text-2xl font-bold">{formatValue(totalPortfolioValue)}</div>
              <div className={`text-sm ${portfolioChange.percentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {portfolioChange.percentage >= 0 ? '+' : ''}{formatValue(portfolioChange.amount)} 
                ({portfolioChange.percentage >= 0 ? '+' : ''}{portfolioChange.percentage.toFixed(2)}%)
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={portfolioHistory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="timestamp" 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  if (timeframe === '24h') {
                    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                  }
                  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickFormatter={formatValue}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="totalValue" 
                stroke="#2563eb" 
                strokeWidth={2}
                dot={false}
                name="Total Portfolio"
              />
              <Line 
                type="monotone" 
                dataKey="btcValue" 
                stroke="#f7931a" 
                strokeWidth={1}
                dot={false}
                name="Bitcoin Holdings"
              />
              <Line 
                type="monotone" 
                dataKey="ethValue" 
                stroke="#627eea" 
                strokeWidth={1}
                dot={false}
                name="Ethereum Holdings"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Asset Allocation Pie Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Asset Allocation</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={assetAllocation}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label={({ name, percentage }) => `${name} ${percentage.toFixed(1)}%`}
              >
                {assetAllocation.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Asset Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle>Holdings Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {assetAllocation.map((asset, index) => (
              <div key={asset.symbol} className="flex items-center justify-between p-3 border rounded">
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-4 h-4 rounded-full" 
                    style={{ backgroundColor: asset.color || COLORS[index % COLORS.length] }}
                  />
                  <div>
                    <div className="font-medium">{asset.name}</div>
                    <div className="text-sm text-gray-500">{asset.symbol}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">{formatValue(asset.value)}</div>
                  <div className="text-sm text-gray-500">{formatPercentage(asset.percentage)}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}