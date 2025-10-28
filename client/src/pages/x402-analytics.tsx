/**
 * x402 Protocol Analytics Dashboard
 * Monitor autonomous AI agent payment performance
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, TrendingUp, DollarSign, Activity, Globe } from 'lucide-react';

interface X402Analytics {
  totalPayments: number;
  totalVolume: number;
  successRate: number;
  averageAmount: number;
  paymentsByNetwork: Record<string, number>;
}

export default function X402Analytics() {
  const { data: analytics, isLoading } = useQuery<{ success: boolean; data: X402Analytics }>({
    queryKey: ['/api/x402/analytics'],
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const stats = analytics?.data;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
          <Zap className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">x402 Protocol Analytics</h1>
          <p className="text-muted-foreground">
            Autonomous AI agent payment performance metrics
          </p>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalPayments || 0}</div>
            <p className="text-xs text-muted-foreground">
              x402 autonomous transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${stats?.totalVolume.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">
              USDC processed via x402
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.successRate.toFixed(1) || '0.0'}%
            </div>
            <p className="text-xs text-muted-foreground">
              Payment completion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${stats?.averageAmount.toFixed(2) || '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">
              Per transaction
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Payments by Network */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            <CardTitle>Payments by Network</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {stats?.paymentsByNetwork && Object.keys(stats.paymentsByNetwork).length > 0 ? (
            <div className="space-y-4">
              {Object.entries(stats.paymentsByNetwork).map(([network, count]) => (
                <div key={network} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span className="font-medium capitalize">{network}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">{count} payments</span>
                    <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{
                          width: `${((count / (stats.totalPayments || 1)) * 100).toFixed(0)}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Zap className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No x402 payments yet</p>
              <p className="text-sm mt-1">
                Start accepting autonomous AI agent payments
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* x402 Protocol Info */}
      <Card className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950">
        <CardHeader>
          <CardTitle>About x402 Protocol</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <strong>x402</strong> is an HTTP 402-based payment protocol launched by Coinbase
            that enables instant stablecoin micropayments over HTTP.
          </p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>Autonomous AI agent payments</li>
            <li>~2 second settlement on Base Chain</li>
            <li>Near-zero transaction fees</li>
            <li>No API keys or KYC required</li>
            <li>Backed by Google, Coinbase, Cloudflare</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
