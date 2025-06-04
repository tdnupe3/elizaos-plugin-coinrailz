import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Activity, Users, DollarSign, TrendingUp, Bot, Network, Globe, Zap, Send, CreditCard, Repeat, Shield } from "lucide-react";
import coinRailzLogo from "@assets/Coin Railz Logo No BG.png";

export default function Landing() {
  const [, setLocation] = useLocation();
  
  const handleSignIn = () => {
    window.location.href = "/api/login";
  };

  const handleSignUp = () => {
    window.location.href = "/api/login";
  };

  const handleGuestAccess = () => {
    setLocation("/demo-dashboard");
  };

  // Fetch network stats for AI agent network (optional feature)
  const { data: networkStats } = useQuery({
    queryKey: ["/api/public/network/stats"],
    refetchInterval: 30000,
    retry: false
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex justify-center mb-6">
              <img 
                src={coinRailzLogo} 
                alt="Coin Railz Logo" 
                className="w-24 h-24"
              />
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">Coin Railz</h1>
            <p className="text-xl text-gray-600 mb-2">
              Cross-Platform P2P Payments & Crypto Gateway
            </p>
            <p className="text-sm text-gray-500">
              Send money globally • Buy/sell crypto • DEX aggregator • Earn referral rewards
            </p>
          </div>

          {/* Core Platform Features */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <Card className="text-center">
              <CardHeader className="pb-3">
                <Send className="w-8 h-8 mx-auto text-blue-600 mb-2" />
                <CardTitle className="text-lg">Send Money</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">Cross-platform P2P transfers with 0.25% fee</p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader className="pb-3">
                <CreditCard className="w-8 h-8 mx-auto text-green-600 mb-2" />
                <CardTitle className="text-lg">Buy/Sell Crypto</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">Trade cryptocurrencies with competitive rates</p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader className="pb-3">
                <Repeat className="w-8 h-8 mx-auto text-purple-600 mb-2" />
                <CardTitle className="text-lg">DEX Aggregator</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">Best swap rates across multiple exchanges</p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader className="pb-3">
                <Users className="w-8 h-8 mx-auto text-orange-600 mb-2" />
                <CardTitle className="text-lg">Referral Program</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">Earn rewards for bringing new users</p>
              </CardContent>
            </Card>
          </div>

          {/* Platform Statistics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-blue-600">24/7</div>
                <p className="text-sm text-gray-600">Global Availability</p>
              </CardContent>
            </Card>
            
            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-600">150+</div>
                <p className="text-sm text-gray-600">Supported Countries</p>
              </CardContent>
            </Card>
            
            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-purple-600">50+</div>
                <p className="text-sm text-gray-600">Cryptocurrencies</p>
              </CardContent>
            </Card>
            
            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-orange-600">Instant</div>
                <p className="text-sm text-gray-600">Transactions</p>
              </CardContent>
            </Card>
          </div>

          {/* Call to Action - Prominent for Human Users */}
          <div className="text-center space-y-6 mb-12">
            <h2 className="text-3xl font-bold text-gray-900">Start Using Coin Railz Today</h2>
            <p className="text-lg text-gray-600 mb-8">Join thousands of users sending money and trading crypto worldwide</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Button 
                onClick={handleSignIn}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 text-lg font-medium"
                size="lg"
              >
                Sign In
              </Button>
              
              <Button 
                onClick={handleSignUp}
                variant="outline"
                className="w-full border-blue-600 text-blue-600 hover:bg-blue-50 py-4 text-lg font-medium"
                size="lg"
              >
                Sign Up
              </Button>
              
              <Button 
                onClick={() => setLocation("/swap")}
                variant="ghost"
                className="w-full text-purple-600 hover:text-purple-800 hover:bg-purple-50 py-4 text-lg font-medium border border-purple-200"
                size="lg"
              >
                Try DEX Swap
              </Button>
              
              <Button 
                onClick={handleGuestAccess}
                variant="ghost"
                className="w-full text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 py-4 text-lg font-medium border border-emerald-200"
                size="lg"
              >
                Demo Mode
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-sm text-purple-800 font-medium mb-2">No Registration Required:</p>
                <div className="text-xs text-purple-700 space-y-1">
                  <p>• Access DEX aggregator instantly</p>
                  <p>• Compare rates across exchanges</p>
                  <p>• Multi-chain support</p>
                </div>
              </div>
              
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <p className="text-sm text-emerald-800 font-medium mb-2">Full Platform Demo:</p>
                <div className="text-xs text-emerald-700 space-y-1">
                  <p>• Test all features with sample data</p>
                  <p>• Digital wallet with demo funds</p>
                  <p>• Complete transaction flow</p>
                </div>
              </div>
            </div>
          </div>

          {/* Key Benefits */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Why Choose Coin Railz
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-sm">Fast global transfers</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-sm">Best crypto rates</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-sm">Multi-chain support</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-sm">Earn referral rewards</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Security & Compliance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">ISO 20022 Compliant</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">FATF Travel Rule</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Bank-Grade Security</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Multi-Factor Authentication</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* AI Agent Network (Secondary Feature) */}
          {networkStats && (
            <Card className="mb-8 border border-gray-200 bg-gray-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Bot className="w-5 h-5 text-gray-600" />
                  AI Agent Integration
                  <Badge variant="outline" className="ml-2 text-xs">Available</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Our platform also supports autonomous AI agents for automated transactions
                </p>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-lg font-bold text-gray-700">{networkStats?.networkStats?.totalAgents || 0}</div>
                    <div className="text-xs text-gray-500">Connected Agents</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-gray-700">{networkStats?.networkStats?.activeAgents || 0}</div>
                    <div className="text-xs text-gray-500">Active Now</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-gray-700">{networkStats?.networkStats?.totalTransactions || 0}</div>
                    <div className="text-xs text-gray-500">AI Transactions</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-200 py-8 mt-16">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-gray-600 mb-2">
            Coin Railz - Secure cross-platform financial services for global users
          </p>
          <p className="text-xs text-gray-500">
            Supporting both human users and autonomous AI agents worldwide
          </p>
        </div>
      </footer>
    </div>
  );
}

function Footer() {
  return null; // Footer is now integrated into the main component
}