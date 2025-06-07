import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, Server, DollarSign, Zap, TrendingUp, AlertTriangle } from "lucide-react";

export default function ProductionDashboard() {
  const { data: healthCheck, isLoading: healthLoading } = useQuery({
    queryKey: ['/api/health/check'],
    refetchInterval: 30000, // Check every 30 seconds
  });

  const { data: cryptoPrices, isLoading: pricesLoading } = useQuery({
    queryKey: ['/api/crypto/prices'],
    refetchInterval: 60000, // Update every minute
  });

  const { data: networkStats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/public/network/stats'],
    refetchInterval: 30000,
  });

  const processReferralRewards = async () => {
    try {
      const response = await fetch('/api/referrals/process-rewards', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (response.ok) {
        alert('Referral rewards processed successfully');
      }
    } catch (error) {
      alert('Error processing referral rewards');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Production Dashboard</h1>
          <p className="text-gray-600">Monitor platform performance and revenue optimization</p>
        </div>

        {/* API Health Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">API Health</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {healthLoading ? (
                <div className="animate-pulse">
                  <div className="h-6 bg-gray-200 rounded mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded"></div>
                </div>
              ) : (
                <div>
                  <div className="text-2xl font-bold">
                    {healthCheck?.status === 'healthy' ? (
                      <Badge variant="default" className="bg-green-500">Healthy</Badge>
                    ) : healthCheck?.status === 'degraded' ? (
                      <Badge variant="secondary" className="bg-yellow-500">Degraded</Badge>
                    ) : (
                      <Badge variant="destructive">Error</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {healthCheck?.services?.length || 0} services monitored
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Network Stats</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="animate-pulse">
                  <div className="h-6 bg-gray-200 rounded mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded"></div>
                </div>
              ) : (
                <div>
                  <div className="text-2xl font-bold">
                    {networkStats?.networkStats?.activeAgents || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Active AI Agents</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Platform Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="animate-pulse">
                  <div className="h-6 bg-gray-200 rounded mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded"></div>
                </div>
              ) : (
                <div>
                  <div className="text-2xl font-bold">
                    ${networkStats?.networkStats?.platformRevenue || '0.00'}
                  </div>
                  <p className="text-xs text-muted-foreground">Total Revenue</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Transactions</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="animate-pulse">
                  <div className="h-6 bg-gray-200 rounded mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded"></div>
                </div>
              ) : (
                <div>
                  <div className="text-2xl font-bold">
                    {networkStats?.networkStats?.totalTransactions || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Total Transactions</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Service Status Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                API Service Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {healthLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="flex justify-between items-center">
                      <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
                      <div className="h-6 bg-gray-200 rounded w-16 animate-pulse"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {healthCheck?.services?.map((service: any) => (
                    <div key={service.service} className="flex justify-between items-center">
                      <span className="font-medium">{service.service}</span>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={service.status === 'healthy' ? 'default' : 'destructive'}
                          className={service.status === 'healthy' ? 'bg-green-500' : ''}
                        >
                          {service.status}
                        </Badge>
                        <span className="text-sm text-gray-500">
                          {service.responseTime}ms
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Cryptocurrency Prices
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pricesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="flex justify-between items-center">
                      <div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div>
                      <div className="h-4 bg-gray-200 rounded w-20 animate-pulse"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {Object.entries(cryptoPrices || {}).map(([symbol, data]: [string, any]) => (
                    <div key={symbol} className="flex justify-between items-center">
                      <span className="font-medium">{symbol}</span>
                      <div className="text-right">
                        <div className="font-bold">${data.price?.toLocaleString()}</div>
                        <div className={`text-sm ${data.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {data.change >= 0 ? '+' : ''}{data.change}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Production Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Production Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <Button onClick={processReferralRewards} className="bg-blue-600 hover:bg-blue-700">
                Process Referral Rewards
              </Button>
              <Button variant="outline" onClick={() => window.location.reload()}>
                Refresh Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}