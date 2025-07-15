import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, Code, Webhook, Globe, ArrowRight, CheckCircle, Settings, Users } from "@/lib/icons";
import { NavigationHeader } from "@/components/navigation-header";
import { MobileNavigation } from "@/components/mobile-navigation";
import { Link } from "wouter";

export default function USDCEnterprise() {
  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationHeader />
      <MobileNavigation />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20 md:pb-8">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-lg p-8 text-white mb-8">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Bot className="w-10 h-10 mr-3" />
              <h1 className="text-3xl md:text-4xl font-bold">
                Enterprise API
              </h1>
            </div>
            <p className="text-lg text-indigo-100 mb-6">
              White-label USDC infrastructure for businesses and institutions
            </p>
            <Badge className="bg-green-500 text-white px-4 py-2 text-sm">
              Enterprise-Grade • Custom Solutions
            </Badge>
          </div>
        </div>

        {/* Key Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="text-center">
            <CardHeader className="pb-3">
              <div className="w-12 h-12 bg-indigo-500 rounded-lg flex items-center justify-center text-white mx-auto mb-3">
                <Code className="w-6 h-6" />
              </div>
              <CardTitle className="text-lg">REST & GraphQL</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-indigo-600">Dual APIs</p>
              <p className="text-sm text-gray-600">Full coverage</p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader className="pb-3">
              <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center text-white mx-auto mb-3">
                <Webhook className="w-6 h-6" />
              </div>
              <CardTitle className="text-lg">Webhooks</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-600">Real-time</p>
              <p className="text-sm text-gray-600">Event notifications</p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader className="pb-3">
              <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center text-white mx-auto mb-3">
                <Users className="w-6 h-6" />
              </div>
              <CardTitle className="text-lg">Multi-Tenant</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">Scalable</p>
              <p className="text-sm text-gray-600">Isolated environments</p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardHeader className="pb-3">
              <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center text-white mx-auto mb-3">
                <Settings className="w-6 h-6" />
              </div>
              <CardTitle className="text-lg">Custom Branding</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-purple-600">White-label</p>
              <p className="text-sm text-gray-600">Your brand</p>
            </CardContent>
          </Card>
        </div>

        {/* API Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Code className="w-5 h-5 mr-2 text-indigo-600" />
                REST API Features
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                  Complete wallet management
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                  Transaction processing
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                  Balance queries and updates
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                  Multi-chain support
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                  Comprehensive documentation
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Globe className="w-5 h-5 mr-2 text-blue-600" />
                GraphQL API Features
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                  Single endpoint flexibility
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                  Real-time subscriptions
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                  Efficient data fetching
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                  Type-safe queries
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                  GraphQL playground
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Enterprise Solutions */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl">Enterprise Solutions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-6 bg-blue-50 rounded-lg">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="font-semibold mb-2">Fintech Startups</h3>
                <p className="text-gray-600 mb-4">Integrate USDC payments into your platform with minimal development</p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Rapid integration (2-4 weeks)</li>
                  <li>• Scalable infrastructure</li>
                  <li>• Full compliance support</li>
                </ul>
              </div>
              
              <div className="text-center p-6 bg-green-50 rounded-lg">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Globe className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="font-semibold mb-2">Traditional Banks</h3>
                <p className="text-gray-600 mb-4">Modernize payment rails with programmable USDC infrastructure</p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Regulatory compliance</li>
                  <li>• Enterprise security</li>
                  <li>• White-label solutions</li>
                </ul>
              </div>
              
              <div className="text-center p-6 bg-purple-50 rounded-lg">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Settings className="w-8 h-8 text-purple-600" />
                </div>
                <h3 className="font-semibold mb-2">Enterprise Businesses</h3>
                <p className="text-gray-600 mb-4">Streamline treasury operations with automated USDC management</p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Treasury automation</li>
                  <li>• Multi-account management</li>
                  <li>• Advanced reporting</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* API Endpoints */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl">Core API Endpoints</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Wallet Management</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <code className="text-sm">POST /wallets</code>
                    <Badge variant="secondary">Create</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <code className="text-sm">GET /wallets/{id}</code>
                    <Badge variant="secondary">Retrieve</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <code className="text-sm">GET /wallets/{id}/balance</code>
                    <Badge variant="secondary">Balance</Badge>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Transaction Processing</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <code className="text-sm">POST /transactions</code>
                    <Badge variant="secondary">Transfer</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <code className="text-sm">GET /transactions/{id}</code>
                    <Badge variant="secondary">Status</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <code className="text-sm">POST /transactions/bulk</code>
                    <Badge variant="secondary">Batch</Badge>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pricing */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl">Enterprise Pricing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-6 bg-blue-50 rounded-lg">
                <h3 className="font-semibold mb-2">Starter</h3>
                <p className="text-3xl font-bold text-blue-600 mb-2">$2,500</p>
                <p className="text-sm text-gray-600 mb-4">per month</p>
                <ul className="text-sm text-left space-y-1">
                  <li>• Up to 10K API calls/month</li>
                  <li>• 5 wallet sets</li>
                  <li>• Basic support</li>
                  <li>• Standard SLA</li>
                </ul>
              </div>
              
              <div className="text-center p-6 bg-green-50 rounded-lg border-2 border-green-200">
                <h3 className="font-semibold mb-2">Professional</h3>
                <p className="text-3xl font-bold text-green-600 mb-2">$7,500</p>
                <p className="text-sm text-gray-600 mb-4">per month</p>
                <ul className="text-sm text-left space-y-1">
                  <li>• Up to 100K API calls/month</li>
                  <li>• Unlimited wallet sets</li>
                  <li>• Priority support</li>
                  <li>• Enhanced SLA</li>
                </ul>
              </div>
              
              <div className="text-center p-6 bg-purple-50 rounded-lg">
                <h3 className="font-semibold mb-2">Enterprise</h3>
                <p className="text-3xl font-bold text-purple-600 mb-2">Custom</p>
                <p className="text-sm text-gray-600 mb-4">pricing</p>
                <ul className="text-sm text-left space-y-1">
                  <li>• Unlimited API calls</li>
                  <li>• White-label solutions</li>
                  <li>• Dedicated support</li>
                  <li>• Custom SLA</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Call to Action */}
        <div className="text-center">
          <Button size="lg" className="mr-4" asChild>
            <Link href="/contact-us">
              Contact Sales
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/documentation">
              View API Docs
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
}