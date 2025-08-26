import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  CreditCard, 
  Calendar, 
  TrendingDown, 
  Zap, 
  Settings, 
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  BarChart3,
  Wallet,
  Edit
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Link } from 'wouter';
import { SubscriptionChangeFlow } from '@/components/SubscriptionChangeFlow';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface SubscriptionDetails {
  id: string;
  planId: string;
  planName: string;
  status: 'active' | 'cancelled' | 'expired' | 'pending';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  billingPeriod: 'monthly' | 'yearly';
  nextBillingDate: string;
  amount: number;
  currency: string;
}

interface UsageStats {
  tradingVolume: number;
  feeSavings: number;
  aiCreditsUsed: number;
  aiCreditsRemaining: number;
  transactionCount: number;
}

interface BillingHistory {
  id: string;
  date: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed';
  description: string;
  invoiceUrl?: string;
}

export default function SubscriptionDashboard() {
  const { toast } = useToast();
  const [showChangeFlow, setShowChangeFlow] = useState(false);

  // Fetch subscription details
  const { data: subscription, isLoading: subscriptionLoading } = useQuery<SubscriptionDetails>({
    queryKey: ['/api/my-subscription'],
    staleTime: 1 * 60 * 1000, // 1 minute
  });

  // Fetch usage statistics
  const { data: usage, isLoading: usageLoading } = useQuery<UsageStats>({
    queryKey: ['/api/subscription/usage'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch billing history
  const { data: billingHistory = [], isLoading: billingLoading } = useQuery<BillingHistory[]>({
    queryKey: ['/api/subscription/billing-history'],
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Cancel subscription mutation
  const cancelSubscriptionMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/cancel-subscription');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-subscription'] });
      toast({
        title: "Subscription Cancelled",
        description: "Your subscription will remain active until the end of your billing period.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Cancellation Failed",
        description: error.message || "Failed to cancel subscription",
        variant: "destructive",
      });
    },
  });

  // Reactivate subscription mutation
  const reactivateSubscriptionMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/reactivate-subscription');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/my-subscription'] });
      toast({
        title: "Subscription Reactivated",
        description: "Your subscription will continue as normal.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Reactivation Failed",
        description: error.message || "Failed to reactivate subscription",
        variant: "destructive",
      });
    },
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'cancelled': return 'bg-yellow-500';
      case 'expired': return 'bg-red-500';
      case 'pending': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getBillingStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'text-green-600';
      case 'pending': return 'text-yellow-600';
      case 'failed': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  if (subscriptionLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center py-12">
          <Wallet className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">No Active Subscription</h2>
          <p className="text-muted-foreground mb-6">
            You're currently on the free plan. Upgrade to unlock premium features and lower fees.
          </p>
          <Link href="/subscription">
            <Button size="lg">
              View Subscription Plans
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Subscription Dashboard</h1>
        <p className="text-muted-foreground">
          Manage your subscription, view usage, and track savings
        </p>
      </div>

      {/* Subscription Status Alert */}
      {subscription.status === 'cancelled' && (
        <Alert className="mb-6 border-yellow-200 bg-yellow-50 dark:bg-yellow-950">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Your subscription is cancelled and will end on {formatDate(subscription.currentPeriodEnd)}.
            You can reactivate it to continue enjoying premium benefits.
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-3"
              onClick={() => reactivateSubscriptionMutation.mutate()}
              disabled={reactivateSubscriptionMutation.isPending}
            >
              Reactivate Subscription
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Current Plan Overview */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Current Plan
                  </CardTitle>
                  <CardDescription>
                    Your active subscription details
                  </CardDescription>
                </div>
                <Badge className={getStatusColor(subscription.status)}>
                  {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold text-lg mb-1">{subscription.planName}</h3>
                  <p className="text-muted-foreground text-sm mb-3">
                    {subscription.billingPeriod === 'yearly' ? 'Annual' : 'Monthly'} billing
                  </p>
                  <div className="text-2xl font-bold">
                    ${subscription.amount}
                    <span className="text-sm font-normal text-muted-foreground">
                      /{subscription.billingPeriod === 'yearly' ? 'year' : 'month'}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">
                      Next billing: {formatDate(subscription.nextBillingDate)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">
                      Period: {formatDate(subscription.currentPeriodStart)} - {formatDate(subscription.currentPeriodEnd)}
                    </span>
                  </div>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="flex gap-3">
                <Button 
                  variant="outline"
                  onClick={() => setShowChangeFlow(true)}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Change Plan
                </Button>
                
                {subscription.status === 'active' && !subscription.cancelAtPeriodEnd && (
                  <Button 
                    variant="destructive" 
                    onClick={() => cancelSubscriptionMutation.mutate()}
                    disabled={cancelSubscriptionMutation.isPending}
                  >
                    Cancel Subscription
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Usage Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Usage & Savings
              </CardTitle>
              <CardDescription>
                Track your monthly activity and fee savings
              </CardDescription>
            </CardHeader>
            <CardContent>
              {usageLoading ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-20 bg-gray-200 rounded" />
                  <div className="h-20 bg-gray-200 rounded" />
                </div>
              ) : usage ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Trading Volume</span>
                        <span className="text-sm text-muted-foreground">
                          ${usage.tradingVolume.toLocaleString()}
                        </span>
                      </div>
                      <div className="text-lg font-semibold text-green-600">
                        ${usage.feeSavings.toFixed(2)} saved
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Compared to standard fees
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Transactions</span>
                        <span className="text-sm text-muted-foreground">
                          {usage.transactionCount}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">AI Credits</span>
                      <span className="text-sm text-muted-foreground">
                        {usage.aiCreditsRemaining} / {usage.aiCreditsUsed + usage.aiCreditsRemaining}
                      </span>
                    </div>
                    <Progress 
                      value={(usage.aiCreditsUsed / (usage.aiCreditsUsed + usage.aiCreditsRemaining)) * 100} 
                      className="mb-2"
                    />
                    <p className="text-xs text-muted-foreground">
                      ${usage.aiCreditsRemaining} remaining this month
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">No usage data available</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/dex-trading">
                <Button variant="outline" className="w-full justify-start">
                  <TrendingDown className="w-4 h-4 mr-2" />
                  Start Trading
                </Button>
              </Link>
              
              <Link href="/ai-marketplace">
                <Button variant="outline" className="w-full justify-start">
                  <Zap className="w-4 h-4 mr-2" />
                  AI Marketplace
                </Button>
              </Link>
              
              <Link href="/subscription">
                <Button variant="outline" className="w-full justify-start">
                  <Settings className="w-4 h-4 mr-2" />
                  Manage Plan
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Billing History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Billing</CardTitle>
            </CardHeader>
            <CardContent>
              {billingLoading ? (
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-gray-200 rounded" />
                  <div className="h-4 bg-gray-200 rounded" />
                  <div className="h-4 bg-gray-200 rounded" />
                </div>
              ) : billingHistory.length > 0 ? (
                <div className="space-y-3">
                  {billingHistory.slice(0, 3).map((bill) => (
                    <div key={bill.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                      <div>
                        <div className="text-sm font-medium">${bill.amount}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(bill.date)}
                        </div>
                      </div>
                      <Badge variant="outline" className={getBillingStatusColor(bill.status)}>
                        {bill.status}
                      </Badge>
                    </div>
                  ))}
                  
                  {billingHistory.length > 3 && (
                    <Button variant="ghost" size="sm" className="w-full mt-2">
                      View All History
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No billing history</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Subscription Change Dialog */}
      <Dialog open={showChangeFlow} onOpenChange={setShowChangeFlow}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Change Your Subscription</DialogTitle>
          </DialogHeader>
          <SubscriptionChangeFlow
            currentSubscription={subscription}
            onClose={() => setShowChangeFlow(false)}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['/api/my-subscription'] });
              setShowChangeFlow(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}