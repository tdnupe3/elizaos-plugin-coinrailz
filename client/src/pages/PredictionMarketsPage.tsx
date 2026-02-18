import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSEO } from "@/hooks/useSEO";
import coinRailzLogo from "@assets/Coin Railz Logo No BG.png";
import { 
  TrendingUp,
  ArrowRight, 
  CheckCircle,
  Shield,
  Zap,
  Globe,
  Database,
  Lock,
  Code,
  Play,
  RefreshCw,
  ExternalLink,
  CreditCard,
  Wallet,
  Search,
  BarChart3,
  Scale,
  Target
} from "lucide-react";

export default function PredictionMarketsPage() {
  const [, setLocation] = useLocation();
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectedPreview, setSelectedPreview] = useState<string | null>(null);

  const fetchPreview = async (productId: string, endpoint: string) => {
    setPreviewLoading(true);
    setSelectedPreview(productId);
    try {
      const res = await fetch(endpoint);
      const data = await res.json();
      setPreviewData(data);
    } catch (err) {
      setPreviewData({ error: "Failed to fetch preview" });
    }
    setPreviewLoading(false);
  };

  useSEO({
    title: "Prediction Market APIs | Kalshi & Polymarket Data | Coin Railz",
    description: "Unified API for prediction market data. Access Kalshi (CFTC-regulated) and Polymarket odds, events, and search via x402 micropayments. One API, 99% market coverage.",
    keywords: "Kalshi API, Polymarket API, prediction market API, prediction market data feed, CFTC regulated prediction market, Kalshi data, Polymarket data, prediction market odds, event contracts API, x402 payments, AI agent prediction markets",
    canonical: "https://coinrailz.com/predictions",
    ogTitle: "Prediction Market APIs | Kalshi + Polymarket | Coin Railz",
    ogDescription: "One API for all prediction markets. Kalshi (CFTC-regulated) + Polymarket. Odds, events, search. Pay-per-call via USDC.",
    twitterTitle: "Prediction Market APIs | Coin Railz",
    twitterDescription: "Unified Kalshi + Polymarket API. 99% market coverage. From $0.25/request via x402 micropayments.",
    structuredData: {
      "@context": "https://schema.org/",
      "@type": "SoftwareApplication",
      "name": "Coin Railz Prediction Market APIs",
      "description": "Unified prediction market data APIs providing access to Kalshi and Polymarket event contracts, odds, and search via x402 micropayments.",
      "url": "https://coinrailz.com/predictions",
      "applicationCategory": "DataAPI",
      "provider": {
        "@type": "Organization",
        "name": "Coin Railz",
        "url": "https://coinrailz.com"
      },
      "operatingSystem": "Web",
      "offers": {
        "@type": "AggregateOffer",
        "priceCurrency": "USD",
        "lowPrice": "0.25",
        "highPrice": "0.50",
        "description": "$0.25-0.50 per API request"
      }
    }
  });

  const platforms = [
    {
      name: "Kalshi",
      logo: "⚖️",
      description: "The first CFTC-regulated prediction exchange in the US. Fiat-settled event contracts.",
      features: ["CFTC Regulated", "$23.8B Volume", "Fiat Settlement", "Economics, Politics, Tech, Weather"],
      status: "Live",
      highlight: true
    },
    {
      name: "Polymarket",
      logo: "📊",
      description: "The largest crypto-native prediction market. On-chain settlement with deep liquidity.",
      features: ["Crypto-Native", "$20B+ Volume", "On-Chain Settlement", "Politics, Crypto, Sports, Culture"],
      status: "Live",
      highlight: false
    }
  ];

  const endpoints = [
    {
      id: "kalshi-markets",
      icon: <BarChart3 className="w-6 h-6 text-emerald-500" />,
      name: "Kalshi Active Markets",
      description: "Browse active event contracts from the CFTC-regulated exchange",
      price: "$0.25",
      unit: "request",
      platform: "Kalshi",
      features: ["Filter by status", "Category filtering", "Volume data"],
      useCases: "Market screening, portfolio construction, trend analysis"
    },
    {
      id: "kalshi-odds",
      icon: <Scale className="w-6 h-6 text-blue-500" />,
      name: "Kalshi Odds Lookup",
      description: "Current yes/no prices, orderbook depth for specific markets",
      price: "$0.50",
      unit: "request",
      platform: "Kalshi",
      features: ["Yes/No prices", "Orderbook depth", "Event details"],
      useCases: "Odds comparison, arbitrage detection, signal generation"
    },
    {
      id: "kalshi-search",
      icon: <Search className="w-6 h-6 text-violet-500" />,
      name: "Kalshi Search",
      description: "Search across all Kalshi markets by keyword",
      price: "$0.25",
      unit: "request",
      platform: "Kalshi",
      features: ["Keyword search", "Status filtering", "Title + ticker matching"],
      useCases: "Market discovery, topic monitoring, research"
    },
    {
      id: "polymarket-events",
      icon: <TrendingUp className="w-6 h-6 text-orange-500" />,
      name: "Polymarket Trending Events",
      description: "Top prediction events with volume and odds data",
      price: "$0.25",
      unit: "request",
      platform: "Polymarket",
      features: ["Sort by volume", "Active/all filter", "Odds included"],
      useCases: "Trending analysis, volume tracking, market overview"
    },
    {
      id: "polymarket-odds",
      icon: <Target className="w-6 h-6 text-rose-500" />,
      name: "Polymarket Odds Lookup",
      description: "Current probability and implied odds for specific events",
      price: "$0.50",
      unit: "request",
      platform: "Polymarket",
      features: ["Probability data", "Implied odds", "Outcome breakdown"],
      useCases: "Price monitoring, arbitrage scanning, sentiment tracking"
    },
    {
      id: "polymarket-search",
      icon: <Search className="w-6 h-6 text-amber-500" />,
      name: "Polymarket Search",
      description: "Search 15,000+ markets with exhaustive or fast mode",
      price: "$0.25",
      unit: "request",
      platform: "Polymarket",
      features: ["Top 5K fast mode", "Exhaustive mode (15K+)", "Include archived"],
      useCases: "Market discovery, historical research, comprehensive coverage"
    }
  ];

  const targetBuyers = [
    {
      title: "AI Trading Agents",
      description: "Autonomous agents that monitor odds, detect arbitrage, and execute strategies across prediction markets",
      budget: "$1K-50K/year",
      icon: <Zap className="w-6 h-6" />
    },
    {
      title: "Quant & Research Firms",
      description: "Quantitative analysis of event probabilities, correlation studies, and alternative data signals",
      budget: "$5K-100K/year",
      icon: <BarChart3 className="w-6 h-6" />
    },
    {
      title: "News & Media Analytics",
      description: "Real-time probability tracking for election coverage, economic events, and breaking news",
      budget: "$2K-25K/year",
      icon: <Globe className="w-6 h-6" />
    },
    {
      title: "Risk & Insurance",
      description: "Market-implied probabilities for catastrophe modeling, political risk, and macro event forecasting",
      budget: "$10K-200K/year",
      icon: <Shield className="w-6 h-6" />
    }
  ];

  const apiReference = [
    { method: "POST", path: "/x402/kalshi-markets", description: "Active Kalshi markets (x402)", platform: "Kalshi" },
    { method: "POST", path: "/x402/kalshi-odds", description: "Kalshi odds lookup (x402)", platform: "Kalshi" },
    { method: "POST", path: "/x402/kalshi-search", description: "Search Kalshi markets (x402)", platform: "Kalshi" },
    { method: "POST", path: "/x402/polymarket-events", description: "Polymarket trending events (x402)", platform: "Polymarket" },
    { method: "POST", path: "/x402/polymarket-odds", description: "Polymarket odds lookup (x402)", platform: "Polymarket" },
    { method: "POST", path: "/x402/polymarket-search", description: "Search Polymarket markets (x402)", platform: "Polymarket" },
    { method: "POST", path: "/x402/prediction-market-odds", description: "Universal odds (any platform)", platform: "Universal" },
  ];

  const creditPacks = [
    { amount: "$50", requests: "100-200", perRequest: "~$0.25-0.50 avg" },
    { amount: "$200", requests: "400-800", perRequest: "~$0.25-0.50 avg" },
    { amount: "$500", requests: "1,000-2,000", perRequest: "~$0.25-0.50 avg" }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900">
      <div className="bg-black/30 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => setLocation("/")}
                className="text-white/80 hover:text-white hover:bg-white/10"
              >
                ← Back
              </Button>
              <div className="flex items-center space-x-3">
                <img 
                  src={coinRailzLogo} 
                  alt="Coin Railz" 
                  className="w-8 h-8"
                />
                <span className="text-xl font-bold text-white">Coin Railz</span>
                <span className="text-white/40">|</span>
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                <span className="text-lg text-white/90">Prediction Markets</span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Live</Badge>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">x402 Enabled</Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-4 mb-6">
            <span className="text-4xl">⚖️</span>
            <span className="text-4xl">📊</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            One API for All Prediction Markets
          </h1>
          <p className="text-xl text-white/70 max-w-3xl mx-auto mb-6">
            Access <span className="text-emerald-400 font-semibold">Kalshi</span> (CFTC-regulated) and{" "}
            <span className="text-orange-400 font-semibold">Polymarket</span> through a single API.
            99% of the $44B prediction market — one integration.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <div className="flex items-center gap-2 text-white/80 bg-white/5 px-4 py-2 rounded-full">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>CFTC Regulated</span>
            </div>
            <div className="flex items-center gap-2 text-white/80 bg-white/5 px-4 py-2 rounded-full">
              <Globe className="w-4 h-4 text-blue-400" />
              <span>$44B Market Coverage</span>
            </div>
            <div className="flex items-center gap-2 text-white/80 bg-white/5 px-4 py-2 rounded-full">
              <Lock className="w-4 h-4 text-yellow-400" />
              <span>x402 Payments</span>
            </div>
          </div>
          <div className="flex justify-center gap-4">
            <Button 
              size="lg" 
              onClick={() => window.open('/.well-known/x402.json', '_blank')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Code className="w-4 h-4 mr-2" />
              View API Manifest
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => setLocation('/pilots/buy')}
              className="border-white/40 text-white bg-white/10 hover:bg-white/20"
            >
              Buy Credits
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
          
          <div className="mt-8 inline-flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-6 py-3">
            <span className="text-white/60 text-sm">API Pricing:</span>
            <div className="flex items-center gap-2">
              <span className="text-green-400 font-semibold">$0.25</span>
              <span className="text-white/40">-</span>
              <span className="text-green-400 font-semibold">$0.50</span>
              <span className="text-white/60 text-sm">per request</span>
            </div>
            <span className="text-white/30">|</span>
            <span className="text-emerald-400 text-sm font-medium">Pay-per-call via USDC</span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-16">
          {platforms.map((platform) => (
            <Card key={platform.name} className={`bg-white/5 border-white/10 backdrop-blur ${platform.highlight ? 'ring-1 ring-emerald-500/30' : ''}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{platform.logo}</span>
                    <div>
                      <CardTitle className="text-white">{platform.name}</CardTitle>
                      <p className="text-white/60 text-sm">{platform.description}</p>
                    </div>
                  </div>
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                    {platform.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {platform.features.map((feature) => (
                    <Badge key={feature} variant="outline" className="border-white/20 text-white/80">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mb-16">
          <h2 className="text-2xl font-bold text-white text-center mb-8">
            <Database className="w-6 h-6 inline mr-2 text-emerald-400" />
            Available Endpoints
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {endpoints.map((endpoint) => (
              <Card key={endpoint.id} className="bg-white/5 border-white/10 backdrop-blur hover:bg-white/10 transition-all">
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    {endpoint.icon}
                    <div className="flex items-center gap-2">
                      <Badge className={endpoint.platform === 'Kalshi' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-orange-500/20 text-orange-400 border-orange-500/30'}>
                        {endpoint.platform}
                      </Badge>
                      <Badge className="bg-white/10 text-white/70 border-white/20">
                        {endpoint.price}/{endpoint.unit}
                      </Badge>
                    </div>
                  </div>
                  <CardTitle className="text-white text-lg">{endpoint.name}</CardTitle>
                  <p className="text-white/60 text-sm">{endpoint.description}</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-1">
                      {endpoint.features.map((feature) => (
                        <Badge key={feature} variant="outline" className="border-white/10 text-white/70 text-xs">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                    <div className="text-xs text-white/40 pt-2 border-t border-white/10">
                      {endpoint.useCases}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="mb-16">
          <h2 className="text-2xl font-bold text-white text-center mb-8">
            Target Markets
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {targetBuyers.map((buyer) => (
              <Card key={buyer.title} className="bg-white/5 border-white/10 backdrop-blur">
                <CardContent className="pt-6">
                  <div className="text-emerald-400 mb-3">{buyer.icon}</div>
                  <h3 className="text-white font-semibold mb-2">{buyer.title}</h3>
                  <p className="text-white/60 text-sm mb-3">{buyer.description}</p>
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                    {buyer.budget}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="mb-16">
          <h2 className="text-2xl font-bold text-white text-center mb-8">
            <Code className="w-6 h-6 inline mr-2 text-emerald-400" />
            API Reference
          </h2>
          <Card className="bg-white/5 border-white/10 backdrop-blur">
            <CardContent className="pt-6">
              <div className="space-y-3">
                {apiReference.map((ep) => (
                  <div key={ep.path} className="flex items-center justify-between p-3 bg-black/20 rounded-lg">
                    <div className="flex items-center gap-4">
                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                        {ep.method}
                      </Badge>
                      <code className="text-emerald-400 font-mono text-sm">{ep.path}</code>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={`text-xs ${
                        ep.platform === 'Kalshi' ? 'border-emerald-500/30 text-emerald-400' :
                        ep.platform === 'Polymarket' ? 'border-orange-500/30 text-orange-400' :
                        'border-purple-500/30 text-purple-400'
                      }`}>
                        {ep.platform}
                      </Badge>
                      <span className="text-white/60 text-sm hidden sm:inline">{ep.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mb-16">
          <h2 className="text-2xl font-bold text-white text-center mb-8">
            <Play className="w-6 h-6 inline mr-2 text-green-400" />
            Live Preview - Try the API
          </h2>
          <Card className="bg-white/5 border-white/10 backdrop-blur">
            <CardContent className="pt-6">
              <p className="text-white/70 text-center mb-6">
                Click an endpoint below to see a live 402 discovery response. This shows the payment requirement your agent will receive.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
                {[
                  { id: 'kalshi-markets', label: 'Kalshi Markets', icon: <BarChart3 className="w-4 h-4 mr-1" />, activeClass: 'bg-emerald-600' },
                  { id: 'kalshi-odds', label: 'Kalshi Odds', icon: <Scale className="w-4 h-4 mr-1" />, activeClass: 'bg-emerald-600' },
                  { id: 'kalshi-search', label: 'Kalshi Search', icon: <Search className="w-4 h-4 mr-1" />, activeClass: 'bg-emerald-600' },
                  { id: 'polymarket-events', label: 'Poly Events', icon: <TrendingUp className="w-4 h-4 mr-1" />, activeClass: 'bg-orange-600' },
                  { id: 'polymarket-odds', label: 'Poly Odds', icon: <Target className="w-4 h-4 mr-1" />, activeClass: 'bg-orange-600' },
                  { id: 'polymarket-search', label: 'Poly Search', icon: <Search className="w-4 h-4 mr-1" />, activeClass: 'bg-orange-600' },
                  { id: 'prediction-market-odds', label: 'Universal', icon: <Globe className="w-4 h-4 mr-1" />, activeClass: 'bg-purple-600' },
                ].map((btn) => (
                  <Button
                    key={btn.id}
                    variant={selectedPreview === btn.id ? 'default' : 'outline'}
                    className={selectedPreview === btn.id 
                      ? btn.activeClass 
                      : 'border-white/30 text-white bg-white/10 hover:bg-white/20'}
                    onClick={() => fetchPreview(btn.id, `/x402/${btn.id}`)}
                    disabled={previewLoading}
                    size="sm"
                  >
                    {btn.icon}
                    <span className="text-xs">{btn.label}</span>
                  </Button>
                ))}
              </div>
              
              {previewLoading && (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
                  <span className="ml-3 text-white/70">Fetching response...</span>
                </div>
              )}
              
              {previewData && !previewLoading && (
                <div className="bg-black/40 rounded-lg p-4 overflow-auto max-h-96">
                  <div className="flex items-center justify-between mb-3">
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                      402 Discovery Response
                    </Badge>
                    <span className="text-white/40 text-xs">This is what your AI agent receives before payment</span>
                  </div>
                  <pre className="text-sm text-green-400 font-mono whitespace-pre-wrap">
                    {JSON.stringify(previewData, null, 2)}
                  </pre>
                </div>
              )}
              
              {!previewData && !previewLoading && (
                <div className="text-center py-8 text-white/50">
                  Click an endpoint button above to see the 402 discovery response
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mb-16">
          <h2 className="text-2xl font-bold text-white text-center mb-8">
            How to Pay - Choose Your Method
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="bg-gradient-to-br from-emerald-600/60 to-teal-600/60 border-2 border-emerald-400/80 shadow-lg shadow-emerald-500/20">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-3">
                  <CreditCard className="w-6 h-6 text-emerald-300" />
                  Prepaid Credits
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-white/80 mb-4">
                  Best for developers and enterprises. Buy credits upfront and use an API key for simple authentication.
                </p>
                <ul className="space-y-2 mb-4">
                  <li className="flex items-center gap-2 text-white/80">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    Simple API key authentication
                  </li>
                  <li className="flex items-center gap-2 text-white/80">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    Pay with card or crypto
                  </li>
                  <li className="flex items-center gap-2 text-white/80">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    Usage dashboard & tracking
                  </li>
                  <li className="flex items-center gap-2 text-white/80">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    No crypto wallet needed
                  </li>
                </ul>
                <Button 
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => setLocation('/pilots/buy')}
                >
                  Buy Credits Package
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-cyan-600/60 to-blue-600/60 border-2 border-cyan-400/80 shadow-lg shadow-cyan-500/20">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-3">
                  <Wallet className="w-6 h-6 text-cyan-300" />
                  x402 Micropayments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-white/80 mb-4">
                  Best for AI agents and autonomous systems. Pay-per-call with on-chain USDC — no account needed.
                </p>
                <ul className="space-y-2 mb-4">
                  <li className="flex items-center gap-2 text-white/80">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    Machine-readable HTTP 402
                  </li>
                  <li className="flex items-center gap-2 text-white/80">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    No onboarding required
                  </li>
                  <li className="flex items-center gap-2 text-white/80">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    Pay with USDC on Ethereum or Base
                  </li>
                  <li className="flex items-center gap-2 text-white/80">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    Perfect for agent-to-API calls
                  </li>
                </ul>
                <Button 
                  variant="outline"
                  className="w-full border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
                  onClick={() => window.open('/x402/kalshi-markets', '_blank')}
                >
                  See x402 Response Format
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mb-16">
          <h2 className="text-2xl font-bold text-white text-center mb-4">
            Need a Wallet? Get Started in 30 Seconds
          </h2>
          <p className="text-white/60 text-center mb-8 max-w-2xl mx-auto">
            If your agent doesn't have a crypto wallet yet, we provide free wallet creation via Coinbase CDP.
            Fund it with USDC on Ethereum or Base and start making API calls immediately.
          </p>
          <Card className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 border-purple-500/30 max-w-2xl mx-auto">
            <CardContent className="py-8">
              <div className="grid grid-cols-3 gap-6 text-center">
                <div>
                  <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-3">
                    <span className="text-xl font-bold text-purple-400">1</span>
                  </div>
                  <h4 className="text-white font-medium mb-1">Create Wallet</h4>
                  <p className="text-white/50 text-xs">POST /x402/wallet/free</p>
                </div>
                <div>
                  <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto mb-3">
                    <span className="text-xl font-bold text-blue-400">2</span>
                  </div>
                  <h4 className="text-white font-medium mb-1">Fund with USDC</h4>
                  <p className="text-white/50 text-xs">Send USDC on Ethereum or Base</p>
                </div>
                <div>
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                    <span className="text-xl font-bold text-emerald-400">3</span>
                  </div>
                  <h4 className="text-white font-medium mb-1">Call Any Endpoint</h4>
                  <p className="text-white/50 text-xs">x402 handles payment</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mb-16">
          <h2 className="text-2xl font-bold text-white text-center mb-8">
            Credits Packages
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {creditPacks.map((pack) => (
              <Card key={pack.amount} className="bg-white/5 border-white/10 backdrop-blur text-center">
                <CardContent className="pt-6">
                  <div className="text-3xl font-bold text-white mb-2">{pack.amount}</div>
                  <div className="text-white/60 mb-4">{pack.requests} requests</div>
                  <div className="text-emerald-400 text-sm">{pack.perRequest}</div>
                  <Button 
                    className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => setLocation('/pilots/buy')}
                  >
                    Get Started
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Card className="bg-gradient-to-r from-emerald-600/20 to-cyan-600/20 border-emerald-500/30">
          <CardContent className="py-12 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to Access Prediction Market Data?
            </h2>
            <p className="text-white/70 mb-6 max-w-2xl mx-auto">
              Start pulling odds and events from Kalshi and Polymarket today.
              No API keys to register, no rate limit negotiations — just micropayments and data.
            </p>
            <div className="flex justify-center gap-4">
              <Button 
                size="lg" 
                className="bg-white text-emerald-900 hover:bg-white/90"
                onClick={() => setLocation('/pilots/buy')}
              >
                Buy Credits Package
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10"
                onClick={() => window.open('/.well-known/x402.json', '_blank')}
              >
                View Full API Manifest
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="mt-12 text-center">
          <p className="text-white/40 text-sm">
            Data from{" "}
            <span className="text-emerald-400">Kalshi</span> (CFTC-regulated) and{" "}
            <span className="text-orange-400">Polymarket</span> (crypto-native)
          </p>
          <p className="text-white/30 text-xs mt-2">
            Combined $44B+ prediction market volume. 7 API endpoints. One integration.
          </p>
        </div>
      </div>
    </div>
  );
}
