import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { NavigationHeader } from "@/components/navigation-header";
import { MobileNavigation } from "@/components/mobile-navigation";
import { useLocation } from "wouter";
import { 
  CreditCard, 
  Wallet, 
  TrendingUp, 
  DollarSign, 
  ArrowRight, 
  ArrowLeft,
  Shield,
  Clock,
  CheckCircle,
  Zap,
  Info
} from "@/lib/icons";

interface PaymentMethod {
  id: string;
  name: string;
  type: 'card' | 'bank' | 'crypto';
  icon: React.ComponentType<any>;
  processingTime: string;
  fees: string;
  limits: { min: number; max: number };
}

interface XRPQuote {
  amount: number;
  price: number;
  total: number;
  fees: number;
  estimatedTime: string;
  exchangeRate: number;
}

export default function XRPBuySell() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [xrpPrice, setXRPPrice] = useState(2.95);
  const [quote, setQuote] = useState<XRPQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const paymentMethods: PaymentMethod[] = [
    {
      id: 'debit-card',
      name: 'Debit Card',
      type: 'card',
      icon: CreditCard,
      processingTime: 'Instant',
      fees: '2.9% + $0.30',
      limits: { min: 10, max: 5000 }
    },
    {
      id: 'credit-card',
      name: 'Credit Card',
      type: 'card',
      icon: CreditCard,
      processingTime: 'Instant',
      fees: '3.5% + $0.30',
      limits: { min: 10, max: 2500 }
    },
    {
      id: 'bank-transfer',
      name: 'Bank Transfer (ACH)',
      type: 'bank',
      icon: Wallet,
      processingTime: '1-3 business days',
      fees: '0.5%',
      limits: { min: 50, max: 25000 }
    },
    {
      id: 'usdc',
      name: 'USDC',
      type: 'crypto',
      icon: DollarSign,
      processingTime: '~1 minute',
      fees: '0.1%',
      limits: { min: 1, max: 100000 }
    }
  ];

  // Fetch XRP price
  useEffect(() => {
    const fetchXRPPrice = async () => {
      try {
        const response = await fetch('/api/xrp/rate');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.rate?.XRP_USD) {
            setXRPPrice(data.rate.XRP_USD);
          }
        }
      } catch (error) {
        console.error('Failed to fetch XRP price:', error);
      }
    };

    fetchXRPPrice();
    const interval = setInterval(fetchXRPPrice, 30000);
    return () => clearInterval(interval);
  }, []);

  // Calculate quote when amount or method changes
  useEffect(() => {
    if (amount && selectedMethod && parseFloat(amount) > 0) {
      calculateQuote();
    } else {
      setQuote(null);
    }
  }, [amount, selectedMethod, activeTab, xrpPrice]);

  const calculateQuote = async () => {
    setLoading(true);
    setError('');

    try {
      const amountNum = parseFloat(amount);
      const method = paymentMethods.find(m => m.id === selectedMethod);
      
      if (!method) return;

      // Calculate fees based on payment method
      let fees = 0;
      if (method.type === 'card') {
        const percentage = method.id === 'credit-card' ? 0.035 : 0.029;
        fees = (amountNum * percentage) + 0.30;
      } else if (method.type === 'bank') {
        fees = amountNum * 0.005;
      } else if (method.type === 'crypto') {
        fees = amountNum * 0.001;
      }

      let xrpAmount: number;
      let total: number;

      if (activeTab === 'buy') {
        // USD amount entered, calculate XRP received
        total = amountNum + fees;
        xrpAmount = amountNum / xrpPrice;
      } else {
        // XRP amount entered, calculate USD received
        total = (amountNum * xrpPrice) - fees;
        xrpAmount = amountNum;
      }

      setQuote({
        amount: xrpAmount,
        price: xrpPrice,
        total: total,
        fees: fees,
        estimatedTime: method.processingTime,
        exchangeRate: xrpPrice
      });

    } catch (error) {
      setError('Failed to calculate quote');
    } finally {
      setLoading(false);
    }
  };

  const handleTransaction = async () => {
    if (!quote || !selectedMethod) return;

    setLoading(true);
    try {
      // Here you would integrate with actual payment processors
      // For now, simulate the transaction
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      alert(`${activeTab === 'buy' ? 'Purchase' : 'Sale'} initiated successfully!`);
      
      // Reset form
      setAmount('');
      setSelectedMethod('');
      setQuote(null);
      
    } catch (error) {
      setError(`Failed to ${activeTab} XRP`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <NavigationHeader />
      <MobileNavigation />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20 md:pb-8">
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
              Buy & Sell XRP
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Buy XRP with fiat currency or sell XRP for cash. Fast, secure, and regulated.
            </p>
            
            {/* Current XRP Price */}
            <div className="mt-6 inline-flex items-center bg-white rounded-lg p-4 shadow-sm">
              <TrendingUp className="w-5 h-5 text-green-500 mr-2" />
              <span className="text-gray-600 mr-2">XRP Price:</span>
              <span className="text-2xl font-bold text-green-600">
                ${xrpPrice.toFixed(4)}
              </span>
              <Badge className="ml-2 bg-green-100 text-green-800">Live</Badge>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Trading Interface */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'buy' | 'sell')}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="buy" className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Buy XRP
                    </TabsTrigger>
                    <TabsTrigger value="sell" className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Sell XRP
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardHeader>
              
              <CardContent className="space-y-6">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {/* Amount Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {activeTab === 'buy' ? 'Amount to Spend (USD)' : 'Amount of XRP to Sell'}
                  </label>
                  <Input
                    type="number"
                    placeholder={activeTab === 'buy' ? 'Enter USD amount' : 'Enter XRP amount'}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="text-lg"
                  />
                </div>

                {/* Payment Method Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {activeTab === 'buy' ? 'Payment Method' : 'Receive Method'}
                  </label>
                  <Select value={selectedMethod} onValueChange={setSelectedMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethods
                        .filter(method => activeTab === 'buy' || method.type !== 'card')
                        .map((method) => (
                        <SelectItem key={method.id} value={method.id}>
                          <div className="flex items-center gap-2">
                            <method.icon className="w-4 h-4" />
                            <span>{method.name}</span>
                            <Badge variant="outline" className="ml-auto">
                              {method.fees}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Quote Display */}
                {quote && (
                  <Card className="bg-gray-50">
                    <CardContent className="p-4 space-y-3">
                      <h4 className="font-semibold text-gray-900">Transaction Summary</h4>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">
                            {activeTab === 'buy' ? 'XRP to Receive:' : 'USD to Receive:'}
                          </span>
                          <span className="font-medium">
                            {activeTab === 'buy' 
                              ? `${quote.amount.toFixed(6)} XRP`
                              : `$${quote.total.toFixed(2)}`
                            }
                          </span>
                        </div>
                        
                        <div className="flex justify-between">
                          <span className="text-gray-600">Exchange Rate:</span>
                          <span className="font-medium">${quote.exchangeRate.toFixed(4)}</span>
                        </div>
                        
                        <div className="flex justify-between">
                          <span className="text-gray-600">Fees:</span>
                          <span className="font-medium">${quote.fees.toFixed(2)}</span>
                        </div>
                        
                        <div className="flex justify-between">
                          <span className="text-gray-600">Processing Time:</span>
                          <span className="font-medium">{quote.estimatedTime}</span>
                        </div>
                      </div>
                      
                      <div className="border-t pt-3">
                        <div className="flex justify-between text-lg font-semibold">
                          <span>Total {activeTab === 'buy' ? 'Cost:' : 'Received:'}</span>
                          <span>${quote.total.toFixed(2)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Action Button */}
                <Button 
                  onClick={handleTransaction}
                  disabled={!quote || loading}
                  className="w-full h-12 text-lg"
                  variant={activeTab === 'buy' ? 'default' : 'outline'}
                >
                  {loading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </div>
                  ) : (
                    <>
                      {activeTab === 'buy' ? 'Buy XRP' : 'Sell XRP'}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar Information */}
          <div className="space-y-6">
            {/* Market Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Market Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">24h Volume:</span>
                  <span className="font-medium">$2.1B</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Market Cap:</span>
                  <span className="font-medium">$168.5B</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">24h Change:</span>
                  <span className="font-medium text-green-600">+5.2%</span>
                </div>
              </CardContent>
            </Card>

            {/* Security Features */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Security & Compliance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm">SOC 2 Type II Certified</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm">FDIC Insured USD Deposits</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm">Cold Storage Protection</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm">KYC/AML Compliant</span>
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
                  onClick={() => setLocation('/xrp-dex-trading')}
                >
                  <Zap className="w-4 h-4 mr-2" />
                  DEX Trading
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => setLocation('/xrp-cross-border-payments')}
                >
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Cross-Border Payments
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}