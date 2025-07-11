import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NavigationHeader } from "@/components/navigation-header";
import { MobileNavigation } from "@/components/mobile-navigation";
import { 
  Search, 
  TrendingUp, 
  TrendingDown, 
  Star, 
  Heart, 
  BarChart3, 
  DollarSign,
  Users,
  Activity,
  AlertCircle,
  CheckCircle2,
  Globe,
  Shield,
  Clock
} from "@/lib/icons";

interface Token {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  supply: number;
  verified: boolean;
  category: string;
  description: string;
  website?: string;
  issuer: string;
  trustLines: number;
  rating: number;
  riskLevel: 'low' | 'medium' | 'high';
  isWatched: boolean;
  holders: number;
}

interface Portfolio {
  tokenId: string;
  symbol: string;
  amount: number;
  value: number;
  pnl: number;
  pnlPercent: number;
}

export default function XRPTokenExplorer() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'price' | 'volume' | 'marketCap' | 'change24h'>('marketCap');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [portfolio, setPortfolio] = useState<Portfolio[]>([]);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // Fetch real token data from API
  const fetchTokens = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/xrp/tokens');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setTokens(data.tokens);
          setLastUpdated(data.lastUpdated);
        }
      }
    } catch (error) {
      console.error('Error fetching tokens:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTokens();
    // Refresh data every 30 seconds
    const interval = setInterval(fetchTokens, 30000);
    return () => clearInterval(interval);
  }, []);

  const categories = [
    'all',
    'defi',
    'gaming',
    'nft',
    'utility',
    'governance',
    'stablecoin',
    'wrapped'
  ];

  // All token data now comes from real API endpoints
  
  // Mock portfolio until user connects wallet
  const mockPortfolio: Portfolio[] = [
    {
      tokenId: 'connect-wallet',
      symbol: 'CONNECT',
      amount: 0,
      value: 0,
      pnl: 0,
      pnlPercent: 0
    }
  ];

  // Initialize portfolio
  useEffect(() => {
    setPortfolio(mockPortfolio);
    setWatchlist([]);
  }, []);

  const filteredTokens = tokens.filter(token => {
    const matchesSearch = token.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         token.symbol.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || token.category === categoryFilter;
    return matchesSearch && matchesCategory;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'price':
        return b.price - a.price;
      case 'volume':
        return b.volume24h - a.volume24h;
      case 'marketCap':
        return b.marketCap - a.marketCap;
      case 'change24h':
        return b.change24h - a.change24h;
      default:
        return 0;
    }
  });

  const toggleWatchlist = (tokenId: string) => {
    setWatchlist(prev => 
      prev.includes(tokenId) 
        ? prev.filter(id => id !== tokenId)
        : [...prev, tokenId]
    );
  };

  const totalPortfolioValue = portfolio.reduce((sum, item) => sum + item.value, 0);
  const totalPortfolioPnL = portfolio.reduce((sum, item) => sum + item.pnl, 0);
  const totalPortfolioPnLPercent = totalPortfolioValue > 0 ? (totalPortfolioPnL / (totalPortfolioValue - totalPortfolioPnL)) * 100 : 0;

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <NavigationHeader />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">XRP Token Explorer</h1>
                <p className="text-gray-600 mt-2">Discover and track XRP-based tokens and currencies</p>
              </div>
              <div className="flex items-center space-x-4">
                <Badge variant="outline" className="bg-blue-50 text-blue-800">
                  <Globe className="w-4 h-4 mr-1" />
                  {tokens.length} Tokens
                </Badge>
                <Badge variant="outline" className="bg-green-50 text-green-800">
                  <Activity className="w-4 h-4 mr-1" />
                  Live Data
                </Badge>
              </div>
            </div>
          </div>

          <Tabs defaultValue="explore" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="explore">Explore</TabsTrigger>
              <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
              <TabsTrigger value="watchlist">Watchlist</TabsTrigger>
            </TabsList>

            <TabsContent value="explore" className="space-y-6">
              {/* Search and Filters */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search tokens..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(category => (
                      <SelectItem key={category} value={category}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={(value: 'price' | 'volume' | 'marketCap' | 'change24h') => setSortBy(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="marketCap">Market Cap</SelectItem>
                    <SelectItem value="volume">Volume</SelectItem>
                    <SelectItem value="price">Price</SelectItem>
                    <SelectItem value="change24h">24h Change</SelectItem>
                  </SelectContent>
                </Select>

                <Button variant="outline" className="w-full">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Analytics
                </Button>
              </div>

              {/* Token List */}
              <div className="space-y-4">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </div>
                ) : (
                  filteredTokens.map(token => (
                    <Card key={token.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                              {token.symbol.charAt(0)}
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <h3 className="font-semibold text-lg">{token.symbol}</h3>
                                <span className="text-gray-500">{token.name}</span>
                                {token.verified && (
                                  <CheckCircle2 className="w-4 h-4 text-blue-500" />
                                )}
                                <Badge variant="outline" className={getRiskColor(token.riskLevel)}>
                                  {token.riskLevel} risk
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-600 mt-1">{token.description}</p>
                            </div>
                          </div>

                          <div className="flex items-center space-x-8">
                            <div className="text-right">
                              <div className="text-lg font-semibold">${token.price.toFixed(6)}</div>
                              <div className={`text-sm flex items-center ${
                                token.change24h > 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {token.change24h > 0 ? (
                                  <TrendingUp className="w-4 h-4 mr-1" />
                                ) : (
                                  <TrendingDown className="w-4 h-4 mr-1" />
                                )}
                                {token.change24h > 0 ? '+' : ''}{token.change24h.toFixed(2)}%
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="text-sm text-gray-500">Volume 24h</div>
                              <div className="font-medium">${token.volume24h.toLocaleString()}</div>
                            </div>

                            <div className="text-right">
                              <div className="text-sm text-gray-500">Market Cap</div>
                              <div className="font-medium">${(token.marketCap / 1000000).toFixed(1)}M</div>
                            </div>

                            <div className="text-right">
                              <div className="text-sm text-gray-500">Trust Lines</div>
                              <div className="font-medium">{token.trustLines.toLocaleString()}</div>
                            </div>

                            <div className="flex items-center space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleWatchlist(token.id)}
                                className={watchlist.includes(token.id) ? 'text-red-600' : 'text-gray-400'}
                              >
                                <Heart className={`w-4 h-4 ${watchlist.includes(token.id) ? 'fill-current' : ''}`} />
                              </Button>
                              <Button variant="outline" size="sm">
                                Trade
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="portfolio" className="space-y-6">
              {/* Portfolio Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Total Value</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">${totalPortfolioValue.toFixed(2)}</div>
                    <div className={`text-sm flex items-center mt-1 ${
                      totalPortfolioPnLPercent > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {totalPortfolioPnLPercent > 0 ? (
                        <TrendingUp className="w-4 h-4 mr-1" />
                      ) : (
                        <TrendingDown className="w-4 h-4 mr-1" />
                      )}
                      {totalPortfolioPnLPercent > 0 ? '+' : ''}${totalPortfolioPnL.toFixed(2)} 
                      ({totalPortfolioPnLPercent > 0 ? '+' : ''}{totalPortfolioPnLPercent.toFixed(2)}%)
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Holdings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{portfolio.length}</div>
                    <div className="text-sm text-gray-600 mt-1">Different tokens</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Best Performer</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">XRP</div>
                    <div className="text-sm text-green-600 mt-1">+5.9% today</div>
                  </CardContent>
                </Card>
              </div>

              {/* Portfolio Holdings */}
              <Card>
                <CardHeader>
                  <CardTitle>Your Holdings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {portfolio.map(item => (
                      <div key={item.tokenId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                            {item.symbol.charAt(0)}
                          </div>
                          <div>
                            <div className="font-medium">{item.symbol}</div>
                            <div className="text-sm text-gray-600">{item.amount.toFixed(2)} tokens</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">${item.value.toFixed(2)}</div>
                          <div className={`text-sm ${
                            item.pnlPercent > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {item.pnlPercent > 0 ? '+' : ''}${item.pnl.toFixed(2)} 
                            ({item.pnlPercent > 0 ? '+' : ''}{item.pnlPercent.toFixed(2)}%)
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="watchlist" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Star className="w-5 h-5 mr-2" />
                    Your Watchlist
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {watchlist.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <Heart className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <p>No tokens in your watchlist yet</p>
                        <p className="text-sm mt-2">Add tokens to track their performance</p>
                      </div>
                    ) : (
                      tokens.filter(token => watchlist.includes(token.id)).map(token => (
                        <div key={token.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                              {token.symbol.charAt(0)}
                            </div>
                            <div>
                              <div className="font-medium">{token.symbol}</div>
                              <div className="text-sm text-gray-600">{token.name}</div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4">
                            <div className="text-right">
                              <div className="font-medium">${token.price.toFixed(6)}</div>
                              <div className={`text-sm ${
                                token.change24h > 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {token.change24h > 0 ? '+' : ''}{token.change24h.toFixed(2)}%
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleWatchlist(token.id)}
                              className="text-red-600"
                            >
                              <Heart className="w-4 h-4 fill-current" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <MobileNavigation />
    </div>
  );
}