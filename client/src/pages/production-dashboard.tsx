import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, Server, DollarSign, Zap, TrendingUp, AlertTriangle } from "lucide-react";
import { useSession } from "next-auth/react";

export default function ProductionDashboard() {
  const { data: healthCheck = { status: 'unknown', services: [] }, isLoading: healthLoading } = useQuery({
    queryKey: ['/api/health/check'],
    refetchInterval: false, // Disable automatic refetching
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      try {
        const response = await fetch('/api/health/check', { credentials: 'include' });
        if (!response.ok) {
          console.warn(`Health check failed: ${response.status}`);
          return { status: 'unknown', services: [] };
        }
        return await response.json();
      } catch (error) {
        console.warn('Health check error:', error);
        return { status: 'unknown', services: [] };
      }
    }
  });

  const { data: cryptoPrices = {}, isLoading: pricesLoading } = useQuery({
    queryKey: ['/api/crypto/prices'],
    refetchInterval: false, // Disable automatic refetching
    retry: false,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      try {
        const response = await fetch('/api/crypto/prices', { credentials: 'include' });
        if (!response.ok) {
          console.warn(`Crypto prices fetch failed: ${response.status}`);
          return {};
        }
        return await response.json();
      } catch (error) {
        console.warn('Crypto prices fetch error:', error);
        return {};
      }
    }
  });

  // Network stats completely removed to prevent excessive API calls
  const networkStats = {
    activeAgents: 0,
    totalTransactions: 0,
    transactionVolume: "0",
    platformFees: "0"
  };
  const statsLoading = false;

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

  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;

  // Check if user has admin access
  const { data: user } = useQuery({
    queryKey: ['/api/user'],
    enabled: !!isAuthenticated,
  });

  const adminEmails = ['travis@kelloggholdings.com', 'travis.kellogg1@gmail.com'];
  const isAdmin = adminEmails.includes(user?.email);

  if (!isAdmin) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-red-500 font-bold text-2xl">
          Unauthorized Access
        </div>
      </div>
    );
  }

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
                    {(healthCheck as any)?.status === 'healthy' ? (
                      <Badge variant="default" className="bg-green-500">Healthy</Badge>
                    ) : (healthCheck as any)?.status === 'degraded' ? (
                      <Badge variant="secondary" className="bg-yellow-500">Degraded</Badge>
                    ) : (
                      <Badge variant="destructive">Unknown</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {(healthCheck as any)?.services?.length || 0} services monitored
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
                    {networkStats.activeAgents || 0}
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
                    ${networkStats.platformFees || '0.00'}
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
                    {networkStats.totalTransactions || 0}
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
                  {(healthCheck as any)?.services?.map((service: any) => (
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