import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, Activity } from '@/lib/icons';
import { useLocation } from 'wouter';
import { useWebSocket } from '@/hooks/useWebSocket';
import PortfolioChart from '@/components/PortfolioChart';

// Generate demo portfolio history data
function generatePortfolioHistory(timeframe: string) {
  const now = new Date();
  const dataPoints = timeframe === '24h' ? 24 : timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : 365;
  const interval = timeframe === '24h' ? 3600000 : timeframe === '7d' ? 86400000 : timeframe === '30d' ? 86400000 : 86400000;
  
  const history = [];
  let baseValue = 12500;
  
  for (let i = dataPoints; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - (i * interval));
    
    // Generate realistic price movement
    const volatility = timeframe === '24h' ? 0.02 : 0.05;
    const change = (Math.random() - 0.5) * volatility;
    baseValue *= (1 + change);
    
    const btcValue = baseValue * 0.45;
    const ethValue = baseValue * 0.30;
    const altValue = baseValue * 0.25;
    
    history.push({
      timestamp: timestamp.toISOString(),
      totalValue: Math.round(baseValue),
      btcValue: Math.round(btcValue),
      ethValue: Math.round(ethValue),
      altValue: Math.round(altValue)
    });
  }
  
  return history;
}

export default function PortfolioAnalytics() {
  const [, setLocation] = useLocation();
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d' | '1y'>('24h');
  const [portfolioData, setPortfolioData] = useState(() => generatePortfolioHistory(timeframe));
  
  const { isConnected, priceData, subscribeToPrices } = useWebSocket({
    onConnect: () => {
      console.log('Connected to real-time price feed');
      subscribeToPrices(['BTC', 'ETH', 'ADA', 'SOL', 'DOT', 'XRP', 'AVAX', 'MATIC', 'USDC']);
    }
  });

  // Demo holdings data
  const holdings = [
    { symbol: 'BTC', name: 'Bitcoin', amount: 0.28543, price: 45000, color: '#f7931a' },
    { symbol: 'ETH', name: 'Ethereum', amount: 3.1245, price: 3200, color: '#627eea' },
    { symbol: 'ADA', name: 'Cardano', amount: 2847.50, price: 0.85, color: '#0033ad' },
    { symbol: 'SOL', name: 'Solana', amount: 15.75, price: 180.50, color: '#9945ff' },
    { symbol: 'DOT', name: 'Polkadot', amount: 45.67, price: 25.30, color: '#e6007a' },
    { symbol: 'USDC', name: 'USD Coin', amount: 500.00, price: 1.00, color: '#2775ca' }
  ];

  // Update holdings with real-time prices if available
  const updatedHoldings = useMemo(() => {
    return holdings.map(holding => {
      const livePrice = priceData.get(holding.symbol);
      return {
        ...holding,
        price: livePrice?.price || holding.price,
        value: holding.amount * (livePrice?.price || holding.price),
        change24h: livePrice?.change24h || 0
      };
    });
  }, [priceData]);

  const assetAllocation = useMemo(() => {
    const totalValue = updatedHoldings.reduce((sum, asset) => sum + asset.value, 0);
    
    return updatedHoldings.map(asset => ({
      name: asset.name,
      symbol: asset.symbol,
      value: asset.value,
      percentage: (asset.value / totalValue) * 100,
      color: asset.color
    }));
  }, [updatedHoldings]);

  const portfolioMetrics = useMemo(() => {
    const totalValue = assetAllocation.reduce((sum, asset) => sum + asset.value, 0);
    const lastValue = portfolioData[portfolioData.length - 2]?.totalValue || totalValue;
    const change = totalValue - lastValue;
    const changePercent = (change / lastValue) * 100;
    
    return {
      totalValue,
      change,
      changePercent,
      dayHigh: Math.max(...portfolioData.slice(-24).map(d => d.totalValue)),
      dayLow: Math.min(...portfolioData.slice(-24).map(d => d.totalValue))
    };
  }, [assetAllocation, portfolioData]);

  useEffect(() => {
    setPortfolioData(generatePortfolioHistory(timeframe));
  }, [timeframe]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              onClick={() => setLocation("/demo-dashboard")}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </Button>
            <h1 className="text-2xl font-bold">Portfolio Analytics</h1>
          </div>
          
          <div className="flex items-center space-x-2">
            <Badge variant={isConnected ? "default" : "secondary"} className="flex items-center space-x-1">
              <Activity className="w-3 h-3" />
              <span>{isConnected ? 'Live' : 'Demo'}</span>
            </Badge>
          </div>
        </div>

        {/* Portfolio Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <DollarSign className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-500">Total Portfolio</span>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold">{formatCurrency(portfolioMetrics.totalValue)}</div>
                <div className={`text-sm ${portfolioMetrics.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {portfolioMetrics.changePercent >= 0 ? '+' : ''}{formatCurrency(portfolioMetrics.change)} 
                  ({portfolioMetrics.changePercent >= 0 ? '+' : ''}{portfolioMetrics.changePercent.toFixed(2)}%)
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-sm text-gray-500">24h High</span>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold">{formatCurrency(portfolioMetrics.dayHigh)}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <TrendingDown className="w-4 h-4 text-red-500" />
                <span className="text-sm text-gray-500">24h Low</span>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold">{formatCurrency(portfolioMetrics.dayLow)}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Activity className="w-4 h-4 text-blue-500" />
                <span className="text-sm text-gray-500">Assets</span>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold">{updatedHoldings.length}</div>
                <div className="text-sm text-gray-500">cryptocurrencies</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Timeframe Selector */}
        <Tabs value={timeframe} onValueChange={(value) => setTimeframe(value as typeof timeframe)}>
          <TabsList>
            <TabsTrigger value="24h">24H</TabsTrigger>
            <TabsTrigger value="7d">7D</TabsTrigger>
            <TabsTrigger value="30d">30D</TabsTrigger>
            <TabsTrigger value="1y">1Y</TabsTrigger>
          </TabsList>

          <TabsContent value={timeframe} className="mt-6">
            <PortfolioChart
              portfolioHistory={portfolioData}
              assetAllocation={assetAllocation}
              timeframe={timeframe}
            />
          </TabsContent>
        </Tabs>

        {/* Holdings Table */}
        <Card>
          <CardHeader>
            <CardTitle>Current Holdings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Asset</th>
                    <th className="text-right py-3 px-4">Holdings</th>
                    <th className="text-right py-3 px-4">Price</th>
                    <th className="text-right py-3 px-4">24h Change</th>
                    <th className="text-right py-3 px-4">Value</th>
                    <th className="text-right py-3 px-4">Allocation</th>
                  </tr>
                </thead>
                <tbody>
                  {updatedHoldings.map((asset) => {
                    const allocation = assetAllocation.find(a => a.symbol === asset.symbol);
                    return (
                      <tr key={asset.symbol} className="border-b">
                        <td className="py-4 px-4">
                          <div className="flex items-center space-x-3">
                            <div 
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                              style={{ backgroundColor: asset.color }}
                            >
                              {asset.symbol.substring(0, 2)}
                            </div>
                            <div>
                              <div className="font-medium">{asset.name}</div>
                              <div className="text-sm text-gray-500">{asset.symbol}</div>
                            </div>
                          </div>
                        </td>
                        <td className="text-right py-4 px-4">
                          <div className="font-medium">{asset.amount.toFixed(6)}</div>
                          <div className="text-sm text-gray-500">{asset.symbol}</div>
                        </td>
                        <td className="text-right py-4 px-4">
                          {formatCurrency(asset.price)}
                        </td>
                        <td className="text-right py-4 px-4">
                          <div className={`${asset.change24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {asset.change24h >= 0 ? '+' : ''}{asset.change24h.toFixed(2)}%
                          </div>
                        </td>
                        <td className="text-right py-4 px-4 font-medium">
                          {formatCurrency(asset.value)}
                        </td>
                        <td className="text-right py-4 px-4">
                          {allocation?.percentage.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}