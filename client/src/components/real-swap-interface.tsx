import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDownUp, AlertTriangle, CheckCircle, ExternalLink } from "@/lib/icons";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useWallet } from "@/hooks/useWallet";
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

const supportedTokens = [
  { symbol: 'ETH', name: 'Ethereum', address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' },
  { symbol: 'USDC', name: 'USD Coin', address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' },
  { symbol: 'USDT', name: 'Tether', address: '0xdac17f958d2ee523a2206206994597c13d831ec7' },
  { symbol: 'DAI', name: 'MakerDAO DAI', address: '0x6b175474e89094c44da98b954eedeac495271d0f' },
  { symbol: 'PEEZY', name: 'PEEZY Token', address: '0x698b1d54E936b9F772b8F58447194bBc82EC1933' }
];

export function RealSwapInterface() {
  const { toast } = useToast();
  const { wallet, connectWallet, signTransaction } = useWallet();
  const [fromToken, setFromToken] = useState('ETH');
  const [toToken, setToToken] = useState('USDC');
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState(5.0);
  const [quote, setQuote] = useState<SwapQuote | null>(null);

  // Get quote mutation
  const getQuoteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/dex/quote', {
        fromToken,
        toToken,
        amount,
        chainId: wallet.chainId || 1,
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

  // Execute real swap mutation
  const executeSwapMutation = useMutation({
    mutationFn: async () => {
      if (!wallet.isConnected || !wallet.address) {
        throw new Error('Wallet not connected');
      }

      if (!quote) {
        throw new Error('No quote available');
      }

      // Step 1: Get transaction data from our API
      const response = await apiRequest('POST', '/api/dex/swap-prepare', {
        fromToken,
        toToken,
        amount,
        slippage,
        userAddress: wallet.address,
        chainId: wallet.chainId
      });
      
      const swapData = await response.json();
      
      if (!swapData.success) {
        throw new Error(swapData.error || 'Failed to prepare swap');
      }

      // Step 2: Execute transaction through MetaMask
      const txHash = await signTransaction(swapData.transactionData);

      return { transactionHash: txHash, ...swapData };
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
          <span>Real DEX Swap</span>
          <div className="flex space-x-2">
            <Badge variant="outline" className="bg-green-50 text-green-700">
              Live 1inch API
            </Badge>
            {wallet.isConnected && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                MetaMask
              </Badge>
            )}
          </div>
        </CardTitle>
        <p className="text-sm text-gray-600">
          Real blockchain transactions with MetaMask signing
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        {!wallet.isConnected && (
          <Alert>
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>
              Connect your wallet (MetaMask, Phantom, Coinbase, etc.) to execute real swaps
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

        {/* From Token */}
        <div className="space-y-2">
          <Label htmlFor="from-token">From</Label>
          <div className="flex space-x-2">
            <Select value={fromToken} onValueChange={setFromToken}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {supportedTokens.map((token) => (
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
                      <span>{token.symbol}</span>
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
                {supportedTokens.map((token) => (
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
                      <span>{token.symbol}</span>
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
              disabled={executeSwapMutation.isPending}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {executeSwapMutation.isPending ? "Executing..." : 
               !wallet.isConnected ? "Connect MetaMask & Swap" : "Execute Real Swap"}
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