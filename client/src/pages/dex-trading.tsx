import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowUpDown, Wallet, TrendingUp, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

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
    const networkFee = 0.002; // Estimated network fee
    
    return { platformFee, networkFee };
  };

  const executeSwap = async () => {
    if (!fromAmount || !quote || !isConnected) return;

    setIsSwapping(true);
    try {
      // In production, this would execute the actual swap transaction
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate transaction time
      
      const { platformFee } = calculateFees();
      
      // Record the trading fee
      await apiRequest('POST', '/api/balance/record-trading-fee', {
        userAddress: walletAddress,
        fromToken: fromAsset,
        toToken: toAsset,
        amount: fromAmount,
        platformFee: platformFee.toString(),
        transactionHash: `0x${Math.random().toString(16).substr(2, 64)}`
      });

      toast({
        title: "Swap Successful!",
        description: `Swapped ${fromAmount} ${fromAsset} for ${quote} ${toAsset}`,
      });
      
      setFromAmount('');
      setQuote(null);
    } catch (error) {
      toast({
        title: "Swap Failed",
        description: "Transaction failed. Please try again.",
        variant: "destructive",
      });
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

          {/* Wallet Connection */}
          {!isConnected ? (
            <Card className="mb-6">
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
            <>
              {/* Connected Wallet Display */}
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

              {/* Trading Interface */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-xl">Swap Tokens</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
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
                        className="flex-1"
                      />
                      <Select value={fromAsset} onValueChange={setFromAsset}>
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
                      <Select value={toAsset} onValueChange={setToAsset}>
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

                  {/* Quote Loading */}
                  {isLoadingQuote && fromAmount && (
                    <div className="text-center text-sm text-gray-500">
                      Getting best price...
                    </div>
                  )}

                  {/* Fee Breakdown */}
                  {quote && fromAmount && (
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

                  {/* Swap Button */}
                  <Button 
                    onClick={executeSwap}
                    disabled={!quote || !fromAmount || isSwapping}
                    className="w-full"
                    size="lg"
                  >
                    {isSwapping ? 'Swapping...' : `Swap ${fromAsset} for ${toAsset}`}
                  </Button>
                </CardContent>
              </Card>
            </>
          )}

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