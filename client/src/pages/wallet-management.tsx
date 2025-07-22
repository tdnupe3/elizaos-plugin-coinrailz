import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import { EnhancedWalletManager } from "@/components/enhanced-wallet-manager";
import { WalletConnect } from "@/components/wallet-connect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Wallet, 
  Shield, 
  Zap, 
  ArrowLeftRight, 
  TrendingUp, 
  DollarSign,
  Info,
  ChevronRight,
  ExternalLink,
  Plus
} from "@/lib/icons";
import { Link } from "wouter";

function WalletManagement() {
  const { user } = useAuth();
  const { wallet } = useWallet();

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Please Sign In</h1>
          <p className="text-gray-600 mb-6">Sign in to manage your digital wallets</p>
          <Link href="/auth">
            <Button>Go to Sign In</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Wallet Management</h1>
              <p className="text-gray-600">
                Manage your Circle USDC wallet and Web3 wallets
              </p>
            </div>
            <div className="flex space-x-4">
              <Button variant="outline" asChild>
                <Link href="/dashboard">
                  <ChevronRight className="h-4 w-4 mr-2 rotate-180" />
                  Dashboard
                </Link>
              </Button>
              <Button asChild>
                <Link href="/dex-aggregator">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Trade Assets
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Wallet Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="w-5 h-5 text-blue-600" />
                Circle Wallet
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Badge variant="outline" className="bg-green-200 text-green-800">
                  <Shield className="w-3 h-3 mr-1" />
                  Auto-Created
                </Badge>
                <p className="text-sm text-gray-700">
                  ✓ Instant USDC settlements<br />
                  ✓ Fiat onramp ready<br />
                  ✓ P2P optimized
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Zap className="w-5 h-5 text-orange-600" />
                Web3 Wallet
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Badge variant="outline" className={`${wallet.isConnected ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                  {wallet.isConnected ? 'Connected' : 'Not Connected'}
                </Badge>
                <p className="text-sm text-gray-700">
                  ✓ Multi-chain access<br />
                  ✓ DEX trading<br />
                  ✓ DeFi protocols
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <ArrowLeftRight className="w-5 h-5 text-purple-600" />
                Transfers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Badge variant="outline" className="bg-purple-200 text-purple-800">
                  <ArrowLeftRight className="w-3 h-3 mr-1" />
                  Available
                </Badge>
                <p className="text-sm text-gray-700">
                  ✓ Seamless USDC movement<br />
                  ✓ Low network fees<br />
                  ✓ 2-5 second speed
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Wallet Interface */}
        <div className="mb-8">
          <EnhancedWalletManager />
        </div>

        {/* Educational Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" />
                Circle USDC Wallets
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Automatically created for you</strong><br />
                  Best for P2P transfers, fiat deposits, and instant settlements
                </AlertDescription>
              </Alert>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <div>
                    <p className="font-medium text-sm">Instant Settlements</p>
                    <p className="text-xs text-gray-600">USDC transfers in 2-5 seconds</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <div>
                    <p className="font-medium text-sm">Multi-Chain Support</p>
                    <p className="text-xs text-gray-600">Ethereum, Polygon, Base, Arbitrum, BNB, Avalanche</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <div>
                    <p className="font-medium text-sm">Fiat Ready</p>
                    <p className="text-xs text-gray-600">Easy bank deposits and withdrawals</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <div>
                    <p className="font-medium text-sm">Enterprise Security</p>
                    <p className="text-xs text-gray-600">Circle's institutional-grade protection</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-orange-600" />
                Web3 Wallets
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Connect your existing wallet</strong><br />
                  Best for DEX trading, DeFi protocols, and multi-asset management
                </AlertDescription>
              </Alert>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <div>
                    <p className="font-medium text-sm">DEX Trading</p>
                    <p className="text-xs text-gray-600">Access 50+ decentralized exchanges</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <div>
                    <p className="font-medium text-sm">Multi-Chain Networks</p>
                    <p className="text-xs text-gray-600">15+ blockchain networks supported</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <div>
                    <p className="font-medium text-sm">DeFi Access</p>
                    <p className="text-xs text-gray-600">Lending, borrowing, yield farming</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <div>
                    <p className="font-medium text-sm">Full Control</p>
                    <p className="text-xs text-gray-600">Your keys, your crypto</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Usage Guide */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Recommended Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-semibold text-blue-700 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Use Circle Wallet For:
                </h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <DollarSign className="w-3 h-3 text-green-600" />
                    P2P money transfers
                  </li>
                  <li className="flex items-center gap-2">
                    <TrendingUp className="w-3 h-3 text-green-600" />
                    Receiving payments
                  </li>
                  <li className="flex items-center gap-2">
                    <Plus className="w-3 h-3 text-green-600" />
                    Adding funds from bank
                  </li>
                  <li className="flex items-center gap-2">
                    <Shield className="w-3 h-3 text-green-600" />
                    Stable USDC storage
                  </li>
                </ul>
              </div>
              
              <div className="space-y-4">
                <h4 className="font-semibold text-orange-700 flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Use Web3 Wallet For:
                </h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <ArrowLeftRight className="w-3 h-3 text-blue-600" />
                    DEX token swaps
                  </li>
                  <li className="flex items-center gap-2">
                    <TrendingUp className="w-3 h-3 text-blue-600" />
                    DeFi protocols
                  </li>
                  <li className="flex items-center gap-2">
                    <Wallet className="w-3 h-3 text-blue-600" />
                    Multi-asset trading
                  </li>
                  <li className="flex items-center gap-2">
                    <ExternalLink className="w-3 h-3 text-blue-600" />
                    External dApp connections
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default WalletManagement;