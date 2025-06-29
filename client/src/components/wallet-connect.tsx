import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wallet, ExternalLink, Copy, CheckCircle, AlertCircle } from "@/lib/icons";
import { useState } from "react";

interface WalletConnectProps {
  className?: string;
  onWalletChange?: (address: string, chainId: number, connected: boolean) => void;
}

const supportedChains = [
  // EVM Compatible Chains
  { id: 1, name: 'Ethereum', symbol: 'ETH', color: 'bg-blue-500', type: 'evm' },
  { id: 137, name: 'Polygon', symbol: 'MATIC', color: 'bg-purple-500', type: 'evm' },
  { id: 56, name: 'BNB Chain', symbol: 'BNB', color: 'bg-yellow-500', type: 'evm' },
  { id: 42161, name: 'Arbitrum', symbol: 'ETH', color: 'bg-cyan-500', type: 'evm' },
  { id: 10, name: 'Optimism', symbol: 'ETH', color: 'bg-slate-500', type: 'evm' },
  { id: 8453, name: 'Base', symbol: 'ETH', color: 'bg-blue-600', type: 'evm' },
  { id: 369, name: 'PulseChain', symbol: 'PLS', color: 'bg-pink-500', type: 'evm' },
  { id: 43114, name: 'Avalanche', symbol: 'AVAX', color: 'bg-slate-600', type: 'evm' },
  
  // Bitcoin Networks
  { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', color: 'bg-orange-500', type: 'bitcoin' },
  { id: 'lightning', name: 'Lightning Network', symbol: 'BTC', color: 'bg-yellow-500', type: 'bitcoin' },
  
  // Non-EVM L1 Chains
  { id: 'solana', name: 'Solana', symbol: 'SOL', color: 'bg-purple-600', type: 'solana' },
  { id: 'xrp', name: 'XRP Ledger', symbol: 'XRP', color: 'bg-gray-700', type: 'xrpl' },
  { id: 'cardano', name: 'Cardano', symbol: 'ADA', color: 'bg-blue-700', type: 'cardano' },
  { id: 'cosmos', name: 'Cosmos Hub', symbol: 'ATOM', color: 'bg-indigo-600', type: 'cosmos' },
  { id: 'polkadot', name: 'Polkadot', symbol: 'DOT', color: 'bg-pink-600', type: 'polkadot' },
  { id: 'near', name: 'NEAR Protocol', symbol: 'NEAR', color: 'bg-green-600', type: 'near' }
];

export function WalletConnect({ className = '', onWalletChange }: WalletConnectProps) {
  const { wallet, connectWallet, disconnectWallet, switchChain } = useWallet();

  // Notify parent component of wallet changes
  React.useEffect(() => {
    if (onWalletChange) {
      onWalletChange(wallet.address, wallet.chainId, wallet.isConnected);
    }
  }, [wallet.address, wallet.chainId, wallet.isConnected, onWalletChange]);

  const copyAddress = () => {
    if (wallet.address) {
      navigator.clipboard.writeText(wallet.address);
    }
  };

  if (!isConnected) {
    return (
      <Card className={`bg-white shadow-sm border border-gray-200 ${className}`}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Wallet className="w-5 h-5" />
            <span>Connect Wallet</span>
          </CardTitle>
          <p className="text-sm text-gray-600">
            Connect your Web3 wallet to access multi-chain crypto features
          </p>
        </CardHeader>
        <CardContent>
          <div className="bg-blue-50 rounded-lg p-4 mb-4">
            <h4 className="font-medium text-blue-900 mb-2">Supported Networks:</h4>
            <div className="flex flex-wrap gap-2">
              {supportedChains.map((chain) => (
                <Badge key={chain.id} variant="outline" className="bg-white">
                  <div className={`w-2 h-2 ${chain.color} rounded-full mr-2`}></div>
                  {chain.name}
                </Badge>
              ))}
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2">
              <Button 
                onClick={connectWallet}
                disabled={wallet.isConnecting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {wallet.isConnecting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Connecting...
                  </>
                ) : (
                  <>
                    <Wallet className="w-4 h-4 mr-2" />
                    Connect MetaMask
                  </>
                )}
              </Button>
              
              <div className="text-xs text-gray-500 text-center mt-2">
                Other wallets (Phantom, XUMM, etc.) coming soon
              </div>
            </div>
            
            <div className="text-center">
              <p className="text-xs text-gray-500">
                Multiple wallet types supported for true multi-chain access
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentChainInfo = supportedChains.find(chain => chain.id === currentChain);

  return (
    <Card className={`bg-white shadow-sm border border-gray-200 ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span>Wallet Connected</span>
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm"
            onClick={disconnectWallet}
            className="text-red-600 hover:text-red-700"
          >
            Disconnect
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Wallet Info */}
          <div>
            <label className="text-sm font-medium text-gray-700">Connected Wallet</label>
            <div className="flex items-center space-x-2 mt-1">
              <Badge variant="outline" className="bg-blue-50">
                <Wallet className="w-3 h-3 mr-1" />
                {wallet.walletType}
              </Badge>
            </div>
          </div>

          {/* Wallet Address */}
          <div>
            <label className="text-sm font-medium text-gray-700">Wallet Address</label>
            <div className="flex items-center space-x-2 mt-1">
              <code className="flex-1 text-sm bg-gray-100 p-2 rounded border font-mono">
                {walletAddress}
              </code>
              <Button 
                variant="outline" 
                size="sm"
                onClick={copyAddress}
                className="shrink-0"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Current Network */}
          <div>
            <label className="text-sm font-medium text-gray-700">Current Network</label>
            <div className="flex items-center space-x-2 mt-1">
              {currentChainInfo && (
                <Badge variant="outline" className="bg-white">
                  <div className={`w-2 h-2 ${currentChainInfo.color} rounded-full mr-2`}></div>
                  {currentChainInfo.name} ({currentChainInfo.symbol})
                </Badge>
              )}
            </div>
          </div>

          {/* Network Switcher */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Available Networks</label>
            <div className="grid grid-cols-1 gap-1 max-h-40 overflow-y-auto">
              {supportedChains.filter(chain => {
                // Show all EVM chains if connected to MetaMask
                if (walletType === 'MetaMask') return chain.type === 'evm';
                // Show only Solana if connected to Phantom
                if (walletType === 'Phantom') return chain.type === 'solana';
                // Show only XRP if connected to XUMM
                if (walletType === 'XUMM') return chain.type === 'xrpl';
                // Show only Bitcoin networks if connected to Bitcoin Wallet
                if (walletType === 'Bitcoin Wallet') return chain.type === 'bitcoin';
                // Show all chains if connected to Other Wallet
                if (walletType === 'Other Wallet') return true;
                return true;
              }).map((chain) => (
                <Button
                  key={chain.id}
                  variant={currentChain === chain.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => switchChain(chain.id)}
                  className="justify-start text-xs h-8"
                >
                  <div className={`w-2 h-2 ${chain.color} rounded-full mr-2`}></div>
                  {chain.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Status Indicator */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm text-green-800 font-medium">Ready for multi-chain transactions</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}