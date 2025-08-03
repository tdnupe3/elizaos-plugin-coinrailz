import { XRPWalletManager } from "@/components/XRPWalletManager";
import { NavigationHeader } from "@/components/navigation-header";
import { MobileNavigation } from "@/components/mobile-navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { 
  Wallet, 
  Shield, 
  Zap, 
  Globe, 
  ArrowLeft,
  CheckCircle,
  Lock,
  Eye
} from "@/lib/icons";

export default function XRPWalletCreation() {
  const [, setLocation] = useLocation();

  const features = [
    {
      icon: Zap,
      title: "Instant Creation",
      description: "Generate secure XRP wallets in seconds with cryptographically secure key generation"
    },
    {
      icon: Shield,
      title: "Enterprise Security",
      description: "Bank-grade encryption and security protocols protect your wallet and private keys"
    },
    {
      icon: Globe,
      title: "Mainnet Ready",
      description: "Connect directly to XRP mainnet for live transactions and balance tracking"
    },
    {
      icon: Eye,
      title: "Real-time Balances",
      description: "Check live XRP balances and transaction history instantly"
    }
  ];

  const securityFeatures = [
    "Secure key generation using industry-standard cryptography",
    "Private keys never leave your device during creation",
    "Optional seed phrase backup for wallet recovery",
    "Live mainnet balance verification",
    "Compatible with existing XRP wallets and exchanges"
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationHeader />
      <MobileNavigation />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20 md:pb-8">
        {/* Header */}
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => setLocation('/xrp-ecosystem')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to XRP Ecosystem
          </Button>
          
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <div className="bg-blue-100 p-3 rounded-full">
                <Wallet className="w-8 h-8 text-blue-600" />
              </div>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              XRP Wallet Creation & Management
            </h1>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Create secure XRP wallets instantly or import existing ones. Manage your XRP holdings 
              with enterprise-grade security and real-time mainnet connectivity.
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Wallet Manager */}
          <div className="lg:col-span-2">
            <XRPWalletManager />
          </div>

          {/* Information Sidebar */}
          <div className="space-y-6">
            {/* Features */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Key Features
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {features.map((feature, index) => (
                  <div key={index} className="flex gap-3">
                    <div className="bg-blue-50 p-2 rounded-lg flex-shrink-0">
                      <feature.icon className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm">{feature.title}</h4>
                      <p className="text-xs text-gray-600 mt-1">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Security Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="w-5 h-5 text-green-600" />
                  Security Features
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {securityFeatures.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Network Status */}
            <Card>
              <CardHeader>
                <CardTitle>Network Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">XRP Mainnet</span>
                  <Badge className="bg-green-100 text-green-800">Connected</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Balance Sync</span>
                  <Badge className="bg-blue-100 text-blue-800">Real-time</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Transaction Fees</span>
                  <span className="text-sm text-gray-600">~0.00001 XRP</span>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => setLocation('/xrp-cross-border-payments')}
                >
                  <Globe className="w-4 h-4 mr-2" />
                  Send Cross-Border Payment
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => setLocation('/xrp-ecosystem')}
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Explore XRP Services
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}