import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/Footer";
import { WalletDisplay } from "@/components/wallet-display";

import { Send, TrendingUp, TrendingDown, ArrowLeftRight, Users, BarChart3, Bot, Globe, DollarSign } from "@/lib/icons";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMobileOptimization } from "@/hooks/useMobileOptimization";

export default function MainMenu() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const handleSignOut = () => {
    window.location.href = "/api/logout";
  };

  const mainActions = [
    {
      id: 'send',
      title: 'Send Money',
      description: 'Instant P2P payments via Zelle, PayPal, Venmo & Cash App',
      icon: Send,
      color: 'bg-emerald-500 hover:bg-emerald-600',
      route: '/send'
    },
    {
      id: 'buy',
      title: 'Buy (On-Ramp)',
      description: 'Convert USD to crypto with bank transfers or cards',
      icon: TrendingUp,
      color: 'bg-emerald-500 hover:bg-emerald-600',
      route: '/buy'
    },
    {
      id: 'sell',
      title: 'Sell (Off-Ramp)',
      description: 'Convert crypto to fiat',
      icon: TrendingDown,
      color: 'bg-sky-500 hover:bg-sky-600',
      route: '/sell'
    },
    {
      id: 'swap',
      title: 'Swap (DEX)',
      description: 'DEX aggregator for crypto',
      icon: ArrowLeftRight,
      color: 'bg-sky-500 hover:bg-sky-600',
      route: '/swap'
    },
    {
      id: 'referrals',
      title: 'Referrals',
      description: 'Earn commission for each friend',
      icon: Users,
      color: 'bg-purple-500 hover:bg-purple-600',
      route: '/referrals'
    },
    {
      id: 'analytics',
      title: 'Portfolio Analytics',
      description: 'Advanced portfolio tracking & performance insights',
      icon: BarChart3,
      color: 'bg-blue-500 hover:bg-blue-600',
      route: '/portfolio-analytics'
    },
    {
      id: 'ai-marketplace',
      title: 'AI Marketplace',
      description: 'Premium AI-powered services & automated solutions',
      icon: Bot,
      color: 'bg-purple-500 hover:bg-purple-600',
      route: '/ai-marketplace'
    },
    {
      id: 'usdc-ecosystem',
      title: 'USDC Ecosystem',
      description: 'Enterprise-grade stablecoin infrastructure powered by Circle',
      icon: DollarSign,
      color: 'bg-blue-600 hover:bg-blue-700',
      route: '/usdc-ecosystem'
    },
    {
      id: 'xrp-ecosystem',
      title: 'XRP Ecosystem',
      description: 'Next-gen financial services powered by XRP Ledger',
      icon: Globe,
      color: 'bg-blue-500 hover:bg-blue-600',
      route: '/xrp-ecosystem'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Welcome back, {user && (user as any).firstName ? (user as any).firstName : 'User'}!
              </h1>
              <p className="text-gray-600 mt-1">Your complete fintech platform - choose an action below</p>
            </div>
            <Button 
              variant="outline"
              onClick={() => window.location.href = "/api/logout"}
            >
              Sign Out
            </Button>
          </div>
        </div>
      </div>



      {/* USDC Wallet Balance - Prominently displayed at top */}
      <div className="max-w-4xl mx-auto px-4 py-4">
        <WalletDisplay />
      </div>

      {/* Main Actions Grid - Positioned Higher */}
      <div className="max-w-4xl mx-auto px-4 py-2">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {mainActions.map((action) => (
            <Card 
              key={action.id} 
              className="hover:shadow-lg transition-shadow duration-200 cursor-pointer border-2 hover:border-blue-200"
              onClick={() => setLocation(action.route)}
            >
              <CardContent className="p-5">
                <div className="flex items-center space-x-3">
                  <div className={`w-12 h-12 ${action.color} rounded-lg flex items-center justify-center text-white`}>
                    <action.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{action.title}</h3>
                    <p className="text-gray-600 text-sm leading-tight">{action.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Referral Section - Make it easy to find */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-purple-900 mb-2">Earn Commission for Each Friend</h2>
              <p className="text-purple-700 text-sm">Share your referral link and earn rewards when friends join</p>
            </div>
            <Button 
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={() => setLocation('/referrals')}
            >
              Get Referral Link
            </Button>
          </div>
        </div>

        {/* Platform Overview */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-emerald-900 mb-3">Your Complete Fintech Platform</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-emerald-800">
            <div>
              <h4 className="font-medium mb-2">Money Transfer:</h4>
              <ul className="space-y-1">
                <li>• Send money via 4 platforms automatically</li>
                <li>• Instant delivery with transparent fees</li>
                <li>• Compliance with all banking regulations</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Crypto Gateway:</h4>
              <ul className="space-y-1">
                <li>• Buy/sell crypto with bank integration</li>
                <li>• DEX aggregation for best swap rates</li>
                <li>• Professional-grade security & custody</li>
              </ul>
            </div>
          </div>
        </div>



        {/* Footer Information */}
        <div className="mt-8 text-center">
          <p className="text-gray-500 text-sm">
            Coin Railz - Cross-platform payments & crypto gateway
          </p>
          <p className="text-gray-400 text-xs mt-2">
            Secure • Fast • Reliable
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}