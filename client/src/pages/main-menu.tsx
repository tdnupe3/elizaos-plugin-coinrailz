import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Send, TrendingUp, TrendingDown, ArrowLeftRight, Users, BarChart3 } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";

export default function MainMenu() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

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
      description: 'Earn $5 for each friend',
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
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Welcome back, {user?.firstName || 'User'}!
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

      {/* Platform Overview */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6 mb-8">
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {mainActions.map((action) => (
            <Card 
              key={action.id}
              className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-blue-200"
              onClick={() => setLocation(action.route)}
            >
              <CardContent className="p-8">
                <div className="flex items-center space-x-4">
                  <div className={`w-16 h-16 ${action.color} rounded-lg flex items-center justify-center text-white`}>
                    <action.icon className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {action.title}
                    </h3>
                    <p className="text-gray-600">
                      {action.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Footer Information */}
        <div className="mt-12 text-center">
          <p className="text-gray-500 text-sm">
            Coin Railz - Cross-platform payments & crypto gateway
          </p>
          <p className="text-gray-400 text-xs mt-2">
            Secure • Fast • Reliable
          </p>
        </div>
      </div>
    </div>
  );
}