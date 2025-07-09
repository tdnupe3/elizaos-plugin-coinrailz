import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, DollarSign, Clock, RefreshCw, ArrowLeft, ExternalLink } from "@/lib/icons";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import peezyMascot from "@assets/peezy logo_1752028927702.jpg";
import peezyBanner from "@assets/peezy_banner-nobg_1752028927706.png";

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

interface PeezyInfoResponse {
  success: boolean;
  tokenInfo: {
    symbol: string;
    name: string;
    address: string;
    decimals: number;
    totalSupply: string;
    exchanges: string[];
  };
}

const cryptoInfo = {
  bitcoin: { name: 'Bitcoin', symbol: 'BTC', color: 'bg-orange-500', description: 'The original cryptocurrency' },
  ethereum: { name: 'Ethereum', symbol: 'ETH', color: 'bg-blue-500', description: 'Smart contract platform' },
  ripple: { name: 'XRP', symbol: 'XRP', color: 'bg-gray-700', description: 'Fast cross-border payments' },
  'usd-coin': { name: 'USD Coin', symbol: 'USDC', color: 'bg-blue-600', description: 'US dollar stablecoin' },
  tether: { name: 'Tether', symbol: 'USDT', color: 'bg-green-500', description: 'Most popular stablecoin' },
  peezy: { name: 'PEEZY Token', symbol: 'PEEZY', color: 'bg-purple-600', description: 'Community-driven meme token' }
};

export default function CryptoPricesPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: pricesData, isLoading, error } = useQuery<CryptoPricesResponse>({
    queryKey: ['/api/crypto/prices'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: peezyInfo } = useQuery<PeezyInfoResponse>({
    queryKey: ['/api/peezy/info'],
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/crypto/prices'] });
    queryClient.invalidateQueries({ queryKey: ['/api/peezy/info'] });
    toast({
      title: "Prices Updated",
      description: "Fetching latest crypto prices...",
    });
  };

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">Live Crypto Prices</h1>
              <p className="text-gray-600">Real-time cryptocurrency market data</p>
            </div>
            <Button onClick={() => setLocation('/')} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-200 rounded-full" />
                      <div className="space-y-2">
                        <div className="w-20 h-4 bg-gray-200 rounded" />
                        <div className="w-16 h-3 bg-gray-200 rounded" />
                      </div>
                    </div>
                    <div className="text-right space-y-2">
                      <div className="w-24 h-4 bg-gray-200 rounded" />
                      <div className="w-20 h-3 bg-gray-200 rounded" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !pricesData?.success) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">Live Crypto Prices</h1>
              <p className="text-gray-600">Real-time cryptocurrency market data</p>
            </div>
            <Button onClick={() => setLocation('/')} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </div>
          
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-red-600 text-lg mb-2">Failed to load crypto prices</p>
              <p className="text-gray-500 mb-4">Please check your connection and try again</p>
              <Button onClick={handleRefresh} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Live Crypto Prices</h1>
            <p className="text-gray-600">Real-time cryptocurrency market data from CoinGecko</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleRefresh} variant="outline">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={() => setLocation('/')} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </div>
        </div>

        <div className="mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Market Data
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <span>Source:</span>
                  <Badge variant="outline">{pricesData.source}</Badge>
                </div>
                <div className="flex items-center gap-1">
                  <span>Last Updated:</span>
                  <Badge variant="outline">
                    {new Date(pricesData.lastUpdated).toLocaleTimeString()}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <span>Auto-refresh:</span>
                  <Badge variant="outline">30 seconds</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(pricesData.prices).map(([key, data]) => {
            const info = cryptoInfo[key as keyof typeof cryptoInfo];
            if (!info) return null;

            const isPeezy = key === 'peezy';

            return (
              <Card key={key} className={`hover:shadow-lg transition-shadow ${isPeezy ? 'ring-2 ring-purple-200' : ''}`}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {isPeezy ? (
                        <div className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center">
                          <img 
                            src={peezyMascot} 
                            alt="PEEZY Mascot" 
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className={`w-12 h-12 ${info.color} rounded-full flex items-center justify-center`}>
                          <span className="text-white font-bold text-sm">{info.symbol}</span>
                        </div>
                      )}
                      <div>
                        <h3 className="font-semibold text-lg">{info.name}</h3>
                        <p className="text-sm text-gray-500">{info.symbol}</p>
                      </div>
                    </div>
                    {isPeezy && (
                      <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                        Featured
                      </Badge>
                    )}
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <p className="text-2xl font-bold">{formatPrice(data.usd)}</p>
                      <div className={`flex items-center gap-1 text-sm ${getChangeColor(data.change_24h)}`}>
                        {getChangeIcon(data.change_24h)}
                        <span>{Math.abs(parseFloat(data.change_24h)).toFixed(2)}% (24h)</span>
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-600">{info.description}</p>
                    
                    {isPeezy && peezyInfo?.success && (
                      <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-orange-50 rounded-lg border border-purple-200">
                        <div className="flex items-center gap-2 mb-3">
                          <img 
                            src={peezyBanner} 
                            alt="PEEZY Logo" 
                            className="h-6 w-auto"
                          />
                          <span className="text-sm font-medium text-purple-900">Token Details</span>
                        </div>
                        <div className="space-y-1 text-xs text-purple-700">
                          <p>Contract: {peezyInfo.tokenInfo.address.slice(0, 6)}...{peezyInfo.tokenInfo.address.slice(-4)}</p>
                          <p>Decimals: {peezyInfo.tokenInfo.decimals}</p>
                          <p>Exchanges: {peezyInfo.tokenInfo.exchanges.slice(0, 3).join(', ')}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ExternalLink className="w-5 h-5" />
                Additional Resources
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Trading Features</h4>
                  <ul className="space-y-1 text-sm text-gray-600">
                    <li>• <button onClick={() => setLocation('/dex')} className="text-blue-600 hover:underline">DEX Aggregator</button> - Trade across multiple exchanges</li>
                    <li>• <button onClick={() => setLocation('/crypto-transfer')} className="text-blue-600 hover:underline">Crypto Transfer</button> - Send crypto to any wallet</li>
                    <li>• <button onClick={() => setLocation('/p2p-transfer')} className="text-blue-600 hover:underline">P2P Transfer</button> - Person-to-person payments</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Platform Features</h4>
                  <ul className="space-y-1 text-sm text-gray-600">
                    <li>• <button onClick={() => setLocation('/ai-marketplace')} className="text-blue-600 hover:underline">AI Marketplace</button> - AI agent services</li>
                    <li>• <button onClick={() => setLocation('/xrp-ecosystem')} className="text-blue-600 hover:underline">XRP Ecosystem</button> - XRP-specific tools</li>
                    <li>• <button onClick={() => setLocation('/wallet-management')} className="text-blue-600 hover:underline">Wallet Management</button> - Manage your crypto</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}