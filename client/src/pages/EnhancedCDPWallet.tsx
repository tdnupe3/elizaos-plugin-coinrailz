import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Zap, 
  Shield, 
  Clock,
  ExternalLink,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

interface SmartAccountDetails {
  address: string;
  ownerAddress: string;
  network: string;
  isDeployed: boolean;
  gasSponsored: boolean;
}

interface SwapQuote {
  fromAsset: string;
  toAsset: string;
  fromAmount: string;
  toAmount: string;
  price: string;
  priceImpact: string;
  gasEstimate: string;
  exchangeRate: string;
}

interface AddressValidation {
  isValid: boolean;
  addressType: 'EOA' | 'Contract' | 'Unknown';
  isInternal: boolean;
  riskLevel: 'Low' | 'Medium' | 'High';
}

/**
 * Enhanced CDP Wallet Interface with Smart Accounts, Gasless Transactions, and Professional Trading
 */
export default function EnhancedCDPWallet() {
  const [selectedNetwork, setSelectedNetwork] = useState('base-mainnet');
  const [smartAccount, setSmartAccount] = useState<SmartAccountDetails | null>(null);
  const [swapForm, setSwapForm] = useState({
    fromAsset: 'USDC',
    toAsset: 'ETH',
    amount: ''
  });
  const [sendForm, setSendForm] = useState({
    toAddress: '',
    amount: '',
    asset: 'USDC'
  });
  const [addressValidation, setAddressValidation] = useState<AddressValidation | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch supported networks
  const { data: networksData } = useQuery({
    queryKey: ['/api/cdp-enhanced/networks'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/cdp-enhanced/networks');
      return response;
    }
  });

  // Create Smart Account mutation
  const createSmartAccountMutation = useMutation({
    mutationFn: async (network: string) => {
      const response = await apiRequest('POST', '/api/cdp-enhanced/smart-account', { network });
      return response;
    },
    onSuccess: (data) => {
      setSmartAccount(data.smartAccount);
      toast({
        title: "Smart Account Created",
        description: `Address: ${data.smartAccount.address.slice(0, 10)}...`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/cdp-enhanced'] });
    },
    onError: (error) => {
      toast({
        title: "Creation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Get swap quote mutation
  const getSwapQuoteMutation = useMutation({
    mutationFn: async (params: { fromAsset: string; toAsset: string; amount: string; network: string }) => {
      const response = await apiRequest('POST', '/api/cdp-enhanced/swap/quote', params);
      return response;
    },
    onSuccess: (data) => {
      toast({
        title: "Quote Generated",
        description: `${data.quote.fromAmount} ${data.quote.fromAsset} → ${data.quote.toAmount} ${data.quote.toAsset}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Quote Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Execute swap mutation
  const executeSwapMutation = useMutation({
    mutationFn: async (params: {
      walletAddress: string;
      fromAsset: string;
      toAsset: string;
      amount: string;
      network: string;
    }) => {
      const response = await apiRequest('POST', '/api/cdp-enhanced/swap/execute', params);
      return response;
    },
    onSuccess: (data) => {
      toast({
        title: "Swap Executed",
        description: `Transaction completed in ${data.executionTime}`,
      });
      // Reset form
      setSwapForm({ fromAsset: 'USDC', toAsset: 'ETH', amount: '' });
      queryClient.invalidateQueries({ queryKey: ['/api/wallets'] });
    },
    onError: (error) => {
      toast({
        title: "Swap Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Validate address mutation
  const validateAddressMutation = useMutation({
    mutationFn: async (params: { address: string; network: string }) => {
      const response = await apiRequest('POST', '/api/cdp-enhanced/validate-address', params);
      return response;
    },
    onSuccess: (data) => {
      setAddressValidation(data.validation);
    },
    onError: () => {
      setAddressValidation(null);
    },
  });

  // Auto-validate address when typing
  useEffect(() => {
    if (sendForm.toAddress.length > 10) {
      const timer = setTimeout(() => {
        validateAddressMutation.mutate({
          address: sendForm.toAddress,
          network: selectedNetwork
        });
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setAddressValidation(null);
    }
  }, [sendForm.toAddress, selectedNetwork]);

  const handleCreateSmartAccount = () => {
    createSmartAccountMutation.mutate(selectedNetwork);
  };

  const handleGetSwapQuote = () => {
    if (!swapForm.fromAsset || !swapForm.toAsset || !swapForm.amount) {
      toast({
        title: "Missing Information",
        description: "Please fill in all swap details",
        variant: "destructive",
      });
      return;
    }

    getSwapQuoteMutation.mutate({
      fromAsset: swapForm.fromAsset,
      toAsset: swapForm.toAsset,
      amount: swapForm.amount,
      network: selectedNetwork
    });
  };

  const handleExecuteSwap = () => {
    if (!smartAccount || !swapForm.fromAsset || !swapForm.toAsset || !swapForm.amount) {
      toast({
        title: "Missing Information",
        description: "Please create a Smart Account and fill in all swap details",
        variant: "destructive",
      });
      return;
    }

    executeSwapMutation.mutate({
      walletAddress: smartAccount.address,
      fromAsset: swapForm.fromAsset,
      toAsset: swapForm.toAsset,
      amount: swapForm.amount,
      network: selectedNetwork
    });
  };

  const getNetworkBadgeColor = (network: string) => {
    if (network.includes('base')) return 'bg-blue-100 text-blue-800';
    if (network.includes('ethereum')) return 'bg-purple-100 text-purple-800';
    if (network.includes('polygon')) return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getRiskBadgeColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'Low': return 'bg-green-100 text-green-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'High': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
          <Wallet className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Enhanced CDP Wallet</h1>
          <p className="text-gray-600">Smart Accounts with Gas Sponsorship & Professional Trading</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Smart Account Creation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              Smart Account Management
            </CardTitle>
            <CardDescription>
              Create gasless accounts with advanced features
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="network-select">Network</Label>
              <select
                id="network-select"
                value={selectedNetwork}
                onChange={(e) => setSelectedNetwork(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {networksData?.networks?.map((networkInfo: any) => (
                  <option key={networkInfo.network} value={networkInfo.network}>
                    {networkInfo.network}
                  </option>
                ))}
              </select>
            </div>

            {smartAccount ? (
              <div className="space-y-3">
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-green-800">Smart Account Active</span>
                  </div>
                  <p className="text-sm text-green-700 font-mono">
                    {smartAccount.address}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Badge className={getNetworkBadgeColor(smartAccount.network)}>
                      {smartAccount.network}
                    </Badge>
                    {smartAccount.gasSponsored && (
                      <Badge className="bg-green-100 text-green-800">
                        <Zap className="w-3 h-3 mr-1" />
                        Gas Sponsored
                      </Badge>
                    )}
                    <Badge variant={smartAccount.isDeployed ? "default" : "secondary"}>
                      {smartAccount.isDeployed ? "Deployed" : "Pending First TX"}
                    </Badge>
                  </div>
                </div>
              </div>
            ) : (
              <Button 
                onClick={handleCreateSmartAccount}
                disabled={createSmartAccountMutation.isPending}
                className="w-full"
              >
                {createSmartAccountMutation.isPending ? 'Creating...' : 'Create Smart Account'}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Professional Swap Interface */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-green-600" />
              Professional Swap (Sub-500ms)
            </CardTitle>
            <CardDescription>
              Lightning-fast swaps with 130+ exchange liquidity
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="from-asset">From Asset</Label>
                <select
                  id="from-asset"
                  value={swapForm.fromAsset}
                  onChange={(e) => setSwapForm(prev => ({ ...prev, fromAsset: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="USDC">USDC</option>
                  <option value="ETH">ETH</option>
                  <option value="WBTC">WBTC</option>
                  <option value="DAI">DAI</option>
                </select>
              </div>
              <div>
                <Label htmlFor="to-asset">To Asset</Label>
                <select
                  id="to-asset"
                  value={swapForm.toAsset}
                  onChange={(e) => setSwapForm(prev => ({ ...prev, toAsset: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ETH">ETH</option>
                  <option value="USDC">USDC</option>
                  <option value="WBTC">WBTC</option>
                  <option value="DAI">DAI</option>
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="swap-amount">Amount</Label>
              <Input
                id="swap-amount"
                type="number"
                value={swapForm.amount}
                onChange={(e) => setSwapForm(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="Enter amount"
              />
            </div>

            {getSwapQuoteMutation.data?.quote && (
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">Best Quote</h4>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>Exchange Rate:</span>
                    <span className="font-mono">{getSwapQuoteMutation.data.quote.exchangeRate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>You'll Receive:</span>
                    <span className="font-mono font-medium">
                      {getSwapQuoteMutation.data.quote.toAmount} {getSwapQuoteMutation.data.quote.toAsset}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Price Impact:</span>
                    <span className="font-mono">{getSwapQuoteMutation.data.quote.priceImpact}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                onClick={handleGetSwapQuote}
                disabled={getSwapQuoteMutation.isPending}
                variant="outline"
                className="flex-1"
              >
                {getSwapQuoteMutation.isPending ? 'Getting Quote...' : 'Get Quote'}
              </Button>
              <Button
                onClick={handleExecuteSwap}
                disabled={executeSwapMutation.isPending || !getSwapQuoteMutation.data}
                className="flex-1"
              >
                {executeSwapMutation.isPending ? 'Swapping...' : 'Execute Swap'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Enhanced Send Interface */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-blue-600" />
              Send to Any Address (Universal Compatibility)
            </CardTitle>
            <CardDescription>
              Send crypto to any wallet, exchange, or DeFi protocol worldwide
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="recipient-address">Recipient Address</Label>
                <Input
                  id="recipient-address"
                  value={sendForm.toAddress}
                  onChange={(e) => setSendForm(prev => ({ ...prev, toAddress: e.target.value }))}
                  placeholder="0x... or ENS domain"
                />
              </div>
              <div>
                <Label htmlFor="send-amount">Amount</Label>
                <Input
                  id="send-amount"
                  type="number"
                  value={sendForm.amount}
                  onChange={(e) => setSendForm(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
            </div>

            {addressValidation && (
              <div className={`p-4 rounded-lg ${
                addressValidation.isValid 
                  ? addressValidation.isInternal 
                    ? 'bg-green-50' 
                    : 'bg-yellow-50'
                  : 'bg-red-50'
              }`}>
                <div className="flex items-start gap-2">
                  {addressValidation.isValid ? (
                    addressValidation.isInternal ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                    )
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-medium ${
                        addressValidation.isValid ? 'text-green-800' : 'text-red-800'
                      }`}>
                        {addressValidation.isValid ? 'Valid Address' : 'Invalid Address'}
                      </span>
                      {addressValidation.isValid && (
                        <Badge className={getRiskBadgeColor(addressValidation.riskLevel)}>
                          {addressValidation.riskLevel} Risk
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm">
                      {addressValidation.isInternal 
                        ? 'This is a Coin Railz user - instant and secure transfer'
                        : addressValidation.isValid
                          ? 'External wallet detected - transaction will be broadcast to blockchain'
                          : 'Please enter a valid blockchain address'
                      }
                    </p>
                    {addressValidation.isValid && (
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-600">
                        <span>Type: {addressValidation.addressType}</span>
                        <span>{addressValidation.isInternal ? 'Internal' : 'External'} Address</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <Button 
              className="w-full md:w-auto"
              disabled={!addressValidation?.isValid || !sendForm.amount}
            >
              Send {sendForm.asset}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Feature Highlights */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Enterprise Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h4 className="font-medium mb-1">Gas Sponsorship</h4>
                <p className="text-sm text-gray-600">
                  Gasless transactions on Base network - users never pay gas fees
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h4 className="font-medium mb-1">Sub-500ms Execution</h4>
                <p className="text-sm text-gray-600">
                  Lightning-fast swaps with 130+ exchange liquidity aggregation
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h4 className="font-medium mb-1">Enterprise Security</h4>
                <p className="text-sm text-gray-600">
                  AWS Nitro Enclaves with hardware-level key isolation
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}