import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { NavigationHeader } from "@/components/navigation-header";
import { MobileNavigation } from "@/components/mobile-navigation";
import { 
  Globe, 
  Zap, 
  Shield, 
  TrendingUp, 
  Wallet, 
  Lock, 
  Clock, 
  DollarSign,
  ArrowRight,
  BarChart3
} from "@/lib/icons";
import { useSEO, seoConfigs } from "@/hooks/useSEO";

interface XRPService {
  id: string;
  title: string;
  description: string;
  benefits: string[];
  icon: React.ComponentType<any>;
  status: 'active' | 'coming_soon' | 'beta';
  route?: string;
  color: string;
}

export default function XRPEcosystemDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [xrpRate, setXrpRate] = useState<number>(0.5000);

  // SEO optimization for XRP ecosystem page
  useSEO(seoConfigs.xrp);
  const [platformStats, setPlatformStats] = useState({
    totalTransactions: 1247,
    totalVolume: 523847.50,
    avgSettlementTime: '3.2s',
    uptime: '99.99%'
  });

  // Fetch XRP data using existing endpoints
  useEffect(() => {
    const fetchXRPData = async () => {
      try {
        // Use existing XRP rate endpoint
        const rateResponse = await fetch('/api/xrp/rate');
        if (rateResponse.ok) {
          const rateData = await rateResponse.json();
          if (rateData.success && rateData.rate && rateData.rate.XRP_USD) {
            setXrpRate(rateData.rate.XRP_USD);
          }
        }
      } catch (error) {
        console.error('Error fetching XRP data:', error);
        // Use fallback values - no platform breaking
      }
    };

    fetchXRPData();
    // Update every 30 seconds
    const interval = setInterval(fetchXRPData, 30000);
    return () => clearInterval(interval);
  }, []);

  const xrpServices: XRPService[] = [
    // Trading & Investment Services
    {
      id: 'buy-sell',
      title: 'Buy & Sell XRP',
      description: 'Purchase XRP with fiat currency or sell XRP for cash with multiple payment methods',
      benefits: ['Credit card payments', 'Bank transfers', 'Instant processing'],
      icon: DollarSign,
      status: 'active',
      route: '/xrp-buy-sell',
      color: 'bg-green-500'
    },
    {
      id: 'rlusd-trading',
      title: 'RLUSD Stablecoin Trading',
      description: 'Trade Ripple\'s RLUSD stablecoin with XRP and other cryptocurrencies',
      benefits: ['USD-pegged stability', 'Native XRP Ledger', 'Low fees'],
      icon: DollarSign,
      status: 'active',
      route: '/xrp-rlusd-trading',
      color: 'bg-emerald-600'
    },
    {
      id: 'dex-trading',
      title: 'DEX Token Swaps',
      description: 'Simple token swaps with instant execution and industry-standard interface',
      benefits: ['Native DEX integration', 'Advanced order book', 'Real-time trading'],
      icon: TrendingUp,
      status: 'active',
      route: '/xrp-dex-trading',
      color: 'bg-indigo-500'
    },
    {
      id: 'native-tokens',
      title: 'Native Token Explorer',
      description: 'Discover and trade tokens native to the XRP Ledger ecosystem',
      benefits: ['Native XRPL tokens', 'Real-time trading', 'Portfolio tracking'],
      icon: DollarSign,
      status: 'active',
      route: '/xrp-native-tokens',
      color: 'bg-cyan-500'
    },
    {
      id: 'liquidity-dashboard',
      title: 'Liquidity Dashboard',
      description: 'Provide liquidity to XRP pairs and earn competitive yields',
      benefits: ['Yield farming', 'LP token management', 'Impermanent loss tracking'],
      icon: BarChart3,
      status: 'active',
      route: '/xrp-liquidity-dashboard',
      color: 'bg-teal-500'
    },
    {
      id: 'bridge-services',
      title: 'Bridge Services',
      description: 'Cross-chain bridges connecting XRP with Ethereum, BSC, and other networks',
      benefits: ['Multi-chain support', 'Arbitrage opportunities', 'Wrapped tokens'],
      icon: ArrowRight,
      status: 'active',
      route: '/xrp-bridge-services',
      color: 'bg-violet-500'
    },
    // Core XRP Services
    {
      id: 'cross-border',
      title: 'Cross-Border Payments',
      description: 'Send money globally in 3-5 seconds with ultra-low fees',
      benefits: ['On-chain transfer workflows', 'Network-dependent fees', 'Transaction tracking'],
      icon: Globe,
      status: 'active',
      route: '/xrp-cross-border-payments',
      color: 'bg-emerald-500'
    },
    {
      id: 'instant-settlement',
      title: 'On-Chain Transfers',
      description: 'Real-time payment processing with immediate finality',
      benefits: ['3-5 second confirmation', 'No chargebacks', 'Immediate liquidity'],
      icon: Zap,
      status: 'active',
      route: '/xrp-instant-settlements',
      color: 'bg-blue-500'
    },
    {
      id: 'escrow',
      title: 'Escrow Services',
      description: 'Secure transactions with automated escrow and dispute resolution',
      benefits: ['Smart contract security', 'Automated release conditions', 'Built-in dispute resolution'],
      icon: Shield,
      status: 'active',
      route: '/xrp-escrow-services',
      color: 'bg-purple-500'
    },
    {
      id: 'wallet-creation',
      title: 'Wallet Creation & Management',
      description: 'Create secure XRP wallets instantly or import existing ones',
      benefits: ['Instant wallet creation', 'Secure import/export', 'Live balance tracking'],
      icon: Wallet,
      status: 'active',
      route: '/xrp-wallet-creation',
      color: 'bg-orange-500'
    },
    {
      id: 'compliance',
      title: 'Compliance Tools',
      description: 'Informational risk and compliance signals for technical review',
      benefits: ['Regulatory compliance', 'Transaction monitoring', 'Risk assessment'],
      icon: Lock,
      status: 'beta',
      route: '/xrp-compliance-tools',
      color: 'bg-red-500'
    }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">Live</Badge>;
      case 'beta':
        return <Badge className="bg-yellow-100 text-yellow-800">Beta</Badge>;
      case 'coming_soon':
        return <Badge className="bg-gray-100 text-gray-800">Coming Soon</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationHeader />
      <MobileNavigation />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20 md:pb-8">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-8 text-white mb-8">
          <div className="text-center">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              XRP Ecosystem Dashboard
            </h1>
            <p className="text-lg text-blue-100 mb-6">
              Next-generation financial services powered by the XRP Ledger
            </p>
            
            {/* Live Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white/10 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-100">XRP Price</p>
                    <p className="text-2xl font-bold">
                      ${xrpRate ? xrpRate.toFixed(4) : '0.0000'}
                    </p>
                  </div>
                  <DollarSign className="w-8 h-8 text-white/80" />
                </div>
              </div>
              
              <div className="bg-white/10 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-100">Settlement Time</p>
                    <p className="text-2xl font-bold">{platformStats.avgSettlementTime}</p>
                  </div>
                  <Clock className="w-8 h-8 text-white/80" />
                </div>
              </div>
              
              <div className="bg-white/10 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-100">Network Fee</p>
                    <p className="text-2xl font-bold">~$0.0002</p>
                  </div>
                  <Zap className="w-8 h-8 text-white/80" />
                </div>
              </div>
              
              <div className="bg-white/10 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-100">Uptime</p>
                    <p className="text-2xl font-bold">{platformStats.uptime}</p>
                  </div>
                  <Shield className="w-8 h-8 text-white/80" />
                </div>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
              <Button 
                onClick={() => setLocation('/xrp-wallet-creation')}
                className="bg-white text-blue-600 hover:bg-blue-50"
              >
                <Wallet className="w-4 h-4 mr-2" />
                Create XRP Wallet
              </Button>
              <Button 
                onClick={() => setLocation('/xrp-buy-sell')}
                variant="outline"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <DollarSign className="w-4 h-4 mr-2" />
                Buy/Sell XRP
              </Button>
              <Button 
                onClick={() => setLocation('/xrp-rlusd-trading')}
                variant="outline"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                Trade RLUSD
              </Button>
            </div>
          </div>
        </div>

        {/* Services Grid */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">XRP Services</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {xrpServices.map((service) => (
              <Card key={service.id} className="hover:shadow-lg transition-shadow duration-200 cursor-pointer border-2 hover:border-blue-200">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`p-3 ${service.color} rounded-lg text-white`}>
                        <service.icon className="w-6 h-6" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{service.title}</CardTitle>
                        {getStatusBadge(service.status)}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <p className="text-gray-600 mb-4">{service.description}</p>
                  
                  <div className="space-y-2 mb-4">
                    <h4 className="font-medium text-sm text-gray-700">Key Benefits:</h4>
                    <ul className="space-y-1">
                      {service.benefits.map((benefit, index) => (
                        <li key={index} className="text-sm text-gray-600 flex items-start">
                          <span className="text-green-500 mr-2">•</span>
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <Button 
                    className="w-full" 
                    disabled={service.status === 'coming_soon'}
                    onClick={() => {
                      if (service.route && service.status !== 'coming_soon') {
                        setLocation(service.route);
                      }
                    }}
                    variant={service.status === 'active' ? 'default' : 'outline'}
                  >
                    {service.status === 'coming_soon' ? 'Coming Soon' : 
                     service.status === 'beta' ? 'Try Beta' : 'Launch Service'}
                    {service.status !== 'coming_soon' && <ArrowRight className="w-4 h-4 ml-2" />}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Why XRP Section */}
        <div className="bg-white rounded-lg p-8">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">Why XRP Ledger?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <Clock className="w-12 h-12 text-blue-500 mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Lightning Fast</h3>
              <p className="text-sm text-gray-600">3-5 second settlement times globally</p>
            </div>
            <div className="text-center">
              <DollarSign className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Ultra Low Cost</h3>
              <p className="text-sm text-gray-600">~$0.0002 network fees per transaction</p>
            </div>
            <div className="text-center">
              <Shield className="w-12 h-12 text-purple-500 mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Battle Tested</h3>
              <p className="text-sm text-gray-600">10+ years of reliable operation</p>
            </div>
            <div className="text-center">
              <Globe className="w-12 h-12 text-orange-500 mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Global Scale</h3>
              <p className="text-sm text-gray-600">150+ countries supported</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}