import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'wouter';
import { NavigationHeader } from '@/components/navigation-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wallet, Shield, Zap, ArrowUpRight, ArrowDownLeft, Plus } from 'lucide-react';
import CoinbaseDefiWallet from '@/components/CoinbaseDefiWallet';

export default function WalletPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = '/api/login';
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <NavigationHeader />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            My Wallet
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Manage all your crypto assets in one place
          </p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="usdc">USDC Wallet</TabsTrigger>
            <TabsTrigger value="coinbase">Coinbase Wallet</TabsTrigger>
            <TabsTrigger value="connect">Coinbase DeFi</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* USDC Wallet Card */}
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">USDC Wallet</CardTitle>
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <Wallet className="w-4 h-4 text-blue-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">$0.00</div>
                  <p className="text-xs text-muted-foreground">
                    For P2P payments and instant transfers
                  </p>
                  <div className="flex space-x-2 mt-4">
                    <Button size="sm" onClick={() => setLocation('/send')}>
                      <ArrowUpRight className="w-4 h-4 mr-1" />
                      Send
                    </Button>
                    <Button size="sm" variant="outline">
                      <ArrowDownLeft className="w-4 h-4 mr-1" />
                      Receive
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Coinbase Wallet Card */}
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Coinbase Wallet</CardTitle>
                  <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                    <Shield className="w-4 h-4 text-orange-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">$0.00</div>
                  <p className="text-xs text-muted-foreground">
                    Enterprise-grade crypto infrastructure
                  </p>
                  <div className="flex space-x-2 mt-4">
                    <Button size="sm" onClick={() => setLocation('/cdp-wallet')}>
                      <Plus className="w-4 h-4 mr-1" />
                      Create
                    </Button>
                    <Button size="sm" variant="outline">
                      Manage
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* DeFi Connection Card */}
              <Card className="hover:shadow-lg transition-shadow border-dashed">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">DeFi Wallet</CardTitle>
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <Zap className="w-4 h-4 text-green-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-muted-foreground">Not Connected</div>
                  <p className="text-xs text-muted-foreground">
                    Connect MetaMask or other DeFi wallets
                  </p>
                  <div className="flex space-x-2 mt-4">
                    <Button size="sm" variant="outline" className="border-dashed">
                      <Plus className="w-4 h-4 mr-1" />
                      Connect
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Wallet Explanation */}
            <Card>
              <CardHeader>
                <CardTitle>Understanding Your Wallets</CardTitle>
                <CardDescription>
                  Different wallet types serve different purposes on Coin Railz
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mt-1">
                    <Wallet className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold">USDC Wallet</h4>
                    <p className="text-sm text-muted-foreground">
                      Perfect for everyday payments, P2P transfers, and AI marketplace purchases. 
                      Uses stable USDC cryptocurrency for reliable transactions.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center mt-1">
                    <Shield className="w-4 h-4 text-orange-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Coinbase Wallet</h4>
                    <p className="text-sm text-muted-foreground">
                      Enterprise-grade security for managing multiple cryptocurrencies across different networks. 
                      Ideal for serious crypto operations and multi-chain activities.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mt-1">
                    <Zap className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold">Coinbase DeFi Wallet</h4>
                    <p className="text-sm text-muted-foreground">
                      Connect your Coinbase self-custody wallet for advanced DeFi features, 
                      native swapping, staking, and cross-chain bridging with premium security.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="usdc">
            <Card>
              <CardHeader>
                <CardTitle>USDC Wallet</CardTitle>
                <CardDescription>Manage your USDC for payments and transfers</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">USDC wallet functionality will be displayed here.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="coinbase">
            <Card>
              <CardHeader>
                <CardTitle>Coinbase Wallet</CardTitle>
                <CardDescription>Enterprise crypto wallet management</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setLocation('/cdp-wallet')}>
                  Access Coinbase Wallet
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="connect">
            <CoinbaseDefiWallet />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}