import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Calendar as CalendarIcon,
  Play, 
  RefreshCw, 
  BarChart3, 
  Users, 
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { format } from 'date-fns';

interface BillingAnalytics {
  period: {
    startDate: string;
    endDate: string;
  };
  totalSubscriptions: number;
  activeSubscriptions: number;
  cancelledSubscriptions: number;
  expiredSubscriptions: number;
  pendingSubscriptions: number;
  totalRevenue: number;
  byPaymentMethod: {
    stripe: number;
    usdc: number;
    paypal: number;
  };
  byBillingPeriod: {
    monthly: number;
    yearly: number;
  };
}

export function AdminBillingPanel() {
  const { toast } = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState('30');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();

  // Fetch billing analytics
  const { data: analytics, isLoading: analyticsLoading, refetch } = useQuery<BillingAnalytics>({
    queryKey: ['/api/admin/billing-analytics', selectedPeriod, customStartDate, customEndDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      if (selectedPeriod === 'custom' && customStartDate && customEndDate) {
        params.append('startDate', customStartDate.toISOString());
        params.append('endDate', customEndDate.toISOString());
      } else {
        const days = parseInt(selectedPeriod);
        const endDate = new Date();
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        params.append('startDate', startDate.toISOString());
        params.append('endDate', endDate.toISOString());
      }
      
      const response = await fetch(`/api/admin/billing-analytics?${params}`);
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Trigger billing cycle mutation
  const triggerBillingMutation = useMutation({
    mutationFn: async (type: string) => {
      return apiRequest('POST', '/api/admin/trigger-billing-cycle', { type });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Billing Cycle Triggered",
        description: data.message || "Billing cycle completed successfully",
      });
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Billing Cycle Failed",
        description: error.message || "Failed to trigger billing cycle",
        variant: "destructive",
      });
    },
  });

  const handleTriggerBilling = (type: string) => {
    triggerBillingMutation.mutate(type);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Billing Administration</h2>
          <p className="text-muted-foreground">
            Manage subscription billing cycles and view analytics
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh Data
        </Button>
      </div>

      <Tabs defaultValue="analytics" className="space-y-6">
        <TabsList>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="billing-ops">Billing Operations</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="space-y-6">
          {/* Period Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Analytics Period</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                    <SelectItem value="90">Last 90 days</SelectItem>
                    <SelectItem value="365">Last year</SelectItem>
                    <SelectItem value="custom">Custom range</SelectItem>
                  </SelectContent>
                </Select>

                {selectedPeriod === 'custom' && (
                  <>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline">
                          <CalendarIcon className="w-4 h-4 mr-2" />
                          {customStartDate ? format(customStartDate, 'MMM dd, yyyy') : 'Start date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={customStartDate}
                          onSelect={setCustomStartDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline">
                          <CalendarIcon className="w-4 h-4 mr-2" />
                          {customEndDate ? format(customEndDate, 'MMM dd, yyyy') : 'End date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={customEndDate}
                          onSelect={setCustomEndDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Analytics Dashboard */}
          {analyticsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="animate-pulse space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-20" />
                      <div className="h-8 bg-gray-200 rounded w-16" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : analytics ? (
            <>
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-blue-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">Total Subscriptions</p>
                        <p className="text-2xl font-bold">{analytics.totalSubscriptions}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">Active</p>
                        <p className="text-2xl font-bold">{analytics.activeSubscriptions}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-yellow-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">Cancelled</p>
                        <p className="text-2xl font-bold">{analytics.cancelledSubscriptions}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-blue-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">Pending</p>
                        <p className="text-2xl font-bold">{analytics.pendingSubscriptions}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Payment Methods</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span>Stripe</span>
                        <Badge variant="outline">{analytics.byPaymentMethod.stripe}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>USDC</span>
                        <Badge variant="outline">{analytics.byPaymentMethod.usdc}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>PayPal</span>
                        <Badge variant="outline">{analytics.byPaymentMethod.paypal}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Billing Periods</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span>Monthly</span>
                        <Badge variant="outline">{analytics.byBillingPeriod.monthly}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Yearly</span>
                        <Badge variant="outline" className="text-green-600">
                          {analytics.byBillingPeriod.yearly}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Failed to load billing analytics. Please refresh and try again.
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        <TabsContent value="billing-ops" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Billing Operations</CardTitle>
              <CardDescription>
                Manually trigger billing processes for testing and emergency situations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                  onClick={() => handleTriggerBilling('daily')}
                  disabled={triggerBillingMutation.isPending}
                  className="h-20 flex-col gap-2"
                >
                  <Play className="w-5 h-5" />
                  <div className="text-center">
                    <div className="font-semibold">Full Daily Cycle</div>
                    <div className="text-xs opacity-75">Renewals + Cleanup + Retries</div>
                  </div>
                </Button>

                <Button
                  onClick={() => handleTriggerBilling('renewals')}
                  disabled={triggerBillingMutation.isPending}
                  variant="outline"
                  className="h-20 flex-col gap-2"
                >
                  <RefreshCw className="w-5 h-5" />
                  <div className="text-center">
                    <div className="font-semibold">Process Renewals</div>
                    <div className="text-xs opacity-75">Upcoming subscription renewals</div>
                  </div>
                </Button>

                <Button
                  onClick={() => handleTriggerBilling('expired')}
                  disabled={triggerBillingMutation.isPending}
                  variant="outline"
                  className="h-20 flex-col gap-2"
                >
                  <Clock className="w-5 h-5" />
                  <div className="text-center">
                    <div className="font-semibold">Cleanup Expired</div>
                    <div className="text-xs opacity-75">Mark expired subscriptions</div>
                  </div>
                </Button>

                <Button
                  onClick={() => handleTriggerBilling('retry')}
                  disabled={triggerBillingMutation.isPending}
                  variant="outline"
                  className="h-20 flex-col gap-2"
                >
                  <TrendingUp className="w-5 h-5" />
                  <div className="text-center">
                    <div className="font-semibold">Retry Payments</div>
                    <div className="text-xs opacity-75">Process failed payments</div>
                  </div>
                </Button>
              </div>

              {triggerBillingMutation.isPending && (
                <Alert className="mt-4">
                  <Clock className="h-4 w-4 animate-spin" />
                  <AlertDescription>
                    Processing billing operation... This may take a few moments.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}