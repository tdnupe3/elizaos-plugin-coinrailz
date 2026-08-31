import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, DollarSign, Clock } from "@/lib/icons";
import { apiRequest } from "@/lib/queryClient";
// Removed large image imports to reduce bundle size
// Use lightweight placeholder or lazy load these assets

interface CryptoPriceData {
  usd: number;
  change_24h: string;
}

interface CryptoPricesResponse {
  success: boolean;
  prices: {
    bitcoin: CryptoPriceData;
    ethereum: CryptoPriceData;
    ripple: CryptoPriceData;
    'usd-coin': CryptoPriceData;
    tether: CryptoPriceData;
    peezy: CryptoPriceData;
  };
  lastUpdated: string;
  source: string;
}

const cryptoInfo = {
  bitcoin: { name: 'Bitcoin', symbol: 'BTC', color: 'bg-orange-500' },
  ethereum: { name: 'Ethereum', symbol: 'ETH', color: 'bg-blue-500' },
  ripple: { name: 'XRP', symbol: 'XRP', color: 'bg-gray-700' },
  'usd-coin': { name: 'USD Coin', symbol: 'USDC', color: 'bg-blue-600' },
  tether: { name: 'Tether', symbol: 'USDT', color: 'bg-green-500' },
  peezy: { name: 'PEEZY Token', symbol: 'PEEZY', color: 'bg-purple-600' }
};

export function CryptoPricesWidget() {
  const { data: pricesData, isLoading, error } = useQuery<CryptoPricesResponse>({
    queryKey: ['/api/crypto/prices'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Live Crypto Prices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-200 rounded-full" />
                  <div className="space-y-1">
                    <div className="w-16 h-4 bg-gray-200 rounded" />
                    <div className="w-12 h-3 bg-gray-200 rounded" />
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div className="w-20 h-4 bg-gray-200 rounded" />
                  <div className="w-16 h-3 bg-gray-200 rounded" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !pricesData?.success) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Live Crypto Prices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-600">Failed to load crypto prices</p>
            <p className="text-sm text-gray-500 mt-2">Please try again later</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatPrice = (price: number) => {
    if (price < 0.001) {
      return price.toExponential(2);
    }
    return price.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    });
  };

  const getChangeColor = (change: string) => {
    const num = parseFloat(change);
    return num >= 0 ? 'text-green-600' : 'text-red-600';
  };

  const getChangeIcon = (change: string) => {
    const num = parseFloat(change);
    return num >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Live Crypto Prices
        </CardTitle>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Clock className="w-4 h-4" />
          <span>Source: {pricesData.source}</span>
          <Badge variant="outline" className="ml-2">
            Last updated: {new Date(pricesData.lastUpdated).toLocaleTimeString()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Object.entries(pricesData.prices).map(([key, data]) => {
            const info = cryptoInfo[key as keyof typeof cryptoInfo];
            if (!info) return null;

            const isPeezy = key === 'peezy';

            return (
              <div key={key} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  {isPeezy ? (
                    <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center">
                      <span className="text-white font-bold text-xs">P</span>
                    </div>
                  ) : (
                    <div className={`w-8 h-8 ${info.color} rounded-full flex items-center justify-center`}>
                      <span className="text-white font-bold text-xs">{info.symbol}</span>
                    </div>
                  )}
                  <div>
                    <p className="font-medium">{info.name}</p>
                    <p className="text-sm text-gray-500">{info.symbol}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatPrice(data.usd)}</p>
                  <div className={`flex items-center gap-1 text-sm ${getChangeColor(data.change_24h)}`}>
                    {getChangeIcon(data.change_24h)}
                    {Math.abs(parseFloat(data.change_24h)).toFixed(2)}%
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}