import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Crown, Star, Shield, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SubscriptionStatus {
  isActive: boolean;
  planId: string;
  planName: string;
  tier: 'free' | 'starter' | 'pro' | 'enterprise';
  tradingFeeReduction: number;
  crossChainFeeReduction: number;
  aiMarketplaceCredits: number;
  status: 'active' | 'cancelled' | 'expired' | 'pending';
}

interface PremiumUserBadgeProps {
  variant?: 'compact' | 'full' | 'icon-only';
  showSavings?: boolean;
  showCredits?: boolean;
  className?: string;
}

export function PremiumUserBadge({ 
  variant = 'compact', 
  showSavings = false, 
  showCredits = false,
  className 
}: PremiumUserBadgeProps) {
  const { data: subscription } = useQuery<SubscriptionStatus>({
    queryKey: ['/api/user/subscription'],
    retry: false,
  });

  // Don't show badge for free users
  if (!subscription || !subscription.isActive || subscription.tier === 'free') {
    return null;
  }

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'starter': return <Zap className="w-3 h-3" />;
      case 'pro': return <Crown className="w-3 h-3" />;
      case 'enterprise': return <Shield className="w-3 h-3" />;
      default: return <Star className="w-3 h-3" />;
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'starter': return 'bg-blue-500 hover:bg-blue-600';
      case 'pro': return 'bg-purple-500 hover:bg-purple-600';
      case 'enterprise': return 'bg-amber-500 hover:bg-amber-600';
      default: return 'bg-gray-500 hover:bg-gray-600';
    }
  };

  const formatFeeReduction = (reduction: number) => {
    const standardFee = 0.25;
    const discountedFee = standardFee * (1 - reduction / 100);
    return `${discountedFee.toFixed(3)}%`;
  };

  if (variant === 'icon-only') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge 
              className={cn(
                "text-white border-0 px-2 py-1",
                getTierColor(subscription.tier),
                className
              )}
            >
              {getTierIcon(subscription.tier)}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-sm">
              <div className="font-semibold">{subscription.planName} Member</div>
              <div>Trading fees: {formatFeeReduction(subscription.tradingFeeReduction)}</div>
              <div>AI credits: ${subscription.aiMarketplaceCredits}/month</div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (variant === 'compact') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge 
              className={cn(
                "text-white border-0 px-2 py-1 gap-1",
                getTierColor(subscription.tier),
                className
              )}
            >
              {getTierIcon(subscription.tier)}
              <span className="text-xs font-medium">{subscription.planName}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-sm space-y-1">
              <div className="font-semibold">{subscription.planName} Benefits</div>
              <div className="text-green-400">• {subscription.tradingFeeReduction}% trading fee discount</div>
              <div className="text-blue-400">• ${subscription.aiMarketplaceCredits} AI credits/month</div>
              <div className="text-purple-400">• {subscription.crossChainFeeReduction}% cross-chain discount</div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Full variant with detailed savings info
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Badge 
        className={cn(
          "text-white border-0 px-2 py-1 gap-1",
          getTierColor(subscription.tier)
        )}
      >
        {getTierIcon(subscription.tier)}
        <span className="text-xs font-medium">{subscription.planName}</span>
      </Badge>
      
      {showSavings && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-green-600 font-medium">
            Fees: {formatFeeReduction(subscription.tradingFeeReduction)}
          </span>
          <span className="text-muted-foreground">
            (save {subscription.tradingFeeReduction}%)
          </span>
        </div>
      )}
      
      {showCredits && subscription.aiMarketplaceCredits > 0 && (
        <div className="flex items-center gap-1 text-xs">
          <Zap className="w-3 h-3 text-purple-500" />
          <span className="text-purple-600 font-medium">
            ${subscription.aiMarketplaceCredits} credits
          </span>
        </div>
      )}
    </div>
  );
}

// Premium benefits indicator for feature gates
export function PremiumFeatureGate({ 
  feature, 
  requiredTier, 
  children 
}: { 
  feature: string;
  requiredTier: 'starter' | 'pro' | 'enterprise';
  children: React.ReactNode;
}) {
  const { data: subscription } = useQuery<SubscriptionStatus>({
    queryKey: ['/api/user/subscription'],
    retry: false,
  });

  const tierLevels = { 'free': 0, 'starter': 1, 'pro': 2, 'enterprise': 3 };
  const userLevel = tierLevels[subscription?.tier || 'free'];
  const requiredLevel = tierLevels[requiredTier];

  const hasAccess = subscription?.isActive && userLevel >= requiredLevel;

  if (hasAccess) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      <div className="opacity-50 pointer-events-none">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-black/10 rounded">
        <Badge variant="secondary" className="gap-1">
          <Crown className="w-3 h-3" />
          {requiredTier}+ required
        </Badge>
      </div>
    </div>
  );
}

// Premium savings indicator for fee displays
export function PremiumSavingsIndicator({ 
  amount, 
  className 
}: { 
  amount: number;
  className?: string;
}) {
  const { data: subscription } = useQuery<SubscriptionStatus>({
    queryKey: ['/api/user/subscription'],
    retry: false,
  });

  if (!subscription?.isActive || subscription.tier === 'free') {
    return null;
  }

  const standardFee = amount * 0.0025; // 0.25%
  const discountedFee = amount * 0.0025 * (1 - subscription.tradingFeeReduction / 100);
  const savings = standardFee - discountedFee;

  if (savings <= 0) return null;

  return (
    <div className={cn("text-xs text-green-600 font-medium", className)}>
      You save ${savings.toFixed(2)} with {subscription.planName}
    </div>
  );
}