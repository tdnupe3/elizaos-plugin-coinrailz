import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, CreditCard, Calendar, TrendingUp, ExternalLink } from "lucide-react";
import { useLocation } from "wouter";

interface Subscription {
  id: number;
  bundleId: string;
  bundleName: string;
  tier: string;
  status: string;
  creditsTotal: number;
  creditsUsed: number;
  creditsRemaining: number;
  monthlyPrice: string;
  currentPeriodEnd: string;
  nextBillingDate: string;
  email: string;
  stripeCustomerId: string;
}

interface UsageRecord {
  id: number;
  serviceSlug: string;
  endpoint: string;
  creditsDeducted: number;
  requestTimestamp: string;
  responseStatus: string;
}

export default function SubscriptionManagementPage() {
  const [, setLocation] = useLocation();

  const { data: subscriptions, isLoading: subsLoading } = useQuery<{ subscriptions: Subscription[] }>({
    queryKey: ["/api/subscriptions/me"],
  });

  const activeSubscription = subscriptions?.subscriptions?.find(s => s.status === 'active');

  const { data: usageData, isLoading: usageLoading } = useQuery<{ usage: UsageRecord[] }>({
    queryKey: ["/api/subscriptions/usage", activeSubscription?.id],
    enabled: !!activeSubscription,
  });

  if (subsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!subscriptions || subscriptions.subscriptions.length === 0) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold">No Active Subscriptions</h1>
          <p className="text-muted-foreground">
            You don't have any active bundle subscriptions yet.
          </p>
          <Button onClick={() => setLocation('/bundles')} data-testid="button-browse-bundles">
            Browse Service Bundles
          </Button>
        </div>
      </div>
    );
  }

  const sub = activeSubscription || subscriptions.subscriptions[0];
  const creditsUsedPercent = (sub.creditsUsed / sub.creditsTotal) * 100;

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">My Subscription</h1>
        <Button variant="outline" onClick={() => setLocation('/bundles')}>
          Browse Bundles
        </Button>
      </div>

      {/* Subscription Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{sub.bundleName}</CardTitle>
              <CardDescription className="capitalize">{sub.tier} Tier</CardDescription>
            </div>
            <Badge variant={sub.status === 'active' ? 'default' : 'secondary'} data-testid="badge-status">
              {sub.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-primary/10 rounded-lg">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Monthly Price</p>
                <p className="text-xl font-bold" data-testid="text-monthly-price">${sub.monthlyPrice}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Credits Remaining</p>
                <p className="text-xl font-bold" data-testid="text-credits-remaining">
                  {sub.creditsRemaining.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Next Billing</p>
                <p className="text-sm font-semibold" data-testid="text-next-billing">
                  {new Date(sub.nextBillingDate).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Credit Usage</p>
              <p className="text-sm text-muted-foreground">
                {sub.creditsUsed.toLocaleString()} / {sub.creditsTotal.toLocaleString()} used
              </p>
            </div>
            <Progress value={creditsUsedPercent} className="h-2" data-testid="progress-credits" />
            <p className="text-xs text-muted-foreground mt-1">
              {creditsUsedPercent.toFixed(1)}% of monthly credits used
            </p>
          </div>

          <div className="border-t pt-4">
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => {
                // Open Stripe customer portal
                window.open(
                  `https://billing.stripe.com/p/login/test_PLACEHOLDER`,
                  '_blank'
                );
              }}
              data-testid="button-manage-billing"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Manage Billing & Cancel Subscription
            </Button>
            <p className="text-xs text-center text-muted-foreground mt-2">
              Opens Stripe Customer Portal
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Usage History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Usage</CardTitle>
          <CardDescription>Your service call history for this billing period</CardDescription>
        </CardHeader>
        <CardContent>
          {usageLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !usageData || usageData.usage.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No usage recorded yet</p>
          ) : (
            <div className="space-y-3">
              {usageData.usage.slice(0, 10).map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                  data-testid={`usage-record-${record.id}`}
                >
                  <div>
                    <p className="font-medium text-sm">
                      {record.serviceSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(record.requestTimestamp).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      -{record.creditsDeducted} credits
                    </p>
                    <Badge variant={record.responseStatus.startsWith('2') ? 'default' : 'destructive'}>
                      {record.responseStatus}
                    </Badge>
                  </div>
                </div>
              ))}
              {usageData.usage.length > 10 && (
                <p className="text-center text-sm text-muted-foreground">
                  Showing 10 of {usageData.usage.length} recent calls
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
