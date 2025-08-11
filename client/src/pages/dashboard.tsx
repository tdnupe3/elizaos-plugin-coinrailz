import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  DollarSign, 
  TrendingUp, 
  Users, 
  Zap,
  CreditCard,
  Wallet,
  BarChart3,
  Send,
  Coins
} from "@/lib/icons";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import OnboardingFlow from "@/components/onboarding-flow";
import { UserGuidanceModal } from "@/components/user-guidance";
import { IntuitiveOnboarding } from "@/components/intuitive-onboarding";
import { QuickFunding } from "@/components/quick-funding";
import { InstantSwap } from "@/components/instant-swap";
import { WalletDisplay } from "@/components/wallet-display";
import { UserSessionManager } from "@/components/UserSessionManager";
import { EnhancedWalletManager } from "@/components/enhanced-wallet-manager";
import { NavigationHeader } from "@/components/navigation-header";
import { KYCStatusDisplay } from "@/components/KYCStatusDisplay";
import CoinbaseConnectionSection from "@/components/coinbase-connection-section";

interface Transaction {
  id: string;
  type: 'p2p' | 'dex' | 'marketplace';
  amount: number;
  currency: string;
  status: 'completed' | 'pending' | 'failed';
  timestamp: string;
  description: string;
}

interface DashboardStats {
  balance: number;
  totalTransactions: number;
  monthlyVolume: number;
  activeAgents: number;
  referralEarnings: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [selectedTab, setSelectedTab] = useState("overview");

  // Fetch real-time user dashboard data
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery({
    queryKey: ["/api/user/dashboard-stats"],
    enabled: !!user,
    retry: false,
    throwOnError: false
  });

  // Fetch user's real-time USDC balance
  const { data: usdcBalance, isLoading: usdcBalanceLoading, refetch: refetchBalance } = useQuery({
    queryKey: ['/api/user/balance'],
    enabled: !!user,
    retry: false,
    throwOnError: false,
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Fetch transaction history
  const { data: transactionHistory, isLoading: transactionsLoading } = useQuery({
    queryKey: ['/api/user/transactions'],
    enabled: !!user,
    retry: false,
    throwOnError: false
  });

  // Use real transaction data
  const transactions = transactionHistory?.transactions || [];
  
  // Calculate real-time stats
  const realTimeStats = {
    balance: usdcBalance?.total || stats?.balance || 0,
    totalTransactions: transactions.length,
    monthlyVolume: stats?.monthlyVolume || 0,
    activeAgents: stats?.activeAgents || 0,
    referralEarnings: stats?.referralEarnings || 0
  };

  const { data: portfolioData } = useQuery({
    queryKey: ["/api/dashboard/portfolio"],
    enabled: !!user,
    retry: false,
    throwOnError: false
  });

  // Use actual user data from balance integration API
  const userStats: DashboardStats = (stats && typeof stats === 'object' && 'balance' in stats) 
    ? {
        balance: stats.balance || 0,
        totalTransactions: stats.totalTransactions || 0,
        monthlyVolume: stats.monthlyVolume || 0,
        activeAgents: stats.activeAgents || 0,
        referralEarnings: stats.referralEarnings || 0,
        totalRevenue: stats.totalRevenue || 0
      } as DashboardStats
    : {
        balance: 0.00,
        totalTransactions: 0,
        monthlyVolume: 0.00,
        activeAgents: 0,
        referralEarnings: 0.00,
        totalRevenue: 0.00
      };

  // Use actual user transactions (empty array for new users)
  const userTransactions: Transaction[] = Array.isArray(transactions) ? transactions : [];

  const formatCurrency = (amount: number, currency: string = "USD") => {
    if (currency === "USD") {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(amount);
    }
    return `${amount} ${currency}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-100 text-green-800">Completed</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'p2p':
        return <Send className="h-4 w-4" />;
      case 'dex':
        return <Coins className="h-4 w-4" />;
      case 'marketplace':
        return <Users className="h-4 w-4" />;
      default:
        return <DollarSign className="h-4 w-4" />;
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Please Sign In</h1>
          <Link href="/auth">
            <Button>Go to Sign In</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <NavigationHeader />
      
      {/* Welcome Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Welcome back, {(user as any)?.firstName || (user as any)?.email || 'User'}!
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                Your financial gateway dashboard
              </p>
            </div>
            <div className="flex space-x-4">
              <Button 
                onClick={() => {
                  refetchBalance();
                  refetchStats();
                }} 
                variant="outline" 
                size="sm"
                disabled={usdcBalanceLoading || statsLoading}
              >
                <ArrowUpRight className="h-4 w-4 mr-2" />
                {usdcBalanceLoading || statsLoading ? 'Refreshing...' : 'Refresh Data'}
              </Button>
              <UserGuidanceModal />
              <Button className="bg-blue-600 hover:bg-blue-700" asChild>
                <Link href="/">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  All Services
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* User Session Manager - Security Fix for User Isolation */}
        <UserSessionManager />

        {/* USDC Wallet Balance - Prominently displayed at top */}
        <div className="mb-8">
          <WalletDisplay />
        </div>

        {/* Enhanced Wallet Manager - Primary wallet interface */}
        <div className="mb-8">
          <EnhancedWalletManager />
        </div>

        {/* Intuitive Onboarding for New Users */}
        <div className="mb-8">
          <IntuitiveOnboarding />
        </div>

        {/* Coinbase Connection Section - Positioned right after demo mode */}
        <div className="mb-8">
          <CoinbaseConnectionSection />
        </div>

        {/* Quick Actions for Funded Users - Show alongside onboarding */}
        <div className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <QuickFunding />
          <InstantSwap />
        </div>

        {/* Original Onboarding Flow for Reference */}
        <div className="mb-8">
          <OnboardingFlow />
        </div>

        {/* KYC Status Display - Show verification status and feature access */}
        <div className="mb-8">
          <KYCStatusDisplay />
        </div>

        {/* Additional USDC Services */}
        <div className="mb-6">
          <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-950 dark:to-green-950">
            <CardHeader>
              <CardTitle className="flex items-center text-blue-700 dark:text-blue-300">
                <DollarSign className="h-5 w-5 mr-2" />
                USDC Services
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 dark:text-blue-400">
                    Instant settlements • Ultra-low fees • Global reach
                  </p>
                </div>
                <div className="flex space-x-2">
                  <Button size="sm" asChild>
                    <Link href="/usdc-buy">Buy USDC</Link>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/usdc-savings">Earn Yield</Link>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/usdc-ecosystem-dashboard">View All</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${(usdcBalance?.balance || realTimeStats.balance).toFixed(2)}
                {usdcBalanceLoading && <span className="text-sm ml-2 text-muted-foreground">updating...</span>}
              </div>
              <p className="text-xs text-muted-foreground">
                Total across all wallets • Last updated: {usdcBalance?.lastUpdated ? new Date(usdcBalance.lastUpdated).toLocaleTimeString() : 'Never'}
              </p>
              {usdcBalance?.breakdown && (
                <div className="text-xs text-muted-foreground mt-1">
                  Circle: ${usdcBalance.breakdown.circle.amount.toFixed(2)} • 
                  Coinbase: ${usdcBalance.breakdown.coinbase.amount.toFixed(2)} • 
                  Crypto: ${usdcBalance.breakdown.crypto.amount.toFixed(2)}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Transactions</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{realTimeStats.totalTransactions}</div>
              <p className="text-xs text-muted-foreground">
                {transactionsLoading ? 'Loading...' : `${transactions.length} recorded`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Volume</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(realTimeStats.monthlyVolume)}</div>
              <p className="text-xs text-muted-foreground">
                {statsLoading ? 'Loading...' : 'Last 30 days activity'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{realTimeStats.activeAgents}</div>
              <p className="text-xs text-muted-foreground">
                {statsLoading ? 'Loading...' : 'AI agents interacted with'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Referral Earnings</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(realTimeStats.referralEarnings)}</div>
              <p className="text-xs text-muted-foreground">
                {statsLoading ? 'Loading...' : 'From referral program'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
            <TabsTrigger value="agents">AI Agents</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Your latest transactions and activities</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {userTransactions.length > 0 ? (
                      userTransactions.slice(0, 5).map((transaction) => (
                        <div key={transaction.id} className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full">
                              {getTransactionIcon(transaction.type)}
                            </div>
                            <div>
                              <p className="font-medium">{transaction.description}</p>
                              <p className="text-sm text-gray-500">
                                {new Date(transaction.timestamp).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">
                              {formatCurrency(transaction.amount, transaction.currency)}
                            </p>
                            {getStatusBadge(transaction.status)}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <p>No transactions yet</p>
                        <p className="text-sm">Start by making a P2P transfer or trading on the DEX aggregator</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                  <CardDescription>Common tasks and shortcuts</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <Button variant="outline" className="h-20" asChild>
                      <Link href="/p2p-transfer">
                        <div className="text-center">
                          <Send className="h-6 w-6 mx-auto mb-2" />
                          <span>Send Money</span>
                        </div>
                      </Link>
                    </Button>
                    
                    <Button variant="outline" className="h-20" asChild>
                      <Link href="/dex-aggregator">
                        <div className="text-center">
                          <Coins className="h-6 w-6 mx-auto mb-2" />
                          <span>Swap Crypto</span>
                        </div>
                      </Link>
                    </Button>
                    
                    <Button variant="outline" className="h-20" asChild>
                      <Link href="/ai-marketplace">
                        <div className="text-center">
                          <Users className="h-6 w-6 mx-auto mb-2" />
                          <span>AI Services</span>
                        </div>
                      </Link>
                    </Button>
                    
                    <Button variant="outline" className="h-20" asChild>
                      <Link href="/add-funds">
                        <div className="text-center">
                          <CreditCard className="h-6 w-6 mx-auto mb-2" />
                          <span>Add Funds</span>
                        </div>
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="transactions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>Complete history of all your transactions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {userTransactions.length > 0 ? (
                    userTransactions.map((transaction) => (
                      <div key={transaction.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-full">
                            {getTransactionIcon(transaction.type)}
                          </div>
                          <div>
                            <p className="font-medium">{transaction.description}</p>
                            <p className="text-sm text-gray-500">
                              {new Date(transaction.timestamp).toLocaleString()}
                            </p>
                            <p className="text-xs text-gray-400">ID: {transaction.id}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">
                            {formatCurrency(transaction.amount, transaction.currency)}
                          </p>
                          {getStatusBadge(transaction.status)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <p className="text-lg">No transactions yet</p>
                      <p className="text-sm mt-2">Your transaction history will appear here once you start using the platform</p>
                      <div className="mt-6 space-x-4">
                        <Button asChild>
                          <Link href="/p2p-transfer">Send Money</Link>
                        </Button>
                        <Button variant="outline" asChild>
                          <Link href="/dex-aggregator">Trade Crypto</Link>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="portfolio" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Portfolio Overview</CardTitle>
                <CardDescription>Your digital asset holdings and performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-gray-500">Portfolio tracking coming soon...</p>
                  <Button className="mt-4" asChild>
                    <Link href="/dex-aggregator">Start Trading</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="agents" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Your AI Agents</CardTitle>
                <CardDescription>Manage your active AI service providers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-gray-500">No active AI agents yet</p>
                  <Button className="mt-4" asChild>
                    <Link href="/ai-marketplace">Browse AI Marketplace</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}