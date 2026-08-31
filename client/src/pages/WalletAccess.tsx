import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Key, Wallet, MessageSquare, Shield } from 'lucide-react';

export default function WalletAccess() {
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [walletInfo, setWalletInfo] = useState<{
    address: string;
    privateKey?: string;
    fundingInstructions?: string;
    setupInstructions?: string;
  } | null>(null);

  const handleGetWalletInfo = async () => {
    try {
      const response = await fetch('/api/wallet/info');
      const data = await response.json();
      setWalletInfo(data);
    } catch (error) {
      console.error('Failed to get wallet info:', error);
    }
  };

  const handleCreateBNBWallet = async () => {
    try {
      const response = await fetch('/api/wallet/create-bnb', { method: 'POST' });
      const data = await response.json();
      setWalletInfo(data);
    } catch (error) {
      console.error('Failed to create BNB wallet:', error);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">🔐 Wallet Access & Setup</h1>
        <p className="text-gray-600">
          Connect your messaging wallet to Blockscan Chat and set up BNB chain outreach
        </p>
      </div>

      <div className="grid gap-6">
        {/* Current Wallet Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Your Current Messaging Wallet
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Shield className="w-4 h-4" />
              <AlertDescription>
                This is the wallet that sent verified blockchain messages to AI16Z, VaderAI, and Circle Alliance.
              </AlertDescription>
            </Alert>

            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="font-mono text-sm">
                <strong>Address:</strong> 0x337b1b6a0FA833Ae09a697606Ca3FD21ADF696ed
              </p>
              <p className="text-sm text-gray-600 mt-2">
                <strong>Network:</strong> Base Chain
              </p>
              <p className="text-sm text-gray-600">
                <strong>Messages Sent:</strong> 3+ verified transactions
              </p>
            </div>

            <div className="flex gap-3">
              <Button onClick={handleGetWalletInfo} variant="outline">
                <Key className="w-4 h-4 mr-2" />
                Get Wallet Access Info
              </Button>
              <Button 
                asChild 
                className="bg-blue-600 hover:bg-blue-700"
              >
                <a href="https://chat.blockscan.com" target="_blank" rel="noopener">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Open Blockscan Chat
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* BNB Wallet Setup */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-yellow-600" />
              Create BNB Chain Wallet
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              Create a new wallet for cheaper messaging on BNB Smart Chain (~$0.10 per message vs $1+ on Base)
            </p>

            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <h4 className="font-semibold text-yellow-800 mb-2">Why BNB Chain?</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                <li>• 10x cheaper transaction fees</li>
                <li>• Access to PancakeSwap, Venus Protocol, gaming projects</li>
                <li>• Binance ecosystem partnerships</li>
                <li>• Same Blockscan Chat compatibility</li>
              </ul>
            </div>

            <Button onClick={handleCreateBNBWallet} className="bg-yellow-600 hover:bg-yellow-700">
              Create BNB Wallet
            </Button>
          </CardContent>
        </Card>

        {/* Wallet Information Display */}
        {walletInfo && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                Wallet Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-red-200 bg-red-50">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  <strong>SECURITY WARNING:</strong> Never share private keys. Treat them like cash.
                </AlertDescription>
              </Alert>

              {walletInfo.address && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="font-mono text-sm break-all">
                    <strong>Address:</strong> {walletInfo.address}
                  </p>
                </div>
              )}

              {walletInfo.privateKey && showPrivateKey && (
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <p className="font-mono text-sm break-all text-red-800">
                    <strong>Private Key:</strong> {walletInfo.privateKey}
                  </p>
                </div>
              )}

              {walletInfo.privateKey && !showPrivateKey && (
                <Button 
                  onClick={() => setShowPrivateKey(true)} 
                  variant="outline"
                  className="border-red-300 text-red-600 hover:bg-red-50"
                >
                  🚨 Show Private Key (Use with Extreme Caution)
                </Button>
              )}

              {walletInfo.fundingInstructions && (
                <div className="mt-4">
                  <h4 className="font-semibold mb-2">💰 How to Fund This Wallet:</h4>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <ol className="text-sm space-y-2">
                      <li>1. Go to Coinbase, Binance, or Crypto.com</li>
                      <li>2. Buy BNB (Binance Coin)</li>
                      <li>3. Send 0.01-0.1 BNB to the address above</li>
                      <li>4. Use "BNB Smart Chain" network (not BEP2)</li>
                    </ol>
                  </div>
                </div>
              )}

              {walletInfo.setupInstructions && (
                <div className="mt-4">
                  <h4 className="font-semibold mb-2">🔧 Setup in MetaMask:</h4>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <ol className="text-sm space-y-2">
                      <li>1. Open MetaMask → "Import Account"</li>
                      <li>2. Paste private key above</li>
                      <li>3. Add BNB Smart Chain network</li>
                      <li>4. Connect to Blockscan Chat</li>
                    </ol>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>📋 Next Steps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-semibold text-blue-800 mb-2">For Base Chain (Current Wallet):</h4>
                <ol className="text-sm text-blue-700 space-y-1">
                  <li>1. Get wallet access info above</li>
                  <li>2. Import to MetaMask</li>
                  <li>3. Connect to Blockscan Chat</li>
                  <li>4. Continue messaging on Base</li>
                </ol>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg">
                <h4 className="font-semibold text-yellow-800 mb-2">For BNB Chain (New Wallet):</h4>
                <ol className="text-sm text-yellow-700 space-y-1">
                  <li>1. Create BNB wallet above</li>
                  <li>2. Fund with 0.01 BNB (~$6)</li>
                  <li>3. Import to MetaMask</li>
                  <li>4. Message BNB projects</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}