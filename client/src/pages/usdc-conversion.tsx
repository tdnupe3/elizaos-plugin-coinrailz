import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowRight, 
  Clock, 
  DollarSign, 
  TrendingUp, 
  Shield, 
  Zap,
  AlertCircle,
  CheckCircle,
  RefreshCw
} from '@/lib/icons';

interface SupportedAsset {
  symbol: string;
  name: string;
  network: string;
  conversionFee: number;
  networkFee: number;
  estimatedTime: string;
  advantages: string[];
}

interface ConversionQuote {
  fromAsset: string;
  toAsset: string;
  fromAmount: number;
  toAmount: number;
  exchangeRate: number;
  platformFee: number;
  networkFee: number;
  totalFee: number;
  estimatedTime: string;
  savings?: {
    vsTraditional: number;
    percentage: number;
  };
}

export default function USDCConversion() {
  const [selectedAsset, setSelectedAsset] = useState('XRP');
  const [amount, setAmount] = useState('');
  const [targetNetwork, setTargetNetwork] = useState('ethereum');
  const [quote, setQuote] = useState<ConversionQuote | null>(null);
  const [expedited, setExpedited] = useState(false);

  // Fetch supported assets
  const { data: supportedAssets } = useQuery<{ assets: SupportedAsset[] }>({
    queryKey: ['/api/usdc-conversion/supported-assets'],
    refetchInterval: 300000 // 5 minutes
  });

  // Get conversion quote
  const quoteMutation = useMutation({
    mutationFn: async (params: { fromAsset: string; amount: number; targetNetwork: string }) => {
      const response = await fetch('/api/usdc-conversion/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get quote');
      }
      return response.json();
    }
  });

  // Execute conversion
  const conversionMutation = useMutation({
    mutationFn: async (params: {
      fromAsset: string;
      amount: number;
      targetNetwork: string;
      destinationAddress: string;
    }) => {
      const response = await fetch('/api/usdc-conversion/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Conversion failed');
      }
      return response.json();
    }
  });

  // Auto-update quote when parameters change
  useEffect(() => {
    if (amount && parseFloat(amount) > 0 && selectedAsset) {
      const timer = setTimeout(() => {
        quoteMutation.mutate({
          fromAsset: selectedAsset,
          amount: parseFloat(amount),
          targetNetwork
        });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [amount, selectedAsset, targetNetwork]);

  // Update quote when mutation succeeds
  useEffect(() => {
    if (quoteMutation.data?.success) {
      setQuote(quoteMutation.data.quote);
    }
  }, [quoteMutation.data]);

  const handleGetQuote = () => {
    if (!amount || parseFloat(amount) <= 0) return;
    
    quoteMutation.mutate({
      fromAsset: selectedAsset,
      amount: parseFloat(amount),
      targetNetwork
    });
  };

  const getAssetIcon = (symbol: string) => {
    const icons: Record<string, string> = {
      XRP: '⚡',
      ETH: 'Ξ',
      BTC: '₿',
      BNB: '🟡',
      ADA: '♠',
      MATIC: '🔮'
    };
    return icons[symbol] || '💰';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl font-bold mb-6">
              Convert Any Crypto to USDC
            </h1>
            <p className="text-xl mb-8 opacity-90">
              Lightning-fast conversions with the lowest fees in the industry. 
              Experience the future of crypto-to-stablecoin conversion.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
                <Zap className="w-8 h-8 mb-3 mx-auto" />
                <h3 className="font-semibold mb-2">Lightning Fast</h3>
                <p className="text-sm opacity-80">Conversions complete in seconds, not hours</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
                <DollarSign className="w-8 h-8 mb-3 mx-auto" />
                <h3 className="font-semibold mb-2">Lowest Fees</h3>
                <p className="text-sm opacity-80">Starting at 0.5% - up to 90% savings</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
                <Shield className="w-8 h-8 mb-3 mx-auto" />
                <h3 className="font-semibold mb-2">Secure & Compliant</h3>
                <p className="text-sm opacity-80">Enterprise-grade security and regulatory compliance</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Conversion Interface */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <Tabs defaultValue="convert" className="space-y-8">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="convert">Convert</TabsTrigger>
              <TabsTrigger value="rates">Live Rates</TabsTrigger>
              <TabsTrigger value="analytics">Market Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="convert" className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Conversion Form */}
                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5" />
                      Asset Conversion
                    </CardTitle>
                    <CardDescription>
                      Convert your crypto assets to USDC across multiple networks
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Asset Selection */}
                    <div className="space-y-2">
                      <Label htmlFor="asset">From Asset</Label>
                      <Select value={selectedAsset} onValueChange={setSelectedAsset}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="XRP">
                            <div className="flex items-center gap-2">
                              <span>⚡</span>
                              <span>XRP</span>
                              <span className="text-gray-500">(Ripple)</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="ETH">
                            <div className="flex items-center gap-2">
                              <span>Ξ</span>
                              <span>ETH</span>
                              <span className="text-gray-500">(Ethereum)</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="BTC">
                            <div className="flex items-center gap-2">
                              <span>₿</span>
                              <span>BTC</span>
                              <span className="text-gray-500">(Bitcoin)</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="BNB">
                            <div className="flex items-center gap-2">
                              <span>🟡</span>
                              <span>BNB</span>
                              <span className="text-gray-500">(BNB Chain)</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="ADA">
                            <div className="flex items-center gap-2">
                              <span>♠</span>
                              <span>ADA</span>
                              <span className="text-gray-500">(Cardano)</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="MATIC">
                            <div className="flex items-center gap-2">
                              <span>🔮</span>
                              <span>MATIC</span>
                              <span className="text-gray-500">(Polygon)</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="VET">
                            <div className="flex items-center gap-2">
                              <span>⚡</span>
                              <span>VET</span>
                              <span className="text-gray-500">(VeChain)</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="AVAX">
                            <div className="flex items-center gap-2">
                              <span>🔺</span>
                              <span>AVAX</span>
                              <span className="text-gray-500">(Avalanche)</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="DOT">
                            <div className="flex items-center gap-2">
                              <span>⚫</span>
                              <span>DOT</span>
                              <span className="text-gray-500">(Polkadot)</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Amount Input */}
                    <div className="space-y-2">
                      <Label htmlFor="amount">Amount</Label>
                      <Input
                        id="amount"
                        type="number"
                        placeholder="Enter amount to convert"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="text-lg"
                      />
                    </div>

                    {/* Target Network */}
                    <div className="space-y-2">
                      <Label htmlFor="network">USDC Network</Label>
                      <Select value={targetNetwork} onValueChange={setTargetNetwork}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ethereum">Ethereum (ETH)</SelectItem>
                          <SelectItem value="polygon">Polygon (MATIC)</SelectItem>
                          <SelectItem value="base">Base (Coinbase L2)</SelectItem>
                          <SelectItem value="arbitrum">Arbitrum (ARB)</SelectItem>
                          <SelectItem value="bnb">BNB Chain (BNB)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* XRP Expedited Option */}
                    {selectedAsset === 'XRP' && (
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="expedited"
                          checked={expedited}
                          onChange={(e) => setExpedited(e.target.checked)}
                          className="w-4 h-4"
                        />
                        <Label htmlFor="expedited" className="text-sm">
                          Expedited processing (+$1.00) - Complete in 1-2 seconds
                        </Label>
                      </div>
                    )}

                    <Button 
                      onClick={handleGetQuote}
                      className="w-full"
                      disabled={!amount || parseFloat(amount) <= 0 || quoteMutation.isPending}
                    >
                      {quoteMutation.isPending ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Getting Quote...
                        </>
                      ) : (
                        'Get Conversion Quote'
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Quote Display */}
                {quote && (
                  <Card className="shadow-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        Conversion Quote
                      </CardTitle>
                      <CardDescription>
                        Quote valid for 5 minutes
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Conversion Summary */}
                      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-4">
                        <div className="flex items-center justify-between text-lg font-semibold">
                          <span>{quote.fromAmount} {quote.fromAsset}</span>
                          <ArrowRight className="w-5 h-5" />
                          <span>{quote.toAmount.toFixed(2)} USDC</span>
                        </div>
                        <div className="text-center text-sm text-gray-600 dark:text-gray-400 mt-2">
                          Rate: 1 {quote.fromAsset} = ${quote.exchangeRate.toFixed(4)} USD
                        </div>
                      </div>

                      {/* Fee Breakdown */}
                      <div className="space-y-3">
                        <h4 className="font-semibold">Fee Breakdown</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Platform Fee:</span>
                            <span>${quote.platformFee.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Network Fee:</span>
                            <span>${quote.networkFee.toFixed(4)}</span>
                          </div>
                          <Separator />
                          <div className="flex justify-between font-semibold">
                            <span>Total Fees:</span>
                            <span>${quote.totalFee.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Timing and Savings */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <Clock className="w-5 h-5 mx-auto mb-2 text-green-600" />
                          <div className="text-sm font-semibold">Settlement Time</div>
                          <div className="text-lg text-green-600">{quote.estimatedTime}</div>
                        </div>
                        {quote.savings && (
                          <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <TrendingUp className="w-5 h-5 mx-auto mb-2 text-blue-600" />
                            <div className="text-sm font-semibold">You Save</div>
                            <div className="text-lg text-blue-600">
                              {quote.savings.percentage.toFixed(1)}%
                            </div>
                          </div>
                        )}
                      </div>

                      {/* XRP Advantages */}
                      {selectedAsset === 'XRP' && (
                        <div className="space-y-2">
                          <h4 className="font-semibold text-sm">XRP Advantages:</h4>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary" className="text-xs">Ultra-fast</Badge>
                            <Badge variant="secondary" className="text-xs">Lowest fees</Badge>
                            <Badge variant="secondary" className="text-xs">High liquidity</Badge>
                            <Badge variant="secondary" className="text-xs">Regulatory clear</Badge>
                          </div>
                        </div>
                      )}

                      <Button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                        Execute Conversion
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Supported Assets Grid */}
              {supportedAssets?.assets && (
                <Card className="shadow-lg">
                  <CardHeader>
                    <CardTitle>Supported Assets</CardTitle>
                    <CardDescription>
                      Convert any of these assets to USDC across multiple networks
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {supportedAssets.assets.map((asset: SupportedAsset) => (
                        <div
                          key={asset.symbol}
                          className={`border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
                            selectedAsset === asset.symbol 
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                              : 'border-gray-200 dark:border-gray-700'
                          }`}
                          onClick={() => setSelectedAsset(asset.symbol)}
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-2xl">{getAssetIcon(asset.symbol)}</span>
                            <div>
                              <div className="font-semibold">{asset.symbol}</div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                {asset.name}
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between">
                              <span>Fee:</span>
                              <span>{(asset.conversionFee * 100).toFixed(2)}%</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Time:</span>
                              <span>{asset.estimatedTime}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="rates">
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle>Live Conversion Rates</CardTitle>
                  <CardDescription>
                    Real-time rates updated every 30 seconds
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 text-gray-500">
                    Live rates component would be implemented here with real-time price feeds
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics">
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle>Market Analytics</CardTitle>
                  <CardDescription>
                    Conversion trends and market insights
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 text-gray-500">
                    Analytics dashboard would be implemented here with conversion volume and trends
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}