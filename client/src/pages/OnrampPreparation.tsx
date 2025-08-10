import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CreditCard, 
  ArrowDownLeft, 
  ArrowUpRight, 
  DollarSign, 
  Clock,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Banknote,
  Smartphone
} from 'lucide-react';

/**
 * Coinbase Onramp/Offramp Preparation Interface
 * Ready for immediate integration once Coinbase approval is granted
 */
export default function OnrampPreparation() {
  const [onrampAmount, setOnrampAmount] = useState('');
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  const [selectedAsset, setSelectedAsset] = useState('USDC');
  const [userEmail, setUserEmail] = useState('');

  const supportedFiatCurrencies = [
    { code: 'USD', name: 'US Dollar', flag: '🇺🇸' },
    { code: 'EUR', name: 'Euro', flag: '🇪🇺' },
    { code: 'GBP', name: 'British Pound', flag: '🇬🇧' },
    { code: 'CAD', name: 'Canadian Dollar', flag: '🇨🇦' },
    { code: 'AUD', name: 'Australian Dollar', flag: '🇦🇺' },
    { code: 'JPY', name: 'Japanese Yen', flag: '🇯🇵' }
  ];

  const supportedCryptoAssets = [
    { symbol: 'USDC', name: 'USD Coin', network: 'Base', fees: 'Zero fees' },
    { symbol: 'ETH', name: 'Ethereum', network: 'Base', fees: 'Low fees' },
    { symbol: 'USDT', name: 'Tether', network: 'Base', fees: 'Low fees' },
    { symbol: 'BTC', name: 'Bitcoin', network: 'Bitcoin', fees: 'Standard fees' }
  ];

  const paymentMethods = [
    { 
      id: 'bank', 
      name: 'Bank Account', 
      icon: <Banknote className="w-5 h-5" />, 
      limits: '$25,000/day',
      time: '1-2 business days'
    },
    { 
      id: 'debit', 
      name: 'Debit Card', 
      icon: <CreditCard className="w-5 h-5" />, 
      limits: '$2,500/day',
      time: 'Instant'
    },
    { 
      id: 'applepay', 
      name: 'Apple Pay', 
      icon: <Smartphone className="w-5 h-5" />, 
      limits: '$1,000/day',
      time: 'Instant'
    }
  ];

  const handleOnrampSimulation = () => {
    console.log('🔄 Simulating Coinbase Onramp integration...');
    console.log(`Amount: ${onrampAmount} ${selectedCurrency}`);
    console.log(`Asset: ${selectedAsset}`);
    console.log(`User: ${userEmail}`);
  };

  const getStatusColor = (status: 'approved' | 'pending' | 'not-applied') => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'not-applied': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-green-600 rounded-xl flex items-center justify-center">
          <DollarSign className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Coinbase Onramp Integration</h1>
          <p className="text-gray-600">Fiat-to-crypto gateway with zero USDC fees</p>
        </div>
      </div>

      {/* Application Status */}
      <Alert className="mb-8">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Integration Status:</strong> Awaiting Coinbase onramp access approval. 
          Once approved, this interface will be fully functional with live fiat deposits.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Onramp Interface */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowDownLeft className="w-5 h-5 text-green-600" />
              Fiat Onramp (Buy Crypto)
            </CardTitle>
            <CardDescription>
              Convert fiat currency to cryptocurrency instantly
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fiat-amount">Amount</Label>
                <Input
                  id="fiat-amount"
                  type="number"
                  value={onrampAmount}
                  onChange={(e) => setOnrampAmount(e.target.value)}
                  placeholder="100"
                />
              </div>
              <div>
                <Label htmlFor="fiat-currency">Fiat Currency</Label>
                <select
                  id="fiat-currency"
                  value={selectedCurrency}
                  onChange={(e) => setSelectedCurrency(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {supportedFiatCurrencies.map((currency) => (
                    <option key={currency.code} value={currency.code}>
                      {currency.flag} {currency.code} - {currency.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <Label htmlFor="crypto-asset">Receive Asset</Label>
              <select
                id="crypto-asset"
                value={selectedAsset}
                onChange={(e) => setSelectedAsset(e.target.value)}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {supportedCryptoAssets.map((asset) => (
                  <option key={asset.symbol} value={asset.symbol}>
                    {asset.symbol} - {asset.name} ({asset.network})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="user-email">Email (Optional for guest checkout)</Label>
              <Input
                id="user-email"
                type="email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>

            {onrampAmount && (
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">Transaction Preview</h4>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span>You Pay:</span>
                    <span className="font-mono">{onrampAmount} {selectedCurrency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>You Receive:</span>
                    <span className="font-mono">~{onrampAmount} {selectedAsset}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Network:</span>
                    <span>Base (Fast & cheap)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Coinbase Fee:</span>
                    <span className="text-green-600 font-medium">
                      {selectedAsset === 'USDC' ? 'FREE' : '1.49%'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <Button 
              onClick={handleOnrampSimulation}
              className="w-full"
              disabled={!onrampAmount}
            >
              Buy {selectedAsset} (Demo)
            </Button>
          </CardContent>
        </Card>

        {/* Offramp Interface */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUpRight className="w-5 h-5 text-blue-600" />
              Fiat Offramp (Sell Crypto)
            </CardTitle>
            <CardDescription>
              Convert cryptocurrency back to fiat currency
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Instant cashouts to linked bank accounts with competitive rates
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Supported Cashout Methods</h4>
                <div className="space-y-2">
                  {paymentMethods.map((method) => (
                    <div key={method.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div className="flex items-center gap-2">
                        {method.icon}
                        <span className="font-medium">{method.name}</span>
                      </div>
                      <div className="text-right text-sm">
                        <div>{method.limits}</div>
                        <div className="text-gray-500">{method.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Button variant="outline" className="w-full">
              Sell Crypto (Coming Soon)
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Feature Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="w-5 h-5 text-green-600" />
              Zero USDC Fees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Coinbase offers zero fees on USDC purchases, making it perfect for Coin Railz's USDC-first architecture.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="w-5 h-5 text-blue-600" />
              Instant Settlement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Debit card and Apple Pay purchases are instant, enabling immediate trading and transfers.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CheckCircle2 className="w-5 h-5 text-purple-600" />
              Guest Checkout
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Users can purchase up to $500/week without creating a Coinbase account.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Integration Status */}
      <Card>
        <CardHeader>
          <CardTitle>Integration Roadmap</CardTitle>
          <CardDescription>Timeline for full onramp/offramp implementation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                  <Clock className="w-4 h-4 text-yellow-600" />
                </div>
                <div>
                  <h4 className="font-medium">Application Submitted</h4>
                  <p className="text-sm text-gray-600">Coinbase onramp access request</p>
                </div>
              </div>
              <Badge className={getStatusColor('pending')}>
                Pending Approval
              </Badge>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg opacity-50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-gray-600" />
                </div>
                <div>
                  <h4 className="font-medium">Integration Development</h4>
                  <p className="text-sm text-gray-600">React component & API integration</p>
                </div>
              </div>
              <Badge className={getStatusColor('not-applied')}>
                Waiting for Approval
              </Badge>
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg opacity-50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                  <Shield className="w-4 h-4 text-gray-600" />
                </div>
                <div>
                  <h4 className="font-medium">Production Launch</h4>
                  <p className="text-sm text-gray-600">Live fiat onramp for users</p>
                </div>
              </div>
              <Badge className={getStatusColor('not-applied')}>
                2-3 Weeks
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Technical Implementation Notes */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Technical Implementation Ready</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-2">React Component Integration</h4>
              <div className="bg-gray-50 p-3 rounded font-mono text-sm">
                {`import { FundCard } from '@coinbase/onchainkit';

<FundCard
  projectId="coin_railz_cdp_id"
  onSuccess={(tx) => {
    updateUserBalance(tx);
  }}
/>`}
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Custom API Integration</h4>
              <div className="bg-gray-50 p-3 rounded font-mono text-sm">
                {`POST /api/onramp/create-session
{
  "amount": 100,
  "currency": "USD",
  "asset": "USDC",
  "userId": "user_123"
}`}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}