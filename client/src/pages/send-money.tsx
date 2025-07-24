import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Send, CheckCircle, AlertCircle, ArrowLeft } from '@/lib/minimal-icons-clean';
import { SimpleBalanceDisplay } from '@/components/simple-balance-display';
import { NavigationHeader } from '@/components/navigation-header';
import { useLocation } from 'wouter';

export default function SendMoney() {
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState({
    senderEmail: '',
    recipientEmail: '',
    amount: '',
    description: ''
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/simple-transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          senderEmail: formData.senderEmail,
          recipientEmail: formData.recipientEmail,
          amount: parseFloat(formData.amount),
          description: formData.description || 'P2P Transfer'
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResult(data);
        setFormData({
          senderEmail: '',
          recipientEmail: '',
          amount: '',
          description: ''
        });
      } else {
        setError(data.error || 'Transfer failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <NavigationHeader />
      <div className="p-4">
        <div className="max-w-2xl mx-auto">
          {/* Back button */}
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => setLocation('/')}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </Button>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Send Money</h1>
            <p className="text-gray-600">Transfer USDC instantly between users</p>
          </div>

        {/* Demo Balance Display - Always Show A1Digital Balance */}
        <div className="mb-6">
          <SimpleBalanceDisplay 
            userEmail="a1digitalllc@gmail.com"
            title="A1Digital Beta Account Balance"
          />
        </div>

        {/* Debug Info */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-2">🔍 Balance Debug Info</h3>
          <p className="text-sm text-blue-700">
            Expected: $50.00 USDC for a1digitalllc@gmail.com<br/>
            API Endpoint: /api/balance-check/a1digitalllc@gmail.com<br/>
            Check browser console for balance parsing logs
          </p>
        </div>

        {/* Balance Display for Sender */}
        {formData.senderEmail && formData.senderEmail !== 'a1digitalllc@gmail.com' && (
          <div className="mb-6">
            <SimpleBalanceDisplay 
              userEmail={formData.senderEmail}
              title={`Sender Balance`}
            />
          </div>
        )}

        {/* Quick Transfer Presets */}
        <Card className="mb-6 bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
          <CardHeader>
            <CardTitle className="text-green-700">Quick Transfer Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Button 
                variant="outline" 
                onClick={() => setFormData(prev => ({ ...prev, senderEmail: 'a1digitalllc@gmail.com' }))}
                className="text-left justify-start"
              >
                <Send className="h-4 w-4 mr-2" />
                Use a1digitalllc@gmail.com
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setFormData(prev => ({ ...prev, recipientEmail: 'stell.mary@yahoo.com' }))}
                className="text-left justify-start"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Send to stell.mary@yahoo.com
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setFormData(prev => ({ ...prev, amount: '25' }))}
              >
                $25
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setFormData(prev => ({ ...prev, amount: '10' }))}
              >
                $10
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setFormData(prev => ({ ...prev, amount: '50' }))}
              >
                $50
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              P2P Transfer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sender Email
                </label>
                <Input
                  type="email"
                  name="senderEmail"
                  value={formData.senderEmail}
                  onChange={handleInputChange}
                  placeholder="Enter sender email"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Recipient Email
                </label>
                <Input
                  type="email"
                  name="recipientEmail"
                  value={formData.recipientEmail}
                  onChange={handleInputChange}
                  placeholder="Enter recipient email"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount (USD)
                </label>
                <Input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleInputChange}
                  placeholder="Enter amount (minimum $10)"
                  min="10"
                  step="0.01"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Platform fee: 0.75% + $1 minimum
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <Input
                  type="text"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="What's this for?"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing Transfer...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Money
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <AlertDescription className="text-red-700">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {result && (
          <Alert className="mb-6 border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <AlertDescription className="text-green-700">
              <div className="space-y-3">
                <p className="font-medium text-lg">💰 Transfer Successful!</p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-1">
                    <p><strong>Amount Sent:</strong> ${result.amount}</p>
                    <p><strong>Platform Fee:</strong> ${result.platformFee}</p>
                    <p><strong>Total Deducted:</strong> ${result.totalDeducted}</p>
                    <p><strong>Recipient:</strong> {result.recipient}</p>
                  </div>
                  <div className="space-y-1">
                    <p><strong>Sender Balance:</strong> ${result.senderNewBalance}</p>
                    <p><strong>Recipient Balance:</strong> ${result.recipientNewBalance}</p>
                    <p><strong>Transaction ID:</strong> {result.transactionId.slice(-8)}</p>
                    <p><strong>Time:</strong> {new Date(result.timestamp).toLocaleTimeString()}</p>
                  </div>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Transfer Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-gray-600">
              <p>• Minimum transfer amount: $10</p>
              <p>• Platform fee: 0.75% with $1 minimum</p>
              <p>• Instant USDC transfers between users</p>
              <p>• Secure database-backed transactions</p>
              <p>• Real-time balance updates</p>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}