import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Send, CheckCircle, AlertCircle } from '@/lib/minimal-icons-clean';

export default function SendMoney() {
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
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Send Money</h1>
          <p className="text-gray-600">Transfer USDC instantly between users</p>
        </div>

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
              <div className="space-y-2">
                <p className="font-medium">Transfer Successful!</p>
                <div className="text-sm space-y-1">
                  <p>Transaction ID: {result.transactionId}</p>
                  <p>Amount: ${result.amount}</p>
                  <p>Platform Fee: ${result.platformFee}</p>
                  <p>Total Deducted: ${result.totalDeducted}</p>
                  <p>Recipient: {result.recipient}</p>
                  <p>New Sender Balance: ${result.senderNewBalance}</p>
                  <p>New Recipient Balance: ${result.recipientNewBalance}</p>
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
  );
}