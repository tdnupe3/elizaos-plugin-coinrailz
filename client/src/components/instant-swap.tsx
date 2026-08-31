import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowUpDown, 
  Zap, 
  Clock, 
  Shield,
  TrendingUp,
  DollarSign
} from "@/lib/icons";
import { useQuery, useMutation } from "@tanstack/react-query";

interface Token {
  symbol: string;
  name: string;
  icon: string;
  balance?: string;
  price?: number;
}
interface SwapQuote {
  toTokenAmount: string;
  estimatedGas: string;
}

const popularTokens: Token[] = [
  { symbol: 'USDC', name: 'USD Coin', icon: '💰', balance: '0.00' },
  { symbol: 'ETH', name: 'Ethereum', icon: '⚡', balance: '0.00' },
  { symbol: 'BTC', name: 'Bitcoin', icon: '₿', balance: '0.00' },
  { symbol: 'XRP', name: 'XRP', icon: '🌊', balance: '0.00' },
  { symbol: 'MATIC', name: 'Polygon', icon: '🔷', balance: '0.00' }
];

export function InstantSwap() {
  const [fromToken, setFromToken] = useState<Token>(popularTokens[0]);
  const [toToken, setToToken] = useState<Token>(popularTokens[1]);
  const [fromAmount, setFromAmount] = useState("100");
  const [slippage, setSlippage] = useState("0.5");

  // Get real-time quote
  const { data: quote, isLoading: quoteLoading } = useQuery<SwapQuote>({
    queryKey: ['/api/dex/quote', fromToken.symbol, toToken.symbol, fromAmount],
    enabled: parseFloat(fromAmount) > 0 && fromToken.symbol !== toToken.symbol
  });

  const swapTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
  };

  const toAmount = quote?.toTokenAmount || '0';
  const platformFee = parseFloat(fromAmount) * 0.0075; // 0.75% fee
  const gasFee = quote?.estimatedGas || '0.00';

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-blue-500" />
          Instant Swap
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* From Token */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">You're swapping</label>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                type="number"
                value={fromAmount}
                onChange={(e) => setFromAmount(e.target.value)}
                placeholder="0.00"
                className="text-lg font-semibold pr-20"
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <Badge variant="secondary" className="flex items-center gap-1">
                  <span>{fromToken.icon}</span>
                  {fromToken.symbol}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Balance: {fromToken.balance} {fromToken.symbol}</span>
            <button className="text-blue-500 hover:underline">Use Max</button>
          </div>
        </div>

        {/* Swap Button */}
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={swapTokens}
            className="rounded-full p-2 border-2 hover:border-blue-500"
          >
            <ArrowUpDown className="w-4 h-4" />
          </Button>
        </div>

        {/* To Token */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">To get</label>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                type="text"
                value={toAmount}
                readOnly
                placeholder="0.00"
                className="text-lg font-semibold pr-20 bg-gray-50"
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <Badge variant="secondary" className="flex items-center gap-1">
                  <span>{toToken.icon}</span>
                  {toToken.symbol}
                </Badge>
              </div>
            </div>
          </div>
          <div className="text-sm text-gray-600">
            Balance: {toToken.balance} {toToken.symbol}
          </div>
        </div>

        {/* Popular Tokens Quick Select */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Popular tokens</label>
          <div className="grid grid-cols-5 gap-2">
            {popularTokens.map((token) => (
              <Button
                key={token.symbol}
                variant={toToken.symbol === token.symbol ? "default" : "outline"}
                size="sm"
                onClick={() => setToToken(token)}
                className="flex flex-col items-center p-2 h-auto"
              >
                <span className="text-lg">{token.icon}</span>
                <span className="text-xs">{token.symbol}</span>
              </Button>
            ))}
          </div>
        </div>

        {/* Trade Details */}
        {quote && (
          <div className="bg-gray-50 rounded-lg p-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Platform fee (0.75%)</span>
              <span>${platformFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Network fee</span>
              <span>${gasFee}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Slippage tolerance</span>
              <span className="flex items-center gap-1">
                {slippage}%
                <button className="text-blue-500 text-xs hover:underline">
                  Edit
                </button>
              </span>
            </div>
            <div className="border-t pt-2 flex justify-between font-semibold">
              <span>You'll receive (minimum)</span>
              <span>{(parseFloat(toAmount) * 0.995).toFixed(4)} {toToken.symbol}</span>
            </div>
          </div>
        )}

        {/* Benefits */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="space-y-1">
            <Clock className="w-5 h-5 mx-auto text-green-500" />
            <div className="text-xs text-gray-600">
              <div className="font-semibold">3 seconds</div>
              <div>Settlement</div>
            </div>
          </div>
          <div className="space-y-1">
            <Shield className="w-5 h-5 mx-auto text-blue-500" />
            <div className="text-xs text-gray-600">
              <div className="font-semibold">MEV Protected</div>
              <div>Best price</div>
            </div>
          </div>
          <div className="space-y-1">
            <TrendingUp className="w-5 h-5 mx-auto text-purple-500" />
            <div className="text-xs text-gray-600">
              <div className="font-semibold">0.75% fee</div>
              <div>Competitive</div>
            </div>
          </div>
        </div>

        {/* Swap Button */}
        <Button 
          className="w-full h-12 text-lg font-semibold"
          disabled={!quote || parseFloat(fromAmount) <= 0}
        >
          {quoteLoading ? 'Getting best price...' : `Swap ${fromToken.symbol} for ${toToken.symbol}`}
        </Button>

        {/* First-time user help */}
        <div className="text-center">
          <div className="text-xs text-gray-500 mb-2">
            New to crypto trading?
          </div>
          <Button variant="ghost" size="sm" className="text-blue-500 text-xs">
            Watch 30-second tutorial
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}