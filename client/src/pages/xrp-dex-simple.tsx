import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { NavigationHeader } from "@/components/navigation-header";
import { MobileNavigation } from "@/components/mobile-navigation";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { 
  ArrowUpDown, 
  TrendingUp, 
  TrendingDown,
  Zap,
  Shield,
  ArrowLeft,
  Info,
  Wallet,
  ArrowDown
} from "@/lib/icons";

interface TokenOption {
  symbol: string;
  name: string;
  balance: string;
  price: number;
  logo: string;
}

export default function XRPDEXSimple() {
  const [, setLocation] = useLocation();
  const [fromToken, setFromToken] = useState('XRP');
  const [toToken, setToToken] = useState('RLUSD');
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [isSwapping, setIsSwapping] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const [slippage, setSlippage] = useState('0.5');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Check authentication status
  const { data: user, isLoading: userLoading, error: userError } = useQuery({
    queryKey: ['/api/auth/user'],
    retry: false
  });

  const isAuthenticated = !!user && !userError;

  // Available tokens (simplified for user-friendly experience)
  const availableTokens: TokenOption[] = [
    {
      symbol: 'XRP',
      name: 'XRP',
      balance: '0.00',
      price: 2.97,
      logo: '🪙'
    },
    {
      symbol: 'RLUSD',
      name: 'Ripple USD',
      balance: '0.00',
      price: 1.00,
      logo: '💵'
    },
    {
      symbol: 'USDC',
      name: 'USD Coin',
      balance: '0.00', 
      price: 1.00,
      logo: '🔵'
    },
    {
      symbol: 'SOLO',
      name: 'Sologenic',
      balance: '0.00',
      price: 0.245,
      logo: '🌟'
    },
    {
      symbol: 'CSC',
      name: 'CasinoCoin',
      balance: '0.00',
      price: 0.002,
      logo: '🎰'
    }
  ];

  // Calculate exchange rate
  useEffect(() => {
    if (fromAmount && fromToken && toToken) {
      const fromTokenData = availableTokens.find(t => t.symbol === fromToken);
      const toTokenData = availableTokens.find(t => t.symbol === toToken);
      
      if (fromTokenData && toTokenData) {
        const exchangeRate = fromTokenData.price / toTokenData.price;
        const calculatedAmount = (parseFloat(fromAmount) * exchangeRate * 0.997).toFixed(6); // 0.3% slippage
        setToAmount(calculatedAmount);
      }
    } else if (!fromAmount) {
      setToAmount('');
    }
  }, [fromAmount, fromToken, toToken]);

  const handleSwapTokens = () => {
    const tempToken = fromToken;
    const tempAmount = fromAmount;
    setFromToken(toToken);
    setToToken(tempToken);
    setFromAmount(toAmount);
    setToAmount(tempAmount);
  };

  const handleConnectWallet = () => {
    setLocation('/xrp-wallet-creation');
  };

  const handleSwap = async () => {
    if (!walletConnected) {
      handleConnectWallet();
      return;
    }

    setIsSwapping(true);
    
    // Simulate swap transaction
    setTimeout(() => {
      setIsSwapping(false);
      // Show success notification
    }, 3000);
  };

  const getFromTokenData = () => availableTokens.find(t => t.symbol === fromToken);
  const getToTokenData = () => availableTokens.find(t => t.symbol === toToken);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      <NavigationHeader />
      <MobileNavigation />
      
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20 md:pb-8">
        {/* Header */}
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => setLocation('/xrp-ecosystem')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to XRP Ecosystem
          </Button>
          
          <div className="text-center">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              XRP DEX Trading
            </h1>
            <p className="text-lg text-gray-600">
              Swap tokens instantly on the XRP Ledger
            </p>
          </div>
        </div>

        {/* Main Swap Interface */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center">
                <ArrowUpDown className="w-5 h-5 mr-2" />
                Swap Tokens
              </span>
              <Badge variant="secondary" className="flex items-center">
                <Zap className="w-3 h-3 mr-1" />
                Instant
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* From Token */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>From</span>
                <span>Balance: {getFromTokenData()?.balance || '0.00'}</span>
              </div>
              <div className="flex space-x-3">
                <Select value={fromToken} onValueChange={setFromToken}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTokens.map(token => (
                      <SelectItem key={token.symbol} value={token.symbol}>
                        <div className="flex items-center">
                          <span className="mr-2">{token.logo}</span>
                          {token.symbol}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="0.0"
                  value={fromAmount}
                  onChange={(e) => setFromAmount(e.target.value)}
                  className="flex-1 text-right text-lg"
                />
              </div>
              <div className="text-right text-sm text-gray-500">
                ≈ ${fromAmount ? (parseFloat(fromAmount) * (getFromTokenData()?.price || 0)).toFixed(2) : '0.00'}
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
                <ArrowDown className="w-4 h-4" />
              </Button>
            </div>

            {/* To Token */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>To</span>
                <span>Balance: {getToTokenData()?.balance || '0.00'}</span>
              </div>
              <div className="flex space-x-3">
                <Select value={toToken} onValueChange={setToToken}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTokens.filter(t => t.symbol !== fromToken).map(token => (
                      <SelectItem key={token.symbol} value={token.symbol}>
                        <div className="flex items-center">
                          <span className="mr-2">{token.logo}</span>
                          {token.symbol}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="0.0"
                  value={toAmount}
                  readOnly
                  className="flex-1 text-right text-lg bg-gray-50"
                />
              </div>
              <div className="text-right text-sm text-gray-500">
                ≈ ${toAmount ? (parseFloat(toAmount) * (getToTokenData()?.price || 0)).toFixed(2) : '0.00'}
              </div>
            </div>

            {/* Exchange Rate */}
            {fromAmount && toAmount && (
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Exchange Rate</span>
                  <span>1 {fromToken} = {(parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(6)} {toToken}</span>
                </div>
              </div>
            )}

            {/* Advanced Settings */}
            <div className="border-t pt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full justify-between"
              >
                Advanced Settings
                <ArrowDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
              </Button>
              
              {showAdvanced && (
                <div className="mt-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-sm text-gray-600">Slippage Tolerance</label>
                    <Select value={slippage} onValueChange={setSlippage}>
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0.1">0.1%</SelectItem>
                        <SelectItem value="0.5">0.5%</SelectItem>
                        <SelectItem value="1.0">1.0%</SelectItem>
                        <SelectItem value="3.0">3.0%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Network Fee</span>
                    <span>~0.00001 XRP</span>
                  </div>
                </div>
              )}
            </div>

            {/* Swap Button */}
            <Button 
              onClick={handleSwap}
              disabled={!fromAmount || parseFloat(fromAmount) <= 0 || isSwapping}
              className="w-full h-12 text-lg"
            >
              {isSwapping ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                  Swapping...
                </div>
              ) : !walletConnected ? (
                <div className="flex items-center">
                  <Wallet className="w-4 h-4 mr-2" />
                  Connect Wallet to Swap
                </div>
              ) : (
                'Swap Tokens'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Security Notice */}
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Your funds remain in your wallet during trading. This DEX operates directly on the XRP Ledger with no intermediaries.
          </AlertDescription>
        </Alert>

        {/* Quick Tutorial */}
        <Card className="mt-6">
          <CardContent className="pt-6">
            <div className="text-center text-sm text-gray-600">
              <h3 className="font-medium mb-2">New to XRP DEX Trading?</h3>
              <p className="mb-4">
                Simply select tokens, enter an amount, and swap. Your XRP wallet will handle the rest.
              </p>
              <Button variant="outline" size="sm">
                <Info className="w-4 h-4 mr-2" />
                View Tutorial
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}