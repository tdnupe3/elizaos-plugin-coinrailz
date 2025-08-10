/**
 * Platform Integration Hub - Showcasing All Ecosystems Working Together
 * Demonstrates the "Best Platform in the World" vision with comprehensive financial services
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Wallet, 
  ArrowLeftRight, 
  Shield, 
  Zap, 
  Globe,
  TrendingUp,
  Users,
  DollarSign,
  Star
} from 'lucide-react';
import { Link } from 'wouter';

const IntegrationCard = ({ 
  title, 
  description, 
  status, 
  revenue, 
  features, 
  link, 
  icon: Icon, 
  gradient 
}: any) => (
  <Card className={`transition-all hover:scale-105 border-2 ${gradient}`}>
    <CardHeader>
      <div className="flex items-center gap-3">
        <Icon className="h-8 w-8 text-white bg-black/20 p-1.5 rounded-lg" />
        <div className="flex-1">
          <CardTitle className="text-lg text-white">{title}</CardTitle>
          <p className="text-white/90 text-sm">{description}</p>
        </div>
        <Badge variant="outline" className="bg-white/20 text-white border-white/30">
          {status}
        </Badge>
      </div>
    </CardHeader>
    <CardContent className="space-y-4">
      {revenue && (
        <div className="bg-white/10 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-white" />
            <span className="text-white font-semibold">{revenue}</span>
          </div>
        </div>
      )}
      
      <div className="space-y-2">
        {features.map((feature: string, index: number) => (
          <div key={index} className="flex items-center gap-2">
            <Star className="h-3 w-3 text-white" />
            <span className="text-white/90 text-sm">{feature}</span>
          </div>
        ))}
      </div>
      
      <Link href={link}>
        <Button className="w-full bg-white text-gray-900 hover:bg-white/90">
          Access Platform
        </Button>
      </Link>
    </CardContent>
  </Card>
);

export default function PlatformIntegrationPage() {
  const [selectedTab, setSelectedTab] = useState('overview');

  const integrations = [
    {
      title: 'Coinbase CDP Integration',
      description: 'Enterprise-grade wallet infrastructure with Smart Accounts',
      status: 'Enhanced',
      revenue: 'Enterprise Ready',
      features: [
        'Server Wallet v2 with 8 networks',
        'Sub-500ms swap execution',
        'Gas-sponsored transactions',
        'Multi-chain Smart Accounts',
        'OAuth2 authentication'
      ],
      link: '/cdp-wallet',
      icon: Shield,
      gradient: 'bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700'
    },
    {
      title: 'Circle USDC Ecosystem', 
      description: 'Real-money P2P transfers and fiat onramps',
      status: 'Active',
      revenue: '$1,025 Revenue',
      features: [
        '25 active USDC wallets',
        'Real-time balance sync',
        'P2P transfers with fees',
        'CoinFlip fiat conversion',
        'Banking infrastructure ready'
      ],
      link: '/wallet',
      icon: DollarSign,
      gradient: 'bg-gradient-to-br from-green-600 via-emerald-600 to-teal-700'
    },
    {
      title: 'XRP Ledger Ecosystem',
      description: 'Complete XRPL financial hub with 7 services',
      status: 'Operational',
      revenue: 'Multi-Service',
      features: [
        'XRP buy/sell with fiat onramps',
        'RLUSD stablecoin trading',
        'Native XRPL token explorer',
        'Advanced DEX trading',
        'Cross-border payments'
      ],
      link: '/xrp',
      icon: Globe,
      gradient: 'bg-gradient-to-br from-orange-600 via-red-600 to-pink-700'
    },
    {
      title: 'DEX Aggregation Platform',
      description: 'Multi-DEX trading with real-time quotes',
      status: 'Live',
      revenue: '0.75% Fee Structure',
      features: [
        '5 major DEX integrations',
        '1inch + Uniswap V3 quotes',
        'MEV protection enabled',
        'Real-time price comparison',
        'Multi-chain support'
      ],
      link: '/swap',
      icon: ArrowLeftRight,
      gradient: 'bg-gradient-to-br from-cyan-600 via-blue-600 to-indigo-700'
    },
    {
      title: 'AI Agent Marketplace',
      description: 'Autonomous agent ecosystem with service delivery',
      status: 'Profitable',
      revenue: '$1,025 Generated',
      features: [
        '10 active AI agents',
        '85% commission structure', 
        'Instant agent activation',
        'Service delivery system',
        'Revenue validation proven'
      ],
      link: '/marketplace',
      icon: Users,
      gradient: 'bg-gradient-to-br from-purple-600 via-violet-600 to-fuchsia-700'
    },
    {
      title: 'Performance Analytics',
      description: 'Real-time platform monitoring and metrics',
      status: 'Monitoring',
      revenue: 'System Health',
      features: [
        'Real-time balance tracking',
        'Transaction monitoring',
        'Revenue analytics',
        'User activity metrics',
        'Performance optimization'
      ],
      link: '/production-dashboard',
      icon: TrendingUp,
      gradient: 'bg-gradient-to-br from-gray-600 via-slate-600 to-zinc-700'
    }
  ];

  const totalFeatures = integrations.reduce((acc, integration) => acc + integration.features.length, 0);
  const activeIntegrations = integrations.filter(i => ['Active', 'Live', 'Operational', 'Profitable'].includes(i.status)).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
            Coin Railz - The Best Platform in the World
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Comprehensive multi-chain fintech platform combining enterprise-grade infrastructure 
            with proven revenue streams and innovative financial services.
          </p>
          <div className="flex justify-center gap-6 text-sm">
            <div className="text-center">
              <p className="font-bold text-2xl text-blue-600">{integrations.length}</p>
              <p className="text-gray-500">Integrated Systems</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-2xl text-green-600">{activeIntegrations}</p>
              <p className="text-gray-500">Active Services</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-2xl text-purple-600">{totalFeatures}</p>
              <p className="text-gray-500">Platform Features</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-2xl text-orange-600">$1,025</p>
              <p className="text-gray-500">Revenue Validated</p>
            </div>
          </div>
        </div>

        {/* Integration Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Platform Overview</TabsTrigger>
            <TabsTrigger value="integrations">All Integrations</TabsTrigger>
            <TabsTrigger value="architecture">Architecture</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {integrations.slice(0, 6).map((integration, index) => (
                <IntegrationCard key={index} {...integration} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="integrations" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {integrations.map((integration, index) => (
                <IntegrationCard key={index} {...integration} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="architecture" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Platform Architecture</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-semibold mb-3">Core Infrastructure</h3>
                      <ul className="space-y-2 text-sm">
                        <li>• PostgreSQL with real-time sync</li>
                        <li>• Express.js backend with TypeScript</li>
                        <li>• React frontend with shadcn/ui</li>
                        <li>• Multi-network blockchain support</li>
                        <li>• Enterprise security patterns</li>
                      </ul>
                    </div>
                    <div>
                      <h3 className="font-semibold mb-3">External Integrations</h3>
                      <ul className="space-y-2 text-sm">
                        <li>• Coinbase CDP Server Wallet v2</li>
                        <li>• Circle USDC API</li>
                        <li>• XRP Ledger mainnet</li>
                        <li>• 1inch & Uniswap V3 DEX APIs</li>
                        <li>• Stripe & PayPal payments</li>
                      </ul>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg">
                    <h3 className="font-semibold mb-3">Strategic Vision</h3>
                    <p className="text-sm text-gray-700">
                      The platform combines proven revenue streams ($1,025 validated) with enterprise-grade 
                      Coinbase infrastructure, creating a comprehensive fintech solution that serves both 
                      retail users and institutional clients across multiple blockchain networks.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Platform Access</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <Link href="/cdp-wallet">
                <Button className="w-full h-16 flex flex-col gap-1">
                  <Shield className="h-5 w-5" />
                  <span className="text-xs">CDP Wallet</span>
                </Button>
              </Link>
              <Link href="/wallet">
                <Button className="w-full h-16 flex flex-col gap-1" variant="outline">
                  <Wallet className="h-5 w-5" />
                  <span className="text-xs">USDC Wallet</span>
                </Button>
              </Link>
              <Link href="/swap">
                <Button className="w-full h-16 flex flex-col gap-1" variant="outline">
                  <ArrowLeftRight className="h-5 w-5" />
                  <span className="text-xs">DEX Trading</span>
                </Button>
              </Link>
              <Link href="/xrp">
                <Button className="w-full h-16 flex flex-col gap-1" variant="outline">
                  <Globe className="h-5 w-5" />
                  <span className="text-xs">XRP Hub</span>
                </Button>
              </Link>
              <Link href="/marketplace">
                <Button className="w-full h-16 flex flex-col gap-1" variant="outline">
                  <Users className="h-5 w-5" />
                  <span className="text-xs">AI Agents</span>
                </Button>
              </Link>
              <Link href="/production-dashboard">
                <Button className="w-full h-16 flex flex-col gap-1" variant="outline">
                  <TrendingUp className="h-5 w-5" />
                  <span className="text-xs">Analytics</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}