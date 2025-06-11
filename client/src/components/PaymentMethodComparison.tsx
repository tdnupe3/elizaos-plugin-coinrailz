import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { CreditCard, DollarSign, Zap, TrendingUp, Award, Clock } from 'lucide-react';

interface PaymentMethodData {
  originalAmount: number;
  processingFee: number;
  convenienceFee: number;
  platformFee: number;
  totalFee: number;
  totalAmount: number;
  netAmount: number;
  paymentMethod: string;
  feeBreakdown?: any;
  savings?: any;
}

interface ComparisonData {
  xrp: PaymentMethodData;
  stripe: PaymentMethodData;
  paypal: PaymentMethodData;
  crypto: PaymentMethodData;
  recommended: string;
}

export default function PaymentMethodComparison() {
  const [amount, setAmount] = useState<string>('500');
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchComparison = async (inputAmount: string) => {
    if (!inputAmount || parseFloat(inputAmount) <= 0) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/fees/compare-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(inputAmount) })
      });
      
      const data = await response.json();
      if (data.success) {
        setComparison(data.comparison);
      }
    } catch (error) {
      console.error('Error fetching comparison:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchComparison(amount);
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [amount]);

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'xrp': return <Zap className="h-5 w-5 text-blue-500" />;
      case 'stripe': return <CreditCard className="h-5 w-5 text-purple-500" />;
      case 'paypal': return <DollarSign className="h-5 w-5 text-blue-600" />;
      case 'crypto': return <TrendingUp className="h-5 w-5 text-orange-500" />;
      default: return null;
    }
  };

  const getMethodName = (method: string) => {
    switch (method) {
      case 'xrp': return 'XRP Ledger';
      case 'stripe': return 'Credit Card (Stripe)';
      case 'paypal': return 'PayPal';
      case 'crypto': return 'Cryptocurrency';
      default: return method;
    }
  };

  const getMethodSpeed = (method: string) => {
    switch (method) {
      case 'xrp': return '3-5 seconds';
      case 'stripe': return '1-3 minutes';
      case 'paypal': return '1-3 minutes';
      case 'crypto': return '10-60 minutes';
      default: return 'Variable';
    }
  };

  const getFeePercentage = (fee: number, amount: number) => {
    return ((fee / amount) * 100).toFixed(2);
  };

  const getFeeColor = (percentage: number) => {
    if (percentage < 1) return 'text-green-600';
    if (percentage < 3) return 'text-yellow-600';
    if (percentage < 5) return 'text-orange-600';
    return 'text-red-600';
  };

  const getBadgeVariant = (method: string, recommended: string) => {
    if (method === recommended) return 'default';
    return 'outline';
  };

  if (loading) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-6 w-6 text-yellow-500" />
          Payment Method Comparison
        </CardTitle>
        <div className="space-y-2">
          <label className="text-sm font-medium">Transaction Amount (USD)</label>
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount..."
            className="max-w-xs"
          />
        </div>
      </CardHeader>

      {comparison && (
        <CardContent className="space-y-6">
          {/* Method Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(comparison).filter(([key]) => key !== 'recommended').map(([method, data]) => (
              <Card key={method} className={`relative ${method === comparison.recommended ? 'ring-2 ring-blue-500' : ''}`}>
                {method === comparison.recommended && (
                  <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-blue-500 text-white">Recommended</Badge>
                  </div>
                )}
                
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    {getMethodIcon(method)}
                    <div>
                      <div className="font-medium text-sm">{getMethodName(method)}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {getMethodSpeed(method)}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Processing:</span>
                      <span className="font-mono">${data.processingFee.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Service:</span>
                      <span className="font-mono">${data.convenienceFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Platform:</span>
                      <span className="font-mono">${data.platformFee.toFixed(2)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-medium">
                      <span>Total Fee:</span>
                      <span className={`font-mono ${getFeeColor(parseFloat(getFeePercentage(data.totalFee, data.originalAmount)))}`}>
                        ${data.totalFee.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Percentage:</span>
                      <span className="font-mono">
                        {getFeePercentage(data.totalFee, data.originalAmount)}%
                      </span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <div className="text-xs text-muted-foreground mb-1">Fee Competitiveness</div>
                    <Progress 
                      value={Math.max(0, 100 - (data.totalFee / data.originalAmount * 100 * 20))} 
                      className="h-2"
                    />
                  </div>

                  <div className="text-center pt-2">
                    <div className="text-lg font-bold">${data.totalAmount.toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground">You Pay</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* XRP Advantages Section */}
          {comparison.xrp.savings && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-500" />
                XRP Ledger Advantages
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-green-600 mb-1">
                      ${comparison.xrp.savings.vsWireTransfer.toFixed(2)}
                    </div>
                    <div className="text-sm text-green-700 dark:text-green-300">
                      Savings vs Wire Transfer
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600 mb-1">
                      {comparison.xrp.savings.percentageSaved}%
                    </div>
                    <div className="text-sm text-blue-700 dark:text-blue-300">
                      Cost Reduction
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-purple-600 mb-1">
                      3-5s
                    </div>
                    <div className="text-sm text-purple-700 dark:text-purple-300">
                      Settlement Time
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Fee Structure Summary */}
          <div className="mt-8 p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-3">Why XRP Ledger Wins</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Ultra-low network fees (~$0.0002)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>Instant settlement (3-5 seconds)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span>Transparent fee structure</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span>No hidden charges</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span>Global accessibility 24/7</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                  <span>Enterprise-grade security</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}