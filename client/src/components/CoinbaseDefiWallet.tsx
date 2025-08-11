/**
 * Coinbase DeFi Wallet Component
 * Premium self-custody wallet integration with advanced DeFi features
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { 
  Wallet, 
  Shield, 
  Zap, 
  CheckCircle, 
  ExternalLink, 
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  AlertTriangle,
  Coins,
  TrendingUp
} from 'lucide-react';

interface CoinbaseDefiWallet {
  id: string;
  address: string;
  walletType: 'coinbase-defi' | 'coinbase-smart';
  network: string;
  balance: number;
  currency: string;
  connected_at: string;
  is_active: boolean;
  features: {
    canSwap: boolean;
    canStake: boolean;
    canBridge: boolean;
    hasAdvancedSecurity: boolean;
  };
}

interface SupportedNetwork {
  chainId: number;
  name: string;
  currency: string;
  explorerUrl: string;
  isTestnet: boolean;
}

export default function CoinbaseDefiWallet() {
  const [connectedWallets, setConnectedWallets] = useState<CoinbaseDefiWallet[]>([]);
  const [supportedNetworks, setSupportedNetworks] = useState<SupportedNetwork[]>([]);
  const [selectedNetwork, setSelectedNetwork] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletBalance, setWalletBalance] = useState<any>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [connectionStep, setConnectionStep] = useState<'select' | 'connect' | 'sign' | 'success'>('select');
  const [walletDetected, setWalletDetected] = useState(false);
  
  const { toast } = useToast();

  // Check for Coinbase Wallet on component mount
  useEffect(() => {
    checkCoinbaseWallet();
    loadSupportedNetworks();
  }, []);

  const checkCoinbaseWallet = () => {
    // Check if Coinbase Wallet is available
    const hasCoinbaseWallet = typeof window !== 'undefined' && 
      (window as any).ethereum?.isCoinbaseWallet;
    
    setWalletDetected(hasCoinbaseWallet);
    
    if (!hasCoinbaseWallet) {
      console.log('Coinbase Wallet not detected');
    }
  };

  const loadSupportedNetworks = async () => {
    try {
      const response = await apiRequest('GET', '/api/defi/networks');
      if (response.success) {
        setSupportedNetworks(response.networks);
        // Default to Ethereum mainnet
        const ethereum = response.networks.find((n: SupportedNetwork) => n.chainId === 1);
        if (ethereum) {
          setSelectedNetwork(ethereum.chainId);
        }
      }
    } catch (error) {
      console.error('Failed to load supported networks:', error);
      toast({
        title: "Network Load Failed",
        description: "Could not load supported networks",
        variant: "destructive",
      });
    }
  };

  const connectCoinbaseWallet = async () => {
    if (!walletDetected) {
      toast({
        title: "Coinbase Wallet Not Found",
        description: "Please install Coinbase Wallet browser extension or mobile app",
        variant: "destructive",
      });
      return;
    }

    if (!selectedNetwork) {
      toast({
        title: "Network Required",
        description: "Please select a network to connect",
        variant: "destructive",
      });
      return;
    }

    setIsConnecting(true);
    setConnectionStep('connect');

    try {
      const ethereum = (window as any).ethereum;
      
      // Request account access
      const accounts = await ethereum.request({
        method: 'eth_requestAccounts'
      });

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const address = accounts[0];
      setConnectionStep('sign');

      // Generate connection message
      const messageResponse = await apiRequest('POST', '/api/defi/wallet/generate-message', {
        address
      });

      if (!messageResponse.success) {
        throw new Error('Failed to generate connection message');
      }

      // Request signature
      const signature = await ethereum.request({
        method: 'personal_sign',
        params: [messageResponse.message, address]
      });

      // Connect wallet to platform
      const connectResponse = await apiRequest('POST', '/api/defi/wallet/connect', {
        address,
        chainId: selectedNetwork,
        walletType: 'coinbase-defi',
        signature,
        message: messageResponse.message
      });

      if (connectResponse.success) {
        setConnectedWallets(prev => [...prev, connectResponse.wallet]);
        setConnectionStep('success');
        
        toast({
          title: "Coinbase Wallet Connected",
          description: `Successfully connected ${address.slice(0, 6)}...${address.slice(-4)}`,
        });

        // Load wallet balance
        loadWalletBalance(address, selectedNetwork);
      } else {
        throw new Error(connectResponse.error || 'Connection failed');
      }

    } catch (error: any) {
      console.error('Coinbase wallet connection failed:', error);
      setConnectionStep('select');
      
      toast({
        title: "Connection Failed",
        description: error.message || 'Failed to connect Coinbase wallet',
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const loadWalletBalance = async (address: string, chainId: number) => {
    setIsLoadingBalance(true);
    try {
      const response = await apiRequest('GET', `/api/defi/wallet/${address}/balance?chainId=${chainId}`);
      if (response.success) {
        setWalletBalance(response.balance);
      }
    } catch (error) {
      console.error('Failed to load wallet balance:', error);
    } finally {
      setIsLoadingBalance(false);
    }
  };

  const openCoinbaseWalletDownload = () => {
    window.open('https://www.coinbase.com/wallet', '_blank');
  };

  const getNetworkName = (chainId: number) => {
    const network = supportedNetworks.find(n => n.chainId === chainId);
    return network?.name || 'Unknown Network';
  };

  const getWalletTypeLabel = (walletType: string) => {
    switch (walletType) {
      case 'coinbase-smart':
        return 'Smart Account';
      case 'coinbase-defi':
        return 'DeFi Wallet';
      default:
        return 'Coinbase Wallet';
    }
  };

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      {!walletDetected && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Coinbase Wallet not detected. Install to continue.</span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={openCoinbaseWalletDownload}
              className="ml-2"
            >
              <ExternalLink className="w-4 h-4 mr-1" />
              Install Coinbase Wallet
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Network Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Connect Coinbase Wallet
          </CardTitle>
          <CardDescription>
            Connect your Coinbase self-custody wallet for advanced DeFi features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Select Network</label>
            <Select
              value={selectedNetwork?.toString() || ''}
              onValueChange={(value) => setSelectedNetwork(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a network" />
              </SelectTrigger>
              <SelectContent>
                {supportedNetworks
                  .filter(network => !network.isTestnet)
                  .map((network) => (
                    <SelectItem key={network.chainId} value={network.chainId.toString()}>
                      <div className="flex items-center gap-2">
                        <span>{network.name}</span>
                        <Badge variant="secondary">{network.currency}</Badge>
                      </div>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <Button 
            onClick={connectCoinbaseWallet}
            disabled={!walletDetected || !selectedNetwork || isConnecting}
            className="w-full"
          >
            {isConnecting ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Wallet className="w-4 h-4 mr-2" />
            )}
            {connectionStep === 'connect' && 'Connecting...'}
            {connectionStep === 'sign' && 'Please Sign Message...'}
            {connectionStep === 'success' && 'Connected!'}
            {connectionStep === 'select' && 'Connect Coinbase Wallet'}
          </Button>
        </CardContent>
      </Card>

      {/* Connected Wallets */}
      {connectedWallets.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Connected Wallets</h3>
          {connectedWallets.map((wallet) => (
            <Card key={wallet.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-green-600" />
                    <span>{getWalletTypeLabel(wallet.walletType)}</span>
                    <Badge variant="outline">{wallet.network}</Badge>
                  </div>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </CardTitle>
                <CardDescription>
                  {wallet.address.slice(0, 8)}...{wallet.address.slice(-6)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-600">Balance</label>
                    <div className="flex items-center gap-2">
                      {isLoadingBalance ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Coins className="w-4 h-4" />
                          <span className="font-mono">
                            {walletBalance?.balance || '0.0'} {wallet.currency}
                          </span>
                        </>
                      )}
                    </div>
                    {walletBalance?.usdValue && (
                      <p className="text-sm text-gray-500">${walletBalance.usdValue} USD</p>
                    )}
                  </div>
                  
                  <div>
                    <label className="text-sm text-gray-600">Features</label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {wallet.features.canSwap && (
                        <Badge variant="secondary" className="text-xs">
                          <ArrowUpRight className="w-3 h-3 mr-1" />
                          Swap
                        </Badge>
                      )}
                      {wallet.features.canStake && (
                        <Badge variant="secondary" className="text-xs">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Stake
                        </Badge>
                      )}
                      {wallet.features.canBridge && (
                        <Badge variant="secondary" className="text-xs">Bridge</Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <Button size="sm" variant="outline">
                    <ArrowUpRight className="w-4 h-4 mr-1" />
                    Send
                  </Button>
                  <Button size="sm" variant="outline">
                    <ArrowDownLeft className="w-4 h-4 mr-1" />
                    Receive
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => loadWalletBalance(wallet.address, selectedNetwork!)}
                  >
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Refresh
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Features Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Coinbase Wallet Features</CardTitle>
          <CardDescription>
            Advanced DeFi capabilities available with your connected wallet
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-blue-600 mt-1" />
              <div>
                <h4 className="font-medium">Self-Custody Security</h4>
                <p className="text-sm text-gray-600">
                  Full control of your private keys with enterprise-grade security
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Zap className="w-5 h-5 text-green-600 mt-1" />
              <div>
                <h4 className="font-medium">Native DeFi Integration</h4>
                <p className="text-sm text-gray-600">
                  Direct access to Uniswap, Compound, Aave, and other protocols
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-purple-600 mt-1" />
              <div>
                <h4 className="font-medium">Advanced Trading</h4>
                <p className="text-sm text-gray-600">
                  Professional trading tools with MEV protection
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Coins className="w-5 h-5 text-orange-600 mt-1" />
              <div>
                <h4 className="font-medium">Multi-Chain Support</h4>
                <p className="text-sm text-gray-600">
                  Ethereum, Base, Polygon, Arbitrum, and BNB Chain
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}