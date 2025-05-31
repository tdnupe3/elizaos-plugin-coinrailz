import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Bitcoin, Send, Download, ArrowLeftRight, TrendingUp, TrendingDown, ArrowUp, ArrowDown, Wallet, History, Users, Home, RefreshCw, AlertTriangle } from "lucide-react";
import { useLocation } from "wouter";
import { demoApi } from "@/lib/demoApiService";
import { BalanceCardSkeleton, TransactionSkeleton, CryptoHoldingSkeleton } from "@/components/ui/loading-skeleton";
import { ErrorBoundary, EmptyState, NetworkErrorFallback } from "@/components/ui/error-boundary";

export default function DemoDashboard() {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<any>(null);
  const [walletBalances, setWalletBalances] = useState<any[]>([]);
  const [cryptoHoldings, setCryptoHoldings] = useState<any[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [cryptoPrices, setCryptoPrices] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDemoData();
  }, []);

  const loadDemoData = async () => {
    try {
      const [userData, walletData, cryptoData, transactionData, pricesData] = await Promise.all([
        demoApi.getUser(),
        demoApi.getWalletBalances(),
        demoApi.getCryptoHoldings(),
        demoApi.getTransactions(),
        demoApi.getCryptoPrices()
      ]);

      setUser(userData);
      setWalletBalances(walletData);
      setCryptoHoldings(cryptoData);
      setRecentTransactions(transactionData.slice(0, 5));
      setCryptoPrices(pricesData);
    } catch (error) {
      console.error('Error loading demo data:', error);
      setError('Unable to load dashboard data. Please try refreshing the page.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDemoData();
  };

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  const formatCrypto = (amount: string | number, decimals: number = 8) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return num.toFixed(decimals);
  };

  const getChangeColor = (change: number) => {
    return change >= 0 ? 'text-blue-600' : 'text-slate-600';
  };

  const getChangeIcon = (change: number) => {
    return change >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />;
  };

  const usdWallet = walletBalances.find(w => w.currency === 'USD');
  const totalCryptoValue = cryptoHoldings.reduce((total, holding) => total + holding.value, 0);
  const totalPortfolioValue = (usdWallet ? parseFloat(usdWallet.balance) : 0) + totalCryptoValue;

  if (loading) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-gray-50">
          {/* Header Skeleton */}
          <div className="bg-white border-b border-gray-200 p-4">
            <div className="max-w-6xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-200 rounded animate-pulse" />
                <div className="w-32 h-6 bg-gray-200 rounded animate-pulse" />
              </div>
              <div className="w-20 h-8 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>

          {/* Content Skeleton */}
          <div className="max-w-6xl mx-auto p-4 space-y-6">
            {/* Balance Cards Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <BalanceCardSkeleton />
              <BalanceCardSkeleton />
              <BalanceCardSkeleton />
            </div>

            {/* Main Content Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Transactions Skeleton */}
              <div className="space-y-4">
                <div className="w-48 h-6 bg-gray-200 rounded animate-pulse" />
                <div className="space-y-3">
                  <TransactionSkeleton />
                  <TransactionSkeleton />
                  <TransactionSkeleton />
                </div>
              </div>

              {/* Crypto Holdings Skeleton */}
              <div className="space-y-4">
                <div className="w-40 h-6 bg-gray-200 rounded animate-pulse" />
                <div className="space-y-3">
                  <CryptoHoldingSkeleton />
                  <CryptoHoldingSkeleton />
                  <CryptoHoldingSkeleton />
                </div>
              </div>
            </div>
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  if (error) {
    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-gray-50">
          <div className="bg-white border-b border-gray-200 p-4">
            <div className="max-w-6xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Home className="w-6 h-6 text-blue-600" />
                <span className="text-lg font-semibold">Demo Dashboard</span>
              </div>
            </div>
          </div>
          <div className="max-w-6xl mx-auto p-4">
            <NetworkErrorFallback onRetry={handleRefresh} />
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <div className="min-h-screen bg-gray-200">
      {/* Demo Mode Header */}
      <div className="bg-blue-600 text-white px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="bg-blue-500 text-white">
              DEMO MODE
            </Badge>
            <span className="text-sm">Testing all features with sample data - no real transactions</span>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm"
              className="text-white hover:bg-blue-500"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              className="text-blue-600 bg-white hover:bg-gray-100"
              onClick={() => setLocation('/')}
            >
              <Home className="h-4 w-4 mr-1" />
              Exit Demo
            </Button>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome back, {user?.firstName}!
            </h1>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                onClick={() => setLocation('/demo/history')}
              >
                <History className="h-4 w-4 mr-1" />
                History
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                onClick={() => setLocation('/transfer')}
              >
                <Send className="h-4 w-4 mr-1" />
                Send Crypto
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                onClick={() => setLocation('/portfolio-analytics')}
              >
                <TrendingUp className="h-4 w-4 mr-1" />
                Analytics
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Portfolio Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Portfolio</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalPortfolioValue)}</div>
              <p className="text-xs text-muted-foreground">USD + Crypto</p>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">USD Wallet</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(usdWallet?.balance || 0)}</div>
              <p className="text-xs text-muted-foreground">Available: {formatCurrency(usdWallet?.availableBalance || 0)}</p>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Crypto Value</CardTitle>
              <Bitcoin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalCryptoValue)}</div>
              <p className="text-xs text-muted-foreground">{cryptoHoldings.length} holdings</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button 
              className="h-20 flex flex-col gap-2 bg-white hover:bg-gray-50 border-gray-200" 
              variant="outline"
              onClick={() => setLocation('/demo/send')}
            >
              <Send className="h-6 w-6" />
              <span className="text-sm">Send Money</span>
            </Button>
            <Button 
              className="h-20 flex flex-col gap-2 bg-white hover:bg-gray-50 border-gray-200" 
              variant="outline"
              onClick={() => setLocation('/demo/buy-sell')}
            >
              <Download className="h-6 w-6" />
              <span className="text-sm">Buy Crypto</span>
            </Button>
            <Button 
              className="h-20 flex flex-col gap-2 bg-white hover:bg-gray-50 border-gray-200" 
              variant="outline"
              onClick={() => setLocation('/demo/buy-sell')}
            >
              <ArrowLeftRight className="h-6 w-6" />
              <span className="text-sm">Sell Crypto</span>
            </Button>
            <Button 
              className="h-20 flex flex-col gap-2 bg-white hover:bg-gray-50 border-gray-200" 
              variant="outline"
              onClick={() => setLocation('/swap')}
            >
              <ArrowLeftRight className="h-6 w-6" />
              <span className="text-sm">Swap</span>
            </Button>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="bg-white">
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentTransactions.map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50">
                    <div className="flex items-center gap-3">
                      {transaction.type === 'receive' ? (
                        <ArrowDown className="h-4 w-4 text-blue-600" />
                      ) : (
                        <ArrowUp className="h-4 w-4 text-slate-600" />
                      )}
                      <div>
                        <p className="font-medium capitalize">{transaction.type}</p>
                        <p className="text-sm text-muted-foreground">
                          {transaction.fromEmail || transaction.toEmail}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-medium ${
                        transaction.type === 'receive' ? 'text-blue-600' : 'text-slate-600'
                      }`}>
                        {transaction.type === 'receive' ? '+' : '-'}{formatCurrency(transaction.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">{transaction.platform}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white">
            <CardHeader>
              <CardTitle>Crypto Holdings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {cryptoHoldings.slice(0, 5).map((holding) => (
                  <div key={holding.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-blue-600">{holding.coinSymbol}</span>
                      </div>
                      <div>
                        <p className="font-medium">{holding.coinName}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatCrypto(holding.amount)} {holding.coinSymbol}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(holding.value)}</p>
                      <div className={`flex items-center gap-1 text-xs ${getChangeColor(cryptoPrices[holding.coinSymbol]?.change || 0)}`}>
                        {getChangeIcon(cryptoPrices[holding.coinSymbol]?.change || 0)}
                        {Math.abs(cryptoPrices[holding.coinSymbol]?.change || 0).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}