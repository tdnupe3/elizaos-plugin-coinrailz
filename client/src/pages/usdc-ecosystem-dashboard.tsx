import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { NavigationHeader } from "@/components/navigation-header";
import { MobileNavigation } from "@/components/mobile-navigation";
import { 
  DollarSign, 
  Shield, 
  Zap, 
  Globe, 
  TrendingUp, 
  Wallet, 
  Lock, 
  ArrowRight,
  CheckCircle,
  Users,
  BarChart3,
  Bot,
  Clock,
  Star,
  Network
} from "@/lib/icons";
import { GasStationWidget } from "@/components/GasStationWidget";
import USDCDepositWidget from "@/components/usdc-deposit-widget";

interface USDCService {
  id: string;
  title: string;
  description: string;
  benefits: string[];
  icon: React.ComponentType<any>;
  status: 'active' | 'coming_soon' | 'beta';
  route?: string;
  color: string;
  fees?: string;
  settlementTime?: string;
}

export default function USDCEcosystemDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [usdcRate, setUsdcRate] = useState<number>(1.00);
  const [platformStats, setPlatformStats] = useState({
    totalUSDCVolume: 0,
    totalTransactions: 0,
    avgSettlementTime: 'N/A',
    uptime: '100%',
    activeWallets: 0,
    supportedChains: 6
  });

  const [circleHealth, setCircleHealth] = useState({
    status: 'operational',
    lastCheck: new Date().toISOString(),
    walletCreation: 'healthy',
    transactions: 'healthy'
  });

  // Fetch real-time USDC data
  useEffect(() => {
    const fetchUSDCData = async () => {
      try {
        // Check Circle service health
        const healthResponse = await fetch('/api/circle/health');
        if (healthResponse.ok) {
          const healthData = await healthResponse.json();
          setCircleHealth(healthData);
        }

        // Fetch live USDC price from CoinGecko API
        const priceResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=usd');
        if (priceResponse.ok) {
          const priceData = await priceResponse.json();
          const liveUsdcPrice = priceData['usd-coin']?.usd || 1.00;
          setUsdcRate(liveUsdcPrice);
        } else {
          // Fallback to $1.00 if API fails
          setUsdcRate(1.00);
        }
      } catch (error) {
        console.error('Error fetching USDC data:', error);
        // Fallback to $1.00 if API fails
        setUsdcRate(1.00);
      }
    };

    fetchUSDCData();
    const interval = setInterval(fetchUSDCData, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const usdcServices: USDCService[] = [
    {
      id: 'instant-payments',
      title: 'Instant USDC Payments',
      description: 'Send and receive USDC instantly across 6 blockchain networks',
      benefits: [
        'Multi-chain support (ETH, MATIC, AVAX, ARB, BASE)',
        'Circle programmable wallets',
        'Instant settlement',
        'Low fees (0.1-0.5%)'
      ],
      icon: Zap,
      status: 'active',
      route: '/usdc-payments',
      color: 'bg-blue-500',
      fees: '0.1-0.5%',
      settlementTime: 'Instant'
    },
    {
      id: 'stablecoin-savings',
      title: 'USDC Savings & Yield',
      description: 'Earn yield on your USDC holdings with DeFi integration',
      benefits: [
        'Competitive APY rates',
        'FDIC-insured backing',
        'No lock-up periods',
        'Automated yield optimization'
      ],
      icon: TrendingUp,
      status: 'beta',
      route: '/usdc-savings',
      color: 'bg-green-500',
      fees: '0.25%',
      settlementTime: 'Real-time'
    },
    {
      id: 'programmable-wallets',
      title: 'Programmable Wallets',
      description: 'Enterprise-grade wallet infrastructure powered by Circle',
      benefits: [
        'MPC key management',
        'Advanced security controls',
        'Multi-signature support',
        'Compliance-ready'
      ],
      icon: Wallet,
      status: 'active',
      route: '/usdc-wallets',
      color: 'bg-purple-500',
      fees: '$0.05/MAW',
      settlementTime: '<2s'
    },
    {
      id: 'cross-border',
      title: 'Cross-Border Payments',
      description: 'Global USDC transfers with instant settlement',
      benefits: [
        '150+ countries supported',
        'Real-time compliance',
        'Regulatory compliant',
        'Multi-currency on/off ramps'
      ],
      icon: Globe,
      status: 'active',
      route: '/usdc-cross-border',
      color: 'bg-orange-500',
      fees: '0.75%',
      settlementTime: '2-5s'
    },
    {
      id: 'defi-integration',
      title: 'DeFi Integration',
      description: 'Access DeFi protocols with USDC liquidity',
      benefits: [
        'Automated yield farming',
        'Liquidity provision',
        'Flash loans',
        'MEV protection'
      ],
      icon: Network,
      status: 'active',
      route: '/usdc-defi',
      color: 'bg-cyan-500',
      fees: '0.5%',
      settlementTime: '~15s'
    },
    {
      id: 'enterprise-api',
      title: 'Enterprise Solutions',
      description: 'White-label USDC infrastructure for businesses',
      benefits: [
        'Easy integration',
        'Real-time notifications',
        'Multi-tenant support',
        'Custom branding'
      ],
      icon: Bot,
      status: 'active',
      route: '/usdc-enterprise',
      color: 'bg-indigo-500',
      fees: 'Custom',
      settlementTime: 'Variable'
    }
  ];

  const handleServiceClick = (service: USDCService) => {
    if (service.route && service.status === 'active') {
      setLocation(service.route);
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
              USDC Ecosystem Dashboard
            </h1>
            <p className="text-lg text-blue-100 mb-6">
              Enterprise-grade stablecoin infrastructure powered by Circle
            </p>
            
            {/* Live Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white/10 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-100">USDC Price</p>
                    <p className="text-2xl font-bold">
                      ${usdcRate.toFixed(4)}
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
                    <p className="text-sm font-medium text-blue-100">Total Volume</p>
                    <p className="text-2xl font-bold">${platformStats.totalUSDCVolume === 0 ? '0.00' : (platformStats.totalUSDCVolume / 1000000).toFixed(1) + 'M'}</p>
                  </div>
                  <BarChart3 className="w-8 h-8 text-white/80" />
                </div>
              </div>
              
              <div className="bg-white/10 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-100">Active Wallets</p>
                    <p className="text-2xl font-bold">{platformStats.activeWallets === 0 ? '0' : platformStats.activeWallets.toLocaleString()}</p>
                  </div>
                  <Users className="w-8 h-8 text-white/80" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Platform Status */}
        <Card className="mb-8 border-blue-200 bg-blue-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-6 h-6 text-blue-600" />
                <div>
                  <h3 className="font-semibold text-blue-800">Platform Status</h3>
                  <p className="text-sm text-blue-700">
                    {platformStats.totalTransactions === 0 ? 
                      'Platform ready for first transactions • All systems operational' : 
                      `All systems operational • Last check: ${new Date(circleHealth.lastCheck).toLocaleTimeString()}`
                    }
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                {platformStats.totalTransactions === 0 ? 'READY' : String(circleHealth.status).toUpperCase()}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* USDC Deposit Widget */}
        <div className="mb-8">
          <USDCDepositWidget />
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {usdcServices.map((service) => (
            <Card 
              key={service.id} 
              className={`hover:shadow-lg transition-all duration-200 ${
                service.status === 'active' ? 'cursor-pointer hover:border-blue-300' : 'opacity-75'
              }`}
              onClick={() => handleServiceClick(service)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className={`w-12 h-12 ${service.color} rounded-lg flex items-center justify-center text-white mb-3`}>
                    <service.icon className="w-6 h-6" />
                  </div>
                  <Badge 
                    variant={service.status === 'active' ? 'default' : 'secondary'}
                    className={
                      service.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : service.status === 'beta'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }
                  >
                    {service.status === 'active' ? 'Live' : 
                     service.status === 'beta' ? 'Beta' : 'Coming Soon'}
                  </Badge>
                </div>
                <CardTitle className="text-lg">{service.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">{service.description}</p>
                
                {/* Service metrics */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Fees</p>
                    <p className="text-sm font-semibold">{service.fees}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Settlement</p>
                    <p className="text-sm font-semibold">{service.settlementTime}</p>
                  </div>
                </div>
                
                {/* Benefits */}
                <ul className="space-y-1">
                  {service.benefits.slice(0, 3).map((benefit, index) => (
                    <li key={index} className="text-sm text-gray-600 flex items-center">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                      {benefit}
                    </li>
                  ))}
                </ul>
                
                {service.status === 'active' && (
                  <div className="mt-4 pt-4 border-t">
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => handleServiceClick(service)}
                    >
                      Access Service
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Gas Station Widget */}
        <div className="mb-8">
          <GasStationWidget userWalletId={user?.walletId} blockchain="ETH" />
        </div>

        {/* Why USDC Section */}
        <div className="bg-white rounded-lg p-8">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">Why USDC?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <Shield className="w-12 h-12 text-blue-500 mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Regulated & Secure</h3>
              <p className="text-sm text-gray-600">FDIC-insured reserves, regulatory compliance</p>
            </div>
            <div className="text-center">
              <Zap className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Instant Settlement</h3>
              <p className="text-sm text-gray-600">Near-instant transactions across multiple chains</p>
            </div>
            <div className="text-center">
              <Network className="w-12 h-12 text-purple-500 mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Multi-Chain</h3>
              <p className="text-sm text-gray-600">Available on Ethereum, Polygon, Avalanche, Arbitrum</p>
            </div>
            <div className="text-center">
              <Star className="w-12 h-12 text-orange-500 mx-auto mb-4" />
              <h3 className="font-semibold mb-2">Enterprise Grade</h3>
              <p className="text-sm text-gray-600">Institutional-grade infrastructure and APIs</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}