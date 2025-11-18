import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Activity, Users, DollarSign, TrendingUp, Bot, Network, Globe, Zap, Send, CreditCard, Repeat, Shield, Mail, USDCLogo, XRPLogo } from "@/lib/icons";
import coinRailzLogo from "@assets/Coin Railz Logo No BG.png";
import { CoinbaseWalletIntegration } from "@/components/CoinbaseWalletIntegration";
import { LanguageSwitcher } from "@/components/language-switcher";
import { UserAuthMenu } from "@/components/UserAuthMenu";
import CoinbaseConnectionSection from "@/components/coinbase-connection-section";
import { useTranslation } from "react-i18next";
import { useSEO, seoConfigs } from "@/hooks/useSEO";
import { FAQSection, InternalLinkingSection, PerformanceOptimizer } from "@/components/SEOEnhancer";
import { trackEvent, trackBusinessEvent, trackConversion } from "@/lib/analytics";
import { EnhanceImageSEO } from "@/components/ImageOptimizer";

export default function Landing() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();

  // SEO optimization for landing page
  useSEO(seoConfigs.home);

  const handleSignIn = () => {
    // Track conversion event for analytics
    trackEvent('click', 'landing_cta', 'sign_in_button');
    // Track business conversion
    trackBusinessEvent('user_login_attempt', {
      service_type: 'authentication',
      user_type: 'returning_customer'
    });
    setLocation("/login");
  };

  const handleSignUp = () => {
    // Track conversion event for analytics
    trackEvent('click', 'landing_cta', 'sign_up_button');
    // Track business conversion attempt
    trackBusinessEvent('user_registration_attempt', {
      service_type: 'authentication',
      user_type: 'new_customer',
      value: 0 // Signup initiation
    });
    setLocation("/signup");
  };

  const handleCoinbaseSignIn = () => {
    // Track conversion event for analytics
    trackEvent('click', 'landing_cta', 'coinbase_auth');
    // Track business conversion
    trackBusinessEvent('coinbase_auth_attempt', {
      service_type: 'coinbase_oauth',
      user_type: 'enterprise_customer',
      payment_method: 'coinbase'
    });
    // Link component handles navigation
  };

  const handleGuestAccess = () => {
    setLocation("/demo-dashboard");
  };

  const handleSendMoney = () => {
    // Track conversion event for analytics
    trackEvent('click', 'landing_cta', 'send_money_button');
    // Track business conversion
    trackBusinessEvent('conversion_initiate', {
      service_type: 'p2p_transfer',
      user_type: 'prospective_customer',
      payment_method: 'crypto'
    });
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
                alt="Coin Railz - AI-Powered Fintech Platform Logo" 
                className="w-6 h-6 sm:w-8 sm:h-8"
              />
              <span className="text-lg sm:text-xl font-bold text-gray-900">Coin Railz</span>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-3">
              <Link href="/developers">
                <Button
                  variant="ghost"
                  className="text-gray-700 hover:text-blue-600 hover:bg-blue-50 text-xs sm:text-sm px-2 sm:px-3"
                  size="sm"
                  data-testid="nav-developers"
                >
                  API Docs
                </Button>
              </Link>
              <LanguageSwitcher />
              {isAuthenticated ? (
                <UserAuthMenu />
              ) : (
                <>
                  <Button 
                    onClick={handleSignIn}
                    variant="outline"
                    className="border-blue-600 text-blue-600 hover:bg-blue-50 text-xs sm:text-sm px-2 sm:px-4"
                    size="sm"
                  >
                    {t('auth.signIn')}
                  </Button>
                  <Button 
                    onClick={handleSignUp}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm px-2 sm:px-4"
                    size="sm"
                  >
                    {t('auth.signUp')}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-4 sm:py-8">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section - Ramp-Inspired Clarity */}
          <div className="text-center mb-8 sm:mb-12">
            <div className="flex justify-center mb-4 sm:mb-6">
              <img 
                src={coinRailzLogo} 
                alt="Coin Railz - Multi-Chain Payment Infrastructure for Crypto Communities" 
                className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24"
              />
            </div>
            
            {/* Main Value Proposition */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 mb-4 sm:mb-6 leading-tight px-2">
              Multi-Chain Payment<br />Infrastructure
            </h1>
            
            <p className="text-xl sm:text-2xl text-gray-600 mb-6 sm:mb-8 px-4 max-w-3xl mx-auto">
              Cross-chain liquidity meets universal settlement. Trade at best rates across 7 blockchains, settle to any platform instantly.
            </p>
            
            {/* Trust Badges */}
            <div className="flex flex-wrap items-center justify-center gap-4 mb-8 text-sm text-gray-700">
              <div className="flex items-center space-x-2">
                <Badge className="bg-blue-100 text-blue-800">✓ 7 Blockchains</Badge>
              </div>
              <div className="flex items-center space-x-2">
                <Badge className="bg-green-100 text-green-800">✓ 0.75% DEX Fees</Badge>
              </div>
              <div className="flex items-center space-x-2">
                <Badge className="bg-purple-100 text-purple-800">✓ Instant Settlement</Badge>
              </div>
            </div>
            
            {/* Key Stats */}
            <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto mb-6 sm:mb-8">
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-blue-600">7</div>
                <div className="text-xs sm:text-sm text-gray-600">Blockchains</div>
              </div>
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-green-600">0.75%</div>
                <div className="text-xs sm:text-sm text-gray-600">Swap Fees</div>
              </div>
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-purple-600">Universal</div>
                <div className="text-xs sm:text-sm text-gray-600">Settlement</div>
              </div>
            </div>

            {/* Primary Action: Sign Up Options */}
            <div className="mb-6 sm:mb-8 max-w-md mx-auto px-4 sm:px-0">
              <Button 
                onClick={handleSignUp}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-4 sm:py-6 text-lg sm:text-xl font-bold shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200 mb-3"
                size="lg"
              >
                🚀 Get Started Now - It's Free!
              </Button>
              
              
              <p className="text-center text-sm text-gray-500 mt-3">
                Already have an account? <button onClick={handleSignIn} className="text-blue-600 hover:text-blue-800 font-medium underline">Sign In</button>
              </p>
            </div>

            {/* TELEGRAM MINI-APP CTA - PRIMARY REVENUE DRIVER */}
            <div className="mb-8 max-w-3xl mx-auto">
              <Card className="border-2 border-blue-400 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-xl">
                <CardHeader className="text-center pb-4">
                  <div className="flex justify-center mb-3">
                    <div className="bg-blue-600 text-white rounded-full w-16 h-16 flex items-center justify-center text-3xl shadow-lg">
                      🎮
                    </div>
                  </div>
                  <CardTitle className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                    Try Instantly on Telegram
                  </CardTitle>
                  <p className="text-lg text-gray-700 font-medium">
                    Get <span className="text-green-600 font-bold">$1 FREE credits</span> • No signup required
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-white rounded-lg p-4 border border-blue-200">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center mb-4">
                      <div className="flex items-center justify-center space-x-2">
                        <Zap className="w-5 h-5 text-blue-600" />
                        <span className="text-sm font-medium text-gray-700">18 AI Services</span>
                      </div>
                      <div className="flex items-center justify-center space-x-2">
                        <DollarSign className="w-5 h-5 text-green-600" />
                        <span className="text-sm font-medium text-gray-700">$0.10-$5.00/use</span>
                      </div>
                      <div className="flex items-center justify-center space-x-2">
                        <Globe className="w-5 h-5 text-purple-600" />
                        <span className="text-sm font-medium text-gray-700">12 Languages</span>
                      </div>
                    </div>
                    <a 
                      href="https://t.me/coinrailz_bot" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      data-testid="telegram-bot-link"
                      onClick={() => {
                        trackEvent('click', 'telegram_bot_cta', 'main_landing_section');
                        trackBusinessEvent('telegram_bot_click', {
                          service_type: 'telegram_miniapp',
                          user_type: 'prospective_customer',
                          value: 1
                        });
                      }}
                    >
                      <Button 
                        className="w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white py-5 sm:py-6 text-lg sm:text-xl font-bold shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
                        size="lg"
                      >
                        <Send className="w-5 h-5 sm:w-6 sm:h-6 mr-3" />
                        Open Telegram Bot → Get $1 Free
                      </Button>
                    </a>
                  </div>
                  <p className="text-center text-sm text-gray-600">
                    🤖 AI contract scanning • 📊 Token price feeds • ⛽ Gas oracle • 🔍 Wallet risk analysis • And 14 more services
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Secondary Actions - All Functional */}
            <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8 max-w-2xl mx-auto px-4 sm:px-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <Button 
                  onClick={() => setLocation("/usdc-ecosystem-dashboard")}
                  variant="outline"
                  className="w-full border-blue-600 text-blue-600 hover:bg-blue-50 py-3 sm:py-4 text-base sm:text-lg font-medium"
                  size="lg"
                >
                  <USDCLogo className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  USDC Ecosystem
                </Button>

                <Button 
                  onClick={() => setLocation("/xrp-ecosystem")}
                  variant="outline"
                  className="w-full border-blue-600 text-blue-600 hover:bg-blue-50 py-3 sm:py-4 text-base sm:text-lg font-medium"
                  size="lg"
                >
                  <XRPLogo className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  XRP Ecosystem
                </Button>
              </div>

              {/* Premium Smart Contract Audit Service - High Revenue */}
              <div className="mb-4">
                <Button 
                  onClick={() => setLocation("/smart-contract-audit")}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-4 sm:py-5 text-lg sm:text-xl font-bold shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
                  size="lg"
                >
                  <Shield className="w-5 h-5 sm:w-6 sm:h-6 mr-3" />
                  🛡️ Smart Contract Audit - $1K • 5-Min Delivery
                </Button>
                <p className="text-center text-sm text-gray-600 mt-2">
                  Professional security analysis • No signup required • Instant results
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <Button 
                  onClick={() => setLocation("/swap")}
                  variant="outline"
                  className="w-full border-purple-600 text-purple-600 hover:bg-purple-50 py-3 sm:py-4 text-base sm:text-lg font-medium"
                  size="lg"
                >
                  <Repeat className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  DEX Swap
                </Button>

                <Button 
                  onClick={() => setLocation("/ai-marketplace")}
                  variant="outline"
                  className="w-full border-orange-600 text-orange-600 hover:bg-orange-50 py-3 sm:py-4 text-base sm:text-lg font-medium"
                  size="lg"
                >
                  <Bot className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  AI Marketplace
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:gap-4">
                <Button 
                  onClick={handleSendMoney}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 sm:py-4 text-base sm:text-lg font-medium"
                  size="lg"
                >
                  <Send className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
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
          </div>

          {/* Coinbase Integration Section - Positioned right after demo mode */}
          <div className="mb-12">
            <CoinbaseConnectionSection />
          </div>

          {/* 18 x402 SERVICES PRICING - REVENUE DRIVER */}
          <div className="text-center mb-12">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-3">18 Pay-Per-Use AI Services</h2>
              <p className="text-lg text-gray-600 mb-2">Available instantly via Telegram • Try with your $1 free credits</p>
              <Badge className="bg-green-100 text-green-800 text-sm px-3 py-1">No subscription • Pay only for what you use</Badge>
            </div>

            {/* Services Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto mb-6">
              {[
                { name: "AI Chat Assistant", price: "$0.10", description: "GPT-4 powered conversations", icon: <Bot className="w-5 h-5" /> },
                { name: "Gas Price Oracle", price: "$0.10", description: "Real-time gas estimates", icon: <Activity className="w-5 h-5" /> },
                { name: "Token Metadata", price: "$0.10", description: "Unified token info", icon: <Network className="w-5 h-5" /> },
                { name: "DEX Liquidity Monitor", price: "$0.20", description: "Pool liquidity tracking", icon: <TrendingUp className="w-5 h-5" /> },
                { name: "Approval Manager", price: "$0.20", description: "Token approval builder", icon: <Shield className="w-5 h-5" /> },
                { name: "Token Price Feed", price: "$0.25", description: "Real-time crypto prices", icon: <DollarSign className="w-5 h-5" /> },
                { name: "Token Sentiment", price: "$0.25", description: "Social sentiment analysis", icon: <TrendingUp className="w-5 h-5" /> },
                { name: "Transaction Builder", price: "$0.30", description: "Pre-validated transactions", icon: <Send className="w-5 h-5" /> },
                { name: "Whale Alerts", price: "$0.35", description: "Large wallet movements", icon: <Activity className="w-5 h-5" /> },
                { name: "Batch Quote", price: "$0.40", description: "Multi-DEX price quotes", icon: <Repeat className="w-5 h-5" /> },
                { name: "Multi-Chain Balance", price: "$0.50", description: "7+ chain balances", icon: <Network className="w-5 h-5" /> },
                { name: "Trending Tokens", price: "$0.50", description: "Top gainers/losers", icon: <TrendingUp className="w-5 h-5" /> },
                { name: "Wallet Risk Score", price: "$0.50", description: "Compliance analysis", icon: <Shield className="w-5 h-5" /> },
                { name: "Portfolio Tracker", price: "$0.50", description: "Multi-chain valuation", icon: <Activity className="w-5 h-5" /> },
                { name: "Trade Signals", price: "$0.75", description: "AI trading recommendations", icon: <TrendingUp className="w-5 h-5" /> },
                { name: "Contract Security Scan", price: "$1.00", description: "Vulnerability detection", icon: <Shield className="w-5 h-5" /> },
                { name: "Instant Agent Wallet", price: "$1.00", description: "Circle MPC wallets", icon: <CreditCard className="w-5 h-5" /> },
                { name: "Chain Bridge", price: "$2.00", description: "Cross-chain USDC routing", icon: <Repeat className="w-5 h-5" /> },
              ].map((service, idx) => (
                <Card 
                  key={idx}
                  className="hover:shadow-md transition-shadow border-gray-200 bg-white text-left"
                  data-testid={`service-card-${idx}`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-blue-600">{service.icon}</div>
                      <Badge className="bg-green-50 text-green-700 font-bold text-sm">{service.price}</Badge>
                    </div>
                    <CardTitle className="text-sm font-semibold text-gray-900">{service.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-gray-600">{service.description}</p>
                  </CardContent>
                </Card>
              ))}
              
              {/* Premium Service Highlight */}
              <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-300 hover:shadow-lg transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between mb-2">
                    <Shield className="w-5 h-5 text-purple-600" />
                    <Badge className="bg-purple-100 text-purple-800 font-bold text-sm">$5.00</Badge>
                  </div>
                  <CardTitle className="text-sm font-semibold text-purple-900">AI Agent Identity (KYA)</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-purple-700">ERC-8004 on-chain verification</p>
                  <Badge className="mt-2 bg-purple-200 text-purple-900 text-xs">Premium</Badge>
                </CardContent>
              </Card>
            </div>

            <div className="text-center">
              <a 
                href="https://t.me/coinrailz_bot" 
                target="_blank" 
                rel="noopener noreferrer"
                data-testid="telegram-services-cta"
              >
                <Button 
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 text-lg font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all"
                  size="lg"
                >
                  <Send className="w-5 h-5 mr-2" />
                  Try These Services on Telegram
                </Button>
              </a>
              <p className="text-sm text-gray-600 mt-3">Use your $1 free credit for 10 AI chats or 4 contract scans</p>
            </div>
          </div>

          {/* Streamlined Core Features - Only Working Features */}
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Full Platform Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              
              {/* Send Money - Working */}
              <Card 
                className="cursor-pointer hover:shadow-lg transition-shadow border-blue-200 bg-blue-50"
                onClick={handleSendMoney}
              >
                <CardHeader className="pb-3">
                  <Send className="w-8 h-8 mx-auto text-blue-600 mb-2" />
                  <CardTitle className="text-lg text-blue-800">Send Money</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-blue-600">Cross-platform P2P transfers</p>
                  <Button size="sm" className="mt-3 bg-blue-600 hover:bg-blue-700">
                    Start Transfer
                  </Button>
                </CardContent>
              </Card>

              {/* DEX Trading - Working */}
              <Card 
                className="cursor-pointer hover:shadow-lg transition-shadow border-purple-200 bg-purple-50"
                onClick={() => setLocation("/swap")}
              >
                <CardHeader className="pb-3">
                  <Repeat className="w-8 h-8 mx-auto text-purple-600 mb-2" />
                  <CardTitle className="text-lg text-purple-800">Trade Crypto</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-purple-600">Best swap rates across exchanges</p>
                  <Button size="sm" className="mt-3 bg-purple-600 hover:bg-purple-700">
                    Start Trading
                  </Button>
                </CardContent>
              </Card>

              {/* AI Marketplace - Working */}
              <Card 
                className="cursor-pointer hover:shadow-lg transition-shadow border-orange-200 bg-orange-50"
                onClick={() => setLocation("/ai-marketplace")}
              >
                <CardHeader className="pb-3">
                  <Bot className="w-8 h-8 mx-auto text-orange-600 mb-2" />
                  <CardTitle className="text-lg text-orange-800">AI Services</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-orange-600">Hire AI agents for tasks</p>
                  <Button size="sm" className="mt-3 bg-orange-600 hover:bg-orange-700">
                    Browse Agents
                  </Button>
                </CardContent>
              </Card>
            </div>
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

          {/* Coinbase Integration Section */}
          <div className="mb-12">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Connect with Coinbase</h2>
              <p className="text-lg text-gray-600 mb-2">
                Seamless integration with your Coinbase account and wallets
              </p>
              <p className="text-sm text-gray-500">
                Auto-detect existing wallets • One-click creation • Skip KYC with Coinbase login
              </p>
            </div>
            <CoinbaseWalletIntegration />
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

      {/* FAQ Section - Integrated into main content for better SEO */}
      <FAQSection />

      {/* Internal Linking Section - SEO Enhancement */}
      <InternalLinkingSection />

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

      {/* SEO Enhancement Components - Properly placed within main content */}
      <PerformanceOptimizer />
      <EnhanceImageSEO />
    </div>
  );
}