import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Crown, TrendingDown, Zap } from 'lucide-react';
import { Link } from 'wouter';

interface SubscriptionStatus {
  planId: string;
  planName: string;
  status: 'active' | 'cancelled' | 'expired' | 'pending';
  currentTier: {
    tradingFeeReduction: number;
    crossChainFeeReduction: number;
    aiMarketplaceCredits: number;
  };
  isActive: boolean;
  aiMarketplaceCredits: number;
}

export function SubscriptionStatusWidget() {
  const { data: subscription } = useQuery<SubscriptionStatus>({
    queryKey: ['/api/my-subscription'],
    retry: false,
  });

  if (!subscription || subscription.planId === 'free') {
    return (
      <Card className="border-2 border-dashed border-muted">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-lg">Free Plan</CardTitle>
          <CardDescription>
            Upgrade to unlock lower fees and premium features
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <div className="mb-4">
            <div className="text-sm text-muted-foreground mb-1">Trading Fees</div>
            <div className="text-lg font-semibold">0.25%</div>
          </div>
          <Link href="/subscription">
            <Button size="sm" className="w-full">
              <Crown className="w-4 h-4 mr-2" />
              Upgrade Plan
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const statusColor = subscription.status === 'active' ? 'bg-green-500' : 
                     subscription.status === 'cancelled' ? 'bg-yellow-500' : 'bg-red-500';

  const baseTradingFee = 0.25;
  const discountedTradingFee = baseTradingFee * (1 - subscription.currentTier.tradingFeeReduction / 100);

  return (
    <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Crown className="w-5 h-5 text-yellow-500" />
            {subscription.planName}
          </CardTitle>
          <Badge className={statusColor}>
            {subscription.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-center">
          <div>
            <div className="text-xs text-muted-foreground">Trading Fees</div>
            <div className="font-semibold text-green-600">
              {discountedTradingFee.toFixed(3)}%
            </div>
            <div className="text-xs text-muted-foreground">
              <span className="line-through">{baseTradingFee}%</span> 
              <span className="ml-1 text-green-600">
                -{subscription.currentTier.tradingFeeReduction}%
              </span>
            </div>
          </div>
          
          <div>
            <div className="text-xs text-muted-foreground">AI Credits</div>
            <div className="font-semibold text-purple-600">
              ${subscription.aiMarketplaceCredits}
            </div>
            <div className="text-xs text-muted-foreground">
              available
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Link href="/dex-trading" className="flex-1">
            <Button size="sm" variant="outline" className="w-full">
              <TrendingDown className="w-3 h-3 mr-1" />
              Trade
            </Button>
          </Link>
          <Link href="/subscription-dashboard" className="flex-1">
            <Button size="sm" variant="outline" className="w-full">
              <Zap className="w-3 h-3 mr-1" />
              Manage
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}