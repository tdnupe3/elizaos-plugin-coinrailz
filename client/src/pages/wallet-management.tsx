import { NavigationHeader } from "@/components/navigation-header";
import { MobileNavigation } from "@/components/mobile-navigation";
import { XRPWalletConnection } from "@/components/xrp-wallet-connection";
import { CommissionDashboard } from "@/components/CommissionDashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  ArrowLeft, 
  Wallet, 
  TrendingUp, 
  Clock, 
  CheckCircle,
  AlertCircle,
  DollarSign,
  Zap
} from "@/lib/icons";
import { useLocation } from "wouter";

export default function WalletManagement() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  // Get user's wallet balances
  const { data: walletBalances } = useQuery({
    queryKey: ['/api/wallets/balances', user?.id],
    enabled: !!user
  });

  return (
    <div className="min-h-screen bg-neutral-50">
      <NavigationHeader />
      <MobileNavigation />
      
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20 md:pb-8">
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => setLocation("/")}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-neutral-800">Wallet Management</h1>
          <p className="text-neutral-500">Connect and manage your cryptocurrency wallets</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Wallet Overview */}
          <div className="lg:col-span-2 space-y-6">
            {/* Balance Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                  <span>Balance Overview</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-gradient-to-r from-emerald-50 to-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-emerald-700">
                      ${user?.usdBalance ? parseFloat(user.usdBalance).toFixed(2) : '0.00'}
                    </div>
                    <div className="text-sm text-emerald-600">USD Balance</div>
                  </div>
                  
                  <div className="text-center p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-700">
                      {walletBalances?.XRP?.balance || '0.000000'} XRP
                    </div>
                    <div className="text-sm text-blue-600">XRP Balance</div>
                  </div>
                  
                  <div className="text-center p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-700">
                      ${((parseFloat(user?.usdBalance || '0') + (parseFloat(walletBalances?.XRP?.balance || '0') * 0.50))).toFixed(2)}
                    </div>
                    <div className="text-sm text-purple-600">Total Value</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Wallet Connection Tabs */}
            <Tabs defaultValue="xrp" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="xrp" className="flex items-center space-x-1">
                  <Zap className="w-3 h-3" />
                  <span>XRP</span>
                </TabsTrigger>
                <TabsTrigger value="earnings" className="flex items-center space-x-1">
                  <TrendingUp className="w-3 h-3" />
                  <span>Earnings</span>
                </TabsTrigger>
                <TabsTrigger value="ethereum">Ethereum</TabsTrigger>
                <TabsTrigger value="solana">Solana</TabsTrigger>
                <TabsTrigger value="bitcoin">Bitcoin</TabsTrigger>
              </TabsList>

              <TabsContent value="xrp" className="mt-6">
                <XRPWalletConnection />
              </TabsContent>

              <TabsContent value="earnings" className="mt-6">
                <CommissionDashboard />
              </TabsContent>

              <TabsContent value="ethereum" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Ethereum Wallet</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Alert>
                      <AlertCircle className="w-4 h-4" />
                      <AlertDescription>
                        Ethereum wallet connection coming soon. Currently focused on XRP integration for ultra-low-cost transfers.
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="solana" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Solana Wallet</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Alert>
                      <AlertCircle className="w-4 h-4" />
                      <AlertDescription>
                        Solana wallet connection coming soon. Currently focused on XRP integration for instant settlements.
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="bitcoin" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Bitcoin Wallet</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Alert>
                      <AlertCircle className="w-4 h-4" />
                      <AlertDescription>
                        Bitcoin wallet connection coming soon. Currently focused on XRP integration for cost-effective transfers.
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar Information */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  onClick={() => setLocation('/send-money')}
                  className="w-full bg-blue-600 text-white"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Send Money
                </Button>
                <Button 
                  onClick={() => setLocation('/receive-money')}
                  variant="outline"
                  className="w-full"
                >
                  <Wallet className="w-4 h-4 mr-2" />
                  Receive Money
                </Button>
              </CardContent>
            </Card>

            {/* XRP Benefits */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Zap className="w-5 h-5 text-blue-600" />
                  <span>Why XRP?</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start space-x-3">
                  <Clock className="w-5 h-5 text-emerald-600 mt-0.5" />
                  <div>
                    <div className="font-medium text-sm">3-5 Second Settlement</div>
                    <div className="text-xs text-gray-600">Near-instant transaction finality</div>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <TrendingUp className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <div className="font-medium text-sm">Ultra-Low Fees</div>
                    <div className="text-xs text-gray-600">$0.0002 network cost vs $25+ wire fees</div>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-purple-600 mt-0.5" />
                  <div>
                    <div className="font-medium text-sm">Global Reach</div>
                    <div className="text-xs text-gray-600">Send money anywhere in the world</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Transaction Flow */}
            <Card>
              <CardHeader>
                <CardTitle>How XRP Payments Work</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm space-y-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">1</div>
                    <span>Connect your XRP wallet</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">2</div>
                    <span>Enter recipient details</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">3</div>
                    <span>Confirm transaction from your wallet</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-xs font-medium">✓</div>
                    <span>Instant settlement completed</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}