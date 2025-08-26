import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowUp, 
  ArrowDown, 
  Crown, 
  CreditCard, 
  Calendar,
  AlertTriangle,
  CheckCircle,
  X,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

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

interface CurrentSubscription {
  id: string;
  planId: string;
  planName: string;
  status: 'active' | 'cancelled' | 'expired' | 'pending';
  billingPeriod: 'monthly' | 'yearly';
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  amount: number;
}

interface SubscriptionChangeFlowProps {
  currentSubscription: CurrentSubscription;
  onClose: () => void;
  onSuccess: () => void;
}

export function SubscriptionChangeFlow({ currentSubscription, onClose, onSuccess }: SubscriptionChangeFlowProps) {
  const { toast } = useToast();
  const [selectedPlanId, setSelectedPlanId] = useState(currentSubscription.planId);
  const [selectedBillingPeriod, setSelectedBillingPeriod] = useState<'monthly' | 'yearly'>(currentSubscription.billingPeriod);
  const [changeType, setChangeType] = useState<'upgrade' | 'downgrade' | 'cancel' | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Fetch available plans
  const { data: plans = [] } = useQuery<SubscriptionPlan[]>({
    queryKey: ['/api/subscription-tiers'],
    staleTime: 5 * 60 * 1000,
  });

  // Calculate change details
  const selectedPlan = plans.find(p => p.id === selectedPlanId);
  const currentPlan = plans.find(p => p.id === currentSubscription.planId);
  
  const currentAmount = currentSubscription.amount;
  const newAmount = selectedPlan ? 
    (selectedBillingPeriod === 'yearly' ? selectedPlan.yearlyPrice : selectedPlan.monthlyPrice) : 0;
  
  const priceDifference = newAmount - currentAmount;
  const isUpgrade = priceDifference > 0;
  const isDowngrade = priceDifference < 0;
  const isPlanChange = selectedPlanId !== currentSubscription.planId;
  const isBillingChange = selectedBillingPeriod !== currentSubscription.billingPeriod;

  // Plan change mutation
  const changePlanMutation = useMutation({
    mutationFn: async () => {
      if (changeType === 'cancel') {
        return apiRequest('POST', '/api/cancel-subscription');
      } else {
        return apiRequest('POST', '/api/change-subscription', {
          newPlanId: selectedPlanId,
          newBillingPeriod: selectedBillingPeriod,
          changeType: isUpgrade ? 'upgrade' : 'downgrade'
        });
      }
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-subscription'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user/subscription'] });
      
      toast({
        title: changeType === 'cancel' ? "Subscription Cancelled" : "Plan Changed Successfully",
        description: data.message || "Your changes will take effect immediately.",
      });
      
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Change Failed",
        description: error.message || "Failed to change subscription",
        variant: "destructive",
      });
    },
  });

  const handleConfirmChange = () => {
    changePlanMutation.mutate();
  };

  const getChangeTypeFromSelection = () => {
    if (!isPlanChange && !isBillingChange) return null;
    if (isUpgrade) return 'upgrade';
    if (isDowngrade) return 'downgrade';
    return isBillingChange ? 'upgrade' : null; // Billing period changes are typically considered upgrades
  };

  const handlePreviewChange = () => {
    const type = getChangeTypeFromSelection();
    setChangeType(type);
    setShowConfirmation(true);
  };

  const getPlanTierLevel = (planId: string) => {
    const tiers = { 'free': 0, 'starter': 1, 'pro': 2, 'enterprise': 3 };
    return tiers[planId as keyof typeof tiers] || 0;
  };

  const isActualUpgrade = selectedPlanId !== currentSubscription.planId && 
    getPlanTierLevel(selectedPlanId) > getPlanTierLevel(currentSubscription.planId);
  const isActualDowngrade = selectedPlanId !== currentSubscription.planId && 
    getPlanTierLevel(selectedPlanId) < getPlanTierLevel(currentSubscription.planId);

  return (
    <div className="space-y-6">
      {/* Current Plan Summary */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-blue-600" />
            Current Plan: {currentSubscription.planName}
          </CardTitle>
          <CardDescription>
            ${currentSubscription.amount}/{currentSubscription.billingPeriod === 'yearly' ? 'year' : 'month'} • 
            Next billing: {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Plan Selection */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Choose New Plan</h3>
        <RadioGroup value={selectedPlanId} onValueChange={setSelectedPlanId}>
          <div className="grid gap-4">
            {plans.filter(plan => plan.id !== 'free').map((plan) => {
              const isCurrentPlan = plan.id === currentSubscription.planId;
              const monthlyPrice = selectedBillingPeriod === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
              
              return (
                <div key={plan.id} className="flex items-center space-x-2">
                  <RadioGroupItem value={plan.id} id={plan.id} disabled={isCurrentPlan} />
                  <Label htmlFor={plan.id} className="flex-1 cursor-pointer">
                    <Card className={`transition-all ${selectedPlanId === plan.id ? 'ring-2 ring-primary' : ''}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold">{plan.name}</h4>
                                {isCurrentPlan && <Badge>Current</Badge>}
                                {isActualUpgrade && plan.id === selectedPlanId && (
                                  <Badge className="bg-green-500">
                                    <ArrowUp className="w-3 h-3 mr-1" />
                                    Upgrade
                                  </Badge>
                                )}
                                {isActualDowngrade && plan.id === selectedPlanId && (
                                  <Badge variant="outline" className="text-orange-600">
                                    <ArrowDown className="w-3 h-3 mr-1" />
                                    Downgrade
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {plan.tradingFeeReduction}% fee reduction • ${plan.aiMarketplaceCredits} AI credits
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">
                              ${monthlyPrice.toFixed(2)}
                              <span className="text-sm font-normal">
                                /{selectedBillingPeriod === 'yearly' ? 'year' : 'month'}
                              </span>
                            </div>
                            {selectedBillingPeriod === 'yearly' && plan.yearlyDiscount > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                Save {plan.yearlyDiscount}%
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Label>
                </div>
              );
            })}
          </div>
        </RadioGroup>
      </div>

      {/* Billing Period Selection */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Billing Period</h3>
        <RadioGroup value={selectedBillingPeriod} onValueChange={(value: 'monthly' | 'yearly') => setSelectedBillingPeriod(value)}>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="monthly" id="monthly" />
              <Label htmlFor="monthly" className="flex-1 cursor-pointer">
                <Card className={`transition-all ${selectedBillingPeriod === 'monthly' ? 'ring-2 ring-primary' : ''}`}>
                  <CardContent className="p-4 text-center">
                    <Calendar className="w-5 h-5 mx-auto mb-2" />
                    <div className="font-semibold">Monthly</div>
                    <div className="text-sm text-muted-foreground">Pay monthly</div>
                  </CardContent>
                </Card>
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yearly" id="yearly" />
              <Label htmlFor="yearly" className="flex-1 cursor-pointer">
                <Card className={`transition-all ${selectedBillingPeriod === 'yearly' ? 'ring-2 ring-primary' : ''}`}>
                  <CardContent className="p-4 text-center">
                    <TrendingUp className="w-5 h-5 mx-auto mb-2" />
                    <div className="font-semibold">Yearly</div>
                    <div className="text-sm text-muted-foreground">Save up to 20%</div>
                  </CardContent>
                </Card>
              </Label>
            </div>
          </div>
        </RadioGroup>
      </div>

      {/* Change Summary */}
      {(isPlanChange || isBillingChange) && selectedPlan && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Change Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Current: {currentPlan?.name}</span>
                <span>${currentAmount}/{currentSubscription.billingPeriod === 'yearly' ? 'year' : 'month'}</span>
              </div>
              <div className="flex justify-between">
                <span>New: {selectedPlan.name}</span>
                <span>${newAmount}/{selectedBillingPeriod === 'yearly' ? 'year' : 'month'}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>
                  {priceDifference > 0 ? 'Additional charge:' : 'Credit applied:'}
                </span>
                <span className={priceDifference > 0 ? 'text-red-600' : 'text-green-600'}>
                  {priceDifference > 0 ? '+' : ''}${Math.abs(priceDifference).toFixed(2)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onClose} className="flex-1">
          Cancel
        </Button>
        
        {(isPlanChange || isBillingChange) && (
          <Button onClick={handlePreviewChange} className="flex-1">
            {isUpgrade ? (
              <>
                <ArrowUp className="w-4 h-4 mr-2" />
                Preview Upgrade
              </>
            ) : isDowngrade ? (
              <>
                <ArrowDown className="w-4 h-4 mr-2" />
                Preview Downgrade
              </>
            ) : (
              'Preview Change'
            )}
          </Button>
        )}
        
        <Button 
          variant="destructive" 
          onClick={() => {
            setChangeType('cancel');
            setShowConfirmation(true);
          }}
          className="flex-1"
        >
          <X className="w-4 h-4 mr-2" />
          Cancel Subscription
        </Button>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {changeType === 'cancel' ? 'Cancel Subscription' : 'Confirm Plan Change'}
            </DialogTitle>
            <DialogDescription>
              {changeType === 'cancel' ? (
                "Your subscription will remain active until the end of your current billing period."
              ) : (
                "Review your plan change details below."
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {changeType === 'cancel' ? (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Your subscription will be cancelled but remain active until {' '}
                  {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}.
                  You'll lose access to premium features after this date.
                </AlertDescription>
              </Alert>
            ) : selectedPlan && (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>New Plan:</span>
                  <span className="font-semibold">{selectedPlan.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>New Price:</span>
                  <span className="font-semibold">
                    ${newAmount}/{selectedBillingPeriod === 'yearly' ? 'year' : 'month'}
                  </span>
                </div>
                {priceDifference !== 0 && (
                  <div className="flex justify-between">
                    <span>
                      {priceDifference > 0 ? 'Prorated charge:' : 'Prorated credit:'}
                    </span>
                    <span className={`font-semibold ${priceDifference > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {priceDifference > 0 ? '+' : ''}${Math.abs(priceDifference).toFixed(2)}
                    </span>
                  </div>
                )}
                
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    {isUpgrade ? 
                      "Your upgrade will take effect immediately and you'll be charged the prorated amount." :
                      "Your downgrade will take effect at the end of your current billing period."
                    }
                  </AlertDescription>
                </Alert>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowConfirmation(false)} className="flex-1">
                Go Back
              </Button>
              <Button 
                onClick={handleConfirmChange} 
                disabled={changePlanMutation.isPending}
                className="flex-1"
                variant={changeType === 'cancel' ? 'destructive' : 'default'}
              >
                {changePlanMutation.isPending ? 'Processing...' : 
                 changeType === 'cancel' ? 'Confirm Cancellation' : 'Confirm Change'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}