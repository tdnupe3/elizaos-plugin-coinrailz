import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { ArrowUpDown, Wallet, TrendingUp, Info, Shield, LineChart, Target, Layers } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface TradingPair {
  from: string;
  to: string;
  verified: boolean;
}

interface NetworkOption {
  id: string;
  name: string;
  displayName: string;
  icon: string;
}

const SUPPORTED_NETWORKS: NetworkOption[] = [
  { id: 'base-mainnet', name: 'base', displayName: 'Base', icon: '🔵' },
  { id: 'ethereum-mainnet', name: 'ethereum', displayName: 'Ethereum', icon: '⟐' },
  { id: 'polygon-mainnet', name: 'polygon', displayName: 'Polygon', icon: '⬣' },
  { id: 'arbitrum-mainnet', name: 'arbitrum', displayName: 'Arbitrum', icon: '🔷' },
];

export default function DEXTrading() {
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  
  // Basic trading state
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState('base-mainnet');
  const [tradingPairs, setTradingPairs] = useState<TradingPair[]>([]);
  const [fromAsset, setFromAsset] = useState('ETH');
  const [toAsset, setToAsset] = useState('USDC');
  const [fromAmount, setFromAmount] = useState('');
  const [quote, setQuote] = useState<number | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  
  // Advanced trading state
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [limitPrice, setLimitPrice] = useState('');
  const [mevProtectionEnabled, setMevProtectionEnabled] = useState(true);
  const [priorityRouting, setPriorityRouting] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState('1h');
  
  // Fetch user's MEV protection settings
  const { data: mevSettings } = useQuery({
    queryKey: ['/api/trading/mev-settings'],
    enabled: isAuthenticated,
  });
  
  // Fetch user's chart settings
  const { data: chartSettings } = useQuery({
    queryKey: ['/api/trading/chart-settings'],
    enabled: isAuthenticated,
  });
  
  // Fetch portfolio holdings
  const { data: portfolioHoldings } = useQuery({
    queryKey: ['/api/trading/portfolio'],
    enabled: isAuthenticated && isConnected,
  });
  
  // Fetch active limit orders
  const { data: limitOrders } = useQuery({
    queryKey: ['/api/trading/limit-orders'],
    enabled: isAuthenticated && isConnected,
  });

  // Mutations for advanced trading features
  const createLimitOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      return apiRequest('POST', '/api/trading/limit-orders', orderData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trading/limit-orders'] });
      toast({
        title: "Limit Order Created",
        description: "Your limit order has been placed successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Order Failed",
        description: error.message || "Failed to create limit order.",
        variant: "destructive",
      });
    }
  });

  const updateMevSettingsMutation = useMutation({
    mutationFn: async (settings: any) => {
      return apiRequest('PUT', '/api/trading/mev-settings', settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trading/mev-settings'] });
      toast({
        title: "MEV Protection Updated",
        description: "Your MEV protection settings have been saved.",
      });
    }
  });

  const updateChartSettingsMutation = useMutation({
    mutationFn: async (settings: any) => {
      return apiRequest('PUT', '/api/trading/chart-settings', settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trading/chart-settings'] });
    }
  });

  // Load trading pairs when network changes
  useEffect(() => {
    const loadTradingPairs = async () => {
      try {
        const response = await apiRequest('GET', `/api/dex/trading-pairs?chain=${selectedNetwork}`);
        setTradingPairs(response.pairs || []);
      } catch (error) {
        console.error('Failed to load trading pairs:', error);
      }
    };

    loadTradingPairs();
  }, [selectedNetwork]);

  // Get quote when amount or assets change
  useEffect(() => {
    const getQuote = async () => {
      if (!fromAmount || !fromAsset || !toAsset || !isConnected) return;
      
      setIsLoadingQuote(true);
      try {
        const response = await apiRequest('GET', 
          `/api/dex/quote?fromAsset=${fromAsset}&toAsset=${toAsset}&amount=${fromAmount}&walletAddress=${walletAddress}`
        );
        setQuote(response.price);
      } catch (error) {
        console.error('Failed to get quote:', error);
        setQuote(null);
      } finally {
        setIsLoadingQuote(false);
      }
    };

    const debounceTimer = setTimeout(getQuote, 500);
    return () => clearTimeout(debounceTimer);
  }, [fromAmount, fromAsset, toAsset, walletAddress, isConnected]);

  const connectWallet = async () => {
    try {
      // Check if MetaMask is installed
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        const provider = (window as any).ethereum;
        
        try {
          // Request account access
          const accounts = await provider.request({
            method: 'eth_requestAccounts'
          });
          
          if (accounts.length > 0) {
            setWalletAddress(accounts[0]);
            setIsConnected(true);
            
            // Get network information
            const chainId = await provider.request({ method: 'eth_chainId' });
            const networkName = getNetworkName(chainId);
            
            toast({
              title: "Wallet Connected Successfully!",
              description: `Connected to ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)} on ${networkName}`,
            });

            // Listen for account changes
            provider.on('accountsChanged', (accounts: string[]) => {
              if (accounts.length === 0) {
                disconnectWallet();
              } else {
                setWalletAddress(accounts[0]);
              }
            });

            // Listen for network changes
            provider.on('chainChanged', () => {
              window.location.reload();
            });
          }
        } catch (error: any) {
          if (error.code === 4001) {
            toast({
              title: "Connection Rejected",
              description: "Please accept the wallet connection to continue.",
              variant: "destructive",
            });
          } else {
            throw error;
          }
        }
      } else {
        // No Web3 wallet detected
        toast({
          title: "No Wallet Detected",
          description: "Please install MetaMask or another Web3 wallet to continue.",
          variant: "destructive",
        });
        
        // Open MetaMask installation page
        window.open('https://metamask.io/download/', '_blank');
      }
    } catch (error: any) {
      console.error('Wallet connection error:', error);
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect wallet. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getNetworkName = (chainId: string) => {
    const networks: { [key: string]: string } = {
      '0x1': 'Ethereum Mainnet',
      '0x89': 'Polygon',
      '0x38': 'BNB Chain',
      '0xa4b1': 'Arbitrum',
      '0xa': 'Optimism',
      '0x2105': 'Base',
    };
    return networks[chainId] || 'Unknown Network';
  };

  const disconnectWallet = () => {
    setIsConnected(false);
    setWalletAddress('');
    setQuote(null);
    toast({
      title: "Wallet Disconnected",
      description: "Your wallet has been disconnected.",
    });
  };

  const swapAssets = () => {
    const tempAsset = fromAsset;
    setFromAsset(toAsset);
    setToAsset(tempAsset);
    setFromAmount('');
    setQuote(null);
  };

  const calculateFees = () => {
    if (!quote || !fromAmount) return { platformFee: 0, networkFee: 0.002 };
    
    const amount = parseFloat(fromAmount);
    const platformFee = amount * 0.0025; // 0.25% platform fee
    const networkFee = 0.002; // Real network fee will come from quote
    
    return { platformFee, networkFee };
  };

  const executeSwap = async () => {
    if (!fromAmount || !quote || !isConnected) return;

    setIsSwapping(true);
    try {
      console.log(`🔄 Executing REAL trade: ${fromAmount} ${fromAsset} → ${toAsset}`);
      
      // PRODUCTION: Execute real blockchain transaction via Coinbase CDP
      const tradeResult = await apiRequest('POST', '/api/dex/execute-trade', {
        fromAsset,
        toAsset,
        amount: fromAmount,
        quote,
        walletAddress,
        userId: user?.id || null // Use authenticated user ID if available
      });

      console.log(`✅ REAL trade completed:`, tradeResult);

      toast({
        title: "Swap Successful!",
        description: `Swapped ${fromAmount} ${fromAsset} for ${tradeResult.transaction.outputAmount} ${toAsset}`,
      });
      
      setFromAmount('');
      setQuote(null);
    } catch (error: any) {
      console.error('❌ Trade execution failed:', error);
      toast({
        title: "Swap Failed",
        description: error.message || "Transaction failed. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSwapping(false);
    }
  };

  const createLimitOrder = async () => {
    if (!fromAmount || !limitPrice || !isConnected || !isAuthenticated) return;

    setIsSwapping(true);
    try {
      console.log(`🎯 Creating limit order: ${fromAmount} ${fromAsset} → ${toAsset} at $${limitPrice}`);
      
      const orderData = {
        fromAsset,
        toAsset,
        amount: parseFloat(fromAmount),
        limitPrice: parseFloat(limitPrice),
        orderType: 'limit',
        network: selectedNetwork
      };

      await createLimitOrderMutation.mutateAsync(orderData);
      
      setFromAmount('');
      setLimitPrice('');
    } catch (error: any) {
      console.error('❌ Limit order creation failed:', error);
      // Error handling is done in the mutation
    } finally {
      setIsSwapping(false);
    }
  };

  const fees = calculateFees();
  const selectedNetworkInfo = SUPPORTED_NETWORKS.find(n => n.id === selectedNetwork);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-4">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Coin Railz <span className="text-blue-600">Advanced Trading</span>
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Professional trading with smart order routing
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
            <span>Powered by</span>
            <Badge variant="outline" className="bg-blue-50 border-blue-200 text-blue-700">
              Coinbase DEX Trading
            </Badge>
          </div>
        </div>

        <div className="max-w-md mx-auto">
          {/* Network Selector */}
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Select Network
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedNetwork} onValueChange={setSelectedNetwork}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_NETWORKS.map((network) => (
                    <SelectItem key={network.id} value={network.id}>
                      <div className="flex items-center gap-2">
                        <span>{network.icon}</span>
                        <span>{network.displayName}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Wallet Connection Status */}
          {!isConnected ? (
            <Card className="mb-6 border-blue-200 bg-blue-50 dark:bg-blue-900/20">
              <CardContent className="pt-6">
                <Button onClick={connectWallet} className="w-full" size="lg">
                  <Wallet className="mr-2 h-4 w-4" />
                  Connect Wallet to Start Trading
                </Button>
                <p className="text-center text-sm text-gray-500 mt-3">
                  No signup required • Guest trading available
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="mb-6 border-green-200 bg-green-50 dark:bg-green-900/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm font-medium">
                      {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                    </span>
                    <Badge variant="secondary">{selectedNetworkInfo?.displayName}</Badge>
                  </div>
                  <Button variant="ghost" size="sm" onClick={disconnectWallet}>
                    Disconnect
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Advanced Trading Interface */}
          <Card className="mb-6">
            <Tabs defaultValue="trade" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="trade">Trade</TabsTrigger>
                <TabsTrigger value="orders">Orders</TabsTrigger>
                <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>
              
              {/* Main Trading Tab */}
              <TabsContent value="trade" className="space-y-4">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Advanced Trading
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Order Type Selector */}
                  <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                    <Button
                      variant={orderType === 'market' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setOrderType('market')}
                      className="flex-1"
                    >
                      Market Order
                    </Button>
                    <Button
                      variant={orderType === 'limit' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setOrderType('limit')}
                      className="flex-1"
                    >
                      <Target className="h-4 w-4 mr-1" />
                      Limit Order
                    </Button>
                  </div>

                  {/* MEV Protection Status */}
                  {isAuthenticated && (
                    <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                          MEV Protection
                        </span>
                        <Badge variant={mevProtectionEnabled ? 'default' : 'secondary'}>
                          {mevProtectionEnabled ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      {priorityRouting && (
                        <Badge variant="outline" className="bg-yellow-50 border-yellow-200 text-yellow-700">
                          <Layers className="h-3 w-3 mr-1" />
                          Priority Routing
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* From Token */}
                  <div className="space-y-2">
                    <Label htmlFor="from-amount">From</Label>
                    <div className="flex gap-2">
                      <Input
                        id="from-amount"
                        type="number"
                        placeholder="0.0"
                        value={fromAmount}
                        onChange={(e) => setFromAmount(e.target.value)}
                        disabled={!isConnected}
                        className="flex-1"
                      />
                      <Select value={fromAsset} onValueChange={setFromAsset} disabled={!isConnected}>
                        <SelectTrigger className="w-[100px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from(new Set(tradingPairs.flatMap(p => [p.from, p.to]))).map(asset => (
                            <SelectItem key={asset} value={asset}>{asset}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Swap Button */}
                  <div className="flex justify-center">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={swapAssets}
                      disabled={!isConnected}
                      className="rounded-full w-10 h-10 p-0"
                    >
                      <ArrowUpDown className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* To Token */}
                  <div className="space-y-2">
                    <Label htmlFor="to-amount">To</Label>
                    <div className="flex gap-2">
                      <Input
                        id="to-amount"
                        type="number"
                        placeholder="0.0"
                        value={quote ? quote.toString() : ''}
                        readOnly
                        className="flex-1 bg-gray-50 dark:bg-gray-800"
                      />
                      <Select value={toAsset} onValueChange={setToAsset} disabled={!isConnected}>
                        <SelectTrigger className="w-[100px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from(new Set(tradingPairs.flatMap(p => [p.from, p.to]))).map(asset => (
                            <SelectItem key={asset} value={asset}>{asset}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Limit Order Price Input (only for limit orders) */}
                  {orderType === 'limit' && (
                    <div className="space-y-2">
                      <Label htmlFor="limit-price">Limit Price</Label>
                      <Input
                        id="limit-price"
                        type="number"
                        placeholder="Enter limit price"
                        value={limitPrice}
                        onChange={(e) => setLimitPrice(e.target.value)}
                        disabled={!isConnected}
                      />
                      <p className="text-xs text-gray-500">
                        Order will execute when {toAsset} reaches this price
                      </p>
                    </div>
                  )}

              {/* Quote Loading */}
              {isLoadingQuote && fromAmount && isConnected && (
                <div className="text-center text-sm text-gray-500">
                  Getting best price...
                </div>
              )}

              {/* Fee Breakdown */}
              {quote && fromAmount && isConnected && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <Info className="h-4 w-4" />
                    Fee Breakdown
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Platform fee (0.25%)</span>
                      <span>${fees.platformFee.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Network fee</span>
                      <span>~${fees.networkFee.toFixed(4)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-medium">
                      <span>Total fees</span>
                      <span>${(fees.platformFee + fees.networkFee).toFixed(4)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Wallet Connection Required Message */}
              {!isConnected && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-center">
                  <div className="flex items-center justify-center gap-2 text-blue-700 dark:text-blue-300 mb-2">
                    <Wallet className="h-4 w-4" />
                    <span className="font-medium">Connect wallet to enable trading</span>
                  </div>
                  <p className="text-sm text-blue-600 dark:text-blue-400">
                    Click "Connect Wallet" above to start making swaps
                  </p>
                </div>
              )}

                  {/* Execute Button */}
                  <Button 
                    onClick={orderType === 'market' ? executeSwap : createLimitOrder}
                    disabled={isConnected && (!quote || !fromAmount || isSwapping || (orderType === 'limit' && !limitPrice))}
                    className="w-full"
                    size="lg"
                  >
                    {!isConnected 
                      ? 'Connect Wallet to Trade' 
                      : isSwapping 
                        ? orderType === 'market' ? 'Swapping...' : 'Creating Order...'
                        : orderType === 'market' 
                          ? `Swap ${fromAsset} for ${toAsset}`
                          : `Create Limit Order`
                    }
                  </Button>
                </CardContent>
              </TabsContent>

              {/* Active Orders Tab */}
              <TabsContent value="orders" className="space-y-4">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Active Orders
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!isAuthenticated ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500 mb-4">Sign in to view your active orders</p>
                      <Button variant="outline">Sign In</Button>
                    </div>
                  ) : !limitOrders?.length ? (
                    <div className="text-center py-8">
                      <Target className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">No active limit orders</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {limitOrders.map((order: any) => (
                        <div key={order.id} className="p-3 border rounded-lg">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium">{order.fromAsset} → {order.toAsset}</p>
                              <p className="text-sm text-gray-500">
                                {order.amount} at ${order.limitPrice}
                              </p>
                            </div>
                            <div className="text-right">
                              <Badge variant={order.status === 'active' ? 'default' : 'secondary'}>
                                {order.status}
                              </Badge>
                              <p className="text-xs text-gray-500 mt-1">
                                {new Date(order.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </TabsContent>

              {/* Portfolio Tab */}
              <TabsContent value="portfolio" className="space-y-4">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Wallet className="h-5 w-5" />
                    Portfolio Tracking
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!isAuthenticated ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500 mb-4">Sign in to track your portfolio</p>
                      <Button variant="outline">Sign In</Button>
                    </div>
                  ) : !portfolioHoldings?.length ? (
                    <div className="text-center py-8">
                      <Wallet className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">No holdings tracked yet</p>
                      <p className="text-xs text-gray-400 mt-2">Make a trade to start tracking</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {portfolioHoldings.map((holding: any) => (
                        <div key={holding.id} className="p-3 border rounded-lg">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium">{holding.asset}</p>
                              <p className="text-sm text-gray-500">
                                {holding.balance} tokens
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">${holding.usdValue}</p>
                              <p className={`text-xs ${holding.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {holding.pnl >= 0 ? '+' : ''}{holding.pnl.toFixed(2)}%
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </TabsContent>

              {/* Settings Tab */}
              <TabsContent value="settings" className="space-y-4">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Trading Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {!isAuthenticated ? (
                    <div className="text-center py-8">
                      <p className="text-gray-500 mb-4">Sign in to customize your trading settings</p>
                      <Button variant="outline">Sign In</Button>
                    </div>
                  ) : (
                    <>
                      {/* MEV Protection Settings */}
                      <div className="space-y-4">
                        <h3 className="font-medium flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          MEV Protection
                        </h3>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">Enable MEV Protection</p>
                              <p className="text-sm text-gray-500">
                                Protect against front-running and sandwich attacks
                              </p>
                            </div>
                            <Switch
                              checked={mevProtectionEnabled}
                              onCheckedChange={(checked) => {
                                setMevProtectionEnabled(checked);
                                updateMevSettingsMutation.mutate({
                                  mevProtectionEnabled: checked,
                                  priorityRouting: priorityRouting
                                });
                              }}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">Priority Routing</p>
                              <p className="text-sm text-gray-500">
                                Get priority access to liquidity pools
                              </p>
                            </div>
                            <Switch
                              checked={priorityRouting}
                              onCheckedChange={(checked) => {
                                setPriorityRouting(checked);
                                updateMevSettingsMutation.mutate({
                                  mevProtectionEnabled: mevProtectionEnabled,
                                  priorityRouting: checked
                                });
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* Chart Settings */}
                      <div className="space-y-4">
                        <h3 className="font-medium flex items-center gap-2">
                          <LineChart className="h-4 w-4" />
                          Chart Preferences
                        </h3>
                        <div className="space-y-3">
                          <div>
                            <Label>Default Timeframe</Label>
                            <Select 
                              value={selectedTimeframe} 
                              onValueChange={(value) => {
                                setSelectedTimeframe(value);
                                updateChartSettingsMutation.mutate({
                                  defaultTimeframe: value,
                                  chartType: 'candlestick'
                                });
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1m">1 Minute</SelectItem>
                                <SelectItem value="5m">5 Minutes</SelectItem>
                                <SelectItem value="15m">15 Minutes</SelectItem>
                                <SelectItem value="1h">1 Hour</SelectItem>
                                <SelectItem value="4h">4 Hours</SelectItem>
                                <SelectItem value="1d">1 Day</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </TabsContent>
            </Tabs>
          </Card>

          {/* Features */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>Multi-chain support across 6 networks</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Competitive 0.25% trading fees</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span>Smart order routing technology</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span>No KYC required for guest trading</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}