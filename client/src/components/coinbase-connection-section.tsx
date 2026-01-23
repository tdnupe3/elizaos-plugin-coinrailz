/**
 * Coinbase Connection Section for Dashboard
 * Prominently displays Coinbase integration features right after demo mode
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wallet, ArrowUpRight, Shield, Zap, ExternalLink } from 'lucide-react';
import { Link } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { CoinbaseWalletIntegration } from './CoinbaseWalletIntegration';

export default function CoinbaseConnectionSection() {
  const { user, isAuthenticated } = useAuth();

  return (
    <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
      <CardHeader>
        <CardTitle className="flex items-center text-blue-700 dark:text-blue-300">
          <Wallet className="h-6 w-6 mr-3" />
          Connect with Coinbase
          <Badge variant="outline" className="ml-auto bg-green-100 text-green-800">
            Recommended
          </Badge>
        </CardTitle>
        <CardDescription className="text-blue-600 dark:text-blue-400">
          Seamless integration with your Coinbase account and wallets
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Key Benefits */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="text-center p-3 sm:p-4 bg-white/50 rounded-lg">
            <Shield className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 text-blue-600" />
            <h3 className="font-semibold text-xs sm:text-sm text-gray-900">Auto-detect Wallets</h3>
            <p className="text-xs text-gray-600">Find existing wallets instantly</p>
          </div>
          <div className="text-center p-3 sm:p-4 bg-white/50 rounded-lg">
            <Zap className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 text-blue-600" />
            <h3 className="font-semibold text-xs sm:text-sm text-gray-900">One-click Creation</h3>
            <p className="text-xs text-gray-600">Create new wallets in seconds</p>
          </div>
          <div className="text-center p-3 sm:p-4 bg-white/50 rounded-lg">
            <ArrowUpRight className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 text-blue-600" />
            <h3 className="font-semibold text-xs sm:text-sm text-gray-900">Skip KYC</h3>
            <p className="text-xs text-gray-600">Use Coinbase login credentials</p>
          </div>
        </div>

        {/* Integration Widget */}
        <div className="bg-white rounded-lg p-4 border">
          <CoinbaseWalletIntegration />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <Button className="w-full bg-blue-600 hover:bg-blue-700 py-3" asChild>
            <Link href="/cdp-wallet">
              <Wallet className="w-4 h-4 mr-2" />
              Manage Coinbase Wallets
            </Link>
          </Button>
          <Button variant="outline" className="w-full border-blue-600 text-blue-600 hover:bg-blue-50 py-3" asChild>
            <Link href="/coinbase-cdp">
              <ExternalLink className="w-4 h-4 mr-2" />
              DeFi Integration
            </Link>
          </Button>
        </div>

        {/* Additional Info */}
        <div className="text-sm text-blue-600 bg-blue-50 p-3 rounded border">
          <p className="font-medium mb-1">Why connect with Coinbase?</p>
          <ul className="text-xs space-y-1 text-blue-700">
            <li>• Fund your wallet directly from Coinbase account</li>
            <li>• Access professional-grade wallet infrastructure</li>
            <li>• Seamless crypto-to-crypto swaps with best rates</li>
            <li>• Enterprise security with multi-signature support</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}