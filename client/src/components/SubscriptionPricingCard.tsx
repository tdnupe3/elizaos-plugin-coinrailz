import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Star, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SubscriptionPlan {
  id: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  yearlyDiscount: number;
  tradingFeeReduction: number;
  crossChainFeeReduction: number;
  aiMarketplaceCredits: number;
  features: string[];
}

interface SubscriptionPricingCardProps {
  plan: SubscriptionPlan;
  isPopular?: boolean;
  isCurrentPlan?: boolean;
  billingPeriod: 'monthly' | 'yearly';
  onSelectPlan: (planId: string, billingPeriod: 'monthly' | 'yearly') => void;
  loading?: boolean;
}

export function SubscriptionPricingCard({
  plan,
  isPopular = false,
  isCurrentPlan = false,
  billingPeriod,
  onSelectPlan,
  loading = false
}: SubscriptionPricingCardProps) {
  const price = billingPeriod === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
  const monthlyEquivalent = billingPeriod === 'yearly' ? plan.yearlyPrice / 12 : plan.monthlyPrice;
  
  // Calculate actual fee rates with discounts
  const standardTradingFee = 0.25;
  const standardCrossChainFee = 0.5;
  const discountedTradingFee = standardTradingFee * (1 - plan.tradingFeeReduction / 100);
  const discountedCrossChainFee = standardCrossChainFee * (1 - plan.crossChainFeeReduction / 100);

  const handleSelectPlan = () => {
    if (!isCurrentPlan && !loading) {
      onSelectPlan(plan.id, billingPeriod);
    }
  };

  return (
    <Card className={cn(
      "relative transition-all duration-200 hover:shadow-lg",
      isPopular && "border-blue-500 border-2 shadow-blue-100",
      isCurrentPlan && "border-green-500 bg-green-50 dark:bg-green-950"
    )}>
      {isPopular && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <Badge variant="default" className="bg-blue-500 text-white px-3 py-1">
            <Star className="w-3 h-3 mr-1" />
            Most Popular
          </Badge>
        </div>
      )}
      
      {isCurrentPlan && (
        <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
          <Badge variant="outline" className="bg-green-500 text-white border-green-500 px-3 py-1">
            <CheckCircle className="w-3 h-3 mr-1" />
            Current Plan
          </Badge>
        </div>
      )}

      <CardHeader className="text-center pb-4">
        <CardTitle className="text-xl font-bold">{plan.name}</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          {plan.id === 'free' ? 'Get started with basic trading' : 
           plan.id === 'starter' ? 'Perfect for regular traders' :
           plan.id === 'pro' ? 'Advanced features for active traders' :
           'Complete solution for institutions'}
        </CardDescription>
        
        <div className="mt-4">
          {plan.id === 'free' ? (
            <div className="text-3xl font-bold text-green-600">Free</div>
          ) : (
            <>
              <div className="text-3xl font-bold">
                ${monthlyEquivalent.toFixed(2)}
                <span className="text-lg font-normal text-muted-foreground">/month</span>
              </div>
              {billingPeriod === 'yearly' && plan.yearlyDiscount > 0 && (
                <div className="text-sm text-green-600 font-medium">
                  Save {plan.yearlyDiscount}% annually
                </div>
              )}
            </>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Fee Savings Highlight */}
        {plan.tradingFeeReduction > 0 && (
          <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <span className="font-medium text-blue-700 dark:text-blue-300">Fee Savings</span>
            </div>
            <div className="text-sm space-y-1">
              <div>Trading: {standardTradingFee}% → <span className="font-bold text-green-600">{discountedTradingFee}%</span></div>
              <div>Cross-chain: {standardCrossChainFee}% → <span className="font-bold text-green-600">{discountedCrossChainFee}%</span></div>
            </div>
          </div>
        )}

        {/* AI Marketplace Credits */}
        {plan.aiMarketplaceCredits > 0 && (
          <div className="bg-purple-50 dark:bg-purple-950 p-3 rounded-lg border border-purple-200 dark:border-purple-800">
            <div className="font-medium text-purple-700 dark:text-purple-300">
              ${plan.aiMarketplaceCredits} AI Credits/month
            </div>
            <div className="text-sm text-purple-600 dark:text-purple-400">
              Use for AI marketplace services
            </div>
          </div>
        )}

        {/* Features List */}
        <div className="space-y-2">
          {plan.features.map((feature, index) => (
            <div key={index} className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
              <span className="text-sm">{feature}</span>
            </div>
          ))}
        </div>
      </CardContent>

      <CardFooter>
        <Button
          onClick={handleSelectPlan}
          disabled={isCurrentPlan || loading}
          className={cn(
            "w-full",
            isPopular && "bg-blue-600 hover:bg-blue-700",
            isCurrentPlan && "bg-green-600 hover:bg-green-600"
          )}
          variant={isPopular ? "default" : "outline"}
        >
          {loading ? "Processing..." :
           isCurrentPlan ? "Current Plan" :
           plan.id === 'free' ? "Continue Free" :
           `Upgrade to ${plan.name}`}
        </Button>
      </CardFooter>
    </Card>
  );
}