import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  BarChart3, TrendingUp, Users, DollarSign, 
  AlertTriangle, Activity, Clock, Shield,
  Download, RefreshCw, Eye, CheckCircle
} from "@/lib/icons";

interface AnalyticsDashboard {
  performance: {
    avgPageLoad: number;
    avgAPIResponse: number;
    totalPageViews: number;
    totalAPIRequests: number;
  };
  errors: {
    totalErrors: number;
    criticalErrors: number;
    errorsByComponent: Record<string, number>;
    recentErrors: any[];
  };
  business: {
    walletOperations: number;
    successfulWalletOps: number;
    revenueEvents: number;
    totalRevenue: number;
  };
  realTime: {
    activeUsers: number;
    currentLoad: number;
  };
}
interface MessagingAnalytics {
  analytics: {
    overall?: {
      totalCampaigns?: number; totalMessages?: number; successRate?: number;
      totalCost?: number; walletBalance?: number; targetTypes?: string[]; activeTargets?: string[];
    };
    emergencyFunding?: { totalMessages?: number; successRate?: number; totalCost?: number; recentTransactions?: string[] };
    serviceMarketing?: { totalMessages?: number; successRate?: number; totalCost?: number; recentTransactions?: string[] };
  };
}

export default function AdminAnalytics() {
  const { user, isAuthenticated } = useAuth();
  const [timeframe, setTimeframe] = useState("24h");
  const [activeTab, setActiveTab] = useState("overview");

  const { data: analytics, isLoading: analyticsLoading, refetch } = useQuery<AnalyticsDashboard>({
    queryKey: ['/api/analytics/dashboard'],
    enabled: isAuthenticated,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: trends, isLoading: trendsLoading } = useQuery({
    queryKey: ['/api/analytics/trends', timeframe],
    enabled: isAuthenticated,
  });

  const { data: health } = useQuery<{ status: string }>({
    queryKey: ['/api/analytics/health'],
    enabled: isAuthenticated,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const { data: messagingAnalytics, isLoading: messagingLoading } = useQuery<MessagingAnalytics>({
    queryKey: ['/api/solana-messaging/campaigns/analytics'],
    enabled: isAuthenticated,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const dashboardData: AnalyticsDashboard = analytics || {
    performance: { avgPageLoad: 0, avgAPIResponse: 0, totalPageViews: 0, totalAPIRequests: 0 },
    errors: { totalErrors: 0, criticalErrors: 0, errorsByComponent: {}, recentErrors: [] },
    business: { walletOperations: 0, successfulWalletOps: 0, revenueEvents: 0, totalRevenue: 0 },
    realTime: { activeUsers: 0, currentLoad: 0 }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-4">Admin Access Required</h2>
            <p className="text-gray-600 mb-4">
              Please sign in with administrative privileges to access analytics.
            </p>
            <Button onClick={() => window.location.href = "/api/login"}>
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Platform Analytics</h1>
              <p className="text-gray-600">Real-time monitoring and performance insights</p>
            </div>
            <div className="flex items-center gap-4">
              <Badge className={health?.status === 'healthy' ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                {health?.status || 'checking...'}
              </Badge>
              <Button variant="outline" onClick={() => refetch()} size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="messaging">Messaging</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="errors">Errors</TabsTrigger>
            <TabsTrigger value="business">Business</TabsTrigger>
            <TabsTrigger value="real-time">Real-time</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Active Users</p>
                      <p className="text-2xl font-bold text-blue-600">{dashboardData.realTime.activeUsers}</p>
                    </div>
                    <Users className="w-8 h-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Revenue Events</p>
                      <p className="text-2xl font-bold text-green-600">{dashboardData.business.revenueEvents}</p>
                    </div>
                    <DollarSign className="w-8 h-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Page Views</p>
                      <p className="text-2xl font-bold text-purple-600">{dashboardData.performance.totalPageViews}</p>
                    </div>
                    <BarChart3 className="w-8 h-8 text-purple-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Critical Errors</p>
                      <p className="text-2xl font-bold text-red-600">{dashboardData.errors.criticalErrors}</p>
                    </div>
                    <AlertTriangle className="w-8 h-8 text-red-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Performance Trends
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {trendsLoading ? (
                    <div className="flex items-center justify-center py-16">
                      <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-16 bg-gray-50 rounded-lg">
                      <div className="text-center">
                        <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">Performance trend chart would be rendered here</p>
                        <p className="text-sm text-gray-500">Data from {timeframe}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    System Health
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="font-medium">Database</span>
                    </div>
                    <Badge className="bg-green-100 text-green-800">Healthy</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="font-medium">API Services</span>
                    </div>
                    <Badge className="bg-green-100 text-green-800">Operational</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="font-medium">Payment Gateway</span>
                    </div>
                    <Badge className="bg-green-100 text-green-800">Active</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-blue-600" />
                      <span className="font-medium">Average Response</span>
                    </div>
                    <Badge className="bg-blue-100 text-blue-800">{dashboardData.performance.avgAPIResponse.toFixed(0)}ms</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Messaging Campaigns Tab */}
          <TabsContent value="messaging" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Solana Messaging Campaigns</h2>
              <Badge className="bg-blue-100 text-blue-800">Active</Badge>
            </div>

            {/* Campaign Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-600">Total Campaigns</p>
                    <p className="text-3xl font-bold text-blue-600">
                      {messagingAnalytics?.analytics?.overall?.totalCampaigns || 0}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-600">Messages Sent</p>
                    <p className="text-3xl font-bold text-green-600">
                      {messagingAnalytics?.analytics?.overall?.totalMessages || 0}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-600">Success Rate</p>
                    <p className="text-3xl font-bold text-purple-600">
                      {messagingAnalytics?.analytics?.overall?.successRate || 0}%
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-600">Total Cost</p>
                    <p className="text-3xl font-bold text-orange-600">
                      {messagingAnalytics?.analytics?.overall?.totalCost || 0} SOL
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Campaign Details */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    🚨 Emergency Funding
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {messagingLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full"></div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">Messages Sent</span>
                        <Badge className="bg-green-100 text-green-800">
                          {messagingAnalytics?.analytics?.emergencyFunding?.totalMessages || 0}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">Success Rate</span>
                        <Badge className="bg-blue-100 text-blue-800">
                          {messagingAnalytics?.analytics?.emergencyFunding?.successRate || 0}%
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">Total Cost</span>
                        <Badge className="bg-purple-100 text-purple-800">
                          {messagingAnalytics?.analytics?.emergencyFunding?.totalCost || 0} SOL
                        </Badge>
                      </div>
                      {(messagingAnalytics?.analytics?.emergencyFunding?.recentTransactions ?? []).length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm font-medium mb-2">Recent Transactions:</p>
                          <div className="bg-gray-50 p-3 rounded text-xs font-mono">
                            {messagingAnalytics?.analytics?.emergencyFunding?.recentTransactions?.[0]?.slice(0, 32)}...
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    🤖 Service Marketing
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {messagingLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full"></div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">Messages Sent</span>
                        <Badge className="bg-green-100 text-green-800">
                          {messagingAnalytics?.analytics?.serviceMarketing?.totalMessages || 0}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">Success Rate</span>
                        <Badge className="bg-blue-100 text-blue-800">
                          {messagingAnalytics?.analytics?.serviceMarketing?.successRate || 0}%
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">Total Cost</span>
                        <Badge className="bg-purple-100 text-purple-800">
                          {messagingAnalytics?.analytics?.serviceMarketing?.totalCost || 0} SOL
                        </Badge>
                      </div>
                      {(messagingAnalytics?.analytics?.serviceMarketing?.recentTransactions ?? []).length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm font-medium mb-2">Recent Transactions:</p>
                          <div className="space-y-1">
                            {(messagingAnalytics?.analytics?.serviceMarketing?.recentTransactions ?? []).slice(0, 3).map((tx, i) => (
                              <div key={i} className="bg-gray-50 p-2 rounded text-xs font-mono">
                                {tx?.slice(0, 32)}...
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Wallet Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  💰 Platform Wallet Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-600">Current Balance</p>
                    <p className="text-2xl font-bold text-green-600">
                      {messagingAnalytics?.analytics?.overall?.walletBalance || 0} SOL
                    </p>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-600">Campaign Types</p>
                    <p className="text-lg font-bold text-blue-600">
                      {messagingAnalytics?.analytics?.overall?.targetTypes?.length || 0} Types
                    </p>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-600">Active Targets</p>
                    <p className="text-lg font-bold text-purple-600">
                      {messagingAnalytics?.analytics?.overall?.activeTargets?.length || 0} Labels
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Performance Metrics</h2>
              <Select value={timeframe} onValueChange={setTimeframe}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">Last Hour</SelectItem>
                  <SelectItem value="24h">Last 24 Hours</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-600">Average Page Load</p>
                    <p className="text-3xl font-bold text-blue-600">{dashboardData.performance.avgPageLoad.toFixed(1)}ms</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-600">API Response Time</p>
                    <p className="text-3xl font-bold text-green-600">{dashboardData.performance.avgAPIResponse.toFixed(1)}ms</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-600">Total Requests</p>
                    <p className="text-3xl font-bold text-purple-600">{dashboardData.performance.totalAPIRequests}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Errors Tab */}
          <TabsContent value="errors" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Error Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-medium mb-4">Errors by Component</h3>
                    <div className="space-y-2">
                      {Object.entries(dashboardData.errors.errorsByComponent).map(([component, count]) => (
                        <div key={component} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="text-sm">{component}</span>
                          <Badge variant="outline">{count}</Badge>
                        </div>
                      ))}
                      {Object.keys(dashboardData.errors.errorsByComponent).length === 0 && (
                        <p className="text-gray-500 text-center py-4">No errors recorded</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium mb-4">Recent Errors</h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {dashboardData.errors.recentErrors.map((error, index) => (
                        <div key={index} className="p-3 bg-red-50 border border-red-200 rounded">
                          <p className="text-sm font-medium text-red-800">{error.message}</p>
                          <p className="text-xs text-red-600">{error.component} • {new Date(error.timestamp).toLocaleTimeString()}</p>
                        </div>
                      ))}
                      {dashboardData.errors.recentErrors.length === 0 && (
                        <p className="text-gray-500 text-center py-4">No recent errors</p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Business Tab */}
          <TabsContent value="business" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-600">Wallet Operations</p>
                    <p className="text-3xl font-bold text-blue-600">{dashboardData.business.walletOperations}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-600">Success Rate</p>
                    <p className="text-3xl font-bold text-green-600">
                      {dashboardData.business.walletOperations > 0 
                        ? ((dashboardData.business.successfulWalletOps / dashboardData.business.walletOperations) * 100).toFixed(1)
                        : 0}%
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-600">Revenue Events</p>
                    <p className="text-3xl font-bold text-purple-600">{dashboardData.business.revenueEvents}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                    <p className="text-3xl font-bold text-orange-600">${dashboardData.business.totalRevenue.toFixed(2)}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Real-time Tab */}
          <TabsContent value="real-time" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    Live Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Active Users</span>
                      <Badge className="bg-green-100 text-green-800">{dashboardData.realTime.activeUsers}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Current Load</span>
                      <Badge className="bg-blue-100 text-blue-800">{dashboardData.realTime.currentLoad}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="w-5 h-5" />
                    Export Data
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button variant="outline" className="w-full">
                    <Download className="w-4 h-4 mr-2" />
                    Download Performance Report
                  </Button>
                  <Button variant="outline" className="w-full">
                    <Download className="w-4 h-4 mr-2" />
                    Export Error Logs
                  </Button>
                  <Button variant="outline" className="w-full">
                    <Download className="w-4 h-4 mr-2" />
                    Business Analytics CSV
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}