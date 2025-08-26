import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Crown, Zap, TrendingDown, Shield, ArrowRight, Calendar } from 'lucide-react';
import { Link } from 'wouter';

interface SubscriptionBenefits {
  planId: string;
  planName: string;
  tier: 'free' | 'starter' | 'pro' | 'enterprise';
  isActive: boolean;
  tradingFeeReduction: number;
  crossChainFeeReduction: number;
  aiMarketplaceCredits: number;
  currentPeriodEnd: Date;
  daysUntilRenewal: number;
  status: 'active' | 'cancelled' | 'expired' | 'pending';
  features: string[];
}

interface UsageStats {
  tradingVolume: number;
  tradingFeesSaved: number;
  crossChainFeesSaved: number;
  aiCreditsUsed: number;
  totalSavings: number;
}

export function SubscriptionBenefitsWidget() {
  const { data: benefits } = useQuery<SubscriptionBenefits>({
    queryKey: ['/api/user/subscription-benefits'],
    retry: false,
  });

  const { data: usage } = useQuery<UsageStats>({
    queryKey: ['/api/user/subscription-usage'],
    retry: false,
  });

  if (!benefits || !benefits.isActive || benefits.tier === 'free') {
    return (
      <Card className="border-2 border-dashed border-muted">
        <CardHeader className="text-center pb-3">
          <CardTitle className="text-lg flex items-center gap-2 justify-center">
            <Crown className="w-5 h-5 text-muted-foreground" />
            Premium Benefits
          </CardTitle>
          <CardDescription>
            Unlock lower fees and exclusive features with a premium subscription
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="font-medium">Trading Fees</div>
              <div className="text-muted-foreground">0.25%</div>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="font-medium">AI Credits</div>
              <div className="text-muted-foreground">$0/month</div>
            </div>
          </div>
          
          <Link href="/subscription">
            <Button className="w-full">
              <Crown className="w-4 h-4 mr-2" />
              Upgrade to Premium
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'starter': return <Zap className="w-5 h-5 text-blue-500" />;
      case 'pro': return <Crown className="w-5 h-5 text-purple-500" />;
      case 'enterprise': return <Shield className="w-5 h-5 text-amber-500" />;
      default: return <Crown className="w-5 h-5" />;
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'starter': return 'border-blue-200 bg-blue-50 dark:bg-blue-950';
      case 'pro': return 'border-purple-200 bg-purple-50 dark:bg-purple-950';
      case 'enterprise': return 'border-amber-200 bg-amber-50 dark:bg-amber-950';
      default: return 'border-gray-200 bg-gray-50 dark:bg-gray-950';
    }
  };

  const creditsUsagePercent = benefits.aiMarketplaceCredits > 0 
    ? Math.min((usage?.aiCreditsUsed || 0) / benefits.aiMarketplaceCredits * 100, 100)
    : 0;

  return (
    <Card className={`${getTierColor(benefits.tier)}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {getTierIcon(benefits.tier)}
            {benefits.planName} Member
          </CardTitle>
          <Badge 
            variant={benefits.status === 'active' ? 'default' : 'secondary'}
            className="capitalize"
          >
            {benefits.status}
          </Badge>
        </div>
        <CardDescription>
          {benefits.daysUntilRenewal > 0 && (
            <div className="flex items-center gap-1 text-xs">
              <Calendar className="w-3 h-3" />
              Renews in {benefits.daysUntilRenewal} days
            </div>
          )}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Current Period Savings */}
        {usage && usage.totalSavings > 0 && (
          <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="text-sm font-medium text-green-800 dark:text-green-200">
              Monthly Savings
            </div>
            <div className="text-lg font-bold text-green-600 dark:text-green-400">
              ${usage.totalSavings.toFixed(2)}
            </div>
            <div className="text-xs text-green-600 dark:text-green-400">
              Trading: ${usage.tradingFeesSaved.toFixed(2)} • Cross-chain: ${usage.crossChainFeesSaved.toFixed(2)}
            </div>
          </div>
        )}

        {/* Benefits Grid */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="p-3 bg-white/50 dark:bg-black/50 rounded-lg border">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-3 h-3 text-green-500" />
              <span className="font-medium">Trading Fees</span>
            </div>
            <div className="text-green-600 font-semibold">
              {(0.25 * (1 - benefits.tradingFeeReduction / 100)).toFixed(3)}%
            </div>
            <div className="text-xs text-muted-foreground">
              {benefits.tradingFeeReduction}% discount
            </div>
          </div>
          
          <div className="p-3 bg-white/50 dark:bg-black/50 rounded-lg border">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-3 h-3 text-purple-500" />
              <span className="font-medium">AI Credits</span>
            </div>
            <div className="text-purple-600 font-semibold">
              ${benefits.aiMarketplaceCredits}
            </div>
            <div className="text-xs text-muted-foreground">
              per month
            </div>
          </div>
        </div>

        {/* AI Credits Usage Progress */}
        {benefits.aiMarketplaceCredits > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span>AI Credits Used</span>
              <span>{usage?.aiCreditsUsed || 0} / {benefits.aiMarketplaceCredits}</span>
            </div>
            <Progress value={creditsUsagePercent} className="h-2" />
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-2">
          <Link href="/dex-trading">
            <Button variant="outline" size="sm" className="w-full">
              <TrendingDown className="w-3 h-3 mr-1" />
              Trade
            </Button>
          </Link>
          <Link href="/subscription-dashboard">
            <Button variant="outline" size="sm" className="w-full">
              <ArrowRight className="w-3 h-3 mr-1" />
              Manage
            </Button>
          </Link>
        </div>

        {/* Key Features */}
        <div className="pt-2 border-t">
          <div className="text-xs font-medium text-muted-foreground mb-2">Premium Features</div>
          <div className="space-y-1">
            {benefits.features.slice(0, 3).map((feature, index) => (
              <div key={index} className="text-xs flex items-center gap-2">
                <div className="w-1 h-1 bg-green-500 rounded-full" />
                {feature}
              </div>
            ))}
            {benefits.features.length > 3 && (
              <div className="text-xs text-muted-foreground">
                +{benefits.features.length - 3} more features
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}