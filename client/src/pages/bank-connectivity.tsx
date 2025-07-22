import React from 'react';
import { PlaidLinkComponent } from '@/components/PlaidLinkComponent';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, ArrowRight } from '@/lib/minimal-icons-clean';

export default function BankConnectivityPage() {
  const handleAccountConnected = (accounts: any[]) => {
    console.log('Bank accounts connected:', accounts);
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Bank Account Integration
          </h1>
          <p className="text-lg text-gray-600">
            Connect your bank account for seamless USD funding and ACH transfers
          </p>
          <Badge variant="outline" className="text-green-600 border-green-200">
            Plaid Pay-as-You-Go Approved
          </Badge>
        </div>

        {/* Features Overview */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <CheckCircle className="h-8 w-8 text-green-600 mx-auto" />
                <h3 className="font-semibold">Instant Verification</h3>
                <p className="text-sm text-gray-600">
                  Verify bank accounts in seconds using Plaid's secure connection
                </p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <CheckCircle className="h-8 w-8 text-green-600 mx-auto" />
                <h3 className="font-semibold">Low-Cost ACH</h3>
                <p className="text-sm text-gray-600">
                  $0.25-$1.50 per ACH transfer, much lower than credit card fees
                </p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <CheckCircle className="h-8 w-8 text-green-600 mx-auto" />
                <h3 className="font-semibold">Bank-Level Security</h3>
                <p className="text-sm text-gray-600">
                  Your credentials are encrypted and never stored by Coin Railz
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Integration Status */}
        <Alert>
          <AlertDescription>
            <div className="flex items-center justify-between">
              <span>
                <strong>Integration Status:</strong> Ready for API credentials configuration
              </span>
              <Badge variant="outline">Approved</Badge>
            </div>
          </AlertDescription>
        </Alert>

        {/* Plaid Connection Component */}
        <PlaidLinkComponent onAccountConnected={handleAccountConnected} />

        {/* Benefits Section */}
        <Card>
          <CardHeader>
            <CardTitle>Why Connect Your Bank Account?</CardTitle>
            <CardDescription>
              Bank connectivity unlocks powerful financial features
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <ArrowRight className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">Bank → PayPal Transfers</span>
                </div>
                <div className="flex items-center gap-3">
                  <ArrowRight className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">Bank → USDC Funding</span>
                </div>
                <div className="flex items-center gap-3">
                  <ArrowRight className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">Bank → Crypto Purchases</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <ArrowRight className="h-4 w-4 text-green-600" />
                  <span className="font-medium">Lower Fees (vs Credit Cards)</span>
                </div>
                <div className="flex items-center gap-3">
                  <ArrowRight className="h-4 w-4 text-green-600" />
                  <span className="font-medium">Higher Transaction Limits</span>
                </div>
                <div className="flex items-center gap-3">
                  <ArrowRight className="h-4 w-4 text-green-600" />
                  <span className="font-medium">2-3 Day Settlement</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Implementation Notes */}
        <Card className="border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-800">Implementation Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">Plaid Pay-as-You-Go program approved</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">PlaidService infrastructure completed</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">API routes and components ready</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 border-2 border-blue-600 rounded" />
              <span className="text-sm">Awaiting API credentials configuration</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}