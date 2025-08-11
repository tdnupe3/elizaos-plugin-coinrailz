import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Wallet, Download, ExternalLink, CheckCircle, AlertCircle } from "@/lib/icons";

interface CoinbaseApp {
  name: string;
  type: 'extension' | 'mobile' | 'desktop';
  detected: boolean;
  installed: boolean;
}

export function CoinbaseWalletIntegration() {
  const [detectedApps, setDetectedApps] = useState<CoinbaseApp[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);
  const { toast } = useToast();

  // Auto-detect Coinbase apps on component mount
  useEffect(() => {
    detectCoinbaseApps();
  }, []);

  const detectCoinbaseApps = () => {
    const apps: CoinbaseApp[] = [];
    
    // Check for Coinbase Wallet browser extension
    if (typeof window !== 'undefined') {
      const hasCoinbaseWallet = !!(window as any).coinbaseWalletExtension || !!(window as any).ethereum?.isCoinbaseWallet;
      const hasCoinbaseApp = !!(window as any).coinbase || !!(window as any).ethereum?.isCoinbase;
      
      apps.push({
        name: 'Coinbase Wallet Extension',
        type: 'extension',
        detected: hasCoinbaseWallet,
        installed: hasCoinbaseWallet
      });

      apps.push({
        name: 'Coinbase App',
        type: 'mobile',
        detected: hasCoinbaseApp,
        installed: hasCoinbaseApp
      });
    }

    setDetectedApps(apps);
  };

  const connectToExistingWallet = async (app: CoinbaseApp) => {
    setIsConnecting(true);
    
    try {
      if (app.type === 'extension' && app.detected) {
        // Connect to existing Coinbase Wallet extension
        const ethereum = (window as any).ethereum;
        if (ethereum?.isCoinbaseWallet) {
          const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
          if (accounts.length > 0) {
            setConnectedWallet(accounts[0]);
            toast({
              title: "Wallet Connected!",
              description: `Connected to ${app.name} successfully`,
              variant: "default",
            });
          }
        }
      } else if (app.type === 'mobile' && app.detected) {
        // Connect to Coinbase mobile app via deep link
        const deepLink = 'https://go.cb-w.com/dapp?cb_url=' + encodeURIComponent(window.location.href);
        window.open(deepLink, '_blank');
        
        toast({
          title: "Redirecting to Coinbase",
          description: "Opening Coinbase app for authentication",
          variant: "default",
        });
      }
    } catch (error) {
      console.error('Wallet connection failed:', error);
      toast({
        title: "Connection Failed",
        description: "Unable to connect to wallet. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const createNewWallet = (type: 'defi' | 'mobile') => {
    if (type === 'defi') {
      // Redirect to Coinbase DeFi Wallet download
      window.open('https://wallet.coinbase.com/', '_blank');
      toast({
        title: "Redirecting to Coinbase",
        description: "Opening DeFi wallet creation page",
        variant: "default",
      });
    } else {
      // Redirect to Coinbase mobile app download
      const userAgent = navigator.userAgent;
      const isIOS = /iPad|iPhone|iPod/.test(userAgent);
      const isAndroid = /Android/.test(userAgent);
      
      let downloadUrl = 'https://www.coinbase.com/wallet';
      if (isIOS) {
        downloadUrl = 'https://apps.apple.com/app/coinbase-wallet/id1278383455';
      } else if (isAndroid) {
        downloadUrl = 'https://play.google.com/store/apps/details?id=org.toshi';
      }
      
      window.open(downloadUrl, '_blank');
      toast({
        title: "Redirecting to App Store",
        description: "Opening Coinbase Wallet download page",
        variant: "default",
      });
    }
  };

  const signInWithCoinbase = () => {
    // Redirect to our Coinbase OAuth login endpoint
    window.location.href = '/auth/coinbase/login';
  };

  return (
    <div className="space-y-6">
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-6 h-6 text-blue-600" />
            Coinbase Integration
          </CardTitle>
          <p className="text-sm text-gray-600">
            Connect your existing Coinbase account or create a new wallet
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          
          {/* Sign in with Coinbase OAuth */}
          <div className="bg-white border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
              <ExternalLink className="w-4 h-4" />
              Sign in with Coinbase (Recommended)
            </h4>
            <p className="text-sm text-blue-600 mb-3">
              Use your existing Coinbase account - no additional KYC required
            </p>
            <Button 
              onClick={signInWithCoinbase}
              className="bg-blue-600 hover:bg-blue-700 text-white w-full"
            >
              Sign in with Coinbase Account
            </Button>
          </div>

          {/* Detected Wallets */}
          {detectedApps.some(app => app.detected) && (
            <div className="bg-white border border-green-200 rounded-lg p-4">
              <h4 className="font-medium text-green-900 mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Detected Coinbase Apps
              </h4>
              <div className="space-y-2">
                {detectedApps
                  .filter(app => app.detected)
                  .map((app, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-green-50 border border-green-200 rounded">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-100 text-green-800">Detected</Badge>
                        <span className="text-sm font-medium">{app.name}</span>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => connectToExistingWallet(app)}
                        disabled={isConnecting}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {isConnecting ? 'Connecting...' : 'Connect'}
                      </Button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Create New Wallet Options */}
          <div className="bg-white border border-orange-200 rounded-lg p-4">
            <h4 className="font-medium text-orange-900 mb-3 flex items-center gap-2">
              <Download className="w-4 h-4" />
              Create New Coinbase Wallet
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => createNewWallet('defi')}
                className="border-orange-600 text-orange-600 hover:bg-orange-50"
              >
                <Wallet className="w-4 h-4 mr-2" />
                DeFi Wallet
              </Button>
              <Button
                variant="outline"
                onClick={() => createNewWallet('mobile')}
                className="border-orange-600 text-orange-600 hover:bg-orange-50"
              >
                <Download className="w-4 h-4 mr-2" />
                Mobile App
              </Button>
            </div>
            <p className="text-xs text-orange-600 mt-2">
              Both options will redirect you to official Coinbase pages for secure wallet creation
            </p>
          </div>

          {/* Connected Status */}
          {connectedWallet && (
            <div className="bg-white border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Wallet Connected</span>
              </div>
              <p className="text-sm text-green-600 mt-1">
                {connectedWallet.slice(0, 6)}...{connectedWallet.slice(-4)}
              </p>
            </div>
          )}

          {/* No Apps Detected */}
          {!detectedApps.some(app => app.detected) && (
            <div className="bg-white border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-yellow-800 mb-2">
                <AlertCircle className="w-4 h-4" />
                <span className="font-medium">No Coinbase Apps Detected</span>
              </div>
              <p className="text-sm text-yellow-600 mb-3">
                Create a new wallet or install Coinbase Wallet to get started
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => createNewWallet('mobile')}
                  className="bg-yellow-600 hover:bg-yellow-700"
                >
                  Download App
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={detectCoinbaseApps}
                  className="border-yellow-600 text-yellow-600 hover:bg-yellow-50"
                >
                  Refresh Detection
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}