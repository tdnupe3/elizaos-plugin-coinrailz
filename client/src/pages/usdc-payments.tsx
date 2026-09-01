import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, DollarSign, Clock, Shield, ArrowRight, CheckCircle } from "@/lib/icons";
import { NavigationHeader } from "@/components/navigation-header";
import { MobileNavigation } from "@/components/mobile-navigation";
import { Link } from "wouter";

export default function USDCPayments() {
  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationHeader />
      <MobileNavigation />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20 md:pb-8">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 rounded-lg p-8 text-white mb-8">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Zap className="w-10 h-10 mr-3" />
              <h1 className="text-3xl md:text-4xl font-bold">
                Instant USDC Payments
              </h1>
            </div>
            <p className="text-lg text-blue-100 mb-6">
              Move USDC across supported blockchain networks with transparent, on-chain payment flows
            </p>
            <Badge className="bg-green-500 text-white px-4 py-2 text-sm">
              Built for Agentic Commerce
            </Badge>
          </div>
        </div>

        {/* Key Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="text-center">
            <CardHeader className="pb-3">
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center text-white mx-auto mb-3">
                <Clock className="w-6 h-6" />
              </div>
              <CardTitle className="text-lg">Fast On-Chain Payments</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-600">Seconds*</p>
              <p className="text-sm text-gray-600">Network-dependent confirmation</p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader className="pb-3">
              <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center text-white mx-auto mb-3">
                <DollarSign className="w-6 h-6" />
              </div>
              <CardTitle className="text-lg">Ultra-Low Fees</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">0.1-0.5%</p>
              <p className="text-sm text-gray-600">vs 2.9% traditional</p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader className="pb-3">
              <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center text-white mx-auto mb-3">
                <Shield className="w-6 h-6" />
              </div>
              <CardTitle className="text-lg">USDC-Native</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-purple-600">Non-Custodial</p>
              <p className="text-sm text-gray-600">You control transaction signing</p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader className="pb-3">
              <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center text-white mx-auto mb-3">
                <CheckCircle className="w-6 h-6" />
              </div>
              <CardTitle className="text-lg">Multi-Chain</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-orange-600">6 Networks</p>
              <p className="text-sm text-gray-600">ETH, MATIC, AVAX+</p>
            </CardContent>
          </Card>
        </div>

        {/* How It Works Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl">How USDC Payments Work</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-blue-600">1</span>
                </div>
                <h3 className="font-semibold mb-2">Connect Your Wallet</h3>
                <p className="text-gray-600">Link an existing wallet or use a supported agent wallet</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-green-600">2</span>
                </div>
                <h3 className="font-semibold mb-2">Select Network</h3>
                <p className="text-gray-600">Choose from Ethereum, Polygon, Avalanche, Arbitrum, Base, or Optimism</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-purple-600">3</span>
                </div>
                <h3 className="font-semibold mb-2">Send Instantly</h3>
                <p className="text-gray-600">USDC payments are verified on-chain; timing depends on the selected network</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Supported Networks */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl">Supported Networks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { name: 'Ethereum', symbol: 'ETH', fee: '0.1%' },
                { name: 'Polygon', symbol: 'MATIC', fee: '0.1%' },
                { name: 'Avalanche', symbol: 'AVAX', fee: '0.2%' },
                { name: 'Arbitrum', symbol: 'ARB', fee: '0.1%' },
                { name: 'Base', symbol: 'BASE', fee: '0.1%' },
                { name: 'Optimism', symbol: 'OP', fee: '0.1%' }
              ].map((network) => (
                <div key={network.symbol} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-semibold">{network.name}</p>
                    <p className="text-sm text-gray-600">{network.symbol}</p>
                  </div>
                  <Badge variant="secondary">{network.fee}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Call to Action */}
        <div className="text-center">
          <Button size="lg" className="mr-4" asChild>
            <Link href="/p2p-transfer">
              Start USDC Transfer
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/usdc-ecosystem-dashboard">
              View All USDC Services
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
}