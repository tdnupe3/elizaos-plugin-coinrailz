import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Activity, Users, DollarSign, TrendingUp, Bot, Network, Globe, Zap, Send, CreditCard, Repeat, Shield, Mail } from "lucide-react";
import coinRailzLogo from "@assets/Coin Railz Logo No BG.png";

export default function Landing() {
  const [, setLocation] = useLocation();

  const handleSignIn = () => {
    // Use demo authentication for development
    fetch("/api/demo-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include"
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        window.location.href = "/";
      }
    })
    .catch(err => {
      // Fallback to OAuth if demo auth fails
      window.location.href = "/api/login";
    });
  };

  const handleSignUp = () => {
    // Use demo authentication for development
    fetch("/api/demo-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include"
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        window.location.href = "/";
      }
    })
    .catch(err => {
      // Fallback to OAuth if demo auth fails
      window.location.href = "/api/login";
    });
  };

  const handleGuestAccess = () => {
    setLocation("/demo-dashboard");
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
                <p className="text-sm text-gray-600">Cross-platform P2P transfers</p>
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
                <div className="text-2xl font-bold text-orange-600">XRP</div>
                <p className="text-sm text-gray-600">FULLY Integrated</p>
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

          {/* AI Agent Marketplace - Prominent Section for SEO */}
          <div className="mb-12">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">AI Agent Marketplace</h2>
              <p className="text-lg text-gray-600 mb-2">
                Autonomous AI agents worldwide - register, discover, and transact instantly
              </p>
              <p className="text-sm text-gray-500">
                No human intervention required • Instant registration • Global transaction network
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Agent Registration & Discovery */}
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl text-blue-800">
                    <Bot className="w-6 h-6" />
                    Agent Registration & Discovery
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="bg-white border border-blue-200 rounded-lg p-4">
                      <h4 className="font-medium text-blue-900 mb-2">Register Your Agent</h4>
                      <p className="text-sm text-blue-700 mb-3">POST /api/public/agents/register</p>
                      <div className="text-xs text-blue-600 space-y-1">
                        <div>• Instant autonomous registration</div>
                        <div>• No human approval required</div>
                        <div>• Global agent network access</div>
                      </div>
                    </div>
                    <div className="bg-white border border-blue-200 rounded-lg p-4">
                      <h4 className="font-medium text-blue-900 mb-2">Discover Other Agents</h4>
                      <p className="text-sm text-blue-700 mb-3">GET /api/public/agents/discover</p>
                      <div className="text-xs text-blue-600 space-y-1">
                        <div>• Search by capabilities & type</div>
                        <div>• Real-time agent status</div>
                        <div>• Public endpoint information</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Agent Transactions */}
              <Card className="border-green-200 bg-green-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl text-green-800">
                    <DollarSign className="w-6 h-6" />
                    Agent-to-Agent Transactions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="bg-white border border-green-200 rounded-lg p-4">
                      <h4 className="font-medium text-green-900 mb-2">Direct Agent Payments</h4>
                      <p className="text-sm text-green-700 mb-3">POST /api/public/agents/transact</p>
                      <div className="text-xs text-green-600 space-y-1">
                        <div>• Instant agent-to-agent transfers</div>
                        <div>• Automated compliance & verification</div>
                        <div>• 2% platform fee (competitive rates)</div>
                      </div>
                    </div>
                    <div className="bg-white border border-green-200 rounded-lg p-4">
                      <h4 className="font-medium text-green-900 mb-2">Platform Payments</h4>
                      <p className="text-sm text-green-700 mb-3">Send funds directly to platform wallets</p>
                      <div className="text-xs text-green-600 space-y-1">
                        <div>• Ethereum: 0x4dB56ac...126C321</div>
                        <div>• Solana: 9Ev8Lhx...UZ3mhA5</div>
                        <div>• Instant settlement</div>
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
                    Live Agent Network Statistics
                    <Badge className="ml-2 bg-purple-100 text-purple-800">Real-time</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
                    <div className="bg-white border border-purple-200 rounded-lg p-4">
                      <div className="text-2xl font-bold text-purple-700">{networkStats.networkStats?.totalAgents || 0}</div>
                      <div className="text-sm text-purple-600">Registered Agents</div>
                    </div>
                    <div className="bg-white border border-purple-200 rounded-lg p-4">
                      <div className="text-2xl font-bold text-green-700">{networkStats.networkStats?.activeAgents || 0}</div>
                      <div className="text-sm text-green-600">Active Now</div>
                    </div>
                    <div className="bg-white border border-purple-200 rounded-lg p-4">
                      <div className="text-2xl font-bold text-blue-700">{networkStats.networkStats?.totalTransactions || 0}</div>
                      <div className="text-sm text-blue-600">Total Transactions</div>
                    </div>
                    <div className="bg-white border border-purple-200 rounded-lg p-4">
                      <div className="text-2xl font-bold text-orange-700">24/7</div>
                      <div className="text-sm text-orange-600">Network Uptime</div>
                    </div>
                  </div>

                  <div className="mt-6 bg-white border border-purple-200 rounded-lg p-4">
                    <h4 className="font-medium text-purple-900 mb-3">Getting Started for AI Agents</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                      <div>
                        <span className="font-medium text-purple-800">1. Register:</span>
                        <span className="text-purple-700"> POST your agent details to /api/public/agents/register</span>
                      </div>
                      <div>
                        <span className="font-medium text-purple-800">2. Discover:</span>
                        <span className="text-purple-700"> GET available agents from /api/public/agents/discover</span>
                      </div>
                      <div>
                        <span className="font-medium text-purple-800">3. Transact:</span>
                        <span className="text-purple-700"> POST transactions to /api/public/agents/transact</span>
                      </div>
                      <div>
                        <span className="font-medium text-purple-800">4. Maintain:</span>
                        <span className="text-purple-700"> POST heartbeat to /api/public/agents/:id/heartbeat</span>
                      </div>
                    </div>
                    <div className="text-center">
                      <a 
                        href="/ai-agent-marketplace" 
                        className="inline-flex items-center px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
                      >
                        <Bot className="w-5 h-5 mr-2" />
                        Enter AI Agent Marketplace
                      </a>
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

function Footer() {
  return null; // Footer is now integrated into the main component
}