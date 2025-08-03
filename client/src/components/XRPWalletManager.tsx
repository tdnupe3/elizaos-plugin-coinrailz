import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Wallet, Plus, Import, Send, CheckCircle, AlertCircle, Copy } from '@/lib/minimal-icons-clean';

interface XRPWallet {
  address: string;
  balance: string;
  publicKey?: string;
  seed?: string;
  network: string;
  status: string;
}

interface XRPTransaction {
  hash: string;
  from: string;
  to: string;
  amount: string;
  fee: string;
  status: string;
  explorerUrl?: string;
}

export function XRPWalletManager() {
  const [wallet, setWallet] = useState<XRPWallet | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showSeed, setShowSeed] = useState(false);
  
  // Payment form state
  const [paymentForm, setPaymentForm] = useState({
    destinationAddress: '',
    amount: '',
    memo: ''
  });
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<XRPTransaction | null>(null);

  // Import wallet state
  const [importForm, setImportForm] = useState({
    address: '',
    seed: ''
  });

  const createWallet = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/xrp/wallet/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: 'demo-user-001'
        }),
      });

      const data = await response.json();

      if (data.success) {
        setWallet(data.wallet);
        setSuccess('XRP wallet created successfully!');
      } else {
        setError(data.error || 'Failed to create wallet');
      }
    } catch (err) {
      setError('Network error creating wallet');
    } finally {
      setLoading(false);
    }
  };

  const importWallet = async () => {
    if (!importForm.address && !importForm.seed) {
      setError('Enter either wallet address or seed phrase');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/xrp/wallet/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: importForm.address || undefined,
          seed: importForm.seed || undefined,
          userId: 'demo-user-001'
        }),
      });

      const data = await response.json();

      if (data.success) {
        setWallet(data.wallet);
        setSuccess('XRP wallet imported successfully!');
        setImportForm({ address: '', seed: '' });
      } else {
        setError(data.error || 'Failed to import wallet');
      }
    } catch (err) {
      setError('Network error importing wallet');
    } finally {
      setLoading(false);
    }
  };

  const submitPayment = async () => {
    if (!wallet?.seed) {
      setError('Wallet seed required for payments');
      return;
    }

    if (!paymentForm.destinationAddress || !paymentForm.amount) {
      setError('Destination address and amount required');
      return;
    }

    setPaymentLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/xrp/payment/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          senderSeed: wallet.seed,
          destinationAddress: paymentForm.destinationAddress,
          amount: paymentForm.amount,
          memo: paymentForm.memo || undefined,
          userId: 'demo-user-001'
        }),
      });

      const data = await response.json();

      if (data.success) {
        setLastTransaction(data.transaction);
        setSuccess(`Payment submitted! Hash: ${data.transaction.hash}`);
        setPaymentForm({ destinationAddress: '', amount: '', memo: '' });
        
        // Refresh wallet balance
        await importWallet();
      } else {
        setError(data.error || 'Failed to submit payment');
      }
    } catch (err) {
      setError('Network error submitting payment');
    } finally {
      setPaymentLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccess('Copied to clipboard!');
    setTimeout(() => setSuccess(''), 2000);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            XRP Wallet Manager
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {!wallet ? (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button 
                  onClick={createWallet} 
                  disabled={loading}
                  className="flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Create New Wallet
                </Button>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Import className="w-4 h-4" />
                  Import Existing Wallet
                </h4>
                <div className="space-y-2">
                  <Input
                    placeholder="XRP Address (r...)"
                    value={importForm.address}
                    onChange={(e) => setImportForm(prev => ({ ...prev, address: e.target.value }))}
                  />
                  <Input
                    placeholder="Seed Phrase (optional)"
                    type="password"
                    value={importForm.seed}
                    onChange={(e) => setImportForm(prev => ({ ...prev, seed: e.target.value }))}
                  />
                  <Button 
                    onClick={importWallet}
                    disabled={loading}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Import className="w-4 h-4" />
                    Import Wallet
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-green-800">Wallet Connected</h4>
                  <Badge variant={wallet.status === 'active' ? 'default' : 'secondary'}>
                    {wallet.status}
                  </Badge>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-green-700">Address:</span>
                    <div className="flex items-center gap-2">
                      <code className="text-green-800">{wallet.address.substring(0, 8)}...{wallet.address.substring(-8)}</code>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => copyToClipboard(wallet.address)}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-green-700">Balance:</span>
                    <span className="font-mono text-green-800">{wallet.balance} XRP</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-green-700">Network:</span>
                    <span className="text-green-800">{wallet.network}</span>
                  </div>

                  {wallet.seed && (
                    <div className="flex items-center justify-between">
                      <span className="text-green-700">Seed:</span>
                      <div className="flex items-center gap-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setShowSeed(!showSeed)}
                        >
                          {showSeed ? 'Hide' : 'Show'}
                        </Button>
                        {showSeed && (
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => copyToClipboard(wallet.seed!)}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {showSeed && wallet.seed && (
                    <div className="p-2 bg-yellow-50 border border-yellow-200 rounded">
                      <code className="text-xs break-all text-yellow-800">{wallet.seed}</code>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Form */}
              {wallet.seed && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Send className="w-4 h-4" />
                      Send XRP Payment
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Input
                      placeholder="Destination Address"
                      value={paymentForm.destinationAddress}
                      onChange={(e) => setPaymentForm(prev => ({ ...prev, destinationAddress: e.target.value }))}
                    />
                    <Input
                      placeholder="Amount (XRP)"
                      type="number"
                      step="0.000001"
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                    />
                    <Input
                      placeholder="Memo (optional)"
                      value={paymentForm.memo}
                      onChange={(e) => setPaymentForm(prev => ({ ...prev, memo: e.target.value }))}
                    />
                    <Button 
                      onClick={submitPayment}
                      disabled={paymentLoading}
                      className="w-full flex items-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      {paymentLoading ? 'Submitting...' : 'Submit Payment'}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Last Transaction */}
              {lastTransaction && (
                <Card>
                  <CardHeader>
                    <CardTitle>Last Transaction</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Hash:</span>
                        <code className="text-blue-600">{lastTransaction.hash.substring(0, 16)}...</code>
                      </div>
                      <div className="flex justify-between">
                        <span>Amount:</span>
                        <span>{lastTransaction.amount} XRP</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Fee:</span>
                        <span>{lastTransaction.fee} XRP</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Status:</span>
                        <Badge variant="default">{lastTransaction.status}</Badge>
                      </div>
                      {lastTransaction.explorerUrl && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => window.open(lastTransaction.explorerUrl, '_blank')}
                          className="w-full mt-2"
                        >
                          View on Explorer
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Button 
                variant="outline" 
                onClick={() => {
                  setWallet(null);
                  setLastTransaction(null);
                  setError('');
                  setSuccess('');
                }}
                className="w-full"
              >
                Disconnect Wallet
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}