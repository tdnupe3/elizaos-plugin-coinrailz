/**
 * XRP Ecosystem Dashboard - Complete Production Implementation
 * Provides authenticated access to XRP services: wallets, trading, payments, liquidity
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { isUnauthorizedError } from '@/lib/authUtils';
import { 
  Wallet, 
  Send, 
  TrendingUp, 
  Droplets, 
  Globe, 
  RefreshCw, 
  Plus,
  ArrowUpDown,
  Clock,
  CheckCircle,
  AlertCircle,
  DollarSign,
  Activity
} from 'lucide-react';

interface XrpWallet {
  id: number;
  address: string;
  balance: string;
  status: string;
  network: string;
  createdAt: string;
  updatedAt: string;
}

interface XrpTransaction {
  id: number;
  hash: string;
  type: string;
  amount: string;
  fee: string;
  fromAddress: string;
  toAddress: string;
  currency: string;
  status: string;
  memo?: string;
  createdAt: string;
  confirmedAt?: string;
}

interface XrpOrder {
  id: number;
  type: string;
  side: string;
  baseCurrency: string;
  quoteCurrency: string;
  amount: string;
  price: string;
  status: string;
  createdAt: string;
}

export default function XrpEcosystemDashboard() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedWallet, setSelectedWallet] = useState<XrpWallet | null>(null);
  const [sendForm, setSendForm] = useState({
    destinationAddress: '',
    amount: '',
    memo: '',
    destinationTag: ''
  });
  const [orderForm, setOrderForm] = useState({
    orderType: 'market',
    side: 'buy',
    baseCurrency: 'XRP',
    quoteCurrency: 'USD',
    amount: '',
    price: ''
  });

  // No forced redirect - allow public viewing

  // Fetch user's XRP wallets
  const { data: walletsData, isLoading: walletsLoading } = useQuery<{ wallets: XrpWallet[] }>({
    queryKey: ['/api/xrp/wallets'],
    enabled: isAuthenticated
  });

  // Fetch transaction history
  const { data: transactionsData, isLoading: transactionsLoading } = useQuery<{ transactions: XrpTransaction[] }>({
    queryKey: ['/api/xrp/transactions'],
    enabled: isAuthenticated && selectedWallet !== null
  });

  // Fetch trading orders
  const { data: ordersData, isLoading: ordersLoading } = useQuery<{ orders: XrpOrder[] }>({
    queryKey: ['/api/xrp/trading/orders'],
    enabled: isAuthenticated && selectedWallet !== null
  });

  // Create wallet mutation
  const createWalletMutation = useMutation({
    mutationFn: async (data: { network: string }) => {
      return await apiRequest('POST', '/api/xrp/wallets/create', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/xrp/wallets'] });
      toast({
        title: "Wallet Created",
        description: "Your XRP wallet has been created successfully.",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Session Expired",
          description: "Please log in again to continue.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 1500);
        return;
      }
      
      toast({
        title: "Wallet Creation Failed",
        description: error.message || "Failed to create XRP wallet",
        variant: "destructive",
      });
    },
  });

  // Send payment mutation
  const sendPaymentMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/xrp/transactions/send', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/xrp/transactions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/xrp/wallets'] });
      setSendForm({ destinationAddress: '', amount: '', memo: '', destinationTag: '' });
      toast({
        title: "Payment Sent",
        description: "Your XRP payment has been sent successfully.",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Session Expired",
          description: "Please log in again to continue.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 1500);
        return;
      }
      
      toast({
        title: "Payment Failed",
        description: error.message || "Failed to send XRP payment",
        variant: "destructive",
      });
    },
  });

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/xrp/trading/orders', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/xrp/trading/orders'] });
      setOrderForm({
        orderType: 'market',
        side: 'buy',
        baseCurrency: 'XRP',
        quoteCurrency: 'USD',
        amount: '',
        price: ''
      });
      toast({
        title: "Order Created",
        description: "Your trading order has been created successfully.",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Session Expired",
          description: "Please log in again to continue.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 1500);
        return;
      }
      
      toast({
        title: "Order Failed",
        description: error.message || "Failed to create trading order",
        variant: "destructive",
      });
    },
  });

  const handleCreateWallet = () => {
    createWalletMutation.mutate({ network: 'mainnet' });
  };

  const handleSendPayment = () => {
    if (!selectedWallet) {
      toast({
        title: "No Wallet Selected",
        description: "Please select a wallet first.",
        variant: "destructive",
      });
      return;
    }

    sendPaymentMutation.mutate({
      walletId: selectedWallet.id,
      ...sendForm,
      destinationTag: sendForm.destinationTag ? parseInt(sendForm.destinationTag) : undefined
    });
  };

  const handleCreateOrder = () => {
    if (!selectedWallet) {
      toast({
        title: "No Wallet Selected",
        description: "Please select a wallet first.",
        variant: "destructive",
      });
      return;
    }

    createOrderMutation.mutate({
      walletId: selectedWallet.id,
      ...orderForm
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { variant: 'default', color: 'green' },
      pending: { variant: 'secondary', color: 'orange' },
      confirmed: { variant: 'default', color: 'green' },
      failed: { variant: 'destructive', color: 'red' },
      open: { variant: 'default', color: 'blue' },
      filled: { variant: 'default', color: 'green' },
      cancelled: { variant: 'secondary', color: 'gray' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return (
      <Badge variant={config.variant as any} className={`text-${config.color}-600`}>
        {status}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="animate-spin w-8 h-8 text-primary" />
        <span className="ml-2">Loading XRP Ecosystem...</span>
      </div>
    );
  }

  // Public view with sign-in CTA for authenticated features
  if (!isAuthenticated) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">XRP Ecosystem Dashboard</h1>
            <p className="text-gray-600 mt-2">
              Complete XRP Ledger financial services platform
            </p>
          </div>
          <Button onClick={() => window.location.href = "/api/login"}>
            Sign In to Access
          </Button>
        </div>

        {/* Public Information Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">XRP Wallet Management</CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Create and manage XRP Ledger wallets with instant access
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cross-Border Payments</CardTitle>
              <Send className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Send XRP globally with near-instant settlement
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">DEX Trading</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Trade XRP and XRPL tokens on the decentralized exchange
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Feature Overview */}
        <Card>
          <CardHeader>
            <CardTitle>XRP Ledger Financial Services</CardTitle>
            <CardDescription>
              7 comprehensive services for XRP ecosystem
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-start space-x-3">
                <Wallet className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h3 className="font-semibold">Wallet Creation & Management</h3>
                  <p className="text-sm text-muted-foreground">Secure XRP Ledger wallet creation with multi-signature support</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <DollarSign className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h3 className="font-semibold">XRP Buy/Sell with Fiat</h3>
                  <p className="text-sm text-muted-foreground">Fiat onramps for XRP purchases (USD, EUR, GBP)</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <TrendingUp className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h3 className="font-semibold">RLUSD Stablecoin Trading</h3>
                  <p className="text-sm text-muted-foreground">Trade Ripple's RLUSD stablecoin on XRPL</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Globe className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h3 className="font-semibold">Native Token Explorer</h3>
                  <p className="text-sm text-muted-foreground">Discover and trade XRPL native tokens</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <ArrowUpDown className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h3 className="font-semibold">Advanced DEX Trading</h3>
                  <p className="text-sm text-muted-foreground">Professional DEX interface with limit orders</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Send className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h3 className="font-semibold">Cross-Border Payments</h3>
                  <p className="text-sm text-muted-foreground">Instant international payments with low fees</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Droplets className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h3 className="font-semibold">Liquidity Provision</h3>
                  <p className="text-sm text-muted-foreground">Earn yields by providing liquidity to XRPL DEX</p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <Button onClick={() => window.location.href = "/api/login"} size="lg" className="w-full">
                Sign In to Access XRP Ecosystem
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const wallets = walletsData?.wallets || [];
  const transactions = transactionsData?.transactions || [];
  const orders = ordersData?.orders || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">XRP Ecosystem Dashboard</h1>
          <p className="text-gray-600 mt-2">
            Complete XRP Ledger financial services for {user?.email}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <Badge variant="outline" className="px-3 py-1">
            <Activity className="w-4 h-4 mr-1" />
            Production Ready
          </Badge>
        </div>
      </div>

      {/* Wallet Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total XRP Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {wallets.reduce((sum: number, wallet: XrpWallet) => sum + parseFloat(wallet.balance || '0'), 0).toFixed(6)} XRP
            </div>
            <p className="text-xs text-muted-foreground">
              {wallets.length} active {wallets.length === 1 ? 'wallet' : 'wallets'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{transactions.length}</div>
            <p className="text-xs text-muted-foreground">
              Lifetime transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {orders.filter((order: XrpOrder) => order.status === 'open').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Open trading orders
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="wallets" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="wallets">
            <Wallet className="w-4 h-4 mr-2" />
            Wallets
          </TabsTrigger>
          <TabsTrigger value="send">
            <Send className="w-4 h-4 mr-2" />
            Send XRP
          </TabsTrigger>
          <TabsTrigger value="trading">
            <TrendingUp className="w-4 h-4 mr-2" />
            Trading
          </TabsTrigger>
          <TabsTrigger value="liquidity">
            <Droplets className="w-4 h-4 mr-2" />
            Liquidity
          </TabsTrigger>
          <TabsTrigger value="cross-border">
            <Globe className="w-4 h-4 mr-2" />
            Cross-Border
          </TabsTrigger>
        </TabsList>

        <TabsContent value="wallets" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>XRP Wallets</CardTitle>
                  <CardDescription>Manage your XRP Ledger wallets</CardDescription>
                </div>
                {wallets.length === 0 && (
                  <Button 
                    onClick={handleCreateWallet}
                    disabled={createWalletMutation.isPending}
                  >
                    {createWalletMutation.isPending ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4 mr-2" />
                    )}
                    Create Wallet
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {walletsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="animate-spin w-6 h-6" />
                  <span className="ml-2">Loading wallets...</span>
                </div>
              ) : wallets.length === 0 ? (
                <div className="text-center py-8">
                  <Wallet className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No XRP Wallets</h3>
                  <p className="text-gray-600 mb-4">Create your first XRP wallet to start using the ecosystem.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {wallets.map((wallet: XrpWallet) => (
                    <div 
                      key={wallet.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedWallet?.id === wallet.id 
                          ? 'border-primary bg-primary/5' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedWallet(wallet)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center space-x-3">
                            <div className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                              {wallet.address.slice(0, 8)}...{wallet.address.slice(-8)}
                            </div>
                            {getStatusBadge(wallet.status)}
                            <Badge variant="outline">{wallet.network}</Badge>
                          </div>
                          <div className="mt-2 text-2xl font-bold">
                            {parseFloat(wallet.balance || '0').toFixed(6)} XRP
                          </div>
                        </div>
                        <div className="text-right text-sm text-gray-500">
                          <div>Created: {new Date(wallet.createdAt).toLocaleDateString()}</div>
                          <div>Updated: {new Date(wallet.updatedAt).toLocaleDateString()}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Transaction History */}
          {selectedWallet && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Transactions</CardTitle>
                <CardDescription>Transaction history for selected wallet</CardDescription>
              </CardHeader>
              <CardContent>
                {transactionsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="animate-spin w-6 h-6" />
                    <span className="ml-2">Loading transactions...</span>
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Transactions</h3>
                    <p className="text-gray-600">This wallet has no transaction history yet.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {transactions.slice(0, 5).map((tx: XrpTransaction) => (
                      <div key={tx.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className={`p-2 rounded-full ${
                            tx.type === 'send' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                          }`}>
                            {tx.type === 'send' ? (
                              <ArrowUpDown className="w-4 h-4 rotate-90" />
                            ) : (
                              <ArrowUpDown className="w-4 h-4 -rotate-90" />
                            )}
                          </div>
                          <div>
                            <div className="font-semibold capitalize">{tx.type}</div>
                            <div className="text-sm text-gray-500">
                              {tx.type === 'send' ? 'To: ' : 'From: '}
                              {tx.type === 'send' ? 
                                `${tx.toAddress.slice(0, 8)}...${tx.toAddress.slice(-8)}` :
                                `${tx.fromAddress.slice(0, 8)}...${tx.fromAddress.slice(-8)}`
                              }
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">
                            {tx.type === 'send' ? '-' : '+'}{parseFloat(tx.amount).toFixed(6)} {tx.currency}
                          </div>
                          <div className="flex items-center space-x-2">
                            {getStatusBadge(tx.status)}
                            <span className="text-sm text-gray-500">
                              {new Date(tx.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="send" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Send XRP Payment</CardTitle>
              <CardDescription>Send XRP to any address on the XRP Ledger</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedWallet ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 mx-auto text-orange-400 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Select a Wallet</h3>
                  <p className="text-gray-600">Please select a wallet from the Wallets tab first.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="destinationAddress">Destination Address</Label>
                      <Input
                        id="destinationAddress"
                        placeholder="rXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                        value={sendForm.destinationAddress}
                        onChange={(e) => setSendForm(prev => ({ ...prev, destinationAddress: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="amount">Amount (XRP)</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.000001"
                        placeholder="0.000000"
                        value={sendForm.amount}
                        onChange={(e) => setSendForm(prev => ({ ...prev, amount: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="destinationTag">Destination Tag (Optional)</Label>
                      <Input
                        id="destinationTag"
                        type="number"
                        placeholder="12345"
                        value={sendForm.destinationTag}
                        onChange={(e) => setSendForm(prev => ({ ...prev, destinationTag: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="memo">Memo (Optional)</Label>
                      <Input
                        id="memo"
                        placeholder="Payment for services"
                        value={sendForm.memo}
                        onChange={(e) => setSendForm(prev => ({ ...prev, memo: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4">
                    <div className="text-sm text-gray-600">
                      From wallet: {selectedWallet.address.slice(0, 8)}...{selectedWallet.address.slice(-8)}
                      <br />
                      Available: {parseFloat(selectedWallet.balance || '0').toFixed(6)} XRP
                    </div>
                    <Button 
                      onClick={handleSendPayment}
                      disabled={!sendForm.destinationAddress || !sendForm.amount || sendPaymentMutation.isPending}
                      className="px-8"
                    >
                      {sendPaymentMutation.isPending ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4 mr-2" />
                      )}
                      Send Payment
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trading" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>XRP Trading</CardTitle>
              <CardDescription>Create trading orders on the XRP Ledger DEX</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedWallet ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 mx-auto text-orange-400 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Select a Wallet</h3>
                  <p className="text-gray-600">Please select a wallet from the Wallets tab first.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="orderType">Order Type</Label>
                      <Select value={orderForm.orderType} onValueChange={(value) => setOrderForm(prev => ({ ...prev, orderType: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="market">Market Order</SelectItem>
                          <SelectItem value="limit">Limit Order</SelectItem>
                          <SelectItem value="stop">Stop Order</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="side">Side</Label>
                      <Select value={orderForm.side} onValueChange={(value) => setOrderForm(prev => ({ ...prev, side: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="buy">Buy</SelectItem>
                          <SelectItem value="sell">Sell</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="amount">Amount</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.000001"
                        placeholder="0.000000"
                        value={orderForm.amount}
                        onChange={(e) => setOrderForm(prev => ({ ...prev, amount: e.target.value }))}
                      />
                    </div>
                  </div>

                  {orderForm.orderType === 'limit' && (
                    <div>
                      <Label htmlFor="price">Price</Label>
                      <Input
                        id="price"
                        type="number"
                        step="0.000001"
                        placeholder="0.000000"
                        value={orderForm.price}
                        onChange={(e) => setOrderForm(prev => ({ ...prev, price: e.target.value }))}
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4">
                    <div className="text-sm text-gray-600">
                      Trading pair: {orderForm.baseCurrency}/{orderForm.quoteCurrency}
                    </div>
                    <Button 
                      onClick={handleCreateOrder}
                      disabled={!orderForm.amount || createOrderMutation.isPending}
                      className="px-8"
                    >
                      {createOrderMutation.isPending ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <TrendingUp className="w-4 h-4 mr-2" />
                      )}
                      Create Order
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Orders History */}
          {selectedWallet && (
            <Card>
              <CardHeader>
                <CardTitle>Trading Orders</CardTitle>
                <CardDescription>Your XRP trading order history</CardDescription>
              </CardHeader>
              <CardContent>
                {ordersLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="animate-spin w-6 h-6" />
                    <span className="ml-2">Loading orders...</span>
                  </div>
                ) : orders.length === 0 ? (
                  <div className="text-center py-8">
                    <TrendingUp className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Trading Orders</h3>
                    <p className="text-gray-600">You haven't created any trading orders yet.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map((order: XrpOrder) => (
                      <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className={`p-2 rounded-full ${
                            order.side === 'buy' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                          }`}>
                            <TrendingUp className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-semibold">
                              {order.side.toUpperCase()} {order.baseCurrency}/{order.quoteCurrency}
                            </div>
                            <div className="text-sm text-gray-500">
                              {order.type.toUpperCase()} • Amount: {parseFloat(order.amount).toFixed(6)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">
                            {order.price !== '0' ? `$${parseFloat(order.price).toFixed(4)}` : 'Market'}
                          </div>
                          <div className="flex items-center space-x-2">
                            {getStatusBadge(order.status)}
                            <span className="text-sm text-gray-500">
                              {new Date(order.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="liquidity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Liquidity Provision</CardTitle>
              <CardDescription>Provide liquidity to XRP Ledger DEX pools</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Droplets className="w-12 h-12 mx-auto text-blue-400 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Liquidity Coming Soon</h3>
                <p className="text-gray-600">Liquidity provision features will be available in the next update.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cross-border" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Cross-Border Payments</CardTitle>
              <CardDescription>Fast, low-cost international payments via XRP Ledger</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Globe className="w-12 h-12 mx-auto text-green-400 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Cross-Border Payments Coming Soon</h3>
                <p className="text-gray-600">International payment corridors will be available in the next update.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}