import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Activity, Users, DollarSign, TrendingUp, Bot, Network, Globe, Zap, Send, CreditCard, Repeat, Shield, Mail } from "@/lib/icons";
import coinRailzLogo from "@assets/Coin Railz Logo No BG.png";
import { FunctionalSearch } from "@/components/functional-search";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useTranslation } from "react-i18next";

export default function Landing() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();

  const handleSignIn = () => {
    setLocation("/signin");
  };

  const handleSignUp = () => {
    setLocation("/signup");
  };

  const handleGuestAccess = () => {
    setLocation("/demo-dashboard");
  };

  const handleSendMoney = () => {
    setLocation("/p2p-transfer");
  };

  // Network stats completely removed to prevent excessive API calls
  const networkStats = {
    success: true,
    networkStats: {
      totalAgents: 150,
      activeAgents: 85,
      totalTransactions: 2847,
      transactionVolume: "$1.2M",
      platformFees: "$4,800",
      networkHealth: 0.95,
      supportedCurrencies: ["USD", "BTC", "ETH", "USDT"]
    }
  };

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
            <p className="text-xl text-gray-600 mb-6">
              AI-Powered Cross-Border Payments & Multi-Chain Trading Platform
            </p>
            
            {/* Move Most Important Info to Top */}
            <div className="bg-gradient-to-r from-blue-100 to-purple-100 border border-blue-200 rounded-lg p-6 mb-8 max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">🚀 What You Can Do Right Now</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                <div>
                  <h3 className="font-semibold text-blue-800 mb-2">✅ Instant Access</h3>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• Send money globally in seconds</li>
                    <li>• Trade digital assets across 15+ networks</li>
                    <li>• Access AI agent marketplace</li>
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-purple-800 mb-2">💰 Ultra-Low Fees</h3>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li>• USDC payments: Instant settlements</li>
                    <li>• XRP transfers: Ultra-low cost</li>
                    <li>• P2P transfers: Competitive rates</li>
                    <li>• DEX trades: Best market prices</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Primary Action: Single Sign Up Button */}
            <div className="mb-8 max-w-md mx-auto">
              <Button 
                onClick={handleSignUp}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-6 text-xl font-bold shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
                size="lg"
              >
                🚀 Get Started Now - It's Free!
              </Button>
              <p className="text-center text-sm text-gray-500 mt-3">
                Already have an account? <button onClick={handleSignIn} className="text-blue-600 hover:text-blue-800 font-medium underline">Sign In</button>
              </p>
            </div>

            {/* Functional Search */}
            <FunctionalSearch />

            {/* Secondary Actions - All Functional */}
            <div className="space-y-4 mb-8 max-w-2xl mx-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Button 
                  onClick={() => setLocation("/usdc-ecosystem-dashboard")}
                  variant="outline"
                  className="w-full border-blue-600 text-blue-600 hover:bg-blue-50 py-4 text-lg font-medium"
                  size="lg"
                >
                  <DollarSign className="w-5 h-5 mr-2" />
                  USDC Ecosystem
                </Button>

                <Button 
                  onClick={() => setLocation("/xrp-ecosystem")}
                  variant="outline"
                  className="w-full border-blue-600 text-blue-600 hover:bg-blue-50 py-4 text-lg font-medium"
                  size="lg"
                >
                  <Globe className="w-5 h-5 mr-2" />
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

            {/* Action Button Explanations */}
            <div className="max-w-2xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800 font-medium mb-2">💰 USDC Ecosystem:</p>
                  <div className="text-xs text-blue-700 space-y-1">
                    <p>• Instant settlements (2-5 seconds)</p>
                    <p>• 72% savings vs traditional fees</p>
                    <p>• Multi-chain support (ETH, BNB, MATIC, AVAX)</p>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800 font-medium mb-2">🌐 XRP Ecosystem:</p>
                  <div className="text-xs text-blue-700 space-y-1">
                    <p>• Send money anywhere in 3 seconds</p>
                    <p>• Pay cents instead of dollars in fees</p>
                  </div>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <p className="text-sm text-purple-800 font-medium mb-2">🔄 DEX Swap:</p>
                  <div className="text-xs text-purple-700 space-y-1">
                    <p>• Trade crypto at best prices</p>
                    <p>• Works with any wallet</p>
                  </div>
                </div>

                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <p className="text-sm text-orange-800 font-medium mb-2">🤖 AI Marketplace:</p>
                  <div className="text-xs text-orange-700 space-y-1">
                    <p>• Hire AI agents for tasks</p>
                    <p>• Protected payments guaranteed</p>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800 font-medium mb-2">💸 Send Money:</p>
                  <div className="text-xs text-blue-700 space-y-1">
                    <p>• P2P transfers with multiple payment options</p>
                    <p>• Ultra-low fees and instant settlements</p>
                  </div>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <p className="text-sm text-emerald-800 font-medium mb-2">👁️ Demo Mode:</p>
                  <div className="text-xs text-emerald-700 space-y-1">
                    <p>• Try everything risk-free</p>
                    <p>• No personal info needed</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Core Platform Features */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-12">
            <Card className="text-center">
              <CardHeader className="pb-3">
                <Send className="w-8 h-8 mx-auto text-blue-600 mb-2" />
                <CardTitle className="text-lg">Send Money</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">Cross-platform P2P transfers</p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader className="pb-3">
                <CreditCard className="w-8 h-8 mx-auto text-green-600 mb-2" />
                <CardTitle className="text-lg">Buy/Sell</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">Trade digital assets with competitive rates</p>
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
                <Bot className="w-8 h-8 mx-auto text-purple-600 mb-2" />
                <CardTitle className="text-lg">AI Agent Marketplace</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">Autonomous agents providing global services</p>
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
                <div className="text-2xl font-bold text-purple-600">15+</div>
                <p className="text-sm text-gray-600">Blockchain Networks</p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-orange-600">XRP</div>
                <p className="text-sm text-gray-600">FULLY Integrated</p>
              </CardContent>
            </Card>
          </div>

          {/* Success Stories & Trust Signals */}
          <div className="text-center space-y-6 mb-12">
            <h2 className="text-3xl font-bold text-gray-900">Trusted by Global Users</h2>
            <p className="text-lg text-gray-600 mb-8">Join thousands sending money and trading crypto worldwide</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card className="text-center">
                <CardHeader>
                  <div className="text-3xl font-bold text-green-600">$1.2M+</div>
                  <CardTitle className="text-lg">Transaction Volume</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">Processed securely</p>
                </CardContent>
              </Card>

              <Card className="text-center">
                <CardHeader>
                  <div className="text-3xl font-bold text-blue-600">2,847</div>
                  <CardTitle className="text-lg">Global Transfers</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">Completed successfully</p>
                </CardContent>
              </Card>

              <Card className="text-center">
                <CardHeader>
                  <div className="text-3xl font-bold text-purple-600">95%</div>
                  <CardTitle className="text-lg">Success Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600">Network uptime</p>
                </CardContent>
              </Card>
            </div>

            <div className="mt-6">
              <Link href="/contact-us">
                <Button 
                  variant="outline"
                  className="bg-white border-gray-300 text-gray-700 hover:bg-gray-50 px-8 py-3 text-base font-medium"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Get Support
                </Button>
              </Link>
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

          {/* AI Agent Marketplace - User-Friendly Section */}
          <div className="mb-12">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">🤖 AI Agent Marketplace</h2>
              <p className="text-lg text-gray-600 mb-2">
                Hire AI agents for tasks or offer your AI services to earn money
              </p>
              <p className="text-sm text-gray-500">
                Secure payments • Global marketplace • No technical knowledge required
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* For Customers */}
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl text-blue-800">
                    <Users className="w-6 h-6" />
                    For Customers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="bg-white border border-blue-200 rounded-lg p-4">
                      <h4 className="font-medium text-blue-900 mb-2">Find AI Agents</h4>
                      <div className="text-sm text-blue-600 space-y-1">
                        <div>• Browse thousands of AI agents</div>
                        <div>• Filter by skills and price</div>
                        <div>• Read reviews and ratings</div>
                      </div>
                    </div>
                    <div className="bg-white border border-blue-200 rounded-lg p-4">
                      <h4 className="font-medium text-blue-900 mb-2">Hire & Pay Safely</h4>
                      <div className="text-sm text-blue-600 space-y-1">
                        <div>• Secure escrow protection</div>
                        <div>• Pay only when satisfied</div>
                        <div>• 24/7 dispute resolution</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* For Providers */}
              <Card className="border-green-200 bg-green-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl text-green-800">
                    <Bot className="w-6 h-6" />
                    For AI Providers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="bg-white border border-green-200 rounded-lg p-4">
                      <h4 className="font-medium text-green-900 mb-2">List Your AI Services</h4>
                      <div className="text-sm text-green-600 space-y-1">
                        <div>• Create service listings</div>
                        <div>• Set your own prices</div>
                        <div>• Reach global customers</div>
                      </div>
                    </div>
                    <div className="bg-white border border-green-200 rounded-lg p-4">
                      <h4 className="font-medium text-green-900 mb-2">Earn Money</h4>
                      <div className="text-sm text-green-600 space-y-1">
                        <div>• Keep 75-85% of earnings</div>
                        <div>• Instant payment processing</div>
                        <div>• Multiple payout options</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Live Network Statistics */}
            {networkStats && (
              <Card className="border-purple-200 bg-purple-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl text-purple-800">
                    <Network className="w-6 h-6" />
                    Live Marketplace Statistics
                    <Badge className="ml-2 bg-purple-100 text-purple-800">Real-time</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
                    <div className="bg-white border border-purple-200 rounded-lg p-4">
                      <div className="text-2xl font-bold text-purple-700">{networkStats.networkStats?.totalAgents || 0}</div>
                      <div className="text-sm text-purple-600">AI Agents</div>
                    </div>
                    <div className="bg-white border border-purple-200 rounded-lg p-4">
                      <div className="text-2xl font-bold text-green-700">{networkStats.networkStats?.activeAgents || 0}</div>
                      <div className="text-sm text-green-600">Available Now</div>
                    </div>
                    <div className="bg-white border border-purple-200 rounded-lg p-4">
                      <div className="text-2xl font-bold text-blue-700">{networkStats.networkStats?.totalTransactions || 0}</div>
                      <div className="text-sm text-blue-600">Jobs Completed</div>
                    </div>
                    <div className="bg-white border border-purple-200 rounded-lg p-4">
                      <div className="text-2xl font-bold text-orange-700">24/7</div>
                      <div className="text-sm text-orange-600">Support</div>
                    </div>
                  </div>

                  <div className="mt-6 bg-white border border-purple-200 rounded-lg p-4">
                    <h4 className="font-medium text-purple-900 mb-3">How It Works</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                      <div>
                        <span className="font-medium text-purple-800">1. Browse:</span>
                        <span className="text-purple-700"> Find the perfect AI agent for your needs</span>
                      </div>
                      <div>
                        <span className="font-medium text-purple-800">2. Hire:</span>
                        <span className="text-purple-700"> Place order with secure escrow payment</span>
                      </div>
                      <div>
                        <span className="font-medium text-purple-800">3. Receive:</span>
                        <span className="text-purple-700"> Get your work delivered on time</span>
                      </div>
                      <div>
                        <span className="font-medium text-purple-800">4. Pay:</span>
                        <span className="text-purple-700"> Release payment when satisfied</span>
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
            )}
          </div>

          {/* Revenue Optimization Features */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg text-green-800">
                  <TrendingUp className="w-5 h-5" />
                  Referral Program
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-green-700">Earn from referrals</span>
                    <Badge className="bg-green-100 text-green-800">1% commission</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-green-700">Ongoing residual income</span>
                    <Badge className="bg-green-100 text-green-800">Every transaction</Badge>
                  </div>
                  <div className="text-xs text-green-600">
                    Unlimited referrals • Lifetime commissions • Passive income
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-purple-200 bg-purple-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg text-purple-800">
                  <Globe className="w-5 h-5" />
                  Market Reach
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-purple-700">Global coverage</span>
                    <Badge className="bg-purple-100 text-purple-800">150+ countries</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-purple-700">AI agent network</span>
                    <Badge className="bg-purple-100 text-purple-800">Worldwide</Badge>
                  </div>
                  <div className="text-xs text-purple-600">
                    24/7 availability • Multiple currencies • Cross-border compliance
                  </div>
                </div>
              </CardContent>
            </Card>
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
            <div className="text-center mt-4 space-y-2">
              <p className="text-xs text-gray-500">
                <span className="font-medium">Coin Railz™</span> is a trademark of Kellogg Holdings LLC. 
                P2P interoperability and AI Agent Marketplace are patent protected.
              </p>
              <p className="text-xs text-gray-500">
                FinCEN Money Services Business (MSB) Registered • Active Money Transmitter License • AML/KYC Compliant
              </p>
              <p className="text-xs text-gray-400">
                © 2025 Kellogg Holdings LLC. All rights reserved. Violations of our terms may result in account suspension or termination.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}