import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, Shield, Key, Globe, ArrowRight, CheckCircle, Lock } from "@/lib/icons";
import { NavigationHeader } from "@/components/navigation-header";
import { MobileNavigation } from "@/components/mobile-navigation";
import { Link } from "wouter";

export default function USDCWallets() {
  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationHeader />
      <MobileNavigation />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20 md:pb-8">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-500 rounded-lg p-8 text-white mb-8">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Wallet className="w-10 h-10 mr-3" />
              <h1 className="text-3xl md:text-4xl font-bold">
                Programmable Wallets
              </h1>
            </div>
            <p className="text-lg text-purple-100 mb-6">
              Enterprise-grade wallet infrastructure powered by Circle's MPC technology
            </p>
            <Badge className="bg-green-500 text-white px-4 py-2 text-sm">
              USDC-Native Security • Agent-Ready Technology
            </Badge>
          </div>
        </div>

        {/* Key Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="text-center">
            <CardHeader className="pb-3">
              <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center text-white mx-auto mb-3">
                <Key className="w-6 h-6" />
              </div>
              <CardTitle className="text-lg">MPC Security</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-purple-600">Multi-Party</p>
              <p className="text-sm text-gray-600">Compute protection</p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader className="pb-3">
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center text-white mx-auto mb-3">
                <Shield className="w-6 h-6" />
              </div>
              <CardTitle className="text-lg">Advanced Control</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-600">Full Control</p>
              <p className="text-sm text-gray-600">Your keys, your rules</p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader className="pb-3">
              <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center text-white mx-auto mb-3">
                <CheckCircle className="w-6 h-6" />
              </div>
              <CardTitle className="text-lg">Multi-Signature</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">Enhanced</p>
              <p className="text-sm text-gray-600">Security approval</p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader className="pb-3">
              <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center text-white mx-auto mb-3">
                <Globe className="w-6 h-6" />
              </div>
              <CardTitle className="text-lg">Compliance Ready</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-orange-600">Regulatory</p>
              <p className="text-sm text-gray-600">Built-in compliance</p>
            </CardContent>
          </Card>
        </div>

        {/* Wallet Types */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Wallet className="w-5 h-5 mr-2 text-blue-600" />
                Individual Wallets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                  Auto-created during registration
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                  Multi-chain USDC support
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                  Instant transaction capability
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                  Circle MPC protection
                </li>
              </ul>
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm font-semibold text-blue-800">Monthly Fee</p>
                <p className="text-sm text-blue-600">$0.05 per Monthly Active Wallet</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Lock className="w-5 h-5 mr-2 text-purple-600" />
                Enterprise Wallets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                  Custom approval workflows
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                  Multi-signature requirements
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                  Advanced compliance features
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                  White-label branding
                </li>
              </ul>
              <div className="mt-4 p-3 bg-purple-50 rounded-lg">
                <p className="text-sm font-semibold text-purple-800">Custom Pricing</p>
                <p className="text-sm text-purple-600">Contact for enterprise rates</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Security Features */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl">Advanced Security Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Key className="w-8 h-8 text-purple-600" />
                </div>
                <h3 className="font-semibold mb-2">MPC Key Management</h3>
                <p className="text-gray-600">No single point of failure with distributed key generation and storage</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="font-semibold mb-2">Hardware Security</h3>
                <p className="text-gray-600">HSM-backed infrastructure with institutional-grade protection</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="font-semibold mb-2">Compliance Built-in</h3>
                <p className="text-gray-600">Automatic KYC/AML screening and regulatory compliance</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pricing */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl">Transparent Pricing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold mb-2">Wallet Creation</h3>
                <p className="text-2xl font-bold text-blue-600">Free</p>
                <p className="text-sm text-gray-600">No setup fees</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold mb-2">Monthly Active Wallet</h3>
                <p className="text-2xl font-bold text-green-600">$0.05</p>
                <p className="text-sm text-gray-600">Per MAW</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold mb-2">Transaction Fees</h3>
                <p className="text-2xl font-bold text-purple-600">0.1%</p>
                <p className="text-sm text-gray-600">Platform fee</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Call to Action */}
        <div className="text-center">
          <Button size="lg" className="mr-4" asChild>
            <Link href="/dashboard">
              Access Your Wallet
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