import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  DollarSign, 
  Crown,
  Activity,
  Calendar,
  Target,
  Star
} from 'lucide-react';

interface SubscriptionAnalytics {
  totalActiveSubscriptions: number;
  totalMonthlyRevenue: number;
  totalYearlyRevenue: number;
  averageRevenuePerUser: number;
  churnRate: number;
  newSubscriptionsThisMonth: number;
  newSubscriptionsLastMonth: number;
  growthRate: number;
  planDistribution: {
    planId: string;
    count: number;
    percentage: number;
    revenue: number;
  }[];
  revenueByMonth: {
    month: string;
    revenue: number;
    subscriptions: number;
  }[];
}

interface RevenueBreakdown {
  subscriptionRevenue: number;
  tradingFeeRevenue: number;
  crossChainFeeRevenue: number;
  aiMarketplaceRevenue: number;
  totalRevenue: number;
  revenueGrowth: number;
}

interface TopSubscriber {
  userId: string;
  email: string;
  currentPlan: string;
  lifetimeValue: number;
  monthsActive: number;
}

export function SubscriptionAnalyticsDashboard() {
  const [dateRange, setDateRange] = useState('last30days');
  
  // Fetch analytics data
  const { data: analytics, isLoading: analyticsLoading } = useQuery<SubscriptionAnalytics>({
    queryKey: ['/api/admin/subscription-analytics', dateRange],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: revenueBreakdown, isLoading: revenueLoading } = useQuery<RevenueBreakdown>({
    queryKey: ['/api/admin/revenue-breakdown'],
    staleTime: 5 * 60 * 1000,
  });

  const { data: topSubscribers, isLoading: subscribersLoading } = useQuery<TopSubscriber[]>({
    queryKey: ['/api/admin/top-subscribers', { limit: 10 }],
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  if (analyticsLoading || revenueLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  // Prepare chart data
  const planDistributionChartData = analytics?.planDistribution.map(plan => ({
    name: plan.planId.charAt(0).toUpperCase() + plan.planId.slice(1),
    value: plan.count,
    revenue: plan.revenue
  })) || [];

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Subscription Analytics</h1>
          <p className="text-muted-foreground">Track subscription performance and user behavior</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant={dateRange === 'last7days' ? 'default' : 'outline'}
            onClick={() => setDateRange('last7days')}
          >
            7 Days
          </Button>
          <Button 
            variant={dateRange === 'last30days' ? 'default' : 'outline'}
            onClick={() => setDateRange('last30days')}
          >
            30 Days
          </Button>
          <Button 
            variant={dateRange === 'last90days' ? 'default' : 'outline'}
            onClick={() => setDateRange('last90days')}
          >
            90 Days
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.totalActiveSubscriptions || 0}</div>
            <p className="text-xs text-muted-foreground">
                <span className={(analytics?.growthRate ?? 0) >= 0 ? "text-green-600" : "text-red-600"}>
                {formatPercent(analytics?.growthRate || 0)}
              </span>{' '}
              from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(analytics?.totalMonthlyRevenue || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
                <span className={(revenueBreakdown?.revenueGrowth ?? 0) >= 0 ? "text-green-600" : "text-red-600"}>
                {formatPercent(revenueBreakdown?.revenueGrowth || 0)}
              </span>{' '}
              from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Revenue per User</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(analytics?.averageRevenuePerUser || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Monthly ARPU
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Churn Rate</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(analytics?.churnRate || 0).toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {(analytics?.churnRate ?? 0) <= 5 ? (
                <span className="text-green-600">Healthy churn rate</span>
              ) : (
                <span className="text-red-600">High churn rate</span>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Revenue Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics?.revenueByMonth || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => [formatCurrency(value as number), 'Revenue']} />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#8884d8" 
                    strokeWidth={2}
                    dot={{ fill: '#8884d8' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Plan Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Plan Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={planDistributionChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {planDistributionChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Subscribers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topSubscribers?.slice(0, 5).map((subscriber, index) => (
                    <div key={subscriber.userId} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium">{subscriber.email}</div>
                          <div className="text-sm text-muted-foreground">
                            {subscriber.currentPlan} • {subscriber.monthsActive} months
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">{formatCurrency(subscriber.lifetimeValue)}</div>
                        <div className="text-sm text-muted-foreground">LTV</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-4">
          {/* Revenue Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Subscriptions</div>
                  <div className="text-2xl font-bold text-blue-600">
                    {formatCurrency(revenueBreakdown?.subscriptionRevenue || 0)}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Trading Fees</div>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(revenueBreakdown?.tradingFeeRevenue || 0)}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">Cross-Chain</div>
                  <div className="text-2xl font-bold text-purple-600">
                    {formatCurrency(revenueBreakdown?.crossChainFeeRevenue || 0)}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">AI Marketplace</div>
                  <div className="text-2xl font-bold text-orange-600">
                    {formatCurrency(revenueBreakdown?.aiMarketplaceRevenue || 0)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          {/* User Growth */}
          <Card>
            <CardHeader>
              <CardTitle>User Growth</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics?.revenueByMonth || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="subscriptions" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="space-y-4">
          {/* Plan Performance */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {analytics?.planDistribution.map((plan, index) => (
              <Card key={plan.planId}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Crown className={`w-4 h-4 ${COLORS[index] ? 'text-blue-500' : 'text-gray-400'}`} />
                    {plan.planId.charAt(0).toUpperCase() + plan.planId.slice(1)} Plan
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-2xl font-bold">{plan.count}</div>
                    <div className="text-sm text-muted-foreground">
                      {plan.percentage.toFixed(1)}% of subscribers
                    </div>
                    <div className="text-sm font-medium text-green-600">
                      {formatCurrency(plan.revenue)}/month
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}