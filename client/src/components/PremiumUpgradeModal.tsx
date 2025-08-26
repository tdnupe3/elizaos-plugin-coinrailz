import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Crown, 
  Star, 
  CheckCircle, 
  TrendingUp,
  Zap,
  Shield,
  BarChart3,
  Headphones,
  ArrowRight,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SubscriptionPaymentFlow } from './SubscriptionPaymentFlow';

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

interface PremiumUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  triggerFeature?: string; // What premium feature triggered the modal
  title?: string;
  description?: string;
}

export function PremiumUpgradeModal({ 
  isOpen, 
  onClose, 
  onSuccess,
  triggerFeature,
  title = "Upgrade to Premium",
  description = "Unlock advanced features and save on trading fees with our premium plans"
}: PremiumUpgradeModalProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<string>('pro');
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('yearly');
  const [showPayment, setShowPayment] = useState(false);

  // Fetch available subscription plans
  const { data: plans = [] } = useQuery<SubscriptionPlan[]>({
    queryKey: ['/api/subscription-tiers'],
    staleTime: 5 * 60 * 1000,
  });

  // Filter out free plan and get paid plans
  const paidPlans = plans.filter(plan => plan.id !== 'free');
  const selectedPlan = plans.find(plan => plan.id === selectedPlanId);

  const handleSelectPlan = (planId: string) => {
    setSelectedPlanId(planId);
    setShowPayment(true);
  };

  const handlePaymentSuccess = () => {
    setShowPayment(false);
    onSuccess?.();
    onClose();
  };

  const handleBackToPlans = () => {
    setShowPayment(false);
  };

  const getPlanIcon = (planId: string) => {
    switch (planId) {
      case 'starter': return <Zap className="w-5 h-5" />;
      case 'pro': return <Crown className="w-5 h-5" />;
      case 'enterprise': return <Shield className="w-5 h-5" />;
      default: return <Star className="w-5 h-5" />;
    }
  };

  const getPlanColor = (planId: string) => {
    switch (planId) {
      case 'starter': return 'text-blue-600 bg-blue-100 dark:bg-blue-900';
      case 'pro': return 'text-purple-600 bg-purple-100 dark:bg-purple-900';
      case 'enterprise': return 'text-amber-600 bg-amber-100 dark:bg-amber-900';
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-900';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Crown className="w-6 h-6 text-yellow-500" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-base">
            {description}
            {triggerFeature && (
              <span className="block mt-2 text-sm font-medium text-blue-600">
                You need a premium plan to access: {triggerFeature}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {!showPayment ? (
          <div className="space-y-6">
            {/* Billing Period Toggle */}
            <div className="flex justify-center">
              <Tabs value={billingPeriod} onValueChange={(value) => setBillingPeriod(value as 'monthly' | 'yearly')}>
                <TabsList className="grid w-full grid-cols-2 max-w-md">
                  <TabsTrigger value="monthly">Monthly</TabsTrigger>
                  <TabsTrigger value="yearly" className="flex items-center gap-2">
                    Yearly
                    <Badge variant="secondary" className="text-xs">Save 20%</Badge>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Premium Benefits Highlight */}
            <Card className="border-yellow-200 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-950 dark:to-amber-950">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Star className="w-5 h-5 text-yellow-500" />
                  <h3 className="font-semibold">Premium Benefits</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-500" />
                    <span>Lower trading fees</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-blue-500" />
                    <span>Advanced analytics</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Headphones className="w-4 h-4 text-purple-500" />
                    <span>Priority support</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-orange-500" />
                    <span>AI marketplace credits</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Plan Selection */}
            <div className="grid md:grid-cols-3 gap-4">
              {paidPlans.map((plan, index) => {
                const price = billingPeriod === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
                const monthlyEquivalent = billingPeriod === 'yearly' ? plan.yearlyPrice / 12 : plan.monthlyPrice;
                const isPopular = plan.id === 'pro';
                const isSelected = selectedPlanId === plan.id;
                
                // Calculate fee savings
                const standardTradingFee = 0.25;
                const standardCrossChainFee = 0.5;
                const discountedTradingFee = standardTradingFee * (1 - plan.tradingFeeReduction / 100);
                const discountedCrossChainFee = standardCrossChainFee * (1 - plan.crossChainFeeReduction / 100);

                return (
                  <Card 
                    key={plan.id}
                    className={cn(
                      "relative cursor-pointer transition-all duration-200 hover:shadow-lg",
                      isPopular && "border-purple-500 border-2 shadow-purple-100 dark:shadow-purple-900",
                      isSelected && "ring-2 ring-blue-500",
                      "hover:scale-105"
                    )}
                    onClick={() => setSelectedPlanId(plan.id)}
                  >
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-10">
                        <Badge className="bg-purple-500 text-white px-3 py-1">
                          <Star className="w-3 h-3 mr-1" />
                          Most Popular
                        </Badge>
                      </div>
                    )}

                    <CardHeader className="text-center">
                      <div className={cn("w-12 h-12 mx-auto rounded-full flex items-center justify-center", getPlanColor(plan.id))}>
                        {getPlanIcon(plan.id)}
                      </div>
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                      <CardDescription>
                        <div className="text-2xl font-bold text-foreground">
                          ${monthlyEquivalent.toFixed(2)}
                          <span className="text-sm font-normal text-muted-foreground">/month</span>
                        </div>
                        {billingPeriod === 'yearly' && (
                          <div className="text-sm text-green-600 font-medium">
                            ${price.toFixed(2)} billed yearly
                          </div>
                        )}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-3">
                      {/* Fee Savings */}
                      <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <div className="text-sm font-medium text-green-700 dark:text-green-300">
                          Trading Fees: {discountedTradingFee.toFixed(3)}%
                        </div>
                        <div className="text-xs text-green-600 dark:text-green-400">
                          Save {plan.tradingFeeReduction}% vs {standardTradingFee}% standard
                        </div>
                      </div>

                      {/* Key Features */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span>{plan.tradingFeeReduction}% fee reduction</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span>${plan.aiMarketplaceCredits} AI credits</span>
                        </div>
                        {plan.features.slice(0, 3).map((feature, featureIndex) => (
                          <div key={featureIndex} className="flex items-center gap-2 text-sm">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span>{feature}</span>
                          </div>
                        ))}
                        {plan.features.length > 3 && (
                          <div className="text-xs text-muted-foreground">
                            +{plan.features.length - 3} more features
                          </div>
                        )}
                      </div>
                    </CardContent>

                    <CardFooter>
                      <Button 
                        className="w-full" 
                        variant={isSelected ? "default" : "outline"}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectPlan(plan.id);
                        }}
                      >
                        {isSelected ? "Selected" : "Choose Plan"}
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>

            {/* Trust Indicators */}
            <div className="flex items-center justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                <span>Secure payments</span>
              </div>
              <div className="flex items-center gap-2">
                <X className="w-4 h-4" />
                <span>Cancel anytime</span>
              </div>
              <div className="flex items-center gap-2">
                <Headphones className="w-4 h-4" />
                <span>24/7 support</span>
              </div>
            </div>
          </div>
        ) : (
          selectedPlan && (
            <div className="space-y-4">
              {/* Selected Plan Summary */}
              <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{selectedPlan.name} Plan</h3>
                      <p className="text-sm text-muted-foreground">
                        {billingPeriod === 'yearly' ? 'Yearly' : 'Monthly'} billing
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold">
                        ${(billingPeriod === 'yearly' ? selectedPlan.yearlyPrice : selectedPlan.monthlyPrice).toFixed(2)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {billingPeriod === 'yearly' ? 'per year' : 'per month'}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Payment Flow */}
              <SubscriptionPaymentFlow
                plan={selectedPlan}
                billingPeriod={billingPeriod}
                onSuccess={handlePaymentSuccess}
                onCancel={handleBackToPlans}
              />

              <Button variant="outline" onClick={handleBackToPlans} className="w-full">
                ← Back to Plans
              </Button>
            </div>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}