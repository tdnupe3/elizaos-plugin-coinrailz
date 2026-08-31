import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NavigationHeader } from "@/components/navigation-header";
import { Users, DollarSign, TrendingUp, Activity, Calendar, Target, Zap, Award } from "@/lib/icons";
interface PlatformStatsResponse {
  analytics: Record<string, any>;
}
interface RevenueResponse {
  revenue: Record<string, any>;
}

export default function PlatformAnalytics() {
  const { data: analytics, isLoading } = useQuery<PlatformStatsResponse>({
    queryKey: ["/api/analytics/platform-stats"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: revenueData } = useQuery<RevenueResponse>({
    queryKey: ["/api/analytics/revenue-breakdown"],
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
        <NavigationHeader />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  const stats = analytics?.analytics || {};
  const revenue = revenueData?.revenue || {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
      <NavigationHeader />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center space-x-2">
              <Activity className="h-8 w-8 text-blue-500" />
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Platform Analytics
              </h1>
            </div>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              Real-time insights into Coin Railz platform performance
            </p>
            <div className="text-sm text-gray-500">
              Last updated: {stats.summary?.lastUpdated ? new Date(stats.summary.lastUpdated).toLocaleString() : 'Now'}
            </div>
          </div>

          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900 dark:to-emerald-800 border-green-200 dark:border-green-700">
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Users className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-green-700 dark:text-green-300">
                      Total Users
                    </p>
                    <p className="text-3xl font-bold text-green-900 dark:text-green-100">
                      {stats.users?.total || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 border-blue-200 dark:border-blue-700">
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-8 w-8 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      Total Transactions
                    </p>
                    <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                      {stats.transactions?.total || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900 dark:to-purple-800 border-purple-200 dark:border-purple-700">
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-8 w-8 text-purple-600" />
                  <div>
                    <p className="text-sm font-medium text-purple-700 dark:text-purple-300">
                      Total Volume
                    </p>
                    <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                      ${parseFloat(stats.transactions?.totalVolume || "0").toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900 dark:to-orange-800 border-orange-200 dark:border-orange-700">
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Award className="h-8 w-8 text-orange-600" />
                  <div>
                    <p className="text-sm font-medium text-orange-700 dark:text-orange-300">
                      Platform Revenue
                    </p>
                    <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                      ${parseFloat(stats.transactions?.totalFeesCollected || "0").toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Statistics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Transaction Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5" />
                  <span>Transaction Analytics</span>
                </CardTitle>
                <CardDescription>
                  Breakdown of platform transaction activity
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="font-medium">Average Transaction Size:</span>
                  <span>${parseFloat(stats.transactions?.avgTransactionSize || "0").toFixed(2)}</span>
                </div>
                
                {/* Transaction Status Breakdown */}
                {stats.transactions?.statusBreakdown && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Transaction Status:</h4>
                    {stats.transactions.statusBreakdown.map((status: any, index: number) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span className="capitalize">{status.status}:</span>
                        <span>{status.count} transactions (${parseFloat(status.volume || "0").toLocaleString()})</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Currency Breakdown */}
                {stats.transactions?.currencyBreakdown && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Currency Breakdown:</h4>
                    {stats.transactions.currencyBreakdown.map((currency: any, index: number) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span>{currency.currency}:</span>
                        <span>{currency.transactionCount} txns (${parseFloat(currency.totalVolume || "0").toLocaleString()})</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Referral & Growth */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Target className="h-5 w-5" />
                  <span>Growth & Referrals</span>
                </CardTitle>
                <CardDescription>
                  User acquisition and referral program performance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="font-medium">Total Referrals:</span>
                  <span>{stats.referrals?.total || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Active Referrers:</span>
                  <span>{stats.referrals?.activeReferrers || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Referral Bonuses Paid:</span>
                  <span>${parseFloat(stats.referrals?.totalBonusesPaid || "0").toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">AI Agents Registered:</span>
                  <span>{stats.aiAgents?.total || 0}</span>
                </div>

                {/* Recent Signups */}
                {stats.users?.dailySignups && stats.users.dailySignups.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Recent Daily Signups:</h4>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {stats.users.dailySignups.slice(0, 10).map((day: any, index: number) => (
                        <div key={index} className="flex justify-between text-sm">
                          <span>{day.date}:</span>
                          <span>{day.signups} users</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Platform Health */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Zap className="h-5 w-5" />
                <span>Platform Health</span>
              </CardTitle>
              <CardDescription>
                System status and operational metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="font-medium">Status: {stats.summary?.platformHealth || 'Operational'}</span>
              </div>
              <div className="mt-4 text-sm text-gray-600 dark:text-gray-300">
                Total Lifetime Revenue: <span className="font-semibold text-green-600">${(revenue.totalLifetimeRevenue || stats.summary?.totalRevenue || 0).toLocaleString()}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}