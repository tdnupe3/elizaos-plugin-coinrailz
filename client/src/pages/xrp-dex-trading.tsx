import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { NavigationHeader } from "@/components/navigation-header";
import { MobileNavigation } from "@/components/mobile-navigation";
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  BarChart3, 
  Clock,
  Shield,
  Zap,
  Activity,
  ArrowUpDown,
  ArrowRight,
  AlertCircle,
  CheckCircle2
} from "@/lib/icons";

interface TokenPair {
  base: string;
  quote: string;
  price: number;
  change24h: number;
  volume24h: number;
  high24h: number;
  low24h: number;
}

interface OrderBookEntry {
  price: number;
  amount: number;
  total: number;
  type: 'bid' | 'ask';
}

interface TradeHistory {
  id: string;
  price: number;
  amount: number;
  time: string;
  type: 'buy' | 'sell';
  status: 'completed' | 'pending' | 'cancelled';
}

export default function XRPDEXTrading() {
  const [selectedPair, setSelectedPair] = useState<TokenPair | null>(null);
  const [orderBook, setOrderBook] = useState<OrderBookEntry[]>([]);
  const [tradeHistory, setTradeHistory] = useState<TradeHistory[]>([]);
  const [orderType, setOrderType] = useState<'market' | 'limit' | 'stop'>('market');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('');
  const [isTrading, setIsTrading] = useState(false);
  const [balance, setBalance] = useState({ XRP: 0, USD: 0 });

  const tokenPairs: TokenPair[] = [
    {
      base: 'XRP',
      quote: 'USD',
      price: 2.25,
      change24h: 5.2,
      volume24h: 1250000,
      high24h: 2.31,
      low24h: 2.18
    },
    {
      base: 'XRP',
      quote: 'BTC',
      price: 0.0000225,
      change24h: -2.1,
      volume24h: 850000,
      high24h: 0.0000235,
      low24h: 0.0000220
    },
    {
      base: 'USD',
      quote: 'XRP',
      price: 0.444,
      change24h: -4.9,
      volume24h: 980000,
      high24h: 0.458,
      low24h: 0.432
    },
    // XRP Ledger Tokens
    {
      base: 'SOLO',
      quote: 'XRP',
      price: 0.14,
      change24h: 12.5,
      volume24h: 245000,
      high24h: 0.16,
      low24h: 0.12
    },
    {
      base: 'CSC',
      quote: 'XRP',
      price: 0.002,
      change24h: -8.3,
      volume24h: 85000,
      high24h: 0.0022,
      low24h: 0.0018
    },
    {
      base: 'COREUM',
      quote: 'XRP',
      price: 0.45,
      change24h: 5.7,
      volume24h: 125000,
      high24h: 0.48,
      low24h: 0.42
    },
    {
      base: 'XRPAYNET',
      quote: 'XRP',
      price: 0.0001,
      change24h: 25.8,
      volume24h: 15000,
      high24h: 0.00012,
      low24h: 0.00008
    },
    {
      base: 'XPUNK',
      quote: 'XRP',
      price: 0.055,
      change24h: -15.2,
      volume24h: 35000,
      high24h: 0.065,
      low24h: 0.051
    }
  ];

  // Initialize with first token pair and fetch real balance
  useEffect(() => {
    if (tokenPairs.length > 0) {
      setSelectedPair(tokenPairs[0]);
      loadOrderBook(tokenPairs[0]);
      loadTradeHistory(tokenPairs[0]);
    }
    fetchBalance();
  }, []);

  const fetchBalance = async () => {
    try {
      const [balanceResponse, rateResponse] = await Promise.all([
        fetch('/api/xrp/balance'),
        fetch('/api/xrp/rate')
      ]);
      
      if (balanceResponse.ok && rateResponse.ok) {
        const balanceData = await balanceResponse.json();
        const rateData = await rateResponse.json();
        
        if (balanceData.success && rateData.success) {
          const xrpAmount = parseFloat(balanceData.balance.available) || 0;
          const xrpRate = rateData.rate?.xrpToUsd || 2.25;
          
          setBalance({
            XRP: xrpAmount,
            USD: xrpAmount * xrpRate
          });
        }
      }
    } catch (error) {
      console.error('Error fetching balance:', error);
      // Keep balance at 0 if fetch fails
    }
  };

  const loadOrderBook = (pair: TokenPair) => {
    // Simulate order book data
    const mockOrderBook: OrderBookEntry[] = [
      // Asks (selling)
      { price: 2.27, amount: 1000, total: 2270, type: 'ask' },
      { price: 2.26, amount: 1500, total: 3390, type: 'ask' },
      { price: 2.25, amount: 2000, total: 4500, type: 'ask' },
      // Bids (buying)
      { price: 2.24, amount: 1800, total: 4032, type: 'bid' },
      { price: 2.23, amount: 2200, total: 4906, type: 'bid' },
      { price: 2.22, amount: 1600, total: 3552, type: 'bid' },
    ];
    setOrderBook(mockOrderBook);
  };

  const loadTradeHistory = (pair: TokenPair) => {
    // Simulate trade history
    const mockHistory: TradeHistory[] = [
      { id: '1', price: 2.25, amount: 500, time: '14:32:15', type: 'buy', status: 'completed' },
      { id: '2', price: 2.24, amount: 750, time: '14:31:45', type: 'sell', status: 'completed' },
      { id: '3', price: 2.25, amount: 1000, time: '14:30:12', type: 'buy', status: 'completed' },
      { id: '4', price: 2.23, amount: 300, time: '14:29:38', type: 'sell', status: 'pending' },
    ];
    setTradeHistory(mockHistory);
  };

  const handlePlaceOrder = async () => {
    if (!selectedPair || !amount) return;

    setIsTrading(true);
    
    try {
      // Simulate order placement
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const newTrade: TradeHistory = {
        id: Date.now().toString(),
        price: parseFloat(price) || selectedPair.price,
        amount: parseFloat(amount),
        time: new Date().toLocaleTimeString(),
        type: side,
        status: 'pending'
      };
      
      setTradeHistory(prev => [newTrade, ...prev]);
      
      // Reset form
      setAmount('');
      setPrice('');
      
      // Show success message
      alert('Order placed successfully!');
      
    } catch (error) {
      alert('Error placing order');
    } finally {
      setIsTrading(false);
    }
  };

  const calculateTotal = () => {
    if (!amount || !price) return 0;
    return parseFloat(amount) * parseFloat(price);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <NavigationHeader />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">XRP DEX Trading</h1>
                <p className="text-gray-600 mt-2">Professional XRP Ledger decentralized exchange</p>
              </div>
              <div className="flex items-center space-x-4">
                <Badge variant="outline" className="bg-green-50 text-green-800">
                  <Zap className="w-4 h-4 mr-1" />
                  Live Trading
                </Badge>
                <Badge variant="outline" className="bg-blue-50 text-blue-800">
                  <Shield className="w-4 h-4 mr-1" />
                  Secure
                </Badge>
              </div>
            </div>
          </div>

          {/* Token Pair Selector */}
          <div className="mb-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <ArrowUpDown className="w-5 h-5 mr-2" />
                  Select Trading Pair
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select 
                  value={selectedPair ? `${selectedPair.base}/${selectedPair.quote}` : ''}
                  onValueChange={(value) => {
                    const pair = tokenPairs.find(p => `${p.base}/${p.quote}` === value);
                    if (pair) {
                      setSelectedPair(pair);
                      loadOrderBook(pair);
                      loadTradeHistory(pair);
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a trading pair" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="XRP/USD">XRP/USD - Major Pair</SelectItem>
                    <SelectItem value="XRP/BTC">XRP/BTC - Crypto Pair</SelectItem>
                    <SelectItem value="USD/XRP">USD/XRP - Reverse Pair</SelectItem>
                    <SelectItem value="SOLO/XRP">SOLO/XRP - Sologenic Token</SelectItem>
                    <SelectItem value="CSC/XRP">CSC/XRP - CasinoCoin</SelectItem>
                    <SelectItem value="COREUM/XRP">COREUM/XRP - Coreum Token</SelectItem>
                    <SelectItem value="XRPAYNET/XRP">XRPAYNET/XRP - XRP Payment Network</SelectItem>
                    <SelectItem value="XPUNK/XRP">XPUNK/XRP - XRP Punk NFT Token</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          </div>

          {/* Selected Pair Overview */}
          {selectedPair && (
            <div className="mb-8">
              <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xl">{selectedPair.base}/{selectedPair.quote}</CardTitle>
                    {selectedPair.change24h > 0 ? (
                      <TrendingUp className="w-6 h-6 text-green-600" />
                    ) : (
                      <TrendingDown className="w-6 h-6 text-red-600" />
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <span className="text-sm text-gray-500">Price</span>
                      <div className="font-bold text-lg">{selectedPair.price.toFixed(6)}</div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">24h Change</span>
                      <div className={`font-bold text-lg ${
                        selectedPair.change24h > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {selectedPair.change24h > 0 ? '+' : ''}{selectedPair.change24h.toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">24h Volume</span>
                      <div className="font-bold text-lg">{selectedPair.volume24h.toLocaleString()}</div>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">24h Range</span>
                      <div className="font-bold text-lg">{selectedPair.low24h.toFixed(6)} - {selectedPair.high24h.toFixed(6)}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Main Trading Interface */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Order Book */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2" />
                  Order Book
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Asks */}
                  <div>
                    <h4 className="text-sm font-medium text-red-600 mb-2">Asks (Selling)</h4>
                    <div className="space-y-1">
                      {orderBook.filter(order => order.type === 'ask').map((order, index) => (
                        <div key={index} className="flex justify-between text-sm">
                          <span className="text-red-600">{order.price.toFixed(6)}</span>
                          <span className="text-gray-600">{order.amount.toFixed(0)}</span>
                          <span className="text-gray-500">{order.total.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Current Price */}
                  <div className="text-center py-2 bg-gray-50 rounded">
                    <div className="text-lg font-bold text-gray-900">
                      {selectedPair?.price.toFixed(6) || '0.000000'}
                    </div>
                    <div className="text-sm text-gray-500">Last Price</div>
                  </div>

                  {/* Bids */}
                  <div>
                    <h4 className="text-sm font-medium text-green-600 mb-2">Bids (Buying)</h4>
                    <div className="space-y-1">
                      {orderBook.filter(order => order.type === 'bid').map((order, index) => (
                        <div key={index} className="flex justify-between text-sm">
                          <span className="text-green-600">{order.price.toFixed(6)}</span>
                          <span className="text-gray-600">{order.amount.toFixed(0)}</span>
                          <span className="text-gray-500">{order.total.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Trading Panel */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <ArrowUpDown className="w-5 h-5 mr-2" />
                  Place Order
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Order Type */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Order Type</label>
                    <Select value={orderType} onValueChange={(value: 'market' | 'limit' | 'stop') => setOrderType(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="market">Market</SelectItem>
                        <SelectItem value="limit">Limit</SelectItem>
                        <SelectItem value="stop">Stop Loss</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Buy/Sell Tabs */}
                  <Tabs value={side} onValueChange={(value: 'buy' | 'sell') => setSide(value)}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="buy" className="text-green-600">Buy</TabsTrigger>
                      <TabsTrigger value="sell" className="text-red-600">Sell</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value={side} className="space-y-4 mt-4">
                      {/* Price Input */}
                      {orderType !== 'market' && (
                        <div>
                          <label className="text-sm font-medium text-gray-700 mb-2 block">Price</label>
                          <Input
                            type="number"
                            step="0.000001"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            placeholder="Enter price"
                          />
                        </div>
                      )}

                      {/* Amount Input */}
                      <div>
                        <label className="text-sm font-medium text-gray-700 mb-2 block">Amount</label>
                        <Input
                          type="number"
                          step="0.01"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="Enter amount"
                        />
                      </div>

                      {/* Total */}
                      <div className="p-3 bg-gray-50 rounded">
                        <div className="flex justify-between text-sm">
                          <span>Total</span>
                          <span className="font-medium">
                            {calculateTotal().toFixed(6)} {selectedPair?.quote}
                          </span>
                        </div>
                      </div>

                      {/* Balance */}
                      <div className="text-sm text-gray-600">
                        Available: {balance.XRP.toFixed(2)} XRP, {balance.USD.toFixed(2)} USD
                      </div>

                      {/* Place Order Button */}
                      <Button 
                        onClick={handlePlaceOrder}
                        disabled={isTrading || !amount}
                        className={`w-full ${
                          side === 'buy' 
                            ? 'bg-green-600 hover:bg-green-700' 
                            : 'bg-red-600 hover:bg-red-700'
                        }`}
                      >
                        {isTrading ? (
                          <div className="flex items-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Processing...
                          </div>
                        ) : (
                          `${side === 'buy' ? 'Buy' : 'Sell'} ${selectedPair?.base || 'XRP'}`
                        )}
                      </Button>
                    </TabsContent>
                  </Tabs>
                </div>
              </CardContent>
            </Card>

            {/* Trade History */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="w-5 h-5 mr-2" />
                  Trade History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {tradeHistory.map((trade) => (
                    <div key={trade.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${
                          trade.type === 'buy' ? 'bg-green-500' : 'bg-red-500'
                        }`}></div>
                        <div>
                          <div className="text-sm font-medium">{trade.price.toFixed(6)}</div>
                          <div className="text-xs text-gray-500">{trade.time}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm">{trade.amount.toFixed(0)}</div>
                        <div className="flex items-center text-xs">
                          {trade.status === 'completed' ? (
                            <CheckCircle2 className="w-3 h-3 text-green-500 mr-1" />
                          ) : (
                            <AlertCircle className="w-3 h-3 text-orange-500 mr-1" />
                          )}
                          {trade.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Trading Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">24h Volume</p>
                    <p className="text-lg font-semibold">{selectedPair?.volume24h.toLocaleString()}</p>
                  </div>
                  <Activity className="w-8 h-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">24h High</p>
                    <p className="text-lg font-semibold">{selectedPair?.high24h.toFixed(6)}</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">24h Low</p>
                    <p className="text-lg font-semibold">{selectedPair?.low24h.toFixed(6)}</p>
                  </div>
                  <TrendingDown className="w-8 h-8 text-red-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Spread</p>
                    <p className="text-lg font-semibold">0.02%</p>
                  </div>
                  <DollarSign className="w-8 h-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <MobileNavigation />
    </div>
  );
}