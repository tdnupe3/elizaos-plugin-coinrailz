import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign, Bitcoin, CheckCircle } from "lucide-react";
import { useLocation } from "wouter";

const DEMO_CRYPTO_PRICES = {
  BTC: { price: 45000, change: 2.5, name: "Bitcoin" },
  ETH: { price: 3200, change: -1.2, name: "Ethereum" },
  ADA: { price: 0.85, change: 4.8, name: "Cardano" },
  DOT: { price: 25.30, change: -0.9, name: "Polkadot" },
  USDC: { price: 1.00, change: 0.0, name: "USD Coin" }
};

export default function DemoBuySell() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("buy");
  const [selectedCrypto, setSelectedCrypto] = useState("");
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setIsSubmitting(false);
    setShowSuccess(true);
    
    // Reset after 3 seconds
    setTimeout(() => {
      setShowSuccess(false);
      setAmount("");
      setSelectedCrypto("");
    }, 3000);
  };

  const calculateTotal = () => {
    if (!selectedCrypto || !amount) return { crypto: 0, fee: 0, total: 0 };
    
    const usdAmount = parseFloat(amount) || 0;
    const cryptoPrice = DEMO_CRYPTO_PRICES[selectedCrypto as keyof typeof DEMO_CRYPTO_PRICES]?.price || 0;
    const fee = usdAmount * 0.015; // 1.5% fee
    
    if (activeTab === "buy") {
      const cryptoAmount = (usdAmount - fee) / cryptoPrice;
      return { crypto: cryptoAmount, fee, total: usdAmount };
    } else {
      const totalUsd = usdAmount * cryptoPrice - fee;
      return { crypto: usdAmount, fee, total: totalUsd };
    }
  };

  const { crypto, fee, total } = calculateTotal();

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-6">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {activeTab === "buy" ? "Purchase" : "Sale"} Complete!
            </h2>
            <p className="text-gray-600 mb-4">
              {activeTab === "buy" 
                ? `You bought ${crypto.toFixed(6)} ${selectedCrypto}`
                : `You sold ${amount} ${selectedCrypto} for $${total.toFixed(2)}`
              }
            </p>
            <Badge variant="secondary" className="mb-4">
              Demo Mode - No actual crypto traded
            </Badge>
            <Button onClick={() => setLocation('/demo')} className="w-full">
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4">
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
                    <TabsTrigger value="buy" style={{ backgroundColor: activeTab === 'buy' ? '#2563eb' : 'white', color: activeTab === 'buy' ? 'white' : '#374151' }}>
                      <TrendingUp className="w-4 h-4 mr-2" />
                      Buy
                    </TabsTrigger>
                    <TabsTrigger value="sell" style={{ backgroundColor: activeTab === 'sell' ? '#2563eb' : 'white', color: activeTab === 'sell' ? 'white' : '#374151' }}>
                      <TrendingDown className="w-4 h-4 mr-2" />
                      Sell
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="buy" className="space-y-6 mt-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Select Cryptocurrency</Label>
                        <Select value={selectedCrypto} onValueChange={setSelectedCrypto} required>
                          <SelectTrigger style={{ backgroundColor: 'white', color: '#374151', borderColor: '#d1d5db' }}>
                            <SelectValue placeholder="Choose crypto to buy" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(DEMO_CRYPTO_PRICES).map(([symbol, data]) => (
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
                            className="pl-10"
                            style={{ backgroundColor: 'white', color: '#374151', borderColor: '#d1d5db' }}
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
                          <SelectTrigger style={{ backgroundColor: 'white', color: '#374151', borderColor: '#d1d5db' }}>
                            <SelectValue placeholder="Choose crypto to sell" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(DEMO_CRYPTO_PRICES).map(([symbol, data]) => (
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
                          style={{ backgroundColor: 'white', color: '#374151', borderColor: '#d1d5db' }}
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
                            <span>${(parseFloat(amount) * DEMO_CRYPTO_PRICES[selectedCrypto as keyof typeof DEMO_CRYPTO_PRICES]?.price || 0).toFixed(2)}</span>
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

                <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-800">
                    <strong>Demo Mode:</strong> This is a demonstration interface. No real cryptocurrency 
                    will be bought or sold, and no actual funds will be transferred.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Market Overview */}
          <div>
            <Card className="bg-white">
              <CardHeader>
                <CardTitle>Live Market Prices (Demo)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(DEMO_CRYPTO_PRICES).map(([symbol, data]) => (
                    <div key={symbol} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{data.name}</p>
                        <p className="text-sm text-gray-500">{symbol}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">${data.price.toLocaleString()}</p>
                        <p className={`text-sm ${data.change > 0 ? 'text-green-600' : data.change < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                          {data.change > 0 ? '+' : ''}{data.change}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}