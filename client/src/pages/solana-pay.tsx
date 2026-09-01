import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { NavigationHeader } from "@/components/navigation-header";
import { MobileNavigation } from "@/components/mobile-navigation";
import { 
  Zap, 
  TrendingUp, 
  Wallet, 
  DollarSign,
  Bot,
  BarChart3,
  Shield,
  Clock,
  Copy,
  Check,
  ExternalLink
} from "@/lib/icons";
import { useSEO } from "@/hooks/useSEO";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface SolanaService {
  id: string;
  title: string;
  description: string;
  priceUsdc: string;
  priceSol: string;
  icon: React.ComponentType<any>;
  endpoint: string;
  capabilities: string[];
  color: string;
}

export default function SolanaPayPage() {
  const [, setLocation] = useLocation();
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const [solPrice, setSolPrice] = useState<number>(150);

  useSEO({
    title: "Solana Payment Processor | Coin Railz",
    description: "Payment tooling for Solana-native AI agents. Network confirmation and applicable fees vary by transaction. Built for agentic USDC workflows.",
    keywords: "Solana payments, AI agents, Truth Terminal, pump.fun, Jito MEV, USDC, crypto payments",
    ogTitle: "Solana Payment Processor - Coin Railz",
    ogDescription: "Payment tooling for Solana-native AI agents with on-chain USDC workflows."
  });

  const platformWallet = "Hgby7VEo6vaPayM1G7kkjTqMAo4aCARoXA3ftWKz1m4k";

  const { data: catalogData } = useQuery({
    queryKey: ['/solana-pay/catalog'],
    retry: false
  });

  const { data: statusData } = useQuery({
    queryKey: ['/solana-pay/status'],
    retry: false
  });

  useEffect(() => {
    const fetchSolPrice = async () => {
      try {
        const response = await fetch('/solana-pay/services/sol-price');
        if (response.ok) {
          const data = await response.json();
          if (data.data?.priceUsd) {
            setSolPrice(data.data.priceUsd);
          }
        }
      } catch (error) {
        console.error('Error fetching SOL price:', error);
      }
    };
    fetchSolPrice();
    const interval = setInterval(fetchSolPrice, 60000);
    return () => clearInterval(interval);
  }, []);

  const copyWallet = async () => {
    await navigator.clipboard.writeText(platformWallet);
    setCopied(true);
    toast({
      title: "Wallet Copied",
      description: "Platform wallet address copied to clipboard"
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const solanaServices: SolanaService[] = [
    {
      id: "sol-price-feed",
      title: "Token Price Feed",
      description: "Real-time Solana token prices via Jupiter and DexScreener aggregation",
      priceUsdc: "0.10",
      priceSol: "0.0005",
      icon: DollarSign,
      endpoint: "/solana-pay/services/price/:mint",
      capabilities: ["Real-time prices", "DEX aggregation", "24h volume data"],
      color: "bg-emerald-500"
    },
    {
      id: "sol-trending",
      title: "Trending Tokens",
      description: "Hot tokens on Solana DEXs with volume, price momentum, and holder data",
      priceUsdc: "0.25",
      priceSol: "0.001",
      icon: TrendingUp,
      endpoint: "/solana-pay/services/trending",
      capabilities: ["Top movers", "Volume analysis", "Token discovery"],
      color: "bg-orange-500"
    },
    {
      id: "sol-whale-alerts",
      title: "Whale Wallet Alerts",
      description: "Track large Solana wallet movements and smart money flows in real-time",
      priceUsdc: "0.50",
      priceSol: "0.002",
      icon: BarChart3,
      endpoint: "/solana-pay/services/whale-alerts",
      capabilities: ["Whale tracking", "Smart money flow", "Real-time alerts"],
      color: "bg-purple-500"
    }
  ];

  const targetAudience = [
    { name: "Truth Terminal Ecosystem", description: "AI agents built on Solana infrastructure" },
    { name: "pump.fun Traders", description: "High-frequency token traders and snipers" },
    { name: "Jito MEV Bots", description: "Arbitrage and MEV extraction automation" },
    { name: "DeFi Automation", description: "Yield farming and liquidity management bots" }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationHeader />
      <MobileNavigation />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20 md:pb-8">
        <div className="bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 rounded-lg p-8 text-white mb-8">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Badge className="bg-white/20 text-white border-white/30">Solana Mainnet</Badge>
              <Badge className="bg-green-500/20 text-green-200 border-green-300/30">
                {(statusData as any)?.status === 'operational' ? 'Operational' : 'Live'}
              </Badge>
            </div>
            
            <h1 className="text-3xl md:text-4xl font-bold mb-4" data-testid="page-title">
              Solana Payment Processor
            </h1>
            <p className="text-lg text-purple-100 mb-6 max-w-2xl mx-auto">
              Payment processing as a service for Solana-native AI agents. 
              On-chain payment workflows with confirmation timing determined by the network.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-white/10 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-200">SOL Price</p>
                    <p className="text-2xl font-bold">${solPrice.toFixed(2)}</p>
                  </div>
                  <DollarSign className="w-8 h-8 text-white/80" />
                </div>
              </div>
              
              <div className="bg-white/10 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-200">Platform Fee</p>
                    <p className="text-2xl font-bold">0.5%</p>
                  </div>
                  <Zap className="w-8 h-8 text-white/80" />
                </div>
              </div>
              
              <div className="bg-white/10 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-200">Settlement</p>
                    <p className="text-2xl font-bold">Instant</p>
                  </div>
                  <Clock className="w-8 h-8 text-white/80" />
                </div>
              </div>
              
              <div className="bg-white/10 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-200">Tokens</p>
                    <p className="text-2xl font-bold">3</p>
                  </div>
                  <Wallet className="w-8 h-8 text-white/80" />
                </div>
              </div>
            </div>

            <div className="bg-white/10 rounded-lg p-4 mb-6 max-w-lg mx-auto">
              <p className="text-sm text-purple-200 mb-2">Platform Wallet</p>
              <div className="flex items-center justify-center gap-2">
                <code className="text-sm font-mono bg-white/10 px-3 py-1 rounded" data-testid="wallet-address">
                  {platformWallet.slice(0, 8)}...{platformWallet.slice(-8)}
                </code>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={copyWallet}
                  className="text-white hover:bg-white/20"
                  data-testid="button-copy-wallet"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 justify-center">
              <Button 
                onClick={() => window.open('/.well-known/solana.json', '_blank')}
                className="bg-white text-purple-600 hover:bg-purple-50"
                data-testid="button-api-docs"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                API Discovery
              </Button>
              <Button 
                onClick={() => window.open('/solana-pay/catalog', '_blank')}
                variant="outline"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                data-testid="button-catalog"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Service Catalog
              </Button>
            </div>
          </div>
        </div>

        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Available Services</h2>
          <p className="text-gray-600 mb-6">Pay-per-use data services for Solana-native AI agents</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {solanaServices.map((service) => (
              <Card key={service.id} className="hover:shadow-lg transition-shadow duration-200 border-2 hover:border-purple-200" data-testid={`card-service-${service.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`p-3 ${service.color} rounded-lg text-white`}>
                        <service.icon className="w-6 h-6" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{service.title}</CardTitle>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="secondary">${service.priceUsdc} USDC</Badge>
                          <Badge variant="outline">{service.priceSol} SOL</Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <p className="text-gray-600 mb-4">{service.description}</p>
                  
                  <div className="space-y-2 mb-4">
                    <h4 className="font-medium text-sm text-gray-700">Capabilities:</h4>
                    <ul className="space-y-1">
                      {service.capabilities.map((cap, index) => (
                        <li key={index} className="text-sm text-gray-600 flex items-start">
                          <span className="text-purple-500 mr-2">•</span>
                          {cap}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 font-mono break-all">{service.endpoint}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">How It Works</h2>
          <p className="text-gray-600 mb-6">Simple 4-step payment flow for autonomous agents</p>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { step: 1, title: "Create Intent", description: "POST to /solana-pay/intents with amount, token, and service" },
              { step: 2, title: "Send Payment", description: "Transfer exact amount to platform wallet with memo tag" },
              { step: 3, title: "Auto Settlement", description: "Helius webhook verifies and settles payment instantly" },
              { step: 4, title: "Access Service", description: "Include x-intent-id header to access paid service" }
            ].map((item) => (
              <Card key={item.step} className="text-center" data-testid={`card-step-${item.step}`}>
                <CardContent className="pt-6">
                  <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-3 font-bold">
                    {item.step}
                  </div>
                  <h3 className="font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-gray-600">{item.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Built For</h2>
          <p className="text-gray-600 mb-6">Targeting the Solana-native AI agent ecosystem</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {targetAudience.map((audience, index) => (
              <Card key={index} className="bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-100" data-testid={`card-audience-${index}`}>
                <CardContent className="pt-6">
                  <Bot className="w-8 h-8 text-purple-500 mb-3" />
                  <h3 className="font-semibold mb-1">{audience.name}</h3>
                  <p className="text-sm text-gray-600">{audience.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="bg-gray-100 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Supported Tokens</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                SOL
              </div>
              <div>
                <p className="font-semibold">Solana</p>
                <p className="text-sm text-gray-500">Native token</p>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                USDC
              </div>
              <div>
                <p className="font-semibold">USD Coin</p>
                <p className="text-sm text-gray-500 font-mono text-xs">EPjFWdd5...TDt1v</p>
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center text-white font-bold">
                USDT
              </div>
              <div>
                <p className="font-semibold">Tether USD</p>
                <p className="text-sm text-gray-500 font-mono text-xs">Es9vMFrz...v9wg</p>
              </div>
            </div>
          </div>
        </div>

        <Card className="border-purple-200 bg-purple-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <Shield className="w-8 h-8 text-purple-500 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-lg mb-2">Completely Isolated Infrastructure</h3>
                <p className="text-gray-600">
                  The Solana Payment Processor operates independently from our x402 EVM infrastructure. 
                  Separate database tables, wallet management, and payment flows ensure maximum reliability 
                  and zero cross-contamination between blockchain ecosystems.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
