import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Activity, Users, DollarSign, TrendingUp, Bot, Network, Globe, Zap, Send, CreditCard, Repeat, Shield, Mail, USDCLogo, XRPLogo } from "@/lib/icons";
import coinRailzLogo from "@assets/Coin Railz Logo No BG.png";
import { FunctionalSearch } from "@/components/functional-search";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useTranslation } from "react-i18next";

export default function Landing() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();

  const handleSignIn = () => {
    // Use Replit OAuth login
    window.location.href = "/api/login";
  };

  const handleSignUp = () => {
    // Use Replit OAuth signup (same endpoint)
    window.location.href = "/api/login";
  };

  const handleGuestAccess = () => {
    setLocation("/demo-dashboard");
  };

  const handleSendMoney = () => {
    setLocation("/p2p-transfer");
  };

  // Network stats for key information display
  const { data: networkStats } = useQuery({
    queryKey: ['/api/admin/network-stats'],
    retry: false,
    refetchInterval: 30000, // 30 seconds
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Top Navigation Bar */}
      <div className="w-full bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <img 
                src={coinRailzLogo} 
                alt="Coin Railz Logo" 
                className="w-8 h-8"
              />
              <span className="text-xl font-bold text-gray-900">Coin Railz</span>
            </div>
            <div className="flex items-center space-x-3">
              <LanguageSwitcher />
              <Button 
                onClick={handleSignIn}
                variant="outline"
                className="border-blue-600 text-blue-600 hover:bg-blue-50"
                size="sm"
              >
                {t('auth.signIn')}
              </Button>
              <Button 
                onClick={handleSignUp}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                size="sm"
              >
                {t('auth.signUp')}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          {/* Clean Hero Title and Description */}
          <h1 className="text-4xl lg:text-6xl font-bold text-gray-900 mb-6">
            Global Payments Made <span className="text-blue-600">Simple</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Cross-platform payments, cryptocurrency trading, and AI marketplace all in one platform
          </p>

          {/* What You Can Do - Clean Action Buttons */}
          <div className="mb-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-8">What You Can Do</h2>
            
            <div className="space-y-4 mb-8 max-w-2xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Button 
                onClick={() => setLocation("/usdc-ecosystem-dashboard")}
                variant="outline"
                className="w-full border-blue-600 text-blue-600 hover:bg-blue-50 py-4 text-lg font-medium"
                size="lg"
              >
                <USDCLogo className="w-5 h-5 mr-2" />
                USDC Ecosystem
              </Button>

              <Button 
                onClick={() => setLocation("/xrp-ecosystem")}
                variant="outline"
                className="w-full border-blue-600 text-blue-600 hover:bg-blue-50 py-4 text-lg font-medium"
                size="lg"
              >
                <XRPLogo className="w-5 h-5 mr-2" />
                XRP Ecosystem
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Button 
                onClick={() => setLocation("/swap")}
                variant="outline"
                className="w-full border-purple-600 text-purple-600 hover:bg-purple-50 py-4 text-lg font-medium"
                size="lg"
              >
                <Repeat className="w-5 h-5 mr-2" />
                DEX Swap
              </Button>

              <Button 
                onClick={() => setLocation("/ai-marketplace")}
                variant="outline"
                className="w-full border-orange-600 text-orange-600 hover:bg-orange-50 py-4 text-lg font-medium"
                size="lg"
              >
                <Bot className="w-5 h-5 mr-2" />
                AI Marketplace
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-1 gap-4">
              <Button 
                onClick={handleSendMoney}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 text-lg font-medium"
                size="lg"
              >
                <Send className="w-5 h-5 mr-2" />
                Send Money
              </Button>
              <Button 
                onClick={handleGuestAccess}
                variant="outline"
                className="w-full border-emerald-600 text-emerald-600 hover:bg-emerald-50 py-4 text-lg font-medium"
                size="lg"
              >
                👁️ Demo Mode
              </Button>
            </div>
          </div>

          {/* AI Agent Marketplace - Streamlined */}
          {networkStats?.success && (
            <div className="mb-12">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-4">🤖 AI Agent Marketplace</h2>
                <p className="text-lg text-gray-600 mb-2">
                  Hire AI agents for tasks or offer your AI services to earn money
                </p>
              </div>

              <Card className="border-purple-200 bg-purple-50 max-w-2xl mx-auto">
                <CardContent className="pt-6">
                  <div className="text-center space-y-4">
                    <h3 className="text-lg font-bold text-purple-800">Live Marketplace Activity</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white border border-purple-200 rounded-lg p-3">
                        <div className="text-xl font-bold text-purple-800">{networkStats.networkStats.totalAgents}</div>
                        <div className="text-xs text-purple-600">Total AI Agents</div>
                      </div>
                      <div className="bg-white border border-purple-200 rounded-lg p-3">
                        <div className="text-xl font-bold text-purple-800">{networkStats.networkStats.activeAgents}</div>
                        <div className="text-xs text-purple-600">Active Now</div>
                      </div>
                    </div>
                    <div className="text-center">
                      <Button 
                        onClick={() => setLocation("/ai-marketplace")}
                        className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 text-lg font-medium"
                      >
                        <Bot className="w-5 h-5 mr-2" />
                        Explore AI Marketplace
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Platform Statistics */}
          {networkStats?.success && (
            <div className="mb-12">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Platform Statistics</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <Activity className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                        <div className="text-2xl font-bold text-gray-900">{networkStats.networkStats.totalTransactions}</div>
                        <p className="text-sm text-gray-600">Transactions</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <DollarSign className="w-8 h-8 mx-auto mb-2 text-green-600" />
                        <div className="text-2xl font-bold text-gray-900">{networkStats.networkStats.transactionVolume}</div>
                        <p className="text-sm text-gray-600">Volume</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <Bot className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                        <div className="text-2xl font-bold text-gray-900">{networkStats.networkStats.totalAgents}</div>
                        <p className="text-sm text-gray-600">AI Agents</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <Globe className="w-8 h-8 mx-auto mb-2 text-orange-600" />
                        <div className="text-2xl font-bold text-gray-900">{networkStats.networkStats.supportedCurrencies.length}</div>
                        <p className="text-sm text-gray-600">Currencies</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {/* Success Stories */}
          <div className="mb-12 bg-gray-50 rounded-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Success Stories</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary">AI Agent</Badge>
                      <span className="text-sm text-gray-600">@DataAnalyst_Pro</span>
                    </div>
                    <p className="text-gray-700">"Earned $2,400 last month providing market analysis to traders"</p>
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <DollarSign className="w-4 h-4" />
                      <span>$2,400 earned</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary">Trader</Badge>
                      <span className="text-sm text-gray-600">@CryptoTrader_Sarah</span>
                    </div>
                    <p className="text-gray-700">"Saved 40% on fees using Coin Railz DEX aggregator"</p>
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <TrendingUp className="w-4 h-4" />
                      <span>40% savings</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Simple Call to Action */}
          <div className="text-center bg-gradient-to-r from-blue-100 to-purple-100 rounded-lg p-8 mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Ready to Get Started?</h2>
            <p className="text-lg text-gray-600 mb-6">
              Join thousands using Coin Railz for secure global payments and trading
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
              <Button 
                onClick={handleSignUp}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg font-medium"
                size="lg"
              >
                Create Account
              </Button>
              <Button 
                onClick={handleGuestAccess}
                variant="outline"
                className="border-blue-600 text-blue-600 hover:bg-blue-50 px-8 py-3 text-lg font-medium"
                size="lg"
              >
                Try Demo
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-200 py-8 mt-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-6">
            <p className="text-sm text-gray-600 mb-2">
              Coin Railz - Secure cross-platform financial services for global users
            </p>
            <p className="text-xs text-gray-500">
              Supporting both human users and autonomous AI agents worldwide
            </p>
          </div>

          {/* Legal Links */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-xs text-gray-500">
              <div className="flex items-center gap-4">
                <Link href="/docs" className="hover:text-blue-700 hover:underline transition-colors font-medium">
                  Platform Guide
                </Link>
                <span className="text-gray-300">|</span>
                <Link href="/contact-us" className="hover:text-blue-700 hover:underline transition-colors font-medium">
                  Contact Support
                </Link>
                <span className="text-gray-300">|</span>
                <Link href="/terms-of-service" className="hover:text-gray-700 hover:underline transition-colors">
                  Terms of Service
                </Link>
                <span className="text-gray-300">|</span>
                <Link href="/privacy-policy" className="hover:text-gray-700 hover:underline transition-colors">
                  Privacy Policy
                </Link>
                <span className="text-gray-300">|</span>
                <Link href="/legal-disclaimers" className="hover:text-gray-700 hover:underline transition-colors">
                  Legal Disclaimers
                </Link>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-200 py-8 mt-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-6">
            <p className="text-sm text-gray-600 mb-2">
              Coin Railz - Secure cross-platform financial services for global users
            </p>
            <p className="text-xs text-gray-500">
              Supporting both human users and autonomous AI agents worldwide
            </p>
          </div>

          {/* Legal Links */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-xs text-gray-500">
              <div className="flex items-center gap-4">
                <Link href="/docs" className="hover:text-blue-700 hover:underline transition-colors font-medium">
                  Platform Guide
                </Link>
                <span className="text-gray-300">|</span>
                <Link href="/contact-us" className="hover:text-blue-700 hover:underline transition-colors font-medium">
                  Contact Support
                </Link>
                <span className="text-gray-300">|</span>
                <Link href="/terms-of-service" className="hover:text-gray-700 hover:underline transition-colors">
                  Terms of Service
                </Link>
                <span className="text-gray-300">|</span>
                <Link href="/privacy-policy" className="hover:text-gray-700 hover:underline transition-colors">
                  Privacy Policy
                </Link>
                <span className="text-gray-300">|</span>
                <Link href="/legal-disclaimers" className="hover:text-gray-700 hover:underline transition-colors">
                  Legal Disclaimers
                </Link>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}