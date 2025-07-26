import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, CheckCircle2, DollarSign, Shield, Clock, TrendingUp } from '@/lib/minimal-icons-clean';

interface BankAccount {
  id: string;
  name: string;
  bank: string;
  accountType: string;
  balance: number;
  connected: boolean;
}

export default function BankConnectivity() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectedAccounts, setConnectedAccounts] = useState<BankAccount[]>([]);
  const [transferAmount, setTransferAmount] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<string>('');

  const handleConnectPNC = async () => {
    setIsConnecting(true);
    
    try {
      // Create Plaid Link Token
      const response = await fetch('/api/plaid/link/create-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken') || 'demo-token'}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Plaid Link Token created:', data);
        
        // Simulate successful PNC account connection
        const mockPNCAccount: BankAccount = {
          id: 'pnc_' + Date.now(),
          name: 'PNC Business Checking ****7892',
          bank: 'PNC Bank',
          accountType: 'Checking',
          balance: 25750.00,
          connected: true
        };
        
        setConnectedAccounts([mockPNCAccount]);
      }
    } catch (error) {
      console.error('PNC connection error:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDeposit = async () => {
    if (!selectedAccount || !transferAmount) return;
    
    try {
      const response = await fetch('/api/plaid/transfer/deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken') || 'demo-token'}`
        },
        body: JSON.stringify({
          accessToken: 'demo-access-token',
          accountId: selectedAccount,
          amount: parseFloat(transferAmount),
          description: 'Coin Railz platform deposit'
        })
      });

      if (response.ok) {
        console.log('Deposit initiated successfully');
        setTransferAmount('');
      }
    } catch (error) {
      console.error('Deposit error:', error);
    }
  };

  const handleWithdrawal = async () => {
    if (!selectedAccount || !transferAmount) return;
    
    try {
      const response = await fetch('/api/plaid/transfer/withdrawal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken') || 'demo-token'}`
        },
        body: JSON.stringify({
          accessToken: 'demo-access-token',
          accountId: selectedAccount,
          amount: parseFloat(transferAmount),
          description: 'Coin Railz platform withdrawal'
        })
      });

      if (response.ok) {
        console.log('Withdrawal initiated successfully');
        setTransferAmount('');
      }
    } catch (error) {
      console.error('Withdrawal error:', error);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Bank Connectivity</h1>
        <p className="text-gray-600">Connect your PNC business accounts to enable USD transfers</p>
      </div>

      {/* Platform Benefits */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <DollarSign className="h-4 w-4 text-green-600" />
            <CardTitle className="text-sm font-medium ml-2">Ultra-Low Fees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">0.25%</div>
            <p className="text-xs text-gray-500">vs 2.9% credit card fees</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <Clock className="h-4 w-4 text-blue-600" />
            <CardTitle className="text-sm font-medium ml-2">Fast Settlement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">1-3 Days</div>
            <p className="text-xs text-gray-500">ACH transfer timing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center space-y-0 pb-2">
            <TrendingUp className="h-4 w-4 text-purple-600" />
            <CardTitle className="text-sm font-medium ml-2">Higher Limits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">$25K+</div>
            <p className="text-xs text-gray-500">daily transfer limits</p>
          </CardContent>
        </Card>
      </div>

      {/* Account Connection */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="h-5 w-5 mr-2 text-blue-600" />
            Connect Your PNC Business Account
          </CardTitle>
          <CardDescription>
            Securely link your existing PNC business accounts for platform funding and withdrawals
          </CardDescription>
        </CardHeader>
        <CardContent>
          {connectedAccounts.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Bank Accounts Connected</h3>
              <p className="text-gray-600 mb-6">Connect your PNC business account to enable USD transfers</p>
              <Button 
                onClick={handleConnectPNC}
                disabled={isConnecting}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {isConnecting ? 'Connecting...' : 'Connect PNC Account'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center text-green-600">
                <CheckCircle2 className="h-5 w-5 mr-2" />
                <span className="font-medium">PNC Account Connected Successfully</span>
              </div>
              
              {connectedAccounts.map((account) => (
                <Card key={account.id} className="border-green-200">
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-medium">{account.name}</h4>
                        <p className="text-sm text-gray-600">{account.bank} • {account.accountType}</p>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">${account.balance.toLocaleString()}</div>
                        <Badge variant="secondary" className="text-green-600 bg-green-50">
                          Connected
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transfer Interface */}
      {connectedAccounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Platform Fund Management</CardTitle>
            <CardDescription>
              Manage funds between your PNC account and Coin Railz platform
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Select Account</label>
              <select 
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="w-full p-2 border rounded-md"
              >
                <option value="">Choose account...</option>
                {connectedAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} - ${account.balance.toLocaleString()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Transfer Amount</label>
              <Input
                type="number"
                placeholder="Enter amount..."
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                min="25"
                step="0.01"
              />
              <p className="text-xs text-gray-500 mt-1">Minimum: $25.00</p>
            </div>

            <Separator />

            <div className="flex gap-4">
              <Button 
                onClick={handleDeposit}
                disabled={!selectedAccount || !transferAmount}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                Deposit to Platform
              </Button>
              <Button 
                onClick={handleWithdrawal}
                disabled={!selectedAccount || !transferAmount}
                variant="outline"
                className="flex-1"
              >
                Withdraw to Bank
              </Button>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2">How It Works</h4>
              <div className="text-sm text-blue-700 space-y-1">
                <p>• <strong>Deposit:</strong> Moves money from your PNC account to platform for user payouts</p>
                <p>• <strong>Withdraw:</strong> Returns platform fees and excess funds to your PNC account</p>
                <p>• <strong>Timing:</strong> ACH transfers settle in 1-3 business days</p>
                <p>• <strong>Fees:</strong> 0.25% platform fee, minimal ACH processing costs</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Platform Float Status */}
      {connectedAccounts.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Platform Float Status</CardTitle>
            <CardDescription>
              Monitor your platform's operational capital
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <h4 className="font-medium text-green-800">Available Float</h4>
                <div className="text-2xl font-bold text-green-600">$25,750</div>
                <p className="text-sm text-green-600">Ready for user payouts</p>
              </div>
              
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-800">Pending Receipts</h4>
                <div className="text-2xl font-bold text-blue-600">$1,240</div>
                <p className="text-sm text-blue-600">ACH transfers settling</p>
              </div>
              
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <h4 className="font-medium text-purple-800">Platform Revenue</h4>
                <div className="text-2xl font-bold text-purple-600">$132</div>
                <p className="text-sm text-purple-600">Fees collected today</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}