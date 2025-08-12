import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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

interface TokenLogoSwapInterfaceProps {
  onAmountChange?: (amount: number) => void;
  externalTradingFees?: any;
  onSwapComplete?: (swapData: any) => Promise<void>;
}

export function TokenLogoSwapInterface({ onAmountChange, externalTradingFees, onSwapComplete }: TokenLogoSwapInterfaceProps = {}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { wallet, connectWallet, signTransaction } = useWallet();
  const { user } = useAuth();
  const [fromToken, setFromToken] = useState('USDC');
  const [toToken, setToToken] = useState('ETH');
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState(5.0);

  // Notify parent component when amount changes and calculate fees
  useEffect(() => {
    if (onAmountChange && amount) {
      const numAmount = parseFloat(amount) || 0;
      onAmountChange(numAmount);
    }
    
    // Calculate trading fees when amount changes
    if (amount && parseFloat(amount) > 0) {
      const amountNum = parseFloat(amount);
      const platformFee = amountNum * 0.003; // 0.3% platform fee
      const processingFee = amountNum * 0.001; // 0.1% processing fee
      const networkFee = amountNum * 0.0005; // 0.05% network fee
      const totalFees = platformFee + processingFee + networkFee;
      
      setTradingFees({
        calculation: {
          platformFee,
          processingFee,
          networkFee,
          totalFees
        }
      });
    } else {
      setTradingFees(null);
    }
  }, [amount, onAmountChange]);
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [usdcBalance, setUsdcBalance] = useState('0.00');
  const [tradingFees, setTradingFees] = useState<any>(null);
  const [customTokens, setCustomTokens] = useState<TokenInfo[]>([]);
  const [showCustomTokenDialog, setShowCustomTokenDialog] = useState(false);
  const [customTokenForm, setCustomTokenForm] = useState<CustomTokenForm>({
    address: '',
    symbol: '',
    name: '',
    decimals: 18
  });
  const [tokenSearchTerm, setTokenSearchTerm] = useState('');
  const [isLoadingTokenInfo, setIsLoadingTokenInfo] = useState(false);
  const [selectedChain, setSelectedChain] = useState(1); // Default to Ethereum

  // Token Logo Component with CoinGecko integration
  const TokenLogo = ({ token, size = "w-4 h-4" }: { token: TokenInfo, size?: string }) => {
    const [logoError, setLogoError] = useState(false);
    
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
    if (token.coinGeckoId && !logoError) {
      // Correct CoinGecko image IDs and filenames
      const getCoinGeckoUrl = (coinGeckoId: string): string => {
        const urlMap: Record<string, string> = {
          'ethereum': 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
          'usd-coin': 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png',
          'tether': 'https://assets.coingecko.com/coins/images/325/small/Tether.png',
          'dai': 'https://assets.coingecko.com/coins/images/9956/small/Badge_Dai.png'
        };
        return urlMap[coinGeckoId] || '';
      };

      const logoUrl = getCoinGeckoUrl(token.coinGeckoId);
      
      if (logoUrl) {
        return (
          <img 
            src={logoUrl} 
            alt={token.symbol} 
            className={`${size} rounded-full object-cover`}
            onError={() => setLogoError(true)}
          />
        );
      }
    }
    
    // Enhanced fallback colors for better token recognition
    const getTokenColor = (symbol: string) => {
      const colorMap: Record<string, string> = {
        'ETH': 'bg-indigo-600',
        'USDC': 'bg-blue-500',
        'USDT': 'bg-green-500',
        'DAI': 'bg-yellow-500',
        'BTC': 'bg-orange-500',
        'BNB': 'bg-yellow-600',
      };
      return colorMap[symbol] || 'bg-gray-500';
    };
    
    return (
      <div className={`${size} rounded-full ${getTokenColor(token.symbol)} flex items-center justify-center`}>
        <span className="text-white text-xs font-bold">
          {token.symbol.charAt(0)}
        </span>
      </div>
    );
  };

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

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <CardTitle className="text-center">
          DEX Aggregator
        </CardTitle>
        <p className="text-sm text-gray-600 text-center">
          Professional DEX aggregator with trading fees
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Blockchain Network Selection */}
        <div className="space-y-2">
          <Label htmlFor="network">Blockchain Network</Label>
          <Select value={selectedChain.toString()} onValueChange={(value) => setSelectedChain(parseInt(value))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {supportedChains.map((chain) => (
                <SelectItem key={chain.id} value={chain.id.toString()}>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${chain.color}`}></div>
                    <span>{chain.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Circle Wallet USDC Balance */}
        {user && (
          <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg p-3 border border-blue-200">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-blue-800">Circle USDC Wallet</p>
                <p className="text-2xl font-bold text-green-700">{parseFloat(usdcBalance).toFixed(2)} USDC</p>
              </div>
              <div className="text-right">
                <Badge variant="outline" className="bg-blue-100 text-blue-800">
                  Instant Settlement
                </Badge>
                <p className="text-xs text-blue-600 mt-1">Ready for Trading</p>
              </div>
            </div>
          </div>
        )}

        {/* From Token */}
        <div className="space-y-2">
          <Label htmlFor="from-token">From Token</Label>
          <div className="flex space-x-2">
            <Select value={fromToken} onValueChange={setFromToken}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <div className="px-2 py-1 text-xs text-gray-500 font-medium">Popular Tokens</div>
                {allTokens.map((token) => (
                  <SelectItem key={`from-${token.symbol}`} value={token.symbol}>
                    <div className="flex items-center gap-2">
                      <TokenLogo token={token} />
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
            onClick={() => {
              const temp = fromToken;
              setFromToken(toToken);
              setToToken(temp);
            }}
            className="rounded-full p-2"
          >
            <ArrowDownUp className="w-4 h-4" />
          </Button>
        </div>

        {/* To Token */}
        <div className="space-y-2">
          <Label htmlFor="to-token">To Token</Label>
          <div className="flex space-x-2">
            <Select value={toToken} onValueChange={setToToken}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <div className="px-2 py-1 text-xs text-gray-500 font-medium">Popular Tokens</div>
                {allTokens.map((token) => (
                  <SelectItem key={`to-${token.symbol}`} value={token.symbol}>
                    <div className="flex items-center gap-2">
                      <TokenLogo token={token} />
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

        {/* Swap Button */}
        <Button className="w-full bg-blue-600 hover:bg-blue-700" disabled={!amount || parseFloat(amount) <= 0}>
          Get Best Rate & Execute Swap
        </Button>
        {/* Trading Fees Display */}
        {tradingFees && (
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <h3 className="font-medium text-green-800 mb-2">Trading Fee Breakdown</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-green-700">Platform Fee:</span>
                <span className="font-medium text-green-800">
                  ${tradingFees.calculation.platformFee.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-700">Processing Fee:</span>
                <span className="font-medium text-green-800">
                  ${tradingFees.calculation.processingFee.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-700">Network Fee:</span>
                <span className="font-medium text-green-800">
                  ${tradingFees.calculation.networkFee.toFixed(2)}
                </span>
              </div>
              <div className="border-t border-green-300 pt-1 mt-2">
                <div className="flex justify-between font-medium">
                  <span className="text-green-800">Total Fees:</span>
                  <span className="text-green-900">
                    ${tradingFees.calculation.totalFees.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-green-600 mt-2">
              Fees automatically collected on swap execution
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}