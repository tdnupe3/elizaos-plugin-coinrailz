import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Activity, Users, DollarSign, TrendingUp, Bot, Network, Globe, Zap, Send, CreditCard, Repeat, Shield, Mail, USDCLogo, XRPLogo, Check } from "@/lib/icons";
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
import { Code, Eye, ChevronRight } from "lucide-react";

export default function Landing() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [selectedExample, setSelectedExample] = useState<string>("fire-alerts");

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
    setLocation("/iot");
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
              <Link href="/pilots/buy">
                <Button
                  className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white text-xs sm:text-sm px-3 sm:px-4"
                  size="sm"
                  data-testid="nav-buy-credits"
                  onClick={() => {
                    trackEvent('click', 'nav_cta', 'buy_credits');
                    trackBusinessEvent('nav_credit_purchase_intent', { source: 'top_nav' });
                  }}
                >
                  Buy Credits
                </Button>
              </Link>
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
                <button 
                  onClick={handleSignIn}
                  className="text-gray-600 hover:text-blue-600 text-xs sm:text-sm"
                >
                  {t('auth.signIn')}
                </button>
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
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold text-gray-900 mb-3 sm:mb-6 leading-tight px-2">
              Curated Machine-Payable Data<br />for AI Agents
            </h1>
            
            <p className="text-base sm:text-2xl text-gray-600 mb-4 sm:mb-8 px-4 max-w-3xl mx-auto">
              66 pay-per-call APIs for crypto/trading intelligence, satellite & IoT data, and prediction markets — built for autonomous agents. API key in ~60 seconds via card — or x402 on-chain USDC for advanced flows.
            </p>
            
            {/* Trust Badges - Card first, x402 secondary */}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-4 sm:mb-6 text-sm text-gray-700">
              <div className="flex items-center space-x-2">
                <Badge className="bg-green-100 text-green-800">✓ API Key in ~60 Seconds</Badge>
              </div>
              <div className="flex items-center space-x-2">
                <Badge className="bg-blue-100 text-blue-800">✓ 66 Pay-Per-Call APIs</Badge>
              </div>
              <div className="flex items-center space-x-2">
                <Badge className="bg-orange-100 text-orange-800">✓ Coinbase Agentic Wallets</Badge>
              </div>
              <div className="flex items-center space-x-2">
                <Badge className="bg-purple-100 text-purple-800">✓ x402 On-Chain (Advanced)</Badge>
              </div>
              <div className="flex items-center space-x-2">
                <Badge className="bg-slate-100 text-slate-700">✓ x402 Open Standard</Badge>
              </div>
            </div>

            {/* x402 Foundation trust strip */}
            <div className="max-w-2xl mx-auto mb-5 px-4">
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 flex items-start space-x-3">
                <Check className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600 leading-relaxed">
                  <span className="font-semibold text-slate-800">x402 Protocol — Open Internet Standard</span> governed by the Linux Foundation. Members include AWS, Google, Microsoft, Mastercard, Cloudflare, Stripe, Adyen, Circle, and Shopify. Coin Railz operates 66 discoverable x402 services for autonomous AI agent data purchasing.
                </p>
              </div>
            </div>

            {/* x402 AWS CloudFront & Coinbase Announcement Section */}
            <div className="max-w-2xl mx-auto mb-8 sm:mb-10 px-4">
              <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-300 rounded-xl p-5 sm:p-6">
                <div className="text-center">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">
                    x402 now live on AWS CloudFront, Solana and Base
                  </h2>
                  <p className="text-sm text-gray-700 mb-4">
                    Coin Railz operates the x402 micropayment infrastructure agents use today to autonomously purchase data.
                  </p>
                  <div className="space-y-2 text-left max-w-xl mx-auto mb-4">
                    <div className="flex items-start space-x-3">
                      <Check className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-700">66 pay-per-call services: DeFi analytics, satellite data, IoT, AI inference</span>
                    </div>
                    <div className="flex items-start space-x-3">
                      <Check className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-700">$0.05 entry price per API call</span>
                    </div>
                    <div className="flex items-start space-x-3">
                      <Check className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-gray-700">Live on Base and Solana</span>
                    </div>
                  </div>
                  <Link href="/x402-docs">
                    <Button className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white text-sm font-semibold px-6">
                      Make your first x402 call
                    </Button>
                  </Link>
                </div>
              </div>
            </div>

            {/* PRIMARY CTA - Card-first instant API key */}
            <div className="max-w-lg mx-auto mb-6 sm:mb-8 space-y-3">
              <Link href="/pilots/buy">
                <div 
                  className="flex items-center justify-between border-2 border-green-400 bg-gradient-to-r from-green-50 to-emerald-50 hover:shadow-lg transition-shadow cursor-pointer rounded-lg px-4 py-3"
                  data-testid="card-starter-credits"
                  onClick={() => {
                    trackEvent('click', 'landing_starter_cta', 'starter_credits_card');
                    trackBusinessEvent('starter_credit_purchase_intent', { payment_method: 'stripe', user_type: 'new_customer', value: 10 });
                  }}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <Zap className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-green-900">Get API Key via Card — ~60 Seconds</div>
                      <div className="text-xs text-green-700">Pay by card • Instant API key • All 60 APIs unlocked</div>
                    </div>
                  </div>
                  <Button 
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white text-sm font-semibold flex-shrink-0 ml-2"
                    size="sm"
                    data-testid="button-starter-purchase"
                  >
                    Get Started →
                  </Button>
                </div>
              </Link>

              <Link href="/pilots/buy">
                <div 
                  className="flex items-center justify-between border border-gray-200 bg-white hover:shadow-md transition-shadow cursor-pointer rounded-lg px-4 py-2.5 mt-3"
                  data-testid="card-pilot-credits"
                  onClick={() => {
                    trackEvent('click', 'landing_pilot_cta', 'purchase_pilot_credits');
                    trackBusinessEvent('pilot_credit_purchase_intent', { payment_method: 'stripe_or_crypto', user_type: 'iot_depin' });
                  }}
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-cyan-100 flex items-center justify-center flex-shrink-0">
                      <CreditCard className="w-4 h-4 text-cyan-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-gray-800">Enterprise Pilot Credits — From $500</div>
                      <div className="text-[10px] text-gray-500">Multi-chain USDC/USDT settlement</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
                </div>
              </Link>
            </div>
            
            {/* Key Stats - Verified counts only */}
            <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto mb-6 sm:mb-8">
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-blue-600">60</div>
                <div className="text-xs sm:text-sm text-gray-600">APIs Available</div>
              </div>
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-green-600">2</div>
                <div className="text-xs sm:text-sm text-gray-600">Payment Rails</div>
              </div>
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-purple-600">$0.03</div>
                <div className="text-xs sm:text-sm text-gray-600">Starting Price</div>
              </div>
            </div>

            {/* Pricing Ladder - reconciles per-call vs credit pack */}
            <div className="max-w-2xl mx-auto mb-8 px-4">
              <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">How Pricing Works</p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-sm font-bold text-gray-900">From $0.03</div>
                    <div className="text-xs text-gray-500 mt-0.5">per API call<br />(from credits)</div>
                  </div>
                  <div className="border-x border-gray-200">
                    <div className="text-sm font-bold text-gray-900">$5 intro</div>
                    <div className="text-xs text-gray-500 mt-0.5">~80–100 calls<br />to get started</div>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900">$10 recommended</div>
                    <div className="text-xs text-gray-500 mt-0.5">~200 calls<br />production-ready</div>
                  </div>
                </div>
              </div>
            </div>

            {/* SEE WHAT YOU GET - Example API Responses */}
            <div className="max-w-3xl mx-auto mb-8 sm:mb-12 px-4">
              <div className="text-center mb-4">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">See What You Get</h2>
                <p className="text-sm text-gray-500">Example API responses — this is exactly what your calls return</p>
              </div>

              <div className="flex flex-wrap justify-center gap-2 mb-4">
                <button
                  onClick={() => setSelectedExample("fire-alerts")}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    selectedExample === "fire-alerts"
                      ? "bg-orange-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  Fire Alerts
                </button>
                <button
                  onClick={() => setSelectedExample("gas-oracle")}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    selectedExample === "gas-oracle"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  Gas Oracle
                </button>
                <button
                  onClick={() => setSelectedExample("token-price")}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    selectedExample === "token-price"
                      ? "bg-purple-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  Token Price
                </button>
              </div>

              <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-700">
                <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
                  <div className="flex items-center space-x-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px]">
                      200 OK
                    </Badge>
                    <span className="text-[10px] text-gray-400">
                      {selectedExample === "fire-alerts" && "$0.05/call"}
                      {selectedExample === "gas-oracle" && "$0.10/call"}
                      {selectedExample === "token-price" && "$0.25/call"}
                    </span>
                  </div>
                </div>
                <div className="p-4 overflow-x-auto">
                  <pre className="text-xs sm:text-sm text-gray-300 font-mono leading-relaxed whitespace-pre">
{selectedExample === "fire-alerts" && `{
  "service": "satellite-fire-alerts",
  "source": "NASA FIRMS",
  "data": {
    "region": "California, US",
    "active_fires": 12,
    "alerts": [
      {
        "latitude": 34.052,
        "longitude": -118.243,
        "confidence": "high",
        "brightness": 342.1,
        "detection_time": "2026-02-22T08:15:00Z"
      }
    ],
    "resolution": "375m",
    "coverage": "global"
  }
}`}
{selectedExample === "gas-oracle" && `{
  "service": "gas-price-oracle",
  "chain": "ethereum",
  "data": {
    "fast": { "gwei": 28.5, "usd_estimate": "$4.82" },
    "standard": { "gwei": 22.1, "usd_estimate": "$3.74" },
    "slow": { "gwei": 18.3, "usd_estimate": "$3.09" },
    "base_fee": 17.8,
    "block_number": 19847523,
    "updated_at": "2026-02-22T13:00:00Z"
  }
}`}
{selectedExample === "token-price" && `{
  "service": "token-price",
  "data": {
    "symbol": "ETH",
    "price_usd": 3245.67,
    "change_24h": "+2.34%",
    "volume_24h": "$18.2B",
    "market_cap": "$390.1B",
    "sources": ["Uniswap", "Sushiswap", "Curve"],
    "updated_at": "2026-02-22T13:00:00Z"
  }
}`}
                  </pre>
                </div>
                <div className="px-4 py-3 bg-gray-800/50 border-t border-gray-700 text-center">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">Example Response — Actual data requires API credits</span>
                </div>
              </div>
            </div>

            {/* AI Agent Discovery Channels - For autonomous agents and developers */}
            <div className="max-w-2xl mx-auto mb-6 sm:mb-8 px-4">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-800 mb-3 text-center">AI Agent Discovery Endpoints</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <a href="/mcp/services" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center space-x-2 bg-white border border-gray-300 rounded px-3 py-2 hover:bg-gray-100 transition-colors">
                    <span className="font-mono text-gray-700">MCP Protocol</span>
                    <Badge className="bg-blue-100 text-blue-700 text-xs">60 services</Badge>
                  </a>
                  <a href="https://coinrailz-x402-gateway.coinrailz.workers.dev/catalog" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center space-x-2 bg-white border border-gray-300 rounded px-3 py-2 hover:bg-gray-100 transition-colors">
                    <span className="font-mono text-gray-700">Cloudflare Gateway</span>
                  </a>
                  <a href="/api/frames" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center space-x-2 bg-white border border-gray-300 rounded px-3 py-2 hover:bg-gray-100 transition-colors">
                    <span className="font-mono text-gray-700">Farcaster Frame</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Secondary Action: Existing Users */}
            <div className="mb-6 sm:mb-8 max-w-md mx-auto px-4 sm:px-0">
              <p className="text-center text-sm text-gray-500">
                Existing user? <button onClick={handleSignIn} className="text-blue-600 hover:text-blue-800 font-medium underline">Sign In</button>
                {' '} or {' '}
                <button onClick={handleGuestAccess} className="text-gray-600 hover:text-gray-800 font-medium underline">Try Demo</button>
              </p>
            </div>

            {/* TELEGRAM MINI-APP - Secondary option for trying services */}
            <div className="mb-6 max-w-lg mx-auto">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-600 mb-2">
                  Want to try the APIs first?
                </p>
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
                  className="text-blue-600 hover:text-blue-800 font-medium underline"
                >
                  Try our Telegram Bot with $1 free credits →
                </a>
              </div>
            </div>

            {/* Secondary Actions - Compact on mobile */}
            <div className="space-y-2 sm:space-y-4 mb-4 sm:mb-8 max-w-2xl mx-auto px-4 sm:px-0">
              <div className="grid grid-cols-2 gap-2 sm:gap-4">
                <Button 
                  onClick={() => setLocation("/usdc-ecosystem-dashboard")}
                  variant="outline"
                  className="w-full border-blue-600 text-blue-600 hover:bg-blue-50 py-2 sm:py-4 text-sm sm:text-lg font-medium"
                  size="sm"
                >
                  <USDCLogo className="w-4 h-4 mr-1 sm:mr-2" />
                  USDC
                </Button>

                <Button 
                  onClick={() => setLocation("/xrp-ecosystem")}
                  variant="outline"
                  className="w-full border-blue-600 text-blue-600 hover:bg-blue-50 py-2 sm:py-4 text-sm sm:text-lg font-medium"
                  size="sm"
                >
                  <XRPLogo className="w-4 h-4 mr-1 sm:mr-2" />
                  XRP
                </Button>
              </div>

              <Button 
                onClick={() => setLocation("/smart-contract-audit")}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-2.5 sm:py-5 text-sm sm:text-xl font-bold shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200"
                size="sm"
              >
                <Shield className="w-4 h-4 sm:w-6 sm:h-6 mr-2 sm:mr-3" />
                Smart Contract Audit - $1K
              </Button>

              <div className="grid grid-cols-2 gap-2 sm:gap-4">
                <Button 
                  onClick={() => setLocation("/swap")}
                  variant="outline"
                  className="w-full border-purple-600 text-purple-600 hover:bg-purple-50 py-2 sm:py-4 text-sm sm:text-lg font-medium"
                  size="sm"
                >
                  <Repeat className="w-4 h-4 mr-1 sm:mr-2" />
                  DEX Swap
                </Button>

                <Button 
                  onClick={() => setLocation("/ai-marketplace")}
                  variant="outline"
                  className="w-full border-orange-600 text-orange-600 hover:bg-orange-50 py-2 sm:py-4 text-sm sm:text-lg font-medium"
                  size="sm"
                >
                  <Bot className="w-4 h-4 mr-1 sm:mr-2" />
                  AI Agents
                </Button>
              </div>
            </div>
          </div>

          {/* IOT & SATELLITE DATA SECTION - DEVICE DATA MONETIZATION */}
          <div className="mb-8 sm:mb-12 bg-gradient-to-br from-slate-900 via-blue-900 to-purple-900 rounded-2xl p-4 sm:p-8 text-white">
            <div className="text-center mb-6">
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">IoT & Satellite Data Payments</h2>
              <p className="text-sm sm:text-base text-gray-300 max-w-2xl mx-auto mb-4">
                AI agents pay IoT devices for data via x402 micropayments. Powered by NASA & ESA.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
                <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/50 text-xs">NASA Earthdata</Badge>
                <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/50 text-xs">ESA Copernicus</Badge>
                <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/50 text-xs">Multi-Chain USDC</Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <Link href="/satellite">
                <Card className="bg-white/10 border-white/20 hover:bg-white/15 transition-all cursor-pointer h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-center space-x-2 mb-1">
                      <Globe className="w-4 h-4 text-cyan-400" />
                      <CardTitle className="text-white text-sm">Satellite Data</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-gray-300 text-xs mb-2">Fire alerts, weather imagery, vegetation</p>
                    <Badge className="bg-green-500/20 text-green-300 text-[10px]">From $0.02/call</Badge>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/fleet">
                <Card className="bg-white/10 border-white/20 hover:bg-white/15 transition-all cursor-pointer h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-center space-x-2 mb-1">
                      <Activity className="w-4 h-4 text-orange-400" />
                      <CardTitle className="text-white text-sm">Fleet Telematics</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-gray-300 text-xs mb-2">Vehicle tracking, fuel analytics</p>
                    <Badge className="bg-green-500/20 text-green-300 text-[10px]">From $0.01/event</Badge>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/weather">
                <Card className="bg-white/10 border-white/20 hover:bg-white/15 transition-all cursor-pointer h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-center space-x-2 mb-1">
                      <Network className="w-4 h-4 text-blue-400" />
                      <CardTitle className="text-white text-sm">Weather Stations</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-gray-300 text-xs mb-2">Real-time environmental sensor data</p>
                    <Badge className="bg-green-500/20 text-green-300 text-[10px]">From $0.005/reading</Badge>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/iot">
                <Card className="bg-white/10 border-white/20 hover:bg-white/15 transition-all cursor-pointer h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-center space-x-2 mb-1">
                      <Zap className="w-4 h-4 text-purple-400" />
                      <CardTitle className="text-white text-sm">IoT Hub</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-gray-300 text-xs mb-2">Device registry, credits, D2D transfers</p>
                    <Badge className="bg-green-500/20 text-green-300 text-[10px]">Full Dashboard</Badge>
                  </CardContent>
                </Card>
              </Link>
            </div>

            <div className="text-center">
              <Link href="/pilots/buy">
                <Button className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white px-6 py-3 text-sm font-medium shadow-lg" size="default">
                  <CreditCard className="w-4 h-4 mr-2" />
                  Get IoT Credits
                </Button>
              </Link>
            </div>
          </div>

          {/* PREDICTION MARKETS SECTION */}
          <div className="mb-8 sm:mb-12 bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 rounded-2xl p-4 sm:p-8 text-white">
            <div className="text-center mb-6">
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">Prediction Market Intel</h2>
              <p className="text-sm sm:text-base text-gray-300 max-w-2xl mx-auto mb-4">
                One API for 99% of the $44B prediction market. Access Kalshi and Polymarket Intel.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/50 text-xs">Kalshi (CFTC-Regulated)</Badge>
                <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/50 text-xs">Polymarket</Badge>
                <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/50 text-xs">7 Endpoints</Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              <Link href="/predictions">
                <Card className="bg-white/10 border-white/20 hover:bg-white/15 transition-all cursor-pointer h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-center space-x-2 mb-1">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      <CardTitle className="text-white text-sm">Kalshi Markets</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-gray-300 text-xs mb-2">CFTC-regulated event contracts, odds, search</p>
                    <Badge className="bg-green-500/20 text-green-300 text-[10px]">From $0.25/call</Badge>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/predictions">
                <Card className="bg-white/10 border-white/20 hover:bg-white/15 transition-all cursor-pointer h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-center space-x-2 mb-1">
                      <Activity className="w-4 h-4 text-orange-400" />
                      <CardTitle className="text-white text-sm">Polymarket Data</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-gray-300 text-xs mb-2">Trending events, odds lookup, 15K+ markets</p>
                    <Badge className="bg-green-500/20 text-green-300 text-[10px]">From $0.25/call</Badge>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/predictions">
                <Card className="bg-white/10 border-white/20 hover:bg-white/15 transition-all cursor-pointer h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-center space-x-2 mb-1">
                      <Shield className="w-4 h-4 text-purple-400" />
                      <CardTitle className="text-white text-sm">Universal Odds</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-gray-300 text-xs mb-2">Cross-platform odds comparison and arbitrage</p>
                    <Badge className="bg-green-500/20 text-green-300 text-[10px]">From $0.50/call</Badge>
                  </CardContent>
                </Card>
              </Link>
            </div>

            <div className="text-center">
              <Link href="/predictions">
                <Button className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-6 py-3 text-sm font-medium shadow-lg" size="default">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Explore Prediction Market Intel
                </Button>
              </Link>
            </div>
          </div>

          {/* x402 SERVICES PRICING - REVENUE DRIVER */}
          <div className="text-center mb-8 sm:mb-12">
            <div className="mb-4 sm:mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 sm:mb-3">Pay-Per-Use AI Services</h2>
              <p className="text-sm sm:text-lg text-gray-600 mb-2">Available via Telegram, x402, or Stripe Credits</p>
              <Badge className="bg-green-100 text-green-800 text-xs sm:text-sm px-2 sm:px-3 py-1">No subscription • Pay only for what you use</Badge>
            </div>

            {/* Services Grid - Compact on mobile */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4 max-w-6xl mx-auto mb-4 sm:mb-6">
              {[
                { name: "AI Chat", price: "$0.10", description: "GPT-4 conversations", icon: <Bot className="w-4 h-4" /> },
                { name: "Gas Oracle", price: "$0.10", description: "Gas estimates", icon: <Activity className="w-4 h-4" /> },
                { name: "Token Info", price: "$0.10", description: "Token metadata", icon: <Network className="w-4 h-4" /> },
                { name: "DEX Liquidity", price: "$0.20", description: "Pool tracking", icon: <TrendingUp className="w-4 h-4" /> },
                { name: "Approvals", price: "$0.20", description: "Token approvals", icon: <Shield className="w-4 h-4" /> },
                { name: "Token Price", price: "$0.25", description: "Crypto prices", icon: <DollarSign className="w-4 h-4" /> },
                { name: "Sentiment", price: "$0.25", description: "Social analysis", icon: <TrendingUp className="w-4 h-4" /> },
                { name: "Tx Builder", price: "$0.30", description: "Pre-validated txs", icon: <Send className="w-4 h-4" /> },
                { name: "Whale Alerts", price: "$0.35", description: "Large movements", icon: <Activity className="w-4 h-4" /> },
                { name: "Batch Quote", price: "$0.40", description: "Multi-DEX prices", icon: <Repeat className="w-4 h-4" /> },
                { name: "Multi-Balance", price: "$0.50", description: "7+ chains", icon: <Network className="w-4 h-4" /> },
                { name: "Trending", price: "$0.50", description: "Gainers/losers", icon: <TrendingUp className="w-4 h-4" /> },
                { name: "Risk Score", price: "$0.50", description: "Compliance", icon: <Shield className="w-4 h-4" /> },
                { name: "Portfolio", price: "$0.50", description: "Valuation", icon: <Activity className="w-4 h-4" /> },
                { name: "Signals", price: "$0.75", description: "AI trading", icon: <TrendingUp className="w-4 h-4" /> },
                { name: "Security Scan", price: "$1.00", description: "Vulnerabilities", icon: <Shield className="w-4 h-4" /> },
                { name: "Agent Wallet", price: "$1.00", description: "MPC wallets", icon: <CreditCard className="w-4 h-4" /> },
                { name: "Bridge", price: "$2.00", description: "Cross-chain", icon: <Repeat className="w-4 h-4" /> },
              ].map((service, idx) => (
                <div 
                  key={idx}
                  className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2 sm:px-4 sm:py-3 hover:shadow-md transition-shadow text-left"
                  data-testid={`service-card-${idx}`}
                >
                  <div className="flex items-center space-x-2 min-w-0">
                    <div className="text-blue-600 flex-shrink-0">{service.icon}</div>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-semibold text-gray-900 truncate">{service.name}</div>
                      <div className="text-[10px] sm:text-xs text-gray-500 truncate">{service.description}</div>
                    </div>
                  </div>
                  <Badge className="bg-green-50 text-green-700 font-bold text-[10px] sm:text-xs flex-shrink-0 ml-1">{service.price}</Badge>
                </div>
              ))}
              
              {/* Premium Service Highlight */}
              <div className="flex items-center justify-between bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-300 rounded-lg px-3 py-2 sm:px-4 sm:py-3 hover:shadow-lg transition-shadow text-left col-span-2 sm:col-span-1">
                <div className="flex items-center space-x-2 min-w-0">
                  <Shield className="w-4 h-4 text-purple-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-semibold text-purple-900">AI Agent Identity (KYA)</div>
                    <div className="text-[10px] sm:text-xs text-purple-700">ERC-8004 verification</div>
                  </div>
                </div>
                <Badge className="bg-purple-100 text-purple-800 font-bold text-[10px] sm:text-xs flex-shrink-0 ml-1">$5.00</Badge>
              </div>
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



          {/* Platform Statistics - Verified claims only */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-blue-600">24/7</div>
                <p className="text-sm text-gray-600">API Availability</p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-600">8</div>
                <p className="text-sm text-gray-600">Blockchain Networks</p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-purple-600">USDC</div>
                <p className="text-sm text-gray-600">Primary Settlement</p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-orange-600">XRP</div>
                <p className="text-sm text-gray-600">Integrated</p>
              </CardContent>
            </Card>
          </div>

          {/* Support Section */}
          <div className="text-center mb-12">
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

            {/* How AI Marketplace Works */}
            <Card className="border-purple-200 bg-purple-50">
              <CardContent className="pt-6">
                <div className="bg-white border border-purple-200 rounded-lg p-4">
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
          </div>

          {/* Coinbase Integration Section */}
          <div className="mb-12">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Connect with Coinbase</h2>
              <p className="text-lg text-gray-600 mb-2">
                Native Coinbase Agentic Wallet support — the first wallet infrastructure built for AI agents
              </p>
              <p className="text-sm text-gray-500">
                AgentKit v0.10.4 • x402 Protocol • search-for-service • pay-for-service • instant onboarding
              </p>
            </div>
            <CoinbaseWalletIntegration />
          </div>

          {/* Primary CTA - Pilot Credits (60-day revenue goal) */}
          <div className="text-center bg-gradient-to-r from-cyan-100 to-blue-100 rounded-lg p-8 mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Ready to Integrate IoT Payments?</h2>
            <p className="text-lg text-gray-600 mb-6">
              Start with prepaid credits for your pilot program. Multi-chain USDC settlement.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
              <Link href="/pilots/buy">
                <Button 
                  className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white px-8 py-3 text-lg font-medium"
                  size="lg"
                >
                  <CreditCard className="w-5 h-5 mr-2" />
                  Purchase Pilot Credits
                </Button>
              </Link>
              <Link href="/contact-us">
                <Button 
                  variant="outline"
                  className="border-blue-600 text-blue-600 hover:bg-blue-50 px-8 py-3 text-lg font-medium"
                  size="lg"
                >
                  Schedule Demo
                </Button>
              </Link>
            </div>
          </div>
        </div>

        
      </div>

      {/* CONTACT FORM */}
      <div className="bg-gray-50 py-12 sm:py-16">
        <div className="container mx-auto px-4 max-w-xl">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Get in Touch</h2>
            <p className="text-sm text-gray-600">Questions about integration, pricing, or partnerships? We respond within 24 hours.</p>
          </div>

          {contactSubmitted ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <Check className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-green-900 mb-2">Message Sent</h3>
              <p className="text-sm text-green-700">Thank you for reaching out. We'll get back to you within 24 hours.</p>
            </div>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setContactSubmitting(true);
                trackEvent('submit', 'contact_form', 'landing_page');
                trackBusinessEvent('contact_form_submission', { source: 'landing_page' });
                try {
                  const res = await fetch('/api/contact', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: contactName, email: contactEmail, message: contactMessage })
                  });
                  if (res.ok) {
                    setContactSubmitted(true);
                  }
                } catch (err) {
                  console.error('Contact form error:', err);
                } finally {
                  setContactSubmitting(false);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label htmlFor="contact-name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  id="contact-name"
                  type="text"
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label htmlFor="contact-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  id="contact-email"
                  type="email"
                  required
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white"
                  placeholder="you@company.com"
                />
              </div>
              <div>
                <label htmlFor="contact-message" className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  id="contact-message"
                  required
                  rows={4}
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white resize-none"
                  placeholder="Tell us about your use case or questions..."
                />
              </div>
              <Button
                type="submit"
                disabled={contactSubmitting}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3 text-sm font-semibold"
              >
                {contactSubmitting ? "Sending..." : "Send Message"}
              </Button>
            </form>
          )}
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
            <p className="text-xs text-gray-500 mb-3">
              Supporting both human users and autonomous AI agents worldwide
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Shield className="w-3 h-3" />
                AML/KYC Compliant
              </span>
            </div>
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
              </p>
              <p className="text-xs text-gray-400">
                © 2025–2026 Kellogg Holdings LLC. All rights reserved.
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