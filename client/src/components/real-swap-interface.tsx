import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDownUp, AlertTriangle, CheckCircle, ExternalLink, Search, Plus } from "@/lib/icons";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useWallet } from "@/hooks/useWallet";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import peezyMascot from "@assets/peezy logo_1752028927702.jpg";

interface SwapQuote {
  bestQuote: {
    dex: string;
    inputAmount: string;
    outputAmount: string;
    exchangeRate: number;
    priceImpact: number;
    gasEstimate: string;
    route: string[];
    confidence: number;
    estimatedTime: string;
  };
  allQuotes: any[];
  platformFee: string;
  platformFeeUSD: string;
  totalOutputAfterFees: string;
  priceImpactWarning: boolean;
  slippageWarning: boolean;
}

interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  decimals?: number;
  verified?: boolean;
  logoURI?: string;
  coinGeckoId?: string;
}

interface CustomTokenForm {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

const supportedTokens: TokenInfo[] = [
  { symbol: 'ETH', name: 'Ethereum', address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', decimals: 18, verified: true, coinGeckoId: 'ethereum' },
  { symbol: 'USDC', name: 'USD Coin', address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', decimals: 6, verified: true, coinGeckoId: 'usd-coin' },
  { symbol: 'USDT', name: 'Tether', address: '0xdac17f958d2ee523a2206206994597c13d831ec7', decimals: 6, verified: true, coinGeckoId: 'tether' },
  { symbol: 'DAI', name: 'MakerDAO DAI', address: '0x6b175474e89094c44da98b954eedeac495271d0f', decimals: 18, verified: true, coinGeckoId: 'dai' },
  { symbol: 'PEEZY', name: 'PEEZY Token', address: '0x698b1d54E936b9F772b8F58447194bBc82EC1933', decimals: 18, verified: true }
];

export function RealSwapInterface() {
  const { toast } = useToast();
  const { wallet, connectWallet, signTransaction } = useWallet();
  const { user } = useAuth();
  const [fromToken, setFromToken] = useState('USDC');
  const [toToken, setToToken] = useState('ETH');
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState(5.0);
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [usdcBalance, setUsdcBalance] = useState('0.00');
  const [customTokens, setCustomTokens] = useState<TokenInfo[]>([]);
  const [showCustomTokenDialog, setShowCustomTokenDialog] = useState(false);
  const [customTokenForm, setCustomTokenForm] = useState<CustomTokenForm>({
    address: '',
    symbol: '',
    name: '',
    decimals: 18
  });

  // Fetch USDC balance for authenticated users
  useEffect(() => {
    if (user) {
      const fetchUSDCBalance = async () => {
        try {
          const response = await apiRequest('/api/user/circle/balance');
          if (response.data && response.data.balance) {
            setUsdcBalance(response.data.balance);
          }
        } catch (error) {
          console.error('Error fetching USDC balance:', error);
        }
      };
      fetchUSDCBalance();
    }
  }, [user]);
  const [tokenSearchTerm, setTokenSearchTerm] = useState('');
  const [isLoadingTokenInfo, setIsLoadingTokenInfo] = useState(false);
  const [selectedChain, setSelectedChain] = useState(1); // Default to Ethereum
  const [tokenLogos, setTokenLogos] = useState<Record<string, string>>({});

  // Token logo fetching utility
  const getTokenLogo = (token: TokenInfo): string => {
    // Return cached logo if available
    if (tokenLogos[token.symbol]) {
      return tokenLogos[token.symbol];
    }
    
    // Special case for PEEZY - use local asset
    if (token.symbol === 'PEEZY') {
      return peezyMascot;
    }
    
    // Use CoinGecko API for other tokens
    if (token.coinGeckoId) {
      const logoUrl = `https://assets.coingecko.com/coins/images/${getCoinGeckoImageId(token.coinGeckoId)}/thumb/${token.symbol.toLowerCase()}.png`;
      // Cache the logo URL
      setTokenLogos(prev => ({ ...prev, [token.symbol]: logoUrl }));
      return logoUrl;
    }
    
    return '';
  };

  // CoinGecko image ID mapping
  const getCoinGeckoImageId = (coinGeckoId: string): string => {
    const idMap: Record<string, string> = {
      'ethereum': '279',
      'usd-coin': '6319',
      'tether': '325',
      'dai': '9956'
    };
    return idMap[coinGeckoId] || coinGeckoId;
  };

  // Supported chains
  const supportedChains = [
    { id: 1, name: 'Ethereum', symbol: 'ETH', color: 'bg-blue-500' },
    { id: 137, name: 'Polygon', symbol: 'MATIC', color: 'bg-purple-500' },
    { id: 56, name: 'BNB Chain', symbol: 'BNB', color: 'bg-yellow-500' },
    { id: 42161, name: 'Arbitrum', symbol: 'ETH', color: 'bg-sky-500' },
    { id: 10, name: 'Optimism', symbol: 'ETH', color: 'bg-red-500' },
    { id: 8453, name: 'Base', symbol: 'ETH', color: 'bg-indigo-500' },
    { id: 369, name: 'PulseChain', symbol: 'PLS', color: 'bg-pink-500' }
  ];

  // Combine predefined and custom tokens
  const allTokens = [...supportedTokens, ...customTokens];

  // Token Logo Component
  const TokenLogo = ({ token, size = "w-4 h-4" }: { token: TokenInfo, size?: string }) => {
    const [logoError, setLogoError] = useState(false);
    const logoUrl = getTokenLogo(token);
    
    // Special case for PEEZY - use local asset
    if (token.symbol === 'PEEZY') {
      return (
        <img 
          src={peezyMascot} 
          alt={token.symbol} 
          className={`${size} rounded-full object-cover`}
        />
      );
    }
    
    // Use CoinGecko logo if available and not errored
    if (logoUrl && !logoError) {
      return (
        <img 
          src={logoUrl} 
          alt={token.symbol} 
          className={`${size} rounded-full object-cover`}
          onError={() => setLogoError(true)}
        />
      );
    }
    
    // Fallback to colored circle with first letter
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 
      'bg-red-500', 'bg-indigo-500', 'bg-pink-500', 'bg-teal-500'
    ];
    const colorIndex = token.symbol.charCodeAt(0) % colors.length;
    
    return (
      <div className={`${size} rounded-full ${colors[colorIndex]} flex items-center justify-center`}>
        <span className="text-white text-xs font-bold">
          {token.symbol.charAt(0)}
        </span>
      </div>
    );
  };

  // Auto-sync chain selection with wallet connection
  useEffect(() => {
    if (wallet.isConnected && wallet.chainId) {
      const isSupported = supportedChains.some(chain => chain.id === wallet.chainId);
      if (isSupported && selectedChain !== wallet.chainId) {
        setSelectedChain(wallet.chainId);
      }
    }
  }, [wallet.isConnected, wallet.chainId, selectedChain]);

  // Auto-detect token info from contract address
  const detectTokenInfoMutation = useMutation({
    mutationFn: async (contractAddress: string) => {
      const response = await apiRequest('GET', `/api/dex/token-info/${contractAddress}`);
      return response;
    },
    onSuccess: (data) => {
      setIsLoadingTokenInfo(false);
      if (data.success && data.tokenInfo) {
        setCustomTokenForm(prev => ({
          ...prev,
          symbol: data.tokenInfo.symbol || '',
          name: data.tokenInfo.name || '',
          decimals: data.tokenInfo.decimals || 18
        }));
        toast({
          title: "Token Detected",
          description: `Found ${data.tokenInfo.symbol} (${data.tokenInfo.name})`,
        });
      } else {
        toast({
          title: "Token Not Found",
          description: "Could not detect token information from this address",
          variant: "destructive"
        });
      }
    },
    onError: (error) => {
      setIsLoadingTokenInfo(false);
      toast({
        title: "Detection Failed",
        description: "Failed to detect token information",
        variant: "destructive"
      });
    }
  });

  // Add custom token
  const addCustomToken = () => {
    if (!customTokenForm.address || !customTokenForm.symbol) {
      toast({
        title: "Invalid Token",
        description: "Please provide a valid contract address and symbol",
        variant: "destructive"
      });
      return;
    }

    const newToken: TokenInfo = {
      symbol: customTokenForm.symbol,
      name: customTokenForm.name,
      address: customTokenForm.address,
      decimals: customTokenForm.decimals,
      verified: false
    };

    setCustomTokens(prev => [...prev, newToken]);
    setCustomTokenForm({ address: '', symbol: '', name: '', decimals: 18 });
    setShowCustomTokenDialog(false);
    
    toast({
      title: "Token Added",
      description: `${newToken.symbol} is now available for trading`,
    });
  };

  // Handle contract address input change
  const handleAddressChange = (address: string) => {
    setCustomTokenForm(prev => ({ ...prev, address }));
    
    // Auto-detect token info if address looks valid
    if (address.length === 42 && address.startsWith('0x')) {
      setIsLoadingTokenInfo(true);
      detectTokenInfoMutation.mutate(address);
    }
  };

  // Get quote mutation
  const getQuoteMutation = useMutation({
    mutationFn: async () => {
      // Get token addresses from allTokens
      const fromTokenData = allTokens.find(t => t.symbol === fromToken);
      const toTokenData = allTokens.find(t => t.symbol === toToken);
      
      const response = await apiRequest('POST', '/api/dex/quote', {
        fromToken: fromTokenData?.address || fromToken,
        toToken: toTokenData?.address || toToken,
        amount,
        chainId: selectedChain,
        slippage
      });
      return response;
    },
    onSuccess: (data) => {
      if (data.success) {
        setQuote(data.quote);
        toast({
          title: "Quote Retrieved",
          description: `1 ${fromToken} = ${data.quote.bestQuote.exchangeRate.toFixed(2)} ${toToken}`,
        });
      } else {
        toast({
          title: "Quote Failed",
          description: data.error || "Failed to get swap quote",
          variant: "destructive"
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Quote Error",
        description: error.message || "Failed to get swap quote",
        variant: "destructive"
      });
    }
  });

  // Execute real swap mutation - supports both external wallets and Circle wallets
  const executeSwapMutation = useMutation({
    mutationFn: async () => {
      if (!quote) {
        throw new Error('No quote available');
      }

      // Check if user is using Circle wallet (authenticated user) or external wallet
      const isCircleWallet = user && fromToken === 'USDC';
      
      if (isCircleWallet) {
        // Use Circle wallet for USDC swaps
        const response = await apiRequest('POST', '/api/user/circle/swap', {
          fromToken: 'USDC',
          toToken,
          amount,
          slippage,
          chainId: selectedChain
        });
        
        if (!response.success) {
          throw new Error(response.error || 'Circle wallet swap failed');
        }
        
        return response.data;
      } else {
        // Use external wallet (MetaMask, etc.)
        if (!wallet.isConnected || !wallet.address) {
          throw new Error('Wallet not connected');
        }

        // Step 1: Get transaction data from our API
        const fromTokenData = allTokens.find(t => t.symbol === fromToken);
        const toTokenData = allTokens.find(t => t.symbol === toToken);
        
        const response = await apiRequest('POST', '/api/dex/swap-prepare', {
          fromToken: fromTokenData?.address || fromToken,
          toToken: toTokenData?.address || toToken,
          amount,
          slippage,
          userAddress: wallet.address,
          chainId: selectedChain
        });
        
        const swapData = await response.json();
        
        if (!swapData.success) {
          throw new Error(swapData.error || 'Failed to prepare swap');
        }

        // Step 2: Execute transaction through MetaMask
        const txHash = await signTransaction(swapData.transactionData);

        return { transactionHash: txHash, ...swapData };
      }
    },
    onSuccess: (data) => {
      toast({
        title: "Swap Executed!",
        description: `Transaction: ${data.transactionHash.slice(0, 10)}...`,
      });
      setQuote(null);
      setAmount('');
    },
    onError: (error: any) => {
      toast({
        title: "Swap Failed",
        description: error.message || "Transaction was rejected",
        variant: "destructive"
      });
    }
  });

  const handleGetQuote = () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount",
        variant: "destructive"
      });
      return;
    }
    getQuoteMutation.mutate();
  };

  const handleSwapTokens = () => {
    const tempFrom = fromToken;
    setFromToken(toToken);
    setToToken(tempFrom);
    setQuote(null);
  };

  const handleExecuteSwap = () => {
    if (!wallet.isConnected) {
      connectWallet();
      return;
    }
    executeSwapMutation.mutate();
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Multi-Chain DEX Swap</span>
          <div className="flex space-x-2">
            <Badge variant="outline" className="bg-green-50 text-green-700">
              Live 1inch API
            </Badge>
            <Badge variant="outline" className={`${supportedChains.find(c => c.id === selectedChain)?.color} bg-opacity-10`}>
              <div className={`w-2 h-2 rounded-full ${supportedChains.find(c => c.id === selectedChain)?.color} mr-1`} />
              {supportedChains.find(c => c.id === selectedChain)?.name}
            </Badge>
            {wallet.isConnected && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                {wallet.walletType}
              </Badge>
            )}
          </div>
        </CardTitle>
        <p className="text-sm text-gray-600">
          Real blockchain transactions across 7 networks with wallet signing
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Circle Wallet USDC Balance */}
        {user && (
          <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg p-3 border border-blue-200">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-blue-800">Circle Wallet Balance</p>
                <p className="text-2xl font-bold text-green-700">{parseFloat(usdcBalance).toFixed(2)} USDC</p>
              </div>
              <div className="text-right">
                <Badge variant="outline" className="bg-blue-100 text-blue-800">
                  Instant Settlement
                </Badge>
                <p className="text-xs text-blue-600 mt-1">Ready for DEX trading</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Connection Status */}
        {!wallet.isConnected && !user && (
          <Alert>
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              Connect your wallet (MetaMask, Phantom, Coinbase, etc.) or sign in to use your Circle wallet
            </AlertDescription>
          </Alert>
        )}

        {wallet.isConnected && (
          <div className="bg-blue-50 rounded-lg p-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-blue-700">Connected:</span>
              <span className="text-blue-800 font-mono">
                {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
              </span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-blue-700">Wallet:</span>
              <span className="text-blue-800">{wallet.walletType}</span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-blue-700">Network:</span>
              <span className="text-blue-800">
                {wallet.chainId === 1 ? 'Ethereum Mainnet' : 
                 wallet.chainId === 137 ? 'Polygon' :
                 wallet.chainId === 56 ? 'BNB Chain' :
                 wallet.chainId === 42161 ? 'Arbitrum' :
                 wallet.chainId === 10 ? 'Optimism' :
                 wallet.chainId === 8453 ? 'Base' :
                 `Chain ${wallet.chainId}`}
              </span>
            </div>
          </div>
        )}

        {/* Chain Selector */}
        <div className="space-y-2">
          <Label htmlFor="chain-selector">Network</Label>
          <Select value={selectedChain.toString()} onValueChange={(value) => setSelectedChain(parseInt(value))}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {supportedChains.map((chain) => (
                <SelectItem key={chain.id} value={chain.id.toString()}>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${chain.color}`} />
                    <span className="font-medium">{chain.name}</span>
                    <span className="text-xs text-gray-500">({chain.symbol})</span>
                    {wallet.isConnected && wallet.chainId === chain.id && (
                      <CheckCircle className="w-3 h-3 text-green-500" />
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Chain Mismatch Warning */}
          {wallet.isConnected && wallet.chainId !== selectedChain && (
            <Alert className="bg-amber-50 border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                <strong>Network Mismatch:</strong> Your wallet is connected to{' '}
                {supportedChains.find(c => c.id === wallet.chainId)?.name || `Chain ${wallet.chainId}`}, 
                but you've selected {supportedChains.find(c => c.id === selectedChain)?.name}.
                <br />
                <span className="text-xs mt-1 block">
                  Switch your wallet network or change the selected network to execute swaps.
                </span>
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Custom Token Info */}
        {customTokens.length > 0 && (
          <Alert className="bg-blue-50 border-blue-200">
            <AlertTriangle className="w-4 h-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              <strong>{customTokens.length} custom token{customTokens.length > 1 ? 's' : ''} added.</strong>
              <br />
              <div className="mt-1 text-sm">
                {customTokens.map((token, index) => (
                  <span key={token.address} className="inline-block mr-2 mb-1">
                    <Badge variant="outline" className="text-xs">
                      {token.symbol}
                      {!token.verified && (
                        <span className="ml-1 text-amber-600">⚠️</span>
                      )}
                    </Badge>
                  </span>
                ))}
              </div>
              <span className="text-xs text-blue-600">
                ⚠️ Unverified tokens may be risky. Only trade tokens you trust.
              </span>
            </AlertDescription>
          </Alert>
        )}

        {/* From Token */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="from-token">From</Label>
            <Dialog open={showCustomTokenDialog} onOpenChange={setShowCustomTokenDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-6 text-xs">
                  <Plus className="w-3 h-3 mr-1" />
                  Add Token
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Custom Token</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="token-address">Contract Address</Label>
                    <Input
                      id="token-address"
                      placeholder="0x..."
                      value={customTokenForm.address}
                      onChange={(e) => handleAddressChange(e.target.value)}
                      className="font-mono text-sm"
                    />
                    {isLoadingTokenInfo && (
                      <div className="text-sm text-gray-500 mt-1">
                        Detecting token info...
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="token-symbol">Symbol</Label>
                      <Input
                        id="token-symbol"
                        placeholder="e.g., USDC"
                        value={customTokenForm.symbol}
                        onChange={(e) => setCustomTokenForm(prev => ({ ...prev, symbol: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="token-decimals">Decimals</Label>
                      <Input
                        id="token-decimals"
                        type="number"
                        placeholder="18"
                        value={customTokenForm.decimals}
                        onChange={(e) => setCustomTokenForm(prev => ({ ...prev, decimals: parseInt(e.target.value) || 18 }))}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="token-name">Name (Optional)</Label>
                    <Input
                      id="token-name"
                      placeholder="e.g., USD Coin"
                      value={customTokenForm.name}
                      onChange={(e) => setCustomTokenForm(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" onClick={() => setShowCustomTokenDialog(false)}>
                      Cancel
                    </Button>
                    <Button onClick={addCustomToken}>
                      Add Token
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="flex space-x-2">
            <Select value={fromToken} onValueChange={setFromToken}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <div className="p-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search tokens..."
                      value={tokenSearchTerm}
                      onChange={(e) => setTokenSearchTerm(e.target.value)}
                      className="pl-8 text-sm"
                    />
                  </div>
                </div>
                <div className="px-2 py-1 text-xs text-gray-500 font-medium">Popular Tokens</div>
                {allTokens
                  .filter(token => 
                    token.symbol.toLowerCase().includes(tokenSearchTerm.toLowerCase()) ||
                    token.name.toLowerCase().includes(tokenSearchTerm.toLowerCase())
                  )
                  .map((token) => (
                    <SelectItem key={token.symbol} value={token.symbol}>
                      <div className="flex items-center gap-2">
                        {token.symbol === 'PEEZY' ? (
                          <img 
                            src={peezyMascot} 
                            alt="PEEZY" 
                            className="w-4 h-4 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                            <span className="text-white text-xs font-bold">
                              {token.symbol.charAt(0)}
                            </span>
                          </div>
                        )}
                        <div className="flex flex-col">
                          <span className="text-sm">{token.symbol}</span>
                          {token.name && (
                            <span className="text-xs text-gray-500 truncate max-w-32">
                              {token.name}
                            </span>
                          )}
                        </div>
                        {token.verified && (
                          <CheckCircle className="w-3 h-3 text-green-500" />
                        )}
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Input
              id="from-amount"
              type="number"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="flex-1"
            />
          </div>
        </div>

        {/* Swap Button */}
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSwapTokens}
            className="rounded-full p-2"
          >
            <ArrowDownUp className="w-4 h-4" />
          </Button>
        </div>

        {/* To Token */}
        <div className="space-y-2">
          <Label htmlFor="to-token">To</Label>
          <div className="flex space-x-2">
            <Select value={toToken} onValueChange={setToToken}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <div className="p-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search tokens..."
                      value={tokenSearchTerm}
                      onChange={(e) => setTokenSearchTerm(e.target.value)}
                      className="pl-8 text-sm"
                    />
                  </div>
                </div>
                <div className="px-2 py-1 text-xs text-gray-500 font-medium">Popular Tokens</div>
                {allTokens
                  .filter(token => 
                    token.symbol.toLowerCase().includes(tokenSearchTerm.toLowerCase()) ||
                    token.name.toLowerCase().includes(tokenSearchTerm.toLowerCase())
                  )
                  .map((token) => (
                    <SelectItem key={token.symbol} value={token.symbol}>
                      <div className="flex items-center gap-2">
                        {token.symbol === 'PEEZY' ? (
                          <img 
                            src={peezyMascot} 
                            alt="PEEZY" 
                            className="w-4 h-4 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                            <span className="text-white text-xs font-bold">
                              {token.symbol.charAt(0)}
                            </span>
                          </div>
                        )}
                        <div className="flex flex-col">
                          <span className="text-sm">{token.symbol}</span>
                          {token.name && (
                            <span className="text-xs text-gray-500 truncate max-w-32">
                              {token.name}
                            </span>
                          )}
                        </div>
                        {token.verified && (
                          <CheckCircle className="w-3 h-3 text-green-500" />
                        )}
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <div className="flex-1 px-3 py-2 bg-gray-50 rounded-md text-sm">
              {quote ? parseFloat(quote.bestQuote.outputAmount).toFixed(6) : '0.0'}
            </div>
          </div>
        </div>

        {/* Slippage */}
        <div className="space-y-2">
          <Label htmlFor="slippage">Slippage Tolerance (%)</Label>
          <div className="flex gap-2">
            <Select 
              value={[1, 2.5, 5, 10, 15].includes(slippage) ? slippage.toString() : ""} 
              onValueChange={(value) => setSlippage(parseFloat(value))}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select %" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1%</SelectItem>
                <SelectItem value="2.5">2.5%</SelectItem>
                <SelectItem value="5">5%</SelectItem>
                <SelectItem value="10">10%</SelectItem>
                <SelectItem value="15">15%</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="Custom"
              min="0.1"
              max="50"
              step="0.1"
              className="w-20"
              value={![1, 2.5, 5, 10, 15].includes(slippage) ? slippage.toString() : ""}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                if (!isNaN(value) && value >= 0.1 && value <= 50) {
                  setSlippage(value);
                } else if (e.target.value === "") {
                  setSlippage(5); // Default back to 5%
                }
              }}
            />
          </div>
        </div>

        {/* Live Quote Display */}
        {quote && (
          <div className="bg-green-50 rounded-lg p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-green-700">Best Route:</span>
              <Badge variant="outline" className="bg-green-100 text-green-800">
                {quote.bestQuote.dex}
              </Badge>
            </div>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-green-700">Live Rate:</span>
                <span className="text-green-800 font-medium">
                  1 {fromToken} = {quote.bestQuote.exchangeRate.toFixed(2)} {toToken}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-700">Price Impact:</span>
                <span className={quote.bestQuote.priceImpact > 5 ? 'text-red-600' : 'text-green-600'}>
                  {quote.bestQuote.priceImpact.toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-700">Platform Fee:</span>
                <span className="text-green-800">${quote.platformFeeUSD}</span>
              </div>
              <div className="flex justify-between font-medium border-t border-green-200 pt-1">
                <span className="text-green-800">You'll receive:</span>
                <span className="text-green-800">
                  {parseFloat(quote.totalOutputAfterFees).toFixed(6)} {toToken}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Warnings */}
        {quote?.priceImpactWarning && (
          <Alert>
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              High price impact detected. Consider reducing your swap amount.
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="space-y-2">
          <Button
            onClick={handleGetQuote}
            disabled={getQuoteMutation.isPending || !amount}
            className="w-full"
            variant="outline"
          >
            {getQuoteMutation.isPending ? "Getting Live Quote..." : "Get Live Quote"}
          </Button>

          {quote && (
            <Button
              onClick={handleExecuteSwap}
              disabled={executeSwapMutation.isPending || (wallet.isConnected && wallet.chainId !== selectedChain)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
            >
              {executeSwapMutation.isPending ? "Executing..." : 
               !wallet.isConnected ? "Connect Wallet & Swap" : 
               wallet.isConnected && wallet.chainId !== selectedChain ? 
               `Switch to ${supportedChains.find(c => c.id === selectedChain)?.name}` : 
               "Execute Real Swap"}
            </Button>
          )}
        </div>

        {/* Real Transaction Notice */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
          <div className="font-medium text-yellow-800 mb-1">⚠️ Real Blockchain Transactions</div>
          <div className="text-yellow-700 space-y-1">
            <p>• Transactions are irreversible once confirmed</p>
            <p>• Supports 5 major wallets: MetaMask, Phantom (ETH), Coinbase, Trust & WalletConnect</p>
            <p>• Always verify amounts before confirming</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}