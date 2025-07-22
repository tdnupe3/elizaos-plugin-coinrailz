import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, Clock, Shield, DollarSign } from '@/lib/minimal-icons-clean';

export default function BankConnectivityPage() {
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
          <Badge variant="outline" className="text-orange-600 border-orange-200">
            <Clock className="h-4 w-4 mr-1" />
            Coming Soon
          </Badge>
        </div>

        {/* Coming Soon Notice */}
        <Alert className="border-orange-200 bg-orange-50">
          <Clock className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <div className="font-semibold text-orange-800">Bank connectivity is coming soon!</div>
              <div className="text-orange-700">
                We're finalizing our Plaid integration to provide secure bank account linking and low-cost ACH transfers. 
                This feature will be available once our production API approval is complete.
              </div>
            </div>
          </AlertDescription>
        </Alert>

        {/* Planned Features */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="opacity-75">
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <Shield className="h-8 w-8 text-blue-600 mx-auto" />
                <h3 className="font-semibold">Bank-Level Security</h3>
                <p className="text-sm text-gray-600">
                  Powered by Plaid's secure API - your credentials are encrypted and never stored
                </p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="opacity-75">
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <DollarSign className="h-8 w-8 text-green-600 mx-auto" />
                <h3 className="font-semibold">Low-Cost ACH</h3>
                <p className="text-sm text-gray-600">
                  $0.25-$1.50 per ACH transfer vs $2.90+ for credit cards (80%+ savings)
                </p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="opacity-75">
            <CardContent className="pt-6">
              <div className="text-center space-y-2">
                <CheckCircle className="h-8 w-8 text-purple-600 mx-auto" />
                <h3 className="font-semibold">Instant Verification</h3>
                <p className="text-sm text-gray-600">
                  Verify and connect bank accounts in seconds with real-time balance checking
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Benefits Section */}
        <Card>
          <CardHeader>
            <CardTitle>What Bank Connectivity Will Enable</CardTitle>
            <CardDescription>
              Once live, you'll be able to fund your Coin Railz account directly from your bank
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-800">Funding Options</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Bank → PayPal transfers
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Bank → USDC wallet funding
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Bank → Crypto purchases
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Direct ACH P2P transfers
                  </li>
                </ul>
              </div>
              
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-800">Cost Advantages</h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center">
                    <DollarSign className="h-4 w-4 text-green-500 mr-2" />
                    ACH: $0.25-$1.50 per transfer
                  </li>
                  <li className="flex items-center">
                    <DollarSign className="h-4 w-4 text-red-500 mr-2" />
                    Credit cards: $2.90+ per transfer
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Save 80%+ on transaction fees
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    No monthly account fees
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Current Status */}
        <Card>
          <CardHeader>
            <CardTitle>Integration Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-600 mr-3" />
                  <span className="font-medium">Technical Infrastructure</span>
                </div>
                <Badge variant="outline" className="text-green-600 border-green-200">Complete</Badge>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-600 mr-3" />
                  <span className="font-medium">Plaid Pay-as-You-Go Program</span>
                </div>
                <Badge variant="outline" className="text-green-600 border-green-200">Approved</Badge>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                <div className="flex items-center">
                  <Clock className="h-5 w-5 text-orange-600 mr-3" />
                  <span className="font-medium">Production API Approval</span>
                </div>
                <Badge variant="outline" className="text-orange-600 border-orange-200">In Progress</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}