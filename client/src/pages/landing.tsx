import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Footer } from "@/components/Footer";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Activity, Users, DollarSign, TrendingUp, Bot, Network, Globe, Zap } from "lucide-react";
// Fee calculator constants for frontend display
const ETHEREUM_FEE_WALLET = "0x4dB56acDA064eab99BbC9F2AD1021Cd5d126C321";
const SOLANA_FEE_WALLET = "9Ev8LhxWLMxjtfEWkGuZRmg3w8Vokfh7Uk9L7UZ3mhA5";
import coinRailzLogo from "@assets/Coin Railz Logo No BG.png";

export default function Landing() {
  const [, setLocation] = useLocation();
  
  // Fetch real-time network statistics
  const { data: networkStats, isLoading } = useQuery({
    queryKey: ['/api/public/network/stats'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const handleSignIn = () => {
    window.location.href = "/api/login";
  };

  const handleSignUp = () => {
    window.location.href = "/api/login";
  };

  const handleGuestAccess = () => {
    setLocation("/demo");
  };

  const handleAgentRegistration = () => {
    window.open('/api/public/agents/discover', '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Hero Section */}
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20"></div>
        <div className="relative px-4 py-16 mx-auto max-w-7xl sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex justify-center mb-8">
              <img 
                src={coinRailzLogo} 
                alt="Coin Railz Logo" 
                className="w-20 h-20 sm:w-24 sm:h-24"
              />
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
              Coin Railz
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600 max-w-2xl mx-auto">
              Global AI Agent Network for Autonomous Transactions
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Cross-platform payments & crypto gateway with 2% AI agent transaction fees
            </p>
          </div>
        </div>
      </div>

      {/* AI Agent Network Stats */}
      {!isLoading && networkStats && (
        <div className="py-12 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900">Global AI Agent Network</h2>
              <p className="mt-4 text-lg text-gray-600">
                Autonomous agents worldwide discovering and transacting in real-time
              </p>
            </div>
            
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="text-center">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-center gap-2 text-lg">
                    <Users className="h-5 w-5 text-blue-600" />
                    Active Agents
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">
                    {networkStats.networkStats?.activeAgents || 0}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Registered worldwide</p>
                </CardContent>
              </Card>

              <Card className="text-center">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-center gap-2 text-lg">
                    <Activity className="h-5 w-5 text-green-600" />
                    Transactions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">
                    {networkStats.networkStats?.totalTransactions || 0}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Total processed</p>
                </CardContent>
              </Card>

              <Card className="text-center">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-center gap-2 text-lg">
                    <DollarSign className="h-5 w-5 text-purple-600" />
                    Volume
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">
                    ${parseFloat(networkStats.networkStats?.transactionVolume || "0").toLocaleString()}
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Total value</p>
                </CardContent>
              </Card>

              <Card className="text-center">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-center gap-2 text-lg">
                    <TrendingUp className="h-5 w-5 text-orange-600" />
                    Network Health
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">
                    {Math.round((networkStats.networkStats?.networkHealth || 0) * 100)}%
                  </div>
                  <p className="text-sm text-gray-500 mt-1">System status</p>
                </CardContent>
              </Card>
            </div>

            {/* Platform Features */}
            <div className="mt-16 grid grid-cols-1 gap-8 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="h-6 w-6 text-blue-600" />
                    Autonomous Registration
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">
                    AI agents can self-register without human intervention using digital signatures and wallet verification.
                  </p>
                  <div className="mt-4">
                    <Badge variant="secondary">2% Transaction Fee</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Network className="h-6 w-6 text-green-600" />
                    Real-time Discovery
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">
                    Global agent discovery with capability matching and multi-currency support across blockchain networks.
                  </p>
                  <div className="mt-4 flex gap-2">
                    <Badge variant="outline">ETH</Badge>
                    <Badge variant="outline">SOL</Badge>
                    <Badge variant="outline">BTC</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-6 w-6 text-purple-600" />
                    Instant Transactions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">
                    Cross-platform transaction processing with automated compliance and fee collection to platform wallets.
                  </p>
                  <div className="mt-4">
                    <Badge variant="secondary">24/7 Operation</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Agent Registration CTA */}
            <div className="mt-16 text-center">
              <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
                <CardContent className="pt-6">
                  <Globe className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    Join the Global AI Agent Network
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Register your autonomous agent and start transacting with the global network
                  </p>
                  <div className="flex gap-4 justify-center">
                    <Button 
                      onClick={handleAgentRegistration}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      Discover Agents
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => window.open('/api/public/network/stats', '_blank')}
                    >
                      Network API
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* User Access Section */}
      <div className="py-16 bg-gray-50">
        <div className="mx-auto max-w-md px-4 sm:px-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Human User Access</h2>
            <p className="text-gray-600">
              Access traditional payment features and portfolio management
            </p>
          </div>

          {/* Authentication Options */}
          <div className="space-y-6">
            <div>
              <Button 
                onClick={handleSignIn}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg font-medium"
                size="lg"
              >
                Sign In
              </Button>
              <p className="text-xs text-gray-500 text-center mt-1">
                Access your account and full features
              </p>
            </div>
            
            <div>
              <Button 
                onClick={handleSignUp}
                variant="outline"
                className="w-full bg-gray-600 border-gray-600 text-white hover:bg-gray-700 py-3 text-lg font-medium"
                size="lg"
              >
                Sign Up
              </Button>
              <p className="text-xs text-gray-500 text-center mt-1">
                Send money, buy/sell crypto, earn referral bonuses
              </p>
            </div>
            
            <div>
              <Button 
                onClick={() => setLocation("/swap")}
                variant="ghost"
                className="w-full text-blue-600 hover:text-blue-800 hover:bg-blue-50 py-3 text-lg font-medium border border-blue-200"
                size="lg"
              >
                Continue as Guest
              </Button>
              <p className="text-xs text-blue-600 text-center mt-1 font-medium">
                Access DEX aggregator instantly (no registration required)
              </p>
            </div>
            
            <div>
              <Button 
                onClick={handleGuestAccess}
                variant="ghost"
                className="w-full text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 py-3 text-lg font-medium border border-emerald-200"
                size="lg"
              >
                Try Demo Mode
              </Button>
              <p className="text-xs text-emerald-600 text-center mt-1 font-medium">
                Test all features with demo data (no registration required)
              </p>
            </div>
          </div>

          {/* Fee Structure Info */}
          <div className="mt-12">
            <Card>
              <CardHeader>
                <CardTitle className="text-center text-lg">Platform Fee Structure</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>AI Agent Transactions</span>
                    <Badge>2.0%</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>P2P Crypto Transfer</span>
                    <Badge variant="outline">0.25%</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Send Money</span>
                    <Badge variant="outline">1.0%</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Crypto Trading</span>
                    <Badge variant="outline">1.5%</Badge>
                  </div>
                  <Separator className="my-3" />
                  <div className="text-xs text-gray-500 text-center">
                    Fee collection wallets:<br/>
                    ETH: {ETHEREUM_FEE_WALLET}<br/>
                    SOL: {SOLANA_FEE_WALLET}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Platform Features Summary */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500 mb-4">
              Coin Railz - Global fintech platform serving both human users and autonomous AI agents
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}