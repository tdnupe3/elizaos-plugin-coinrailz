import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';

export interface SubscriptionStatus {
  isActive: boolean;
  planId: string;
  planName: string;
  tier: 'free' | 'starter' | 'pro' | 'enterprise';
  tradingFeeReduction: number;
  crossChainFeeReduction: number;
  aiMarketplaceCredits: number;
  currentPeriodEnd: string;
  daysUntilRenewal: number;
  status: 'active' | 'cancelled' | 'expired' | 'pending';
  cancelAtPeriodEnd: boolean;
  paymentMethod?: string;
  billingPeriod?: 'monthly' | 'yearly';
  features: string[];
}

export interface SubscriptionBenefits {
  tradingFeeReduction: string;
  crossChainFeeReduction: string;
  aiCredits: string;
  planName: string;
  isActive: boolean;
}

/**
 * Hook to get user's subscription status and benefits
 * Automatically handles guest users and provides caching
 */
export function useSubscriptionStatus() {
  const { isAuthenticated } = useAuth();

  const {
    data: status,
    isLoading: statusLoading,
    error: statusError
  } = useQuery<SubscriptionStatus>({
    queryKey: ['/api/user/subscription-status'],
    enabled: isAuthenticated,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 1,
  });

  const {
    data: benefits,
    isLoading: benefitsLoading,
    error: benefitsError
  } = useQuery<SubscriptionBenefits>({
    queryKey: ['/api/user/subscription-benefits'],
    enabled: isAuthenticated,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 1,
  });

  // Provide default values for guests
  const defaultStatus: SubscriptionStatus = {
    isActive: true,
    planId: 'free',
    planName: 'Guest',
    tier: 'free',
    tradingFeeReduction: 0,
    crossChainFeeReduction: 0,
    aiMarketplaceCredits: 0,
    currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    daysUntilRenewal: 365,
    status: 'active',
    cancelAtPeriodEnd: false,
    features: ['Basic Trading']
  };

  const defaultBenefits: SubscriptionBenefits = {
    tradingFeeReduction: 'None',
    crossChainFeeReduction: 'None',
    aiCredits: 'None',
    planName: 'Guest',
    isActive: false
  };

  return {
    // Status data
    status: isAuthenticated ? status : defaultStatus,
    benefits: isAuthenticated ? benefits : defaultBenefits,
    
    // Loading states
    isLoading: isAuthenticated && (statusLoading || benefitsLoading),
    
    // Error states
    error: statusError || benefitsError,
    
    // Convenience flags
    isAuthenticated,
    isGuest: !isAuthenticated,
    hasActivePlan: isAuthenticated ? (status?.isActive && status?.planId !== 'free') : false,
    planTier: isAuthenticated ? status?.tier : 'free',
    tradingDiscount: isAuthenticated ? status?.tradingFeeReduction || 0 : 0,
    crossChainDiscount: isAuthenticated ? status?.crossChainFeeReduction || 0 : 0,
    
    // Utility functions
    hasFeature: (feature: string) => {
      if (!isAuthenticated || !status) return false;
      return status.features.includes(feature);
    },
    
    canUpgrade: () => {
      if (!isAuthenticated) return true; // Guests can always sign up
      return !status || status.planId === 'free' || status.tier !== 'enterprise';
    },
    
    getUpgradeMessage: () => {
      if (!isAuthenticated) return 'Sign up to save on trading fees';
      if (!status || status.planId === 'free') return 'Upgrade to save on trading fees';
      if (status.tier === 'starter') return 'Upgrade to Pro for bigger savings';
      if (status.tier === 'pro') return 'Upgrade to Enterprise for maximum savings';
      return 'You have the best plan!';
    }
  };
}