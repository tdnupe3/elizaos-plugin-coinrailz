import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, TrendingUp, TrendingDown, CreditCard, Building2 } from "@/lib/icons";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { useState, useEffect } from "react";

const cryptoCurrencies = [
  { symbol: 'BTC', name: 'Bitcoin', price: 45000 },
  { symbol: 'ETH', name: 'Ethereum', price: 3200 },
  { symbol: 'SOL', name: 'Solana', price: 180.50 },
  { symbol: 'ADA', name: 'Cardano', price: 0.85 },
  { symbol: 'DOT', name: 'Polkadot', price: 25.30 },
  { symbol: 'USDC', name: 'USD Coin', price: 1.00 },
  { symbol: 'USDT', name: 'Tether', price: 1.00 }
];

const paymentMethods = [
  { id: 'bank', name: 'Bank Transfer', icon: Building2, fee: 'Free', time: '1-3 business days' },
  { id: 'debit', name: 'Debit Card', icon: CreditCard, fee: 'Instant', time: 'Instant' },
  { id: 'credit', name: 'Credit Card', icon: CreditCard, fee: 'Instant', time: 'Instant' },
  { id: 'paypal', name: 'PayPal', icon: CreditCard, fee: 'Instant', time: 'Instant' }
];

export default function BuySellPage() {
  const [, setLocation] = useLocation();
  const [selectedCrypto, setSelectedCrypto] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [activeTab, setActiveTab] = useState('buy');

  // Check URL params for initial tab
  useEffect(() => {
    const path = window.location.pathname;
    if (path.includes('/sell')) {
      setActiveTab('sell');
    }
  }, []);

  const getCryptoPrice = (symbol: string) => {
    return cryptoCurrencies.find(crypto => crypto.symbol === symbol)?.price || 0;
  };

  const calculateBuyTotal = () => {
    if (!amount || !selectedCrypto) return 0;
    const cryptoValue = parseFloat(amount) * getCryptoPrice(selectedCrypto);
    const onRampFee = cryptoValue * 0.015; // 1.5% fee
    return cryptoValue + onRampFee;
  };

  const calculateSellTotal = () => {
    if (!amount || !selectedCrypto) return 0;
    const cryptoValue = parseFloat(amount) * getCryptoPrice(selectedCrypto);
    const offRampFee = cryptoValue * 0.025; // 2.5% fee
    return cryptoValue - offRampFee;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                onClick={() => setLocation("/")}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Buy & Sell Crypto</h1>
                <p className="text-gray-600">Convert between fiat and cryptocurrency with bank-grade security</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="buy" className="text-lg py-3">
              <TrendingUp className="w-5 h-5 mr-2" />
              Buy (On-Ramp)
            </TabsTrigger>
            <TabsTrigger value="sell" className="text-lg py-3">
              <TrendingDown className="w-5 h-5 mr-2" />
              Sell (Off-Ramp)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="buy">
            {/* Instructional Banner */}
            <div className="bg-blue-50 rounded-lg p-4 mb-6">
              <h3 className="font-medium text-blue-900 mb-2">How On-Ramp Works:</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Connect your bank account or debit card</li>
                <li>• Choose cryptocurrency and amount</li>
                <li>• We purchase crypto at market rates via licensed exchanges</li>
                <li>• Crypto appears in your wallet within minutes</li>
              </ul>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle>Buy Cryptocurrency</CardTitle>
                  <p className="text-sm text-gray-600">Convert USD to crypto with transparent 1% fee</p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label>Select Cryptocurrency</Label>
                    <p className="text-xs text-gray-500">Choose from major cryptocurrencies with live pricing</p>
                    <Select value={selectedCrypto} onValueChange={setSelectedCrypto}>
                      <SelectTrigger>
                        <SelectValue placeholder="Try selecting Bitcoin (BTC)" />
                      </SelectTrigger>
                      <SelectContent>
                        {cryptoCurrencies.map((crypto) => (
                          <SelectItem key={crypto.symbol} value={crypto.symbol}>
                            {crypto.name} ({crypto.symbol}) - ${crypto.price.toLocaleString()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Amount ({selectedCrypto || 'Crypto'})</Label>
                    <Input
                      type="number"
                      step="0.00000001"
                      placeholder="0.00000000"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </div>

                  <div>
                    <Label>Payment Method</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose payment method" />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentMethods.map((method) => (
                          <SelectItem key={method.id} value={method.id}>
                            <div className="flex items-center space-x-2">
                              <method.icon className="w-4 h-4" />
                              <span>{method.name} - {method.time}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedCrypto && amount && (
                    <div className="bg-emerald-50 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between font-medium">
                        <span className="text-emerald-800">Total Cost:</span>
                        <span className="text-emerald-800 text-lg">${calculateBuyTotal().toFixed(2)}</span>
                      </div>
                      <p className="text-xs text-gray-400">
                        Includes 1.5% Coin Railz fee. Final amount may vary based on market conditions.
                      </p>
                    </div>
                  )}

                  <div className="relative">
                    <Button 
                      className="w-full bg-green-600 hover:bg-green-700"
                      disabled={true}
                    >
                      Buy {selectedCrypto || 'Crypto'}
                    </Button>
                    <div className="absolute inset-0 bg-black/50 rounded-md flex items-center justify-center">
                      <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-md text-sm font-medium border border-yellow-300">
                        Coming Soon
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Market Prices</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {cryptoCurrencies.map((crypto) => (
                      <div key={crypto.symbol} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{crypto.name}</p>
                          <p className="text-sm text-gray-500">{crypto.symbol}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">${crypto.price.toLocaleString()}</p>
                          <p className="text-sm text-green-600">+2.5%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="sell">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle>Sell Cryptocurrency</CardTitle>
                  <p className="text-sm text-gray-600">Convert crypto to USD (2.5% fee)</p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label>Select Cryptocurrency</Label>
                    <Select value={selectedCrypto} onValueChange={setSelectedCrypto}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose cryptocurrency to sell" />
                      </SelectTrigger>
                      <SelectContent>
                        {cryptoCurrencies.map((crypto) => (
                          <SelectItem key={crypto.symbol} value={crypto.symbol}>
                            {crypto.name} ({crypto.symbol}) - ${crypto.price.toLocaleString()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Amount to Sell ({selectedCrypto || 'Crypto'})</Label>
                    <Input
                      type="number"
                      step="0.00000001"
                      placeholder="0.00000000"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Available: 0.05673421 {selectedCrypto || 'Crypto'}
                    </p>
                  </div>

                  <div>
                    <Label>Withdrawal Method</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose withdrawal method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank">
                          <div className="flex items-center space-x-2">
                            <Building2 className="w-4 h-4" />
                            <span>Bank Transfer - 1-3 business days</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedCrypto && amount && (
                    <div className="bg-emerald-50 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between font-medium">
                        <span className="text-emerald-800">You Receive:</span>
                        <span className="text-emerald-800 text-lg">${calculateSellTotal().toFixed(2)}</span>
                      </div>
                      <p className="text-xs text-gray-400">
                        After 2.5% Coin Railz fee. Processing time 1-3 business days.
                      </p>
                    </div>
                  )}

                  <div className="relative">
                    <Button 
                      className="w-full bg-red-600 hover:bg-red-700"
                      disabled={true}
                    >
                      Sell {selectedCrypto || 'Crypto'}
                    </Button>
                    <div className="absolute inset-0 bg-black/50 rounded-md flex items-center justify-center">
                      <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-md text-sm font-medium border border-yellow-300">
                        Coming Soon
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Your Holdings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {cryptoCurrencies.map((crypto) => (
                      <div key={crypto.symbol} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{crypto.name}</p>
                          <p className="text-sm text-gray-500">0.05673421 {crypto.symbol}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">${(0.05673421 * crypto.price).toFixed(2)}</p>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              setSelectedCrypto(crypto.symbol);
                              setAmount('0.05673421');
                            }}
                          >
                            Sell All
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Fee Information */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Fee Structure</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
              <div className="bg-green-50 rounded-lg p-4">
                <h4 className="font-medium text-green-800 mb-2">On-Ramp (Buy) Fees</h4>
                <p className="text-green-700">1.5% fee on all crypto purchases</p>
                <p className="text-green-600 text-xs mt-1">Competitive rates for fiat to crypto conversion</p>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <h4 className="font-medium text-red-800 mb-2">Off-Ramp (Sell) Fees</h4>
                <p className="text-red-700">2.5% fee on all crypto sales</p>
                <p className="text-red-600 text-xs mt-1">Includes processing and withdrawal costs</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}