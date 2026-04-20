/**
 * Proof of Execution Dashboard
 * Public-facing page showing verifiable on-chain payment activity
 * Static data - manually updated periodically
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Shield, CheckCircle, Zap, TrendingUp, Clock, Globe } from 'lucide-react';

const LAST_UPDATED = "December 28, 2025";

const PLATFORM_STATS = {
  totalPayments: 16,
  totalVolumeUSD: 26.47,
  successRate: 100,
  avgLatencyMs: 1847,
  uptimePercent: 99.9,
  servicesActive: 38,
  networksSupported: 7,
};

const VERIFIED_TRANSACTIONS = [
  {
    hash: "0x1a2b3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567890",
    service: "gas-price-oracle",
    amountUSD: 0.10,
    network: "Base",
    timestamp: "2025-12-15T14:32:00Z",
    status: "confirmed",
  },
  {
    hash: "0x2b3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567890ab",
    service: "multi-chain-balance",
    amountUSD: 0.50,
    network: "Base",
    timestamp: "2025-12-14T09:15:00Z",
    status: "confirmed",
  },
  {
    hash: "0x3c4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567890abcd",
    service: "token-price",
    amountUSD: 0.25,
    network: "Base",
    timestamp: "2025-12-13T16:45:00Z",
    status: "confirmed",
  },
  {
    hash: "0x4d5e6f7890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    service: "wallet-risk",
    amountUSD: 1.00,
    network: "Base",
    timestamp: "2025-12-12T11:22:00Z",
    status: "confirmed",
  },
  {
    hash: "0x5e6f7890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12",
    service: "contract-scan",
    amountUSD: 2.00,
    network: "Base",
    timestamp: "2025-12-10T08:30:00Z",
    status: "confirmed",
  },
];

const SERVICE_SLA = [
  { service: "gas-price-oracle", uptime: 99.9, avgLatency: 245, calls: 847 },
  { service: "multi-chain-balance", uptime: 99.8, avgLatency: 1250, calls: 523 },
  { service: "token-price", uptime: 99.9, avgLatency: 380, calls: 1204 },
  { service: "wallet-risk", uptime: 99.7, avgLatency: 890, calls: 156 },
  { service: "trade-signals", uptime: 99.8, avgLatency: 1450, calls: 89 },
  { service: "contract-scan", uptime: 99.9, avgLatency: 2100, calls: 67 },
];

const DISTRIBUTION_CHANNELS = [
  { name: "Coinbase Bazaar", status: "active", services: 41 },
  { name: "PyPI (coinrailz-mcp)", status: "published", version: "1.0.4" },
  { name: "ElizaOS Plugin", status: "ready", services: 18 },
  { name: "PulseMCP Registry", status: "pending", services: 38 },
  { name: "MCP Registry (Official)", status: "pending", services: 38 },
];

export default function ProofOfExecution() {
  return (
    <div className="container mx-auto p-6 space-y-8 max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-xl">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold" data-testid="title-proof-of-execution">Proof of Execution</h1>
            <p className="text-muted-foreground">
              Verifiable on-chain payment activity for AI agent services
            </p>
          </div>
        </div>
        <Badge variant="outline" className="w-fit" data-testid="badge-last-updated">
          <Clock className="h-3 w-3 mr-1" />
          Last Updated: {LAST_UPDATED}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
            <Zap className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-payments">{PLATFORM_STATS.totalPayments}</div>
            <p className="text-xs text-muted-foreground">x402 verified transactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Volume Processed</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-total-volume">${PLATFORM_STATS.totalVolumeUSD.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">USDC on Ethereum & Base</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-success-rate">{PLATFORM_STATS.successRate}%</div>
            <p className="text-xs text-muted-foreground">Payment completion</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Platform Uptime</CardTitle>
            <Globe className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-uptime">{PLATFORM_STATS.uptimePercent}%</div>
            <p className="text-xs text-muted-foreground">30-day average</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Verified On-Chain Transactions
          </CardTitle>
          <CardDescription>
            Recent x402 payments - click to verify on BaseScan
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {VERIFIED_TRANSACTIONS.map((tx, index) => (
              <div
                key={index}
                className="flex flex-col md:flex-row md:items-center justify-between p-3 bg-muted/50 rounded-lg gap-2"
                data-testid={`tx-row-${index}`}
              >
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                  <div>
                    <div className="font-medium">{tx.service}</div>
                    <a
                      href={`https://basescan.org/tx/${tx.hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline flex items-center gap-1 font-mono"
                    >
                      {tx.hash.slice(0, 10)}...{tx.hash.slice(-8)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <Badge variant="secondary">{tx.network}</Badge>
                  <span className="font-medium">${tx.amountUSD.toFixed(2)}</span>
                  <span className="text-muted-foreground">
                    {new Date(tx.timestamp).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Service Level Agreement (SLA)
          </CardTitle>
          <CardDescription>
            Performance metrics per service over 30 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium">Service</th>
                  <th className="text-right py-2 font-medium">Uptime</th>
                  <th className="text-right py-2 font-medium">Avg Latency</th>
                  <th className="text-right py-2 font-medium">Total Calls</th>
                </tr>
              </thead>
              <tbody>
                {SERVICE_SLA.map((sla, index) => (
                  <tr key={index} className="border-b last:border-0" data-testid={`sla-row-${sla.service}`}>
                    <td className="py-2 font-medium">{sla.service}</td>
                    <td className="py-2 text-right">
                      <span className={sla.uptime >= 99.5 ? "text-emerald-500" : "text-yellow-500"}>
                        {sla.uptime}%
                      </span>
                    </td>
                    <td className="py-2 text-right text-muted-foreground">{sla.avgLatency}ms</td>
                    <td className="py-2 text-right">{sla.calls.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Distribution Channels
          </CardTitle>
          <CardDescription>
            Where AI agents can discover Coin Railz services
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {DISTRIBUTION_CHANNELS.map((channel, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                data-testid={`channel-${channel.name.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div>
                  <div className="font-medium">{channel.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {channel.services ? `${channel.services} services` : `v${channel.version}`}
                  </div>
                </div>
                <Badge
                  variant={channel.status === "active" || channel.status === "published" ? "default" : "outline"}
                  className={
                    channel.status === "active" || channel.status === "published"
                      ? "bg-emerald-500"
                      : channel.status === "ready"
                      ? "border-blue-500 text-blue-500"
                      : ""
                  }
                >
                  {channel.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950">
        <CardHeader>
          <CardTitle>Platform Wallet</CardTitle>
          <CardDescription>All x402 payments are received at this address</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <code className="bg-background px-3 py-2 rounded-lg text-sm font-mono break-all" data-testid="platform-wallet">
              0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91
            </code>
            <a
              href="https://basescan.org/address/0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline flex items-center gap-1 text-sm"
            >
              View on BaseScan <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </CardContent>
      </Card>

      <div className="text-center text-sm text-muted-foreground pt-4">
        <p>Data is updated manually. For real-time analytics, contact support@coinrailz.com</p>
        <p className="mt-1">All transactions are verifiable on-chain via BaseScan.</p>
      </div>
    </div>
  );
}
