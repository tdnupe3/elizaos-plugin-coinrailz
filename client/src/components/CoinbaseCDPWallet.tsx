/**
 * Coinbase CDP (Developer Platform) Wallet Component
 * Provides enterprise-grade wallet creation, balance monitoring, and transactions
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Wallet, ArrowUpRight, ArrowDownLeft, RefreshCw, Plus, ExternalLink } from 'lucide-react';

interface CDPWallet {
  id: string;
  address: string;
  network: string;
  status: string;
  created_at: string;
}

interface CDPTransaction {
  id: string;
  type: 'send' | 'receive';
  amount: string;
  currency: string;
  to_address?: string;
  from_address?: string;
  status: 'pending' | 'completed' | 'failed';
  transaction_hash?: string;
  created_at: string;
}

interface WalletBalances {
  [currency: string]: number;
}

export default function CoinbaseCDPWallet() {
  const [wallets, setWallets] = useState<CDPWallet[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<CDPWallet | null>(null);
  const [balances, setBalances] = useState<WalletBalances>({});
  const [transactions, setTransactions] = useState<CDPTransaction[]>([]);
  const [networks, setNetworks] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState('base-mainnet');
  
  // Send transaction state
  const [showSendForm, setShowSendForm] = useState(false);
  const [sendAmount, setSendAmount] = useState('');
  const [sendAddress, setSendAddress] = useState('');
  const [sendCurrency, setSendCurrency] = useState('ETH');
  const [isSending, setIsSending] = useState(false);

  // OAuth state
  const [showOAuth, setShowOAuth] = useState(false);
  const [isConnectingOAuth, setIsConnectingOAuth] = useState(false);

  const { toast } = useToast();

  // Load supported networks on component mount
  useEffect(() => {
    loadNetworks();
  }, []);

  const loadNetworks = async () => {
    try {
      const response = await apiRequest('GET', '/api/cdp/networks');
      if (response.success) {
        setNetworks(response.networks);
      }
    } catch (error) {
      console.error('Failed to load networks:', error);
    }
  };

  const createWallet = async () => {
    setIsCreatingWallet(true);
    try {
      const response = await apiRequest('POST', '/api/cdp/wallet/create', {
        network: selectedNetwork
      });

      if (response.success) {
        const newWallet = response.wallet;
        setWallets(prev => [...prev, newWallet]);
        setSelectedWallet(newWallet);
        
        toast({
          title: "CDP Wallet Created",
          description: `Successfully created wallet on ${selectedNetwork}`,
        });
      } else {
        throw new Error(response.error || 'Failed to create wallet');
      }
    } catch (error) {
      console.error('Wallet creation error:', error);
      toast({
        title: "Wallet Creation Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive",
      });
    } finally {
      setIsCreatingWallet(false);
    }
  };

  const loadWalletBalances = async (walletId: string) => {
    setIsLoading(true);
    try {
      const response = await apiRequest('GET', `/api/cdp/wallet/${walletId}/balances`);
      if (response.success) {
        setBalances(response.balances);
      } else {
        throw new Error('Failed to load balances');
      }
    } catch (error) {
      console.error('Balance loading error:', error);
      toast({
        title: "Balance Load Failed",
        description: "Could not retrieve wallet balances",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadTransactionHistory = async (walletId: string) => {
    try {
      const response = await apiRequest('GET', `/api/cdp/wallet/${walletId}/transactions`);
      if (response.success) {
        setTransactions(response.transactions);
      }
    } catch (error) {
      console.error('Transaction history error:', error);
    }
  };

  const sendTransaction = async () => {
    if (!selectedWallet || !sendAmount || !sendAddress) return;

    setIsSending(true);
    try {
      const response = await apiRequest('POST', `/api/cdp/wallet/${selectedWallet.id}/send`, {
        toAddress: sendAddress,
        amount: sendAmount,
        currency: sendCurrency
      });

      if (response.success) {
        toast({
          title: "Transaction Sent",
          description: `Successfully sent ${sendAmount} ${sendCurrency}`,
        });
        
        // Reset form and reload data
        setSendAmount('');
        setSendAddress('');
        setShowSendForm(false);
        
        // Refresh balances and transactions
        await loadWalletBalances(selectedWallet.id);
        await loadTransactionHistory(selectedWallet.id);
      } else {
        throw new Error(response.error || 'Failed to send transaction');
      }
    } catch (error) {
      console.error('Send transaction error:', error);
      toast({
        title: "Transaction Failed",
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const connectCoinbaseOAuth = async () => {
    setIsConnectingOAuth(true);
    try {
      const response = await apiRequest('GET', '/api/cdp/oauth/authorize');
      if (response.success && response.authorization_url) {
        // Open OAuth URL in new window
        window.open(response.authorization_url, 'coinbase-oauth', 'width=600,height=700');
        
        toast({
          title: "OAuth Started",
          description: "Complete the authorization in the popup window",
        });
      } else {
        throw new Error('Failed to get authorization URL');
      }
    } catch (error) {
      console.error('OAuth error:', error);
      toast({
        title: "OAuth Failed",
        description: "Could not start Coinbase authorization",
        variant: "destructive",
      });
    } finally {
      setIsConnectingOAuth(false);
    }
  };

  // Load wallet data when selected wallet changes
  useEffect(() => {
    if (selectedWallet) {
      loadWalletBalances(selectedWallet.id);
      loadTransactionHistory(selectedWallet.id);
    }
  }, [selectedWallet]);

  const formatBalance = (balance: number, currency: string) => {
    return `${balance.toFixed(8)} ${currency}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Coinbase Developer Platform (CDP)
          </CardTitle>
          <CardDescription>
            Enterprise-grade wallet management with multi-network support
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Wallet Creation */}
          <div className="flex items-center gap-4">
            <Select value={selectedNetwork} onValueChange={setSelectedNetwork}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select network" />
              </SelectTrigger>
              <SelectContent>
                {networks.map((network) => (
                  <SelectItem key={network} value={network}>
                    {network}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button 
              onClick={createWallet} 
              disabled={isCreatingWallet}
              className="flex items-center gap-2"
            >
              {isCreatingWallet ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Create Wallet
            </Button>

            <Button 
              variant="outline" 
              onClick={connectCoinbaseOAuth}
              disabled={isConnectingOAuth}
              className="flex items-center gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Connect Coinbase
            </Button>
          </div>

          {/* Wallet Selection */}
          {wallets.length > 0 && (
            <div className="space-y-2">
              <Label>Select Wallet</Label>
              <Select 
                value={selectedWallet?.id || ''} 
                onValueChange={(value) => {
                  const wallet = wallets.find(w => w.id === value);
                  setSelectedWallet(wallet || null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a wallet" />
                </SelectTrigger>
                <SelectContent>
                  {wallets.map((wallet) => (
                    <SelectItem key={wallet.id} value={wallet.id}>
                      {wallet.address.slice(0, 8)}...{wallet.address.slice(-6)} ({wallet.network})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Wallet Details */}
          {selectedWallet && (
            <Card className="bg-gray-50">
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label>Address</Label>
                    <p className="font-mono">{selectedWallet.address}</p>
                  </div>
                  <div>
                    <Label>Network</Label>
                    <p>{selectedWallet.network}</p>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Badge variant="outline">{selectedWallet.status}</Badge>
                  </div>
                  <div>
                    <Label>Created</Label>
                    <p>{new Date(selectedWallet.created_at).toLocaleDateString()}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-4">
                  <Button 
                    size="sm" 
                    onClick={() => setShowSendForm(!showSendForm)}
                    className="flex items-center gap-2"
                  >
                    <ArrowUpRight className="h-4 w-4" />
                    Send
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => loadWalletBalances(selectedWallet.id)}
                    disabled={isLoading}
                    className="flex items-center gap-2"
                  >
                    {isLoading ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Refresh
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Send Transaction Form */}
          {showSendForm && selectedWallet && (
            <Card className="border-blue-200">
              <CardHeader>
                <CardTitle className="text-lg">Send Transaction</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="amount">Amount</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.00000001"
                      placeholder="0.0"
                      value={sendAmount}
                      onChange={(e) => setSendAmount(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="currency">Currency</Label>
                    <Select value={sendCurrency} onValueChange={setSendCurrency}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ETH">ETH</SelectItem>
                        <SelectItem value="USDC">USDC</SelectItem>
                        <SelectItem value="WBTC">WBTC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="address">Recipient Address</Label>
                  <Input
                    id="address"
                    placeholder="0x..."
                    value={sendAddress}
                    onChange={(e) => setSendAddress(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={sendTransaction}
                    disabled={isSending || !sendAmount || !sendAddress}
                    className="flex items-center gap-2"
                  >
                    {isSending && <RefreshCw className="h-4 w-4 animate-spin" />}
                    Send Transaction
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowSendForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Balances */}
          {selectedWallet && Object.keys(balances).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Balances</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(balances).map(([currency, balance]) => (
                    <div key={currency} className="flex justify-between items-center">
                      <span className="font-medium">{currency}</span>
                      <span className="font-mono">{formatBalance(balance, currency)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Transaction History */}
          {selectedWallet && transactions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {transactions.slice(0, 5).map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex items-center gap-3">
                        {tx.type === 'send' ? (
                          <ArrowUpRight className="h-4 w-4 text-red-500" />
                        ) : (
                          <ArrowDownLeft className="h-4 w-4 text-green-500" />
                        )}
                        <div>
                          <p className="font-medium">
                            {tx.type === 'send' ? 'Sent' : 'Received'} {tx.amount} {tx.currency}
                          </p>
                          <p className="text-sm text-gray-500">
                            {new Date(tx.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <Badge className={getStatusColor(tx.status)}>
                        {tx.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}