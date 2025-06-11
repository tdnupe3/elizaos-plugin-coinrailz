import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { TrendingDown, Clock, Shield, Zap } from 'lucide-react';

interface FeeCalculation {
  originalAmount: number;
  processingFee: number;
  convenienceFee: number;
  platformFee: number;
  totalFee: number;
  totalAmount: number;
  netAmount: number;
  paymentMethod: string;
  feeBreakdown?: {
    networkFee: number;
    serviceFee: number;
    platformFee: number;
    description: string;
  };
  savings?: {
    vsWireTransfer: number;
    vsCompetitor: number;
    percentageSaved: number;
  };
}

interface FeeOptimization {
  suggested: number;
  currentFeePercentage: number;
  suggestedFeePercentage: number;
  savings: number;
}

export default function FeeCalculatorWidget() {
  const [amount, setAmount] = useState<string>('100');
  const [fees, setFees] = useState<FeeCalculation | null>(null);
  const [optimization, setOptimization] = useState<FeeOptimization | null>(null);
  const [loading, setLoading] = useState(false);

  const calculateFees = async (inputAmount: string) => {
    if (!inputAmount || parseFloat(inputAmount) <= 0) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/fees/calculate-xrp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(inputAmount) })
      });
      
      const data = await response.json();
      if (data.success) {
        setFees(data.fees);
        setOptimization(data.optimization);
      }
    } catch (error) {
      console.error('Error calculating fees:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      calculateFees(amount);
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [amount]);

  const getTierBadge = (amt: number) => {
    if (amt < 50) return <Badge variant="secondary">Small</Badge>;
    if (amt <= 250) return <Badge variant="outline">Medium</Badge>;
    return <Badge variant="default">Large</Badge>;
  };

  const getFeeColor = (percentage: number) => {
    if (percentage < 1) return 'text-green-600';
    if (percentage < 3) return 'text-yellow-600';
    return 'text-orange-600';
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-blue-500" />
          XRP Fee Calculator
          <Badge variant="outline" className="ml-2">Enhanced Tiered Pricing</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Amount Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Transaction Amount (USD)</label>
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter amount..."
            className="text-lg"
          />
        </div>

        {fees && (
          <>
            {/* Fee Breakdown */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Fee Breakdown</h3>
                {getTierBadge(fees.originalAmount)}
              </div>

              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Network Fee:</span>
                    <span className="font-mono">${fees.feeBreakdown?.networkFee.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Service Fee:</span>
                    <span className="font-mono">${fees.feeBreakdown?.serviceFee.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Platform Fee:</span>
                    <span className="font-mono">${fees.platformFee.toFixed(2)}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between font-medium">
                    <span>Total Fee:</span>
                    <span className={`font-mono ${getFeeColor((fees.totalFee / fees.originalAmount) * 100)}`}>
                      ${fees.totalFee.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Fee Percentage:</span>
                    <span className="font-mono">
                      {((fees.totalFee / fees.originalAmount) * 100).toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span>You Send:</span>
                    <span className="font-mono">${fees.totalAmount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                {fees.feeBreakdown?.description}
              </div>
            </div>

            <Separator />

            {/* Savings Comparison */}
            {fees.savings && (
              <div className="space-y-3">
                <h3 className="font-medium flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-green-500" />
                  Savings vs Traditional Wire Transfer
                </h3>
                
                <div className="grid grid-cols-2 gap-4 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      ${fees.savings.vsWireTransfer.toFixed(2)}
                    </div>
                    <div className="text-sm text-muted-foreground">Total Savings</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {fees.savings.percentageSaved}%
                    </div>
                    <div className="text-sm text-muted-foreground">Percentage Saved</div>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  Traditional wire transfer: ${fees.savings.vsCompetitor.toFixed(2)} • XRP: ${fees.totalFee.toFixed(2)}
                </div>
              </div>
            )}

            {/* Optimization Suggestion */}
            {optimization && optimization.savings > 0 && (
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                  💡 Fee Optimization Suggestion
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Consider sending ${optimization.suggested} instead to reduce your fee percentage from {optimization.currentFeePercentage}% to {optimization.suggestedFeePercentage}% 
                  (saves ${optimization.savings.toFixed(2)})
                </p>
              </div>
            )}

            {/* Key Benefits */}
            <div className="grid grid-cols-3 gap-4 pt-4">
              <div className="text-center">
                <Clock className="h-6 w-6 mx-auto mb-2 text-blue-500" />
                <div className="text-sm font-medium">3-5 Seconds</div>
                <div className="text-xs text-muted-foreground">Settlement Time</div>
              </div>
              <div className="text-center">
                <Shield className="h-6 w-6 mx-auto mb-2 text-green-500" />
                <div className="text-sm font-medium">Ultra-Low</div>
                <div className="text-xs text-muted-foreground">Network Fees</div>
              </div>
              <div className="text-center">
                <TrendingDown className="h-6 w-6 mx-auto mb-2 text-purple-500" />
                <div className="text-sm font-medium">80-95%</div>
                <div className="text-xs text-muted-foreground">Cost Savings</div>
              </div>
            </div>

            {/* Action Button */}
            <Button 
              className="w-full" 
              size="lg"
              onClick={() => window.location.href = '/transfer'}
            >
              Send ${fees.originalAmount} via XRP
            </Button>
          </>
        )}

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}