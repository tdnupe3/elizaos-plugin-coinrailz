import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { 
  TrendingDown, 
  Crown, 
  Percent,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Link } from 'wouter';

interface FeeCalculation {
  baseFee: number;
  discountAmount: number;
  finalFee: number;
  feeReduction: number;
}

interface SubscriptionBenefits {
  tradingFeeReduction: string;
  crossChainFeeReduction: string;
  aiCredits: string;
  planName: string;
  isActive: boolean;
}

interface SubscriptionFeeDisplayProps {
  amount: number;
  feeType?: 'trading' | 'crosschain';
  showUpgradePrompt?: boolean;
  compact?: boolean;
}

export function SubscriptionFeeDisplay({ 
  amount, 
  feeType = 'trading', 
  showUpgradePrompt = true,
  compact = false 
}: SubscriptionFeeDisplayProps) {
  const { user, isAuthenticated } = useAuth();
  const [calculatedFee, setCalculatedFee] = useState<FeeCalculation | null>(null);

  // Fetch user's subscription benefits
  const { data: benefits } = useQuery<SubscriptionBenefits>({
    queryKey: ['/api/user/subscription-benefits'],
    enabled: isAuthenticated,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Calculate fees when amount or user changes
  useEffect(() => {
    if (!isAuthenticated || !amount || amount <= 0) {
      // For guests, show base rates
      const baseFeeRate = feeType === 'trading' ? 0.015 : 0.025;
      const baseFee = amount * baseFeeRate;
      setCalculatedFee({
        baseFee,
        discountAmount: 0,
        finalFee: baseFee,
        feeReduction: 0
      });
      return;
    }

    // For authenticated users, fetch real calculation
    const endpoint = feeType === 'trading' ? 
      '/api/user/calculate-trading-fee' : 
      '/api/user/calculate-crosschain-fee';

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount })
    })
      .then(res => res.json())
      .then(data => setCalculatedFee(data))
      .catch(error => {
        console.error('Fee calculation failed:', error);
        // Fallback to base calculation
        const baseFeeRate = feeType === 'trading' ? 0.015 : 0.025;
        const baseFee = amount * baseFeeRate;
        setCalculatedFee({
          baseFee,
          discountAmount: 0,
          finalFee: baseFee,
          feeReduction: 0
        });
      });
  }, [amount, feeType, isAuthenticated, user]);

  if (!calculatedFee) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
        Calculating fees...
      </div>
    );
  }

  const hasDiscount = calculatedFee.feeReduction > 0;
  const isGuest = !isAuthenticated;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm">
          Fee: ${calculatedFee.finalFee.toFixed(4)}
        </span>
        {hasDiscount && (
          <Badge variant="secondary" className="text-xs">
            <TrendingDown className="w-3 h-3 mr-1" />
            {calculatedFee.feeReduction}% off
          </Badge>
        )}
        {isGuest && showUpgradePrompt && (
          <Link href="/subscription">
            <Button variant="outline" size="sm" className="text-xs h-6 px-2">
              Save with Pro
            </Button>
          </Link>
        )}
      </div>
    );
  }

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Fee Breakdown */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">
                {feeType === 'trading' ? 'Trading Fee' : 'Cross-Chain Fee'}
              </span>
              <div className="text-right">
                {hasDiscount ? (
                  <>
                    <span className="text-sm line-through text-muted-foreground">
                      ${calculatedFee.baseFee.toFixed(4)}
                    </span>
                    <span className="ml-2 font-semibold text-green-600">
                      ${calculatedFee.finalFee.toFixed(4)}
                    </span>
                  </>
                ) : (
                  <span className="font-semibold">
                    ${calculatedFee.finalFee.toFixed(4)}
                  </span>
                )}
              </div>
            </div>

            {hasDiscount && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-green-600 flex items-center gap-1">
                  <TrendingDown className="w-4 h-4" />
                  You saved:
                </span>
                <span className="font-semibold text-green-600">
                  ${calculatedFee.discountAmount.toFixed(4)} ({calculatedFee.feeReduction}%)
                </span>
              </div>
            )}
          </div>

          {/* Subscription Status */}
          {isAuthenticated && benefits && (
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium">{benefits.planName}</span>
                  {benefits.isActive && (
                    <Badge variant="secondary" className="text-xs">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Active
                    </Badge>
                  )}
                </div>
                {benefits.tradingFeeReduction !== 'None' && (
                  <Badge className="bg-green-500 text-xs">
                    <Percent className="w-3 h-3 mr-1" />
                    {benefits.tradingFeeReduction} off
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Guest Upgrade Prompt */}
          {isGuest && showUpgradePrompt && (
            <Alert>
              <TrendingDown className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span className="text-sm">
                  Get up to 30% off fees with Pro subscription
                </span>
                <Link href="/subscription">
                  <Button variant="outline" size="sm" className="ml-2">
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Upgrade
                  </Button>
                </Link>
              </AlertDescription>
            </Alert>
          )}

          {/* Free User Upgrade Prompt */}
          {isAuthenticated && benefits && benefits.planName === 'Free' && showUpgradePrompt && (
            <Alert>
              <Crown className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span className="text-sm">
                  Save ${((amount * 0.015) * 0.1).toFixed(2)}+ per trade with Starter plan
                </span>
                <Link href="/subscription">
                  <Button variant="outline" size="sm" className="ml-2">
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Upgrade
                  </Button>
                </Link>
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}