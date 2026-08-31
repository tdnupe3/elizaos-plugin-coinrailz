import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Wallet, 
  Copy, 
  QrCode, 
  DollarSign,
  CheckCircle,
  ArrowRight,
  ArrowLeftRight,
  Plus,
  ExternalLink,
  Info,
  Zap,
  Shield,
  Send
} from "@/lib/icons";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { WalletConnect } from "./wallet-connect";

interface WalletBalance {
  asset: string;
  balance: string;
  usdValue: number;
}

export function EnhancedWalletManager() {
  const { user } = useAuth();
  const { wallet, connectWallet, disconnectWallet } = useWallet();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDirection, setTransferDirection] = useState<'toCircle' | 'toMetaMask'>('toCircle');
  const [showTransferForm, setShowTransferForm] = useState(false);

  // Circle Wallet Data
  const { data: circleWalletStatus } = useQuery({
    queryKey: ['/api/user-circle/wallet/info'],
    enabled: !!user,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 30000,
  });

  const { data: circleBalance } = useQuery({
    queryKey: ['/api/user-circle/balance'],
    enabled: !!user,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 30000,
  });

  // MetaMask Wallet Balances (when connected)
  const { data: web3Balances } = useQuery<{ balances: WalletBalance[] }>({
    queryKey: ['/api/wallets/balances', wallet.address],
    enabled: wallet.isConnected && !!wallet.address,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 30000,
  });

  const circleWalletAddress = (circleWalletStatus as any)?.wallet?.address;
  const circleUsdcBalance = parseFloat((circleBalance as any)?.balance || '0');
  const hasCircleWallet = !!(circleWalletStatus && (circleWalletStatus as any)?.success && circleWalletAddress);

  // Transfer mutation
  const transferMutation = useMutation({
    mutationFn: async (params: { from: string; to: string; amount: string; direction: string }) => {
      return apiRequest(`/api/wallets/transfer`, {
        method: 'POST',
        body: JSON.stringify(params)
      });
    },
    onSuccess: () => {
      toast({
        title: "Transfer Successful!",
        description: `Successfully transferred $${transferAmount} USDC`,
      });
      setShowTransferForm(false);
      setTransferAmount("");
      // Refresh balances
      queryClient.invalidateQueries({ queryKey: ['/api/user-circle/balance'] });
      queryClient.invalidateQueries({ queryKey: ['/api/wallets/balances'] });
    },
    onError: (error: any) => {
      toast({
        title: "Transfer Failed",
        description: error?.message || "Transfer could not be completed",
        variant: "destructive"
      });
    }
  });

  const copyAddress = (address: string, type: string) => {
    navigator.clipboard.writeText(address);
    toast({
      title: "Address Copied!",
      description: `Your ${type} wallet address has been copied to clipboard`,
    });
  };

  const handleTransfer = () => {
    if (!transferAmount || parseFloat(transferAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid transfer amount",
        variant: "destructive"
      });
      return;
    }

    const params = {
      from: transferDirection === 'toCircle' ? wallet.address : circleWalletAddress,
      to: transferDirection === 'toCircle' ? circleWalletAddress : wallet.address,
      amount: transferAmount,
      direction: transferDirection
    };

    transferMutation.mutate(params);
  };

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Your Digital Wallets</h2>
        <p className="text-gray-600">Manage your Circle USDC wallet and Web3 wallets in one place</p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="circle">Circle Wallet</TabsTrigger>
          <TabsTrigger value="web3">Web3 Wallets</TabsTrigger>
          <TabsTrigger value="transfer">Transfer</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Circle Wallet Overview */}
            <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Shield className="w-5 h-5 text-blue-600" />
                  Circle USDC Wallet
                  <Badge variant="outline" className="bg-blue-200 text-blue-800 ml-auto">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Managed
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-gray-900">
                    ${circleUsdcBalance.toFixed(2)} <span className="text-lg text-gray-600">USDC</span>
                  </p>
                  <p className="text-sm text-gray-600 mt-1">Instant settlements • Low fees</p>
                </div>
                
                {hasCircleWallet && (
                  <div className="text-xs text-gray-600 text-center font-mono break-all bg-white/50 p-2 rounded">
                    {circleWalletAddress}
                  </div>
                )}

                <div className="text-center text-sm text-gray-700">
                  <p>✓ Automatic creation</p>
                  <p>✓ Best for P2P transfers</p>
                  <p>✓ Fiat onramp ready</p>
                </div>
              </CardContent>
            </Card>

            {/* Web3 Wallet Overview */}
            <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-orange-100">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Zap className="w-5 h-5 text-orange-600" />
                  Web3 Wallet
                  <Badge variant="outline" className={`ml-auto ${wallet.isConnected ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                    {wallet.isConnected ? 'Connected' : 'Not Connected'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {wallet.isConnected ? (
                  <>
                    <div className="text-center">
                      <p className="text-sm text-gray-600">Connected Wallet</p>
                      <p className="font-semibold text-gray-900">{wallet.walletType}</p>
                      <div className="text-xs text-gray-600 font-mono break-all bg-white/50 p-2 rounded mt-2">
                        {wallet.address}
                      </div>
                    </div>
                    
                    <div className="text-center text-sm text-gray-700">
                      <p>✓ Multi-chain access</p>
                      <p>✓ Best for DEX trading</p>
                      <p>✓ Full Web3 ecosystem</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-center">
                      <p className="text-gray-600 mb-4">Connect your Web3 wallet for multi-chain trading</p>
                      <Button
                        onClick={() => connectWallet('MetaMask')}
                        className="w-full bg-orange-600 hover:bg-orange-700"
                      >
                        <Wallet className="w-4 h-4 mr-2" />
                        Connect MetaMask
                      </Button>
                    </div>
                    
                    <div className="text-center text-sm text-gray-700">
                      <p>• MetaMask • Coinbase • Trust</p>
                      <p>• WalletConnect • Phantom</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          {hasCircleWallet && wallet.isConnected && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowTransferForm(true)}
                    className="w-full"
                  >
                    <ArrowLeftRight className="w-4 h-4 mr-2" />
                    Transfer Between Wallets
                  </Button>
                  <Button variant="outline" className="w-full">
                    <Send className="w-4 h-4 mr-2" />
                    Send Money
                  </Button>
                  <Button variant="outline" className="w-full">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Trade on DEX
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Circle Wallet Tab */}
        <TabsContent value="circle" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" />
                Circle USDC Wallet
                <Badge variant="outline" className="bg-blue-100 text-blue-800 ml-auto">
                  Managed Wallet
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {!hasCircleWallet ? (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Setting up your Circle USDC wallet... This usually takes a few seconds.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  {/* Balance Display */}
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg">
                    <div className="text-center">
                      <p className="text-sm text-gray-600 mb-2">USDC Balance</p>
                      <p className="text-4xl font-bold text-gray-900">
                        ${circleUsdcBalance.toFixed(2)}
                      </p>
                      <p className="text-sm text-gray-500 mt-2">
                        Multi-chain USDC (Ethereum, Polygon, Base, Arbitrum, BNB, Avalanche)
                      </p>
                    </div>
                  </div>

                  {/* Wallet Address */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Wallet Address</label>
                    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                      <code className="flex-1 text-sm font-mono text-gray-800 break-all">
                        {circleWalletAddress}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyAddress(circleWalletAddress, 'Circle')}
                        className="flex-shrink-0"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Features */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-green-50 rounded-lg">
                      <h4 className="font-semibold text-green-800 mb-2">✓ Instant Settlements</h4>
                      <p className="text-sm text-green-700">USDC transfers settle in 2-5 seconds</p>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-semibold text-blue-800 mb-2">✓ Low Fees</h4>
                      <p className="text-sm text-blue-700">Ultra-competitive rates for P2P transfers</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <h4 className="font-semibold text-purple-800 mb-2">✓ Fiat Ready</h4>
                      <p className="text-sm text-purple-700">Easy bank deposits and withdrawals</p>
                    </div>
                    <div className="p-4 bg-orange-50 rounded-lg">
                      <h4 className="font-semibold text-orange-800 mb-2">✓ Secure</h4>
                      <p className="text-sm text-orange-700">Circle's enterprise-grade security</p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-3 gap-3">
                    <Button className="w-full bg-blue-600 hover:bg-blue-700">
                      <DollarSign className="w-4 h-4 mr-2" />
                      Add Funds
                    </Button>
                    <Button variant="outline" className="w-full" asChild>
                      <Link href="/p2p-transfer">
                        <Send className="w-4 h-4 mr-2" />
                        Send USDC
                      </Link>
                    </Button>
                    <Button variant="outline" className="w-full" asChild>
                      <Link href="/usdc-off-ramp">
                        <ArrowRight className="w-4 h-4 mr-2" />
                        Cash Out
                      </Link>
                    </Button>
                  </div>

                  {/* Deposit Instructions */}
                  {circleUsdcBalance === 0 && (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Ready to get started?</strong><br />
                        Send USDC from Coinbase, another exchange, or bank account to your wallet address above. 
                        Deposits are instant and you can start sending money immediately.
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Web3 Wallets Tab */}
        <TabsContent value="web3" className="space-y-6">
          {!wallet.isConnected ? (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-orange-600" />
                    Connect Web3 Wallet
                  </CardTitle>
                  <p className="text-gray-600">
                    Connect your Web3 wallet for multi-chain DEX trading and DeFi access
                  </p>
                </CardHeader>
                <CardContent>
                  <WalletConnect />
                </CardContent>
              </Card>

              {/* Benefits */}
              <Card>
                <CardHeader>
                  <CardTitle>Why Connect a Web3 Wallet?</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-orange-50 rounded-lg">
                      <h4 className="font-semibold text-orange-800 mb-2">🔄 DEX Trading</h4>
                      <p className="text-sm text-orange-700">Access 50+ decentralized exchanges</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <h4 className="font-semibold text-purple-800 mb-2">⛓️ Multi-Chain</h4>
                      <p className="text-sm text-purple-700">Trade on 15+ blockchain networks</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <h4 className="font-semibold text-green-800 mb-2">🏦 DeFi Access</h4>
                      <p className="text-sm text-green-700">Lending, borrowing, yield farming</p>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-semibold text-blue-800 mb-2">🔄 Easy Transfers</h4>
                      <p className="text-sm text-blue-700">Move USDC between wallets seamlessly</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-orange-600" />
                  {wallet.walletType} Wallet
                  <Badge variant="outline" className="bg-green-100 text-green-800 ml-auto">
                    Connected
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Wallet Info */}
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-700 mb-2">Wallet Address</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-sm font-mono text-gray-800 break-all">
                        {wallet.address}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyAddress(wallet.address, wallet.walletType)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Balances */}
                  {web3Balances && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-gray-700">Asset Balances</h4>
                      <div className="space-y-2">
                        {((web3Balances as any)?.balances || []).map((balance: WalletBalance) => (
                          <div key={balance.asset} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                            <div>
                              <p className="font-medium">{balance.asset}</p>
                              <p className="text-sm text-gray-600">${balance.usdValue.toFixed(2)}</p>
                            </div>
                            <p className="font-mono text-sm">{parseFloat(balance.balance).toFixed(6)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-3">
                  <Button className="w-full bg-orange-600 hover:bg-orange-700">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Trade on DEX
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={disconnectWallet}
                  >
                    Disconnect
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Transfer Tab */}
        <TabsContent value="transfer" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowLeftRight className="w-5 h-5 text-blue-600" />
                Transfer Between Wallets
              </CardTitle>
              <p className="text-gray-600">
                Move USDC between your Circle wallet and Web3 wallet
              </p>
            </CardHeader>
            <CardContent>
              {!hasCircleWallet || !wallet.isConnected ? (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    You need both wallets connected to transfer funds. 
                    {!hasCircleWallet && " Your Circle wallet is being set up."}
                    {!wallet.isConnected && " Please connect your Web3 wallet."}
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-6">
                  {/* Transfer Direction */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-700">Transfer Direction</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <Button
                        variant={transferDirection === 'toCircle' ? 'default' : 'outline'}
                        onClick={() => setTransferDirection('toCircle')}
                        className="w-full justify-start"
                      >
                        <ArrowRight className="w-4 h-4 mr-2" />
                        Web3 → Circle Wallet
                      </Button>
                      <Button
                        variant={transferDirection === 'toMetaMask' ? 'default' : 'outline'}
                        onClick={() => setTransferDirection('toMetaMask')}
                        className="w-full justify-start"
                      >
                        <ArrowRight className="w-4 h-4 mr-2" />
                        Circle → Web3 Wallet
                      </Button>
                    </div>
                  </div>

                  {/* Amount Input */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Amount (USDC)</label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                    />
                    <p className="text-xs text-gray-500">
                      Available: ${transferDirection === 'toCircle' ? '0.00' : circleUsdcBalance.toFixed(2)} USDC
                    </p>
                  </div>

                  {/* Transfer Summary */}
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Transfer Summary</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>From:</span>
                        <span className="font-mono text-xs">
                          {transferDirection === 'toCircle' 
                            ? `${wallet.address.slice(0, 8)}...${wallet.address.slice(-6)}`
                            : `${circleWalletAddress.slice(0, 8)}...${circleWalletAddress.slice(-6)}`
                          }
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>To:</span>
                        <span className="font-mono text-xs">
                          {transferDirection === 'toCircle' 
                            ? `${circleWalletAddress.slice(0, 8)}...${circleWalletAddress.slice(-6)}`
                            : `${wallet.address.slice(0, 8)}...${wallet.address.slice(-6)}`
                          }
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Amount:</span>
                        <span>${transferAmount || '0.00'} USDC</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Network Fee:</span>
                        <span>~$0.50 - $2.00</span>
                      </div>
                    </div>
                  </div>

                  {/* Transfer Button */}
                  <Button
                    onClick={handleTransfer}
                    disabled={!transferAmount || transferMutation.isPending}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {transferMutation.isPending ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Processing Transfer...
                      </>
                    ) : (
                      <>
                        <ArrowLeftRight className="w-4 h-4 mr-2" />
                        Transfer USDC
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}