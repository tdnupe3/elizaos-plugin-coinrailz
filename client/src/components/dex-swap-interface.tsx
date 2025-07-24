import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDownUp, AlertTriangle, CheckCircle, ExternalLink, Search, Plus } from "@/lib/icons";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

interface SwapInterfaceProps {
  walletAddress?: string;
  currentChain?: number;
  isWalletConnected: boolean;
}

interface TokenInfo {
  symbol: string;
  name: string;
  address: string;
  decimals?: number;
  verified?: boolean;
  logoURI?: string;
}

interface CustomTokenForm {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

const supportedTokens: TokenInfo[] = [
  { symbol: 'ETH', name: 'Ethereum', address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', decimals: 18, verified: true },
  { symbol: 'USDC', name: 'USD Coin', address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', decimals: 6, verified: true },
  { symbol: 'USDT', name: 'Tether', address: '0xdac17f958d2ee523a2206206994597c13d831ec7', decimals: 6, verified: true },
  { symbol: 'DAI', name: 'MakerDAO DAI', address: '0x6b175474e89094c44da98b954eedeac495271d0f', decimals: 18, verified: true },
  { symbol: 'PEEZY', name: 'PEEZY Token', address: '0x698b1d54E936b9F772b8F58447194bBc82EC1933', decimals: 18, verified: true }
];

export function DEXSwapInterface({ walletAddress, currentChain = 1, isWalletConnected }: SwapInterfaceProps) {
  const { toast } = useToast();
  const [fromToken, setFromToken] = useState('ETH');
  const [toToken, setToToken] = useState('USDC');
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState(5.0);
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [customTokens, setCustomTokens] = useState<TokenInfo[]>([]);
  const [showTokenDialog, setShowTokenDialog] = useState(false);
  const [tokenSearchTerm, setTokenSearchTerm] = useState('');
  const [customTokenForm, setCustomTokenForm] = useState<CustomTokenForm>({
    address: '',
    symbol: '',
    name: '',
    decimals: 18
  });
  const [isLoadingTokenInfo, setIsLoadingTokenInfo] = useState(false);

  // Get all available tokens (supported + custom)
  const allTokens = [...supportedTokens, ...customTokens];

  // Filter tokens based on search term
  const filteredTokens = allTokens.filter(token =>
    token.symbol.toLowerCase().includes(tokenSearchTerm.toLowerCase()) ||
    token.name.toLowerCase().includes(tokenSearchTerm.toLowerCase()) ||
    token.address.toLowerCase().includes(tokenSearchTerm.toLowerCase())
  );

  // Fetch token info by address mutation
  const fetchTokenInfoMutation = useMutation({
    mutationFn: async (address: string) => {
      const response = await apiRequest('GET', `/api/dex/token-info/${address}`);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setCustomTokenForm(prev => ({
          ...prev,
          symbol: data.token.symbol,
          name: data.token.name,
          decimals: data.token.decimals
        }));
      } else {
        toast({
          title: "Token not found",
          description: "Unable to fetch token information from this address",
          variant: "destructive"
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to fetch token information",
        variant: "destructive"
      });
    }
  });

  // Add custom token function
  const addCustomToken = () => {
    if (!customTokenForm.address || !customTokenForm.symbol) {
      toast({
        title: "Invalid Token",
        description: "Please provide a valid contract address and symbol",
        variant: "destructive"
      });
      return;
    }

    // Check if token already exists
    const existingToken = allTokens.find(
      token => token.address.toLowerCase() === customTokenForm.address.toLowerCase()
    );

    if (existingToken) {
      toast({
        title: "Token Already Added",
        description: `${existingToken.symbol} is already in your token list`,
        variant: "destructive"
      });
      return;
    }

    const newToken: TokenInfo = {
      symbol: customTokenForm.symbol,
      name: customTokenForm.name || customTokenForm.symbol,
      address: customTokenForm.address,
      decimals: customTokenForm.decimals,
      verified: false
    };

    setCustomTokens(prev => [...prev, newToken]);
    setCustomTokenForm({ address: '', symbol: '', name: '', decimals: 18 });
    setShowTokenDialog(false);
    
    toast({
      title: "Token Added",
      description: `${newToken.symbol} has been added to your token list`,
    });
  };

  // Auto-fetch token info when address is entered
  const handleAddressChange = (address: string) => {
    setCustomTokenForm(prev => ({ ...prev, address }));
    
    // Auto-fetch if it looks like a valid Ethereum address
    if (address.match(/^0x[a-fA-F0-9]{40}$/)) {
      setIsLoadingTokenInfo(true);
      fetchTokenInfoMutation.mutate(address);
      setIsLoadingTokenInfo(false);
    }
  };

  // Get quote mutation
  const getQuoteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/dex/quote', {
        fromToken,
        toToken,
        amount,
        chainId: currentChain,
        slippage
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setQuote(data.quote);
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

  // Execute swap mutation  
  const executeSwapMutation = useMutation({
    mutationFn: async () => {
      if (!walletAddress) {
        throw new Error('Wallet not connected');
      }

      if (!quote) {
        throw new Error('No quote available');
      }

      // First, get the swap transaction data from our API
      const response = await apiRequest('POST', '/api/dex/swap-prepare', {
        fromToken,
        toToken,
        amount,
        slippage,
        userAddress: walletAddress,
        chainId: currentChain
      });
      
      const swapData = await response.json();
      
      if (!swapData.success) {
        throw new Error(swapData.error || 'Failed to prepare swap');
      }

      // Now execute the transaction through MetaMask
      if (typeof (window as any).ethereum === 'undefined') {
        throw new Error('MetaMask not available');
      }

      const ethereum = (window as any).ethereum;
      
      // Send the transaction
      const txHash = await ethereum.request({
        method: 'eth_sendTransaction',
        params: [swapData.transactionData],
      });

      return { transactionHash: txHash, ...swapData };
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Swap Initiated",
          description: `Transaction hash: ${data.transaction.transactionHash.slice(0, 10)}...`,
        });
        setQuote(null);
        setAmount('');
      } else {
        toast({
          title: "Swap Failed",
          description: data.error || "Failed to execute swap",
          variant: "destructive"
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Swap Error",
        description: error.message || "Failed to execute swap",
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
    if (!isWalletConnected) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to execute swaps",
        variant: "destructive"
      });
      return;
    }
    executeSwapMutation.mutate();
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>DEX Swap</span>
          <Badge variant="outline" className="bg-green-50 text-green-700">
            Live Pricing
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* From Token */}
        <div className="space-y-2">
          <Label htmlFor="from-token">From</Label>
          <div className="flex space-x-2">
            <Dialog open={showTokenDialog} onOpenChange={setShowTokenDialog}>
              <div className="flex space-x-2">
                <Select value={fromToken} onValueChange={setFromToken}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="p-2">
                      <div className="flex items-center space-x-2 mb-2">
                        <Search className="h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="Search tokens..."
                          value={tokenSearchTerm}
                          onChange={(e) => setTokenSearchTerm(e.target.value)}
                          className="h-8"
                        />
                      </div>
                      <div className="border-b mb-2 pb-2">
                        <div className="text-xs font-medium text-gray-500 mb-1">Popular Tokens</div>
                        {supportedTokens.map((token) => (
                          <SelectItem key={token.symbol} value={token.symbol}>
                            <div className="flex items-center space-x-2">
                              <span className="font-medium">{token.symbol}</span>
                              <span className="text-xs text-gray-500">{token.name}</span>
                              {token.verified && (
                                <CheckCircle className="h-3 w-3 text-green-500" />
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </div>
                      {customTokens.length > 0 && (
                        <div className="border-b mb-2 pb-2">
                          <div className="text-xs font-medium text-gray-500 mb-1">Custom Tokens</div>
                          {customTokens.map((token) => (
                            <SelectItem key={token.symbol} value={token.symbol}>
                              <div className="flex items-center space-x-2">
                                <span className="font-medium">{token.symbol}</span>
                                <span className="text-xs text-gray-500">{token.name}</span>
                                <Badge variant="outline" className="text-xs">Custom</Badge>
                              </div>
                            </SelectItem>
                          ))}
                        </div>
                      )}
                      {filteredTokens.length === 0 && tokenSearchTerm && (
                        <div className="text-center py-2">
                          <div className="text-sm text-gray-500 mb-2">Token not found</div>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline">
                              <Plus className="h-3 w-3 mr-1" />
                              Add Custom Token
                            </Button>
                          </DialogTrigger>
                        </div>
                      )}
                    </div>
                  </SelectContent>
                </Select>
                <DialogTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
              </div>

              {/* Custom Token Dialog */}
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Custom Token</DialogTitle>
                </DialogHeader>
                <Tabs defaultValue="address" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="address">By Address</TabsTrigger>
                    <TabsTrigger value="search">Search</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="address" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="token-address">Contract Address</Label>
                      <Input
                        id="token-address"
                        placeholder="0x..."
                        value={customTokenForm.address}
                        onChange={(e) => handleAddressChange(e.target.value)}
                      />
                      {isLoadingTokenInfo && (
                        <div className="text-sm text-gray-500">Fetching token info...</div>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label htmlFor="token-symbol">Symbol</Label>
                        <Input
                          id="token-symbol"
                          placeholder="e.g. WETH"
                          value={customTokenForm.symbol}
                          onChange={(e) => setCustomTokenForm(prev => ({ ...prev, symbol: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="token-decimals">Decimals</Label>
                        <Input
                          id="token-decimals"
                          type="number"
                          value={customTokenForm.decimals}
                          onChange={(e) => setCustomTokenForm(prev => ({ ...prev, decimals: parseInt(e.target.value) || 18 }))}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="token-name">Token Name (Optional)</Label>
                      <Input
                        id="token-name"
                        placeholder="e.g. Wrapped Ethereum"
                        value={customTokenForm.name}
                        onChange={(e) => setCustomTokenForm(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                    
                    <Button 
                      onClick={addCustomToken} 
                      className="w-full"
                      disabled={!customTokenForm.address || !customTokenForm.symbol}
                    >
                      Add Token
                    </Button>
                  </TabsContent>
                  
                  <TabsContent value="search" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="token-search">Search Token</Label>
                      <div className="relative">
                        <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                        <Input
                          id="token-search"
                          placeholder="Search by name or symbol..."
                          value={tokenSearchTerm}
                          onChange={(e) => setTokenSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {filteredTokens.map((token) => (
                        <div 
                          key={token.address}
                          className="flex items-center justify-between p-2 rounded-lg border hover:bg-gray-50 cursor-pointer"
                          onClick={() => {
                            setFromToken(token.symbol);
                            setShowTokenDialog(false);
                          }}
                        >
                          <div>
                            <div className="font-medium">{token.symbol}</div>
                            <div className="text-xs text-gray-500">{token.name}</div>
                          </div>
                          <div className="flex items-center space-x-1">
                            {token.verified && (
                              <CheckCircle className="h-3 w-3 text-green-500" />
                            )}
                            {!token.verified && (
                              <Badge variant="outline" className="text-xs">Custom</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                      {filteredTokens.length === 0 && tokenSearchTerm && (
                        <div className="text-center py-4 text-gray-500">
                          No tokens found. Try adding by contract address.
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
            
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
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <div className="p-2">
                  <div className="flex items-center space-x-2 mb-2">
                    <Search className="h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search tokens..."
                      value={tokenSearchTerm}
                      onChange={(e) => setTokenSearchTerm(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div className="border-b mb-2 pb-2">
                    <div className="text-xs font-medium text-gray-500 mb-1">Popular Tokens</div>
                    {supportedTokens.map((token) => (
                      <SelectItem key={token.symbol} value={token.symbol}>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{token.symbol}</span>
                          <span className="text-xs text-gray-500">{token.name}</span>
                          {token.verified && (
                            <CheckCircle className="h-3 w-3 text-green-500" />
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </div>
                  {customTokens.length > 0 && (
                    <div className="border-b mb-2 pb-2">
                      <div className="text-xs font-medium text-gray-500 mb-1">Custom Tokens</div>
                      {customTokens.map((token) => (
                        <SelectItem key={token.symbol} value={token.symbol}>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{token.symbol}</span>
                            <span className="text-xs text-gray-500">{token.name}</span>
                            <Badge variant="outline" className="text-xs">Custom</Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </div>
                  )}
                </div>
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
          <Select value={slippage.toString()} onValueChange={(value) => setSlippage(parseFloat(value))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1.0">1%</SelectItem>
              <SelectItem value="2.5">2.5%</SelectItem>
              <SelectItem value="5.0">5%</SelectItem>
              <SelectItem value="10.0">10%</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Quote Display */}
        {quote && (
          <div className="bg-blue-50 rounded-lg p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Best Route:</span>
              <Badge variant="outline">{quote.bestQuote.dex}</Badge>
            </div>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span>Rate:</span>
                <span>1 {fromToken} = {quote.bestQuote.exchangeRate.toFixed(2)} {toToken}</span>
              </div>
              <div className="flex justify-between">
                <span>Price Impact:</span>
                <span className={quote.bestQuote.priceImpact > 5 ? 'text-red-600' : 'text-green-600'}>
                  {quote.bestQuote.priceImpact.toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span>Platform Fee:</span>
                <span>${quote.platformFeeUSD}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>You'll receive:</span>
                <span>{parseFloat(quote.totalOutputAfterFees).toFixed(6)} {toToken}</span>
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
            {getQuoteMutation.isPending ? "Getting Quote..." : "Get Quote"}
          </Button>

          {quote && (
            <Button
              onClick={handleExecuteSwap}
              disabled={executeSwapMutation.isPending || !isWalletConnected}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {executeSwapMutation.isPending ? "Executing..." : 
               !isWalletConnected ? "Connect Wallet to Swap" : "Execute Swap"}
            </Button>
          )}
        </div>

        {!isWalletConnected && (
          <Alert>
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              Connect your wallet to execute swaps. You can still get quotes without connecting.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}