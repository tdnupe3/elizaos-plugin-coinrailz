import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, Bitcoin, CheckCircle } from "@/lib/icons";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import TransactionFlowOrchestrator from "@/components/TransactionFlowOrchestrator";

export default function DemoBuySell() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("buy");
  
  // Fetch real-time crypto prices from API
  const { data: pricesResponse, isLoading: pricesLoading } = useQuery({
    queryKey: ['/api/crypto/prices'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });
  
  // Transform API response to component format
  const cryptoPrices = pricesResponse?.success ? {
    BTC: { 
      price: pricesResponse.prices.bitcoin.usd, 
      change: parseFloat(pricesResponse.prices.bitcoin.change_24h), 
      name: "Bitcoin", 
      symbol: "₿" 
    },
    ETH: { 
      price: pricesResponse.prices.ethereum.usd, 
      change: parseFloat(pricesResponse.prices.ethereum.change_24h), 
      name: "Ethereum", 
      symbol: "Ξ" 
    },
    XRP: { 
      price: pricesResponse.prices.ripple.usd, 
      change: parseFloat(pricesResponse.prices.ripple.change_24h), 
      name: "XRP", 
      symbol: "✕" 
    },
    USDC: { 
      price: pricesResponse.prices['usd-coin'].usd, 
      change: parseFloat(pricesResponse.prices['usd-coin'].change_24h), 
      name: "USD Coin", 
      symbol: "$" 
    },
    USDT: { 
      price: pricesResponse.prices.tether.usd, 
      change: parseFloat(pricesResponse.prices.tether.change_24h), 
      name: "Tether", 
      symbol: "₮" 
    },
    PEEZY: { 
      price: pricesResponse.prices.peezy.usd, 
      change: parseFloat(pricesResponse.prices.peezy.change_24h), 
      name: "PEEZY", 
      symbol: "🫧" 
    }
  } : {
    // Fallback with current market approximations while loading
    BTC: { price: 111000, change: 2.5, name: "Bitcoin", symbol: "₿" },
    ETH: { price: 4100, change: 1.8, name: "Ethereum", symbol: "Ξ" },
    XRP: { price: 2.45, change: 3.2, name: "XRP", symbol: "✕" },
    USDC: { price: 1.00, change: 0.0, name: "USD Coin", symbol: "$" },
    USDT: { price: 1.00, change: 0.0, name: "Tether", symbol: "₮" },
    PEEZY: { price: 0.000006234, change: 18.05, name: "PEEZY", symbol: "🫧" }
  };

  const [selectedCrypto, setSelectedCrypto] = useState("");
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showFlowOrchestrator, setShowFlowOrchestrator] = useState(false);

  // Calculate purchase amounts
  const price = selectedCrypto ? cryptoPrices[selectedCrypto as keyof typeof cryptoPrices]?.price || 0 : 0;
  const fee = amount ? parseFloat(amount) * 0.015 : 0;
  const crypto = amount && price ? (parseFloat(amount) - fee) / price : 0;
  const total = amount && price ? parseFloat(amount) * price - fee : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCrypto || !amount) return;

    setIsSubmitting(true);
    
    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setIsSubmitting(false);
    setShowSuccess(true);
    
    setTimeout(() => {
      setShowSuccess(false);
      setAmount("");
      setSelectedCrypto("");
    }, 3000);
  };

  const handleExploreFlows = () => {
    setShowFlowOrchestrator(true);
  };

  if (showFlowOrchestrator) {
    return <TransactionFlowOrchestrator />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation('/demo')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Demo
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Buy & Sell Crypto</h1>
                <p className="text-sm text-gray-600">Demo Mode - No real transactions</p>
              </div>
            </div>
            <Badge variant="outline">Demo</Badge>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Trading Interface */}
          <div>
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Bitcoin className="w-5 h-5" />
                  <span>Crypto Trading Demo</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="buy">
                      <TrendingUp className="w-4 h-4 mr-2" />
                      Buy
                    </TabsTrigger>
                    <TabsTrigger value="sell">
                      <TrendingDown className="w-4 h-4 mr-2" />
                      Sell
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="buy" className="space-y-6 mt-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Select Cryptocurrency</Label>
                        <Select value={selectedCrypto} onValueChange={setSelectedCrypto} required>
                          <SelectTrigger className="bg-white text-gray-700 border-gray-300">
                            <SelectValue placeholder="Choose crypto to buy" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(cryptoPrices).map(([symbol, data]) => (
                              <SelectItem key={symbol} value={symbol}>
                                <div className="flex justify-between w-full items-center">
                                  <span>{data.name} ({symbol})</span>
                                  <span className="ml-4">${data.price.toLocaleString()}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Amount to Spend (USD)</Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <Input
                            type="number"
                            placeholder="0.00"
                            className="pl-10 bg-white text-gray-700 border-gray-300"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            step="0.01"
                            min="10"
                            max="10000"
                            required
                          />
                        </div>
                      </div>

                      {selectedCrypto && amount && (
                        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                          <h3 className="font-medium text-gray-900">Purchase Summary</h3>
                          <div className="flex justify-between text-sm">
                            <span>USD Amount:</span>
                            <span>${parseFloat(amount).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Trading Fee (1.5%):</span>
                            <span>${fee.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm border-t pt-2 font-medium">
                            <span>You'll Receive:</span>
                            <span>{crypto.toFixed(6)} {selectedCrypto}</span>
                          </div>
                        </div>
                      )}

                      <Button
                        type="submit"
                        className="w-full"
                        disabled={isSubmitting || !amount || !selectedCrypto}
                      >
                        {isSubmitting ? (
                          <>
                            <div className="animate-spin w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
                            Processing Demo Purchase...
                          </>
                        ) : (
                          <>
                            <TrendingUp className="w-4 h-4 mr-2" />
                            Buy {selectedCrypto} (Demo)
                          </>
                        )}
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="sell" className="space-y-6 mt-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Select Cryptocurrency to Sell</Label>
                        <Select value={selectedCrypto} onValueChange={setSelectedCrypto} required>
                          <SelectTrigger className="bg-white text-gray-700 border-gray-300">
                            <SelectValue placeholder="Choose crypto to sell" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(cryptoPrices).map(([symbol, data]) => (
                              <SelectItem key={symbol} value={symbol}>
                                <div className="flex justify-between w-full items-center">
                                  <span>{data.name} ({symbol})</span>
                                  <span className="ml-4">${data.price.toLocaleString()}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Amount to Sell ({selectedCrypto || 'Crypto'})</Label>
                        <Input
                          type="number"
                          placeholder="0.00"
                          className="bg-white text-gray-700 border-gray-300"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          step="0.000001"
                          min="0.000001"
                          required
                        />
                      </div>

                      {selectedCrypto && amount && (
                        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                          <h3 className="font-medium text-gray-900">Sale Summary</h3>
                          <div className="flex justify-between text-sm">
                            <span>Selling:</span>
                            <span>{amount} {selectedCrypto}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Market Value:</span>
                            <span>${(parseFloat(amount) * price).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Trading Fee (1.5%):</span>
                            <span>${fee.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm border-t pt-2 font-medium">
                            <span>You'll Receive:</span>
                            <span>${total.toFixed(2)} USD</span>
                          </div>
                        </div>
                      )}

                      <Button
                        type="submit"
                        className="w-full"
                        disabled={isSubmitting || !amount || !selectedCrypto}
                      >
                        {isSubmitting ? (
                          <>
                            <div className="animate-spin w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
                            Processing Demo Sale...
                          </>
                        ) : (
                          <>
                            <TrendingDown className="w-4 h-4 mr-2" />
                            Sell {selectedCrypto} (Demo)
                          </>
                        )}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Market Overview */}
          <div className="space-y-6">
            <Card className="bg-white">
              <CardHeader>
                <CardTitle>Live Market Prices</CardTitle>
                <p className="text-sm text-gray-600">Real-time cryptocurrency prices</p>
              </CardHeader>
              <CardContent>
                {pricesLoading && (
                  <div className="text-center py-4">
                    <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Loading live prices...</p>
                  </div>
                )}
                <div className="space-y-3">
                  {Object.entries(cryptoPrices).slice(0, 6).map(([symbol, data]) => (
                    <div key={symbol} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                      <div className="flex items-center space-x-3">
                        <span className="text-lg">{data.symbol}</span>
                        <div>
                          <div className="font-medium">{data.name}</div>
                          <div className="text-xs text-gray-500">{symbol}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">${data.price.toLocaleString()}</div>
                        <div className={`text-xs ${data.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {data.change >= 0 ? '+' : ''}{data.change}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-2">Explore More Features</h3>
                <p className="text-blue-100 mb-4">
                  Check out our advanced transaction flows and payment routing system
                </p>
                <Button 
                  onClick={handleExploreFlows}
                  variant="secondary"
                  className="bg-white text-blue-600 hover:bg-blue-50"
                >
                  View Transaction Flows
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Success Animation */}
        {showSuccess && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="bg-white p-8 max-w-md mx-4">
              <div className="text-center">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">Demo Transaction Complete!</h3>
                <p className="text-gray-600 mb-4">
                  Your {activeTab} order has been processed successfully in demo mode.
                </p>
                <p className="text-sm text-gray-500">
                  This was a demonstration. No real funds were transferred.
                </p>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}