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
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

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

const supportedTokens = [
  { symbol: 'ETH', name: 'Ethereum', address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' },
  { symbol: 'USDC', name: 'USD Coin', address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' },
  { symbol: 'USDT', name: 'Tether', address: '0xdac17f958d2ee523a2206206994597c13d831ec7' },
  { symbol: 'DAI', name: 'MakerDAO DAI', address: '0x6b175474e89094c44da98b954eedeac495271d0f' }
];

export function DEXSwapInterface({ walletAddress, currentChain = 1, isWalletConnected }: SwapInterfaceProps) {
  const { toast } = useToast();
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
            <Select value={fromToken} onValueChange={setFromToken}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {supportedTokens.map((token) => (
                  <SelectItem key={token.symbol} value={token.symbol}>
                    {token.symbol}
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
                    {token.symbol}
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