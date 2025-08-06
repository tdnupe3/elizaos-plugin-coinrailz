import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { NavigationHeader } from "@/components/navigation-header";
import { MobileNavigation } from "@/components/mobile-navigation";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { 
  DollarSign, 
  TrendingUp, 
  ArrowLeft, 
  ArrowRight,
  RefreshCw,
  Shield,
  Zap,
  CheckCircle,
  Info,
  Wallet,
  AlertCircle
} from "@/lib/icons";

interface RLUSDPair {
  id: string;
  base: string;
  quote: string;
  price: number;
  volume24h: number;
  change24h: number;
  liquidity: number;
}

interface TradeOrder {
  id: string;
  pair: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  amount: number;
  price?: number;
  total: number;
  status: 'pending' | 'filled' | 'cancelled';
  timestamp: string;
}

export default function XRPRLUSDTrading() {
  const [, setLocation] = useLocation();
  const [selectedPair, setSelectedPair] = useState<RLUSDPair | null>(null);
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<TradeOrder[]>([]);

  // Check authentication status
  const { data: user, isLoading: userLoading, error: userError } = useQuery({
    queryKey: ['/api/auth/user'],
    retry: false
  });

  const isAuthenticated = !!user && !userError;

  const rlusdPairs: RLUSDPair[] = [
    {
      id: 'XRP-RLUSD',
      base: 'XRP',
      quote: 'RLUSD',
      price: 3.05,
      volume24h: 15420000,
      change24h: 3.2,
      liquidity: 8500000
    },
    {
      id: 'RLUSD-USD',
      base: 'RLUSD',
      quote: 'USD',
      price: 1.0001,
      volume24h: 42300000,
      change24h: 0.01,
      liquidity: 12000000
    },
    {
      id: 'BTC-RLUSD',
      base: 'BTC',
      quote: 'RLUSD',
      price: 102450.75,
      volume24h: 8900000,
      change24h: 1.8,
      liquidity: 5200000
    },
    {
      id: 'ETH-RLUSD',
      base: 'ETH',
      quote: 'RLUSD',
      price: 3420.15,
      volume24h: 12800000,
      change24h: 2.1,
      liquidity: 6800000
    }
  ];

  useEffect(() => {
    if (!selectedPair) {
      setSelectedPair(rlusdPairs[0]); // Default to XRP-RLUSD
    }
  }, []);

  const handleSignIn = () => {
    setLocation('/auth');
  };

  const handlePlaceOrder = async () => {
    if (!selectedPair || !amount) {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const amountNum = parseFloat(amount);
      const priceNum = orderType === 'limit' ? parseFloat(price) : selectedPair.price;
      const total = amountNum * priceNum;

      // Call actual RLUSD trading API
      const response = await fetch('/api/xrp/rlusd-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pair: selectedPair.id,
          side,
          type: orderType,
          amount: amountNum,
          price: orderType === 'limit' ? priceNum : undefined
        })
      });

      if (!response.ok) {
        throw new Error('Order placement failed');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Order placement failed');
      }

      const newOrder: TradeOrder = {
        id: result.orderId || Date.now().toString(),
        pair: selectedPair.id,
        side,
        type: orderType,
        amount: amountNum,
        price: orderType === 'limit' ? priceNum : undefined,
        total,
        status: 'filled',
        timestamp: new Date().toLocaleTimeString()
      };
      
      setOrders(prev => [newOrder, ...prev]);
      
      // Reset form
      setAmount('');
      setPrice('');
      
    } catch (error: any) {
      console.error('Order placement failed:', error);
      alert(error.message || 'Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number, decimals = 2) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(num);
  };

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(num);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50">
      <NavigationHeader />
      <MobileNavigation />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20 md:pb-8">
        {/* Header */}
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => setLocation('/xrp-ecosystem')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to XRP Ecosystem
          </Button>
          
          <div className="text-center">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              RLUSD Trading Hub
            </h1>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Trade Ripple's USD stablecoin (RLUSD) with XRP and other major cryptocurrencies 
              on the XRP Ledger's native DEX.
            </p>
          </div>
        </div>



        <div className="grid lg:grid-cols-4 gap-6">
          {/* Trading Pairs */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  RLUSD Pairs
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {rlusdPairs.map((pair) => (
                  <div
                    key={pair.id}
                    onClick={() => setSelectedPair(pair)}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedPair?.id === pair.id 
                        ? 'bg-blue-100 border-blue-200 border-2' 
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold">{pair.id}</div>
                        <div className="text-sm text-gray-600">
                          ${formatNumber(pair.price, pair.base === 'RLUSD' ? 4 : 2)}
                        </div>
                      </div>
                      <Badge 
                        variant={pair.change24h >= 0 ? 'default' : 'destructive'}
                        className={pair.change24h >= 0 ? 'bg-green-100 text-green-800' : ''}
                      >
                        {pair.change24h >= 0 ? '+' : ''}{pair.change24h.toFixed(2)}%
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Vol: {formatCurrency(pair.volume24h / 1000000)}M
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Trading Interface */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Trade {selectedPair?.id}</span>
                  <Badge className="bg-green-100 text-green-800">
                    RLUSD Native
                  </Badge>
                </CardTitle>
              </CardHeader>
              
              <CardContent className="space-y-6">
                {/* Order Type Selection */}
                <Tabs value={orderType} onValueChange={(value) => setOrderType(value as 'market' | 'limit')}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="market">Market Order</TabsTrigger>
                    <TabsTrigger value="limit">Limit Order</TabsTrigger>
                  </TabsList>
                </Tabs>

                {/* Buy/Sell Toggle */}
                <Tabs value={side} onValueChange={(value) => setSide(value as 'buy' | 'sell')}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="buy" className="data-[state=active]:bg-green-600">
                      Buy {selectedPair?.base}
                    </TabsTrigger>
                    <TabsTrigger value="sell" className="data-[state=active]:bg-red-600">
                      Sell {selectedPair?.base}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                {/* Price Input (for limit orders) */}
                {orderType === 'limit' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Price ({selectedPair?.quote})
                    </label>
                    <Input
                      type="number"
                      placeholder={`Current: ${selectedPair?.price.toFixed(4)}`}
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                    />
                  </div>
                )}

                {/* Amount Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount ({selectedPair?.base})
                  </label>
                  <Input
                    type="number"
                    placeholder="Enter amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>

                {/* Order Summary */}
                {amount && selectedPair && (
                  <Card className="bg-gray-50">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Amount:</span>
                        <span>{amount} {selectedPair.base}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Price:</span>
                        <span>
                          {orderType === 'limit' ? price || selectedPair.price : selectedPair.price} {selectedPair.quote}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm border-t pt-2">
                        <span className="font-semibold">Total:</span>
                        <span className="font-semibold">
                          {(parseFloat(amount) * (orderType === 'limit' ? parseFloat(price) || selectedPair.price : selectedPair.price)).toFixed(4)} {selectedPair.quote}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}



                {/* Place Order Button */}
                <Button 
                  onClick={handlePlaceOrder}
                  disabled={!amount || loading || (orderType === 'limit' && !price)}
                  className={`w-full h-12 ${
                    side === 'buy' 
                      ? 'bg-green-600 hover:bg-green-700' 
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {loading ? (
                    <div className="flex items-center">
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </div>
                  ) : (
                    `${side === 'buy' ? 'Buy' : 'Sell'} ${selectedPair?.base}`
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Recent Orders */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Recent Orders</CardTitle>
              </CardHeader>
              <CardContent>
                {orders.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No orders yet. Place your first order above.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {orders.slice(0, 5).map((order) => (
                      <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Badge 
                            variant={order.side === 'buy' ? 'default' : 'secondary'}
                            className={order.side === 'buy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                          >
                            {order.side.toUpperCase()}
                          </Badge>
                          <span className="font-medium">{order.pair}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">{order.amount} @ {order.price?.toFixed(4)}</div>
                          <Badge variant="outline" className="text-xs">
                            {order.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Market Info Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* RLUSD Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  RLUSD Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Type:</span>
                  <span className="font-medium">USD Stablecoin</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Issuer:</span>
                  <span className="font-medium">Ripple Labs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Peg:</span>
                  <span className="font-medium">1:1 USD</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Network:</span>
                  <span className="font-medium">XRP Ledger</span>
                </div>
                <div className="text-xs text-gray-500 mt-4">
                  RLUSD is fully backed by USD reserves and regulated by New York State Department of Financial Services.
                </div>
              </CardContent>
            </Card>

            {/* Market Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Market Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Volume:</span>
                  <span className="font-medium">{formatCurrency(78900000)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Liquidity:</span>
                  <span className="font-medium">{formatCurrency(32500000)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Active Pairs:</span>
                  <span className="font-medium">12</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Avg Spread:</span>
                  <span className="font-medium">0.02%</span>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => setLocation('/xrp-wallet-creation')}
                >
                  <Wallet className="w-4 h-4 mr-2" />
                  Create XRP Wallet
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => setLocation('/xrp-buy-sell')}
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  Buy/Sell XRP
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => setLocation('/xrp-dex-trading')}
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Advanced DEX
                </Button>
              </CardContent>
            </Card>

            {/* RLUSD Benefits */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  RLUSD Advantages
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                  <span className="text-sm">3-5 second settlements</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                  <span className="text-sm">~$0.0002 transaction fees</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                  <span className="text-sm">Full USD backing</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                  <span className="text-sm">Regulatory compliance</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                  <span className="text-sm">Native XRP Ledger integration</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}