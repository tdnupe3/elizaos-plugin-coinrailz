import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Network, TrendingUp, Shield, Zap, ArrowRight, CheckCircle, DollarSign } from "@/lib/icons";
import { NavigationHeader } from "@/components/navigation-header";
import { MobileNavigation } from "@/components/mobile-navigation";
import { Link } from "wouter";

export default function USDCDefi() {
  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationHeader />
      <MobileNavigation />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20 md:pb-8">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-cyan-600 to-cyan-500 rounded-lg p-8 text-white mb-8">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Network className="w-10 h-10 mr-3" />
              <h1 className="text-3xl md:text-4xl font-bold">
                USDC DeFi Integration
              </h1>
            </div>
            <p className="text-lg text-cyan-100 mb-6">
              Access DeFi protocols with USDC liquidity and automated yield optimization
            </p>
            <Badge className="bg-green-500 text-white px-4 py-2 text-sm">
              Automated Yield Farming • MEV Protection
            </Badge>
          </div>
        </div>

        {/* Key Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="text-center">
            <CardHeader className="pb-3">
              <div className="w-12 h-12 bg-cyan-500 rounded-lg flex items-center justify-center text-white mx-auto mb-3">
                <TrendingUp className="w-6 h-6" />
              </div>
              <CardTitle className="text-lg">Yield Farming</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-cyan-600">Auto-Optimized</p>
              <p className="text-sm text-gray-600">Best APY rates</p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader className="pb-3">
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center text-white mx-auto mb-3">
                <DollarSign className="w-6 h-6" />
              </div>
              <CardTitle className="text-lg">Liquidity Provision</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-600">Dual Rewards</p>
              <p className="text-sm text-gray-600">Fees + tokens</p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader className="pb-3">
              <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center text-white mx-auto mb-3">
                <Zap className="w-6 h-6" />
              </div>
              <CardTitle className="text-lg">Flash Loans</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">Instant</p>
              <p className="text-sm text-gray-600">Capital efficiency</p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader className="pb-3">
              <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center text-white mx-auto mb-3">
                <Shield className="w-6 h-6" />
              </div>
              <CardTitle className="text-lg">MEV Protection</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-purple-600">Protected</p>
              <p className="text-sm text-gray-600">Anti-sandwich</p>
            </CardContent>
          </Card>
        </div>

        {/* DeFi Protocols */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl">Integrated DeFi Protocols</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="p-4 bg-blue-50 rounded-lg">
                <h3 className="font-semibold mb-2">Uniswap V3</h3>
                <p className="text-sm text-gray-600 mb-3">Concentrated liquidity and automated position management</p>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Est. APY:</span>
                  <span className="text-sm font-bold text-blue-600">8-15%</span>
                </div>
              </div>
              
              <div className="p-4 bg-green-50 rounded-lg">
                <h3 className="font-semibold mb-2">Compound</h3>
                <p className="text-sm text-gray-600 mb-3">Money market protocol for lending and borrowing</p>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Est. APY:</span>
                  <span className="text-sm font-bold text-green-600">4-8%</span>
                </div>
              </div>
              
              <div className="p-4 bg-purple-50 rounded-lg">
                <h3 className="font-semibold mb-2">Aave</h3>
                <p className="text-sm text-gray-600 mb-3">Decentralized lending with variable rates</p>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Est. APY:</span>
                  <span className="text-sm font-bold text-purple-600">3-7%</span>
                </div>
              </div>
              
              <div className="p-4 bg-orange-50 rounded-lg">
                <h3 className="font-semibold mb-2">Curve Finance</h3>
                <p className="text-sm text-gray-600 mb-3">Stablecoin-optimized automated market maker</p>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Est. APY:</span>
                  <span className="text-sm font-bold text-orange-600">5-12%</span>
                </div>
              </div>
              
              <div className="p-4 bg-cyan-50 rounded-lg">
                <h3 className="font-semibold mb-2">Yearn Finance</h3>
                <p className="text-sm text-gray-600 mb-3">Automated yield farming strategies</p>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Est. APY:</span>
                  <span className="text-sm font-bold text-cyan-600">6-18%</span>
                </div>
              </div>
              
              <div className="p-4 bg-indigo-50 rounded-lg">
                <h3 className="font-semibold mb-2">Convex Finance</h3>
                <p className="text-sm text-gray-600 mb-3">Boosted Curve rewards and governance</p>
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Est. APY:</span>
                  <span className="text-sm font-bold text-indigo-600">7-20%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* How It Works */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl">How USDC DeFi Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-cyan-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-cyan-600">1</span>
                </div>
                <h3 className="font-semibold mb-2">Deposit USDC</h3>
                <p className="text-gray-600">Connect your wallet and deposit USDC into our DeFi integration</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-blue-600">2</span>
                </div>
                <h3 className="font-semibold mb-2">Auto-Optimization</h3>
                <p className="text-gray-600">AI algorithms find the best yield opportunities across protocols</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-green-600">3</span>
                </div>
                <h3 className="font-semibold mb-2">Earn Rewards</h3>
                <p className="text-gray-600">Automatically compound earnings and maximize yield</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-purple-600">4</span>
                </div>
                <h3 className="font-semibold mb-2">Withdraw Anytime</h3>
                <p className="text-gray-600">Exit positions instantly with minimal slippage</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Risk Management */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl">Risk Management & Protection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex items-start space-x-3">
                <Shield className="w-6 h-6 text-green-500 mt-1" />
                <div>
                  <h3 className="font-semibold mb-1">Smart Contract Audits</h3>
                  <p className="text-sm text-gray-600">All integrated protocols undergo rigorous security audits</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-6 h-6 text-blue-500 mt-1" />
                <div>
                  <h3 className="font-semibold mb-1">Diversified Exposure</h3>
                  <p className="text-sm text-gray-600">Risk spread across multiple protocols and strategies</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Zap className="w-6 h-6 text-purple-500 mt-1" />
                <div>
                  <h3 className="font-semibold mb-1">MEV Protection</h3>
                  <p className="text-sm text-gray-600">Advanced protection against sandwich attacks</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Fee Structure */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl">Transparent Fee Structure</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold mb-2">Management Fee</h3>
                <p className="text-2xl font-bold text-cyan-600">0.5%</p>
                <p className="text-sm text-gray-600">Annual management fee</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold mb-2">Performance Fee</h3>
                <p className="text-2xl font-bold text-green-600">15%</p>
                <p className="text-sm text-gray-600">Of profits above 4% APY</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold mb-2">Withdrawal Fee</h3>
                <p className="text-2xl font-bold text-blue-600">0.1%</p>
                <p className="text-sm text-gray-600">For instant withdrawals</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Call to Action */}
        <div className="text-center">
          <Button size="lg" className="mr-4" asChild>
            <Link href="/dashboard">
              Start DeFi Earning
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/usdc-ecosystem-dashboard">
              Back to USDC Dashboard
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
}