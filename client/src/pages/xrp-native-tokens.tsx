import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NavigationHeader } from "@/components/navigation-header";
import { MobileNavigation } from "@/components/mobile-navigation";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { 
  Search, 
  TrendingUp, 
  TrendingDown,
  DollarSign, 
  ArrowLeft, 
  Star,
  ExternalLink,
  Zap,
  Shield,
  Clock,
  BarChart3
} from "@/lib/icons";

interface XRPLToken {
  currency: string;
  issuer: string;
  name: string;
  symbol: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  totalSupply: number;
  holders: number;
  description: string;
  website?: string;
  verified: boolean;
  category: 'defi' | 'stablecoin' | 'utility' | 'gaming' | 'nft' | 'other';
}

interface TokenTrade {
  id: string;
  tokenSymbol: string;
  side: 'buy' | 'sell';
  amount: number;
  priceXRP: number;
  total: number;
  timestamp: string;
  status: 'completed' | 'pending';
}

export default function XRPNativeTokens() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [favorites, setFavorites] = useState<string[]>(['RLUSD', 'SOLO']);
  const [recentTrades, setRecentTrades] = useState<TokenTrade[]>([]);
  const [sortBy, setSortBy] = useState<'volume' | 'price' | 'change'>('volume');

  // XRP Ledger native tokens (simulated data)
  const xrplTokens: XRPLToken[] = [
    {
      currency: '534F4C4F00000000000000000000000000000000', // SOLO hex
      issuer: 'rHZwvHEs56GCmHuKUF4QuNqaERL6CwMsD1',
      name: 'SOLO',
      symbol: 'SOLO',
      price: 0.245,
      priceChange24h: 8.3,
      volume24h: 1250000,
      marketCap: 98500000,
      totalSupply: 400000000,
      holders: 15420,
      description: 'Utility token for the Sologenic ecosystem, enabling tokenization of real-world assets',
      website: 'https://sologenic.com',
      verified: true,
      category: 'defi'
    },
    {
      currency: 'RLUSD',
      issuer: 'rRippleLUSDIssuerfghjklmnbvcxz123456',
      name: 'Ripple USD',
      symbol: 'RLUSD',
      price: 1.0001,
      priceChange24h: 0.01,
      volume24h: 45000000,
      marketCap: 250000000,
      totalSupply: 250000000,
      holders: 8950,
      description: 'Ripple\'s regulated USD stablecoin fully backed by cash and cash equivalents',
      website: 'https://ripple.com',
      verified: true,
      category: 'stablecoin'
    },
    {
      currency: '434F524500000000000000000000000000000000', // CORE hex
      issuer: 'rCORERippleomnjaswefgh1234567890123',
      name: 'CoreToken',
      symbol: 'CORE',
      price: 0.0423,
      priceChange24h: -2.1,
      volume24h: 780000,
      marketCap: 42300000,
      totalSupply: 1000000000,
      holders: 3240,
      description: 'Governance token for decentralized applications built on XRP Ledger',
      verified: true,
      category: 'defi'
    },
    {
      currency: '58535053000000000000000000000000000000000', // XSPS hex
      issuer: 'rXSPSTokenIssuer789012345678901234567',
      name: 'XRP Ledger Sports',
      symbol: 'XSPS',
      price: 0.156,
      priceChange24h: 12.7,
      volume24h: 320000,
      marketCap: 15600000,
      totalSupply: 100000000,
      holders: 1850,
      description: 'Fan token for sports betting and fantasy games on XRP Ledger',
      verified: false,
      category: 'gaming'
    },
    {
      currency: '4E4654580000000000000000000000000000000000', // NFTX hex
      issuer: 'rNFTXrpLedgerToken123456789012345678',
      name: 'NFT Exchange Token',
      symbol: 'NFTX',
      price: 0.089,
      priceChange24h: 5.4,
      volume24h: 180000,
      marketCap: 8900000,
      totalSupply: 100000000,
      holders: 920,
      description: 'Utility token for NFT marketplace and trading on XRP Ledger',
      verified: false,
      category: 'nft'
    }
  ];

  const filteredTokens = xrplTokens.filter(token => {
    const matchesSearch = token.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         token.symbol.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || token.category === selectedCategory;
    return matchesSearch && matchesCategory;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'volume':
        return b.volume24h - a.volume24h;
      case 'price':
        return b.price - a.price;
      case 'change':
        return b.priceChange24h - a.priceChange24h;
      default:
        return 0;
    }
  });

  const toggleFavorite = (symbol: string) => {
    setFavorites(prev => 
      prev.includes(symbol) 
        ? prev.filter(s => s !== symbol)
        : [...prev, symbol]
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toLocaleString();
  };

  const handleQuickTrade = (token: XRPLToken, side: 'buy' | 'sell') => {
    // Simulate quick trade
    const newTrade: TokenTrade = {
      id: Date.now().toString(),
      tokenSymbol: token.symbol,
      side,
      amount: 100,
      priceXRP: token.price / 2.97, // Convert USD price to XRP (using current XRP rate)
      total: 100 * (token.price / 2.97),
      timestamp: new Date().toLocaleTimeString(),
      status: 'completed'
    };
    
    setRecentTrades(prev => [newTrade, ...prev.slice(0, 4)]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      <NavigationHeader />
      <MobileNavigation />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20 md:pb-8">
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
              XRP Ledger Native Tokens
            </h1>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Discover, analyze, and trade tokens native to the XRP Ledger. From stablecoins to DeFi tokens, 
              explore the growing ecosystem of XRPL-based digital assets.
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Filters & Search */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="w-5 h-5" />
                  Filters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Search */}
                <div>
                  <Input
                    placeholder="Search tokens..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full"
                  />
                </div>

                {/* Category Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <select 
                    value={selectedCategory} 
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  >
                    <option value="all">All Categories</option>
                    <option value="stablecoin">Stablecoins</option>
                    <option value="defi">DeFi</option>
                    <option value="gaming">Gaming</option>
                    <option value="nft">NFTs</option>
                    <option value="utility">Utility</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Sort Options */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sort by</label>
                  <select 
                    value={sortBy} 
                    onChange={(e) => setSortBy(e.target.value as 'volume' | 'price' | 'change')}
                    className="w-full p-2 border border-gray-300 rounded-md"
                  >
                    <option value="volume">24h Volume</option>
                    <option value="price">Price</option>
                    <option value="change">24h Change</option>
                  </select>
                </div>

                {/* Favorites */}
                {favorites.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Favorites</label>
                    <div className="space-y-1">
                      {favorites.map(symbol => (
                        <div key={symbol} className="flex items-center justify-between p-2 bg-yellow-50 rounded">
                          <span className="text-sm font-medium">{symbol}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleFavorite(symbol)}
                          >
                            <Star className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Trades */}
            {recentTrades.length > 0 && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Recent Trades
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {recentTrades.map(trade => (
                    <div key={trade.id} className="p-2 bg-gray-50 rounded text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{trade.tokenSymbol}</span>
                        <Badge 
                          variant={trade.side === 'buy' ? 'default' : 'secondary'}
                          className={trade.side === 'buy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                        >
                          {trade.side.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="text-gray-600">
                        {trade.amount} @ {trade.priceXRP.toFixed(6)} XRP
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Token List */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>XRP Ledger Tokens ({filteredTokens.length})</span>
                  <Badge className="bg-purple-100 text-purple-800">
                    Native XRPL
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredTokens.map((token) => (
                    <Card key={token.currency} className="hover:shadow-md transition-shadow border-l-4 border-l-purple-500">
                      <CardContent className="p-6">
                        <div className="grid md:grid-cols-12 gap-4 items-center">
                          {/* Token Info */}
                          <div className="md:col-span-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                                <span className="font-bold text-purple-700">
                                  {token.symbol.substring(0, 2)}
                                </span>
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold">{token.name}</h3>
                                  {token.verified && (
                                    <Shield className="w-4 h-4 text-green-500" />
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => toggleFavorite(token.symbol)}
                                  >
                                    {favorites.includes(token.symbol) ? (
                                      <Star className="w-4 h-4 text-yellow-500 fill-current" />
                                    ) : (
                                      <Star className="w-4 h-4 text-gray-400" />
                                    )}
                                  </Button>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-gray-600">{token.symbol}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {token.category}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Price & Change */}
                          <div className="md:col-span-2 text-center">
                            <div className="font-semibold text-lg">
                              {formatCurrency(token.price)}
                            </div>
                            <div className={`flex items-center justify-center gap-1 text-sm ${
                              token.priceChange24h >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {token.priceChange24h >= 0 ? (
                                <TrendingUp className="w-3 h-3" />
                              ) : (
                                <TrendingDown className="w-3 h-3" />
                              )}
                              {Math.abs(token.priceChange24h).toFixed(2)}%
                            </div>
                          </div>

                          {/* Volume & Market Cap */}
                          <div className="md:col-span-3 text-center">
                            <div className="text-sm text-gray-600">
                              Volume: {formatCurrency(token.volume24h)}
                            </div>
                            <div className="text-sm text-gray-600">
                              Market Cap: {formatCurrency(token.marketCap)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatNumber(token.holders)} holders
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="md:col-span-3">
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 border-green-600 hover:bg-green-50"
                                onClick={() => handleQuickTrade(token, 'buy')}
                              >
                                Quick Buy
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 border-red-600 hover:bg-red-50"
                                onClick={() => handleQuickTrade(token, 'sell')}
                              >
                                Quick Sell
                              </Button>
                              {token.website && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => window.open(token.website, '_blank')}
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Description */}
                        <div className="mt-4 pt-4 border-t">
                          <p className="text-sm text-gray-600">{token.description}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {filteredTokens.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No tokens found matching your criteria.</p>
                    <p className="text-sm mt-2">Try adjusting your search or filters.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}