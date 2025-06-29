/**
 * KYC Feature Demonstration Page
 * Shows progressive feature access and upgrade flow
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { KYCStatusIndicator } from "@/components/kyc-status-indicator";
import { FeatureGate } from "@/components/feature-gate";
import { KYCUpgradeModal } from "@/components/kyc-upgrade-modal";
import { Shield, Users, CreditCard, DollarSign, TrendingUp } from "@/lib/icons";

type KYCStatus = 'basic' | 'pending' | 'verified' | 'rejected';

export default function KYCDemo() {
  const [currentStatus, setCurrentStatus] = useState<KYCStatus>('basic');
  const [complianceLevel, setComplianceLevel] = useState<'basic' | 'enhanced' | 'institutional'>('basic');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const handleStatusChange = (newStatus: KYCStatus) => {
    setCurrentStatus(newStatus);
    if (newStatus === 'verified') {
      setComplianceLevel('enhanced');
    }
  };

  const handleStartKYC = () => {
    setCurrentStatus('pending');
    setShowUpgradeModal(false);
  };

  const mockFeatures = [
    {
      id: 'crypto',
      title: 'Crypto Trading',
      description: 'Trade cryptocurrencies without KYC requirements',
      requiredStatus: 'pending' as const,
      component: (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Cryptocurrency Exchange
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span>BTC Balance:</span>
                <span className="font-semibold">0.00543 BTC</span>
              </div>
              <div className="flex justify-between">
                <span>ETH Balance:</span>
                <span className="font-semibold">2.47 ETH</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button>Buy Crypto</Button>
                <Button>Sell Crypto</Button>
              </div>
              <div className="text-xs text-green-600 bg-green-50 p-2 rounded">
                ✓ No KYC required for crypto-to-crypto trading
              </div>
            </div>
          </CardContent>
        </Card>
      )
    },
    {
      id: 'referrals',
      title: 'Referral System',
      description: 'Earn commissions by referring new users',
      requiredStatus: 'pending' as const,
      component: (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Referral Dashboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span>Total Referrals:</span>
                <Badge>12</Badge>
              </div>
              <div className="flex justify-between">
                <span>Pending Commissions:</span>
                <span className="font-semibold">$245.50</span>
              </div>
              <Button className="w-full">Generate Referral Link</Button>
            </div>
          </CardContent>
        </Card>
      )
    },
    {
      id: 'fiat',
      title: 'Fiat P2P Transfers',
      description: 'Send/receive traditional currency (requires KYC)',
      requiredStatus: 'verified' as const,
      component: (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Fiat P2P Transfer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Recipient Email</label>
                <input 
                  className="w-full p-2 border rounded-md mt-1" 
                  placeholder="user@example.com" 
                />
              </div>
              <div>
                <label className="text-sm font-medium">Amount (USD)</label>
                <input 
                  className="w-full p-2 border rounded-md mt-1" 
                  placeholder="100.00" 
                />
              </div>
              <Button className="w-full">Send Fiat Payment</Button>
              <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded mt-2">
                ⚠️ KYC verification required for fiat transactions
              </div>
            </div>
          </CardContent>
        </Card>
      )
    },
    {
      id: 'banking',
      title: 'Bank Integration',
      description: 'Connect bank accounts for fiat transactions (requires KYC)',
      requiredStatus: 'verified' as const,
      component: (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Bank Account Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span>Connected Accounts:</span>
                <span className="font-semibold">Chase Checking</span>
              </div>
              <div className="flex justify-between">
                <span>Available Balance:</span>
                <span className="font-semibold">$3,247.30</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline">Deposit</Button>
                <Button variant="outline">Withdraw</Button>
              </div>
              <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                🔒 KYC verification required for bank transactions
              </div>
            </div>
          </CardContent>
        </Card>
      )
    },
    {
      id: 'agents',
      title: 'AI Agent Marketplace',
      description: 'Hire AI agents for automated tasks',
      requiredStatus: 'verified' as const,
      component: (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              AI Agent Services
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-3 border rounded-md">
                <div className="font-semibold">Trading Bot Pro</div>
                <div className="text-sm text-gray-600">Automated trading strategies</div>
                <div className="flex justify-between items-center mt-2">
                  <Badge variant="secondary">$50/month</Badge>
                  <Button size="sm">Hire Agent</Button>
                </div>
              </div>
              <div className="p-3 border rounded-md">
                <div className="font-semibold">Portfolio Analyzer</div>
                <div className="text-sm text-gray-600">Real-time portfolio insights</div>
                <div className="flex justify-between items-center mt-2">
                  <Badge variant="secondary">$25/month</Badge>
                  <Button size="sm">Hire Agent</Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )
    }
  ];

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">KYC Feature Access Demo</h1>
        <p className="text-gray-600">
          Experience how features unlock based on verification status
        </p>
      </div>

      {/* Status Control Panel */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Demo Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Current KYC Status:</label>
              <div className="flex gap-2">
                {(['basic', 'pending', 'verified', 'rejected'] as const).map((status) => (
                  <Button
                    key={status}
                    variant={currentStatus === status ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleStatusChange(status)}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
            
            {currentStatus === 'verified' && (
              <div>
                <label className="text-sm font-medium mb-2 block">Compliance Level:</label>
                <div className="flex gap-2">
                  {(['basic', 'enhanced', 'institutional'] as const).map((level) => (
                    <Button
                      key={level}
                      variant={complianceLevel === level ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setComplianceLevel(level)}
                    >
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* KYC Status Display */}
      <div className="mb-8">
        <KYCStatusIndicator
          status={currentStatus}
          complianceLevel={complianceLevel}
          onUpgrade={() => setShowUpgradeModal(true)}
          showUpgradePrompt={true}
        />
      </div>

      {/* Feature Tabs */}
      <Tabs defaultValue="crypto" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          {mockFeatures.map((feature) => (
            <TabsTrigger key={feature.id} value={feature.id}>
              {feature.title}
            </TabsTrigger>
          ))}
        </TabsList>

        {mockFeatures.map((feature) => (
          <TabsContent key={feature.id} value={feature.id}>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>

              <FeatureGate
                requiredKYCStatus={feature.requiredStatus}
                userKYCStatus={currentStatus}
                feature={feature.title}
                onUpgrade={() => setShowUpgradeModal(true)}
                showPreview={true}
              >
                {feature.component}
              </FeatureGate>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {/* Transaction Limits Display */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Transaction Limits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 border rounded-md">
              <div className="text-2xl font-bold text-gray-400">$0</div>
              <div className="text-sm text-gray-600">Basic Account</div>
              <div className="text-xs text-gray-500">No financial features</div>
            </div>
            <div className="text-center p-4 border rounded-md">
              <div className="text-2xl font-bold text-blue-600">$50,000</div>
              <div className="text-sm text-gray-600">Enhanced KYC</div>
              <div className="text-xs text-gray-500">Per transaction limit</div>
            </div>
            <div className="text-center p-4 border rounded-md">
              <div className="text-2xl font-bold text-purple-600">$1,000,000</div>
              <div className="text-sm text-gray-600">Institutional KYC</div>
              <div className="text-xs text-gray-500">Enterprise access</div>
            </div>
          </div>
          
          <div className="mt-4 p-4 bg-gray-50 rounded-md">
            <div className="text-sm font-medium mb-2">Your Current Access:</div>
            <div className="text-xs text-gray-600">
              {currentStatus === 'basic' && 'Crypto trading unlimited, KYC required for fiat features'}
              {currentStatus === 'pending' && 'Crypto trading unlimited, fiat verification in progress'}
              {currentStatus === 'verified' && complianceLevel === 'basic' && 'All features: Crypto unlimited, Fiat up to $10,000'}
              {currentStatus === 'verified' && complianceLevel === 'enhanced' && 'All features: Crypto unlimited, Fiat up to $50,000'}
              {currentStatus === 'verified' && complianceLevel === 'institutional' && 'All features: Crypto unlimited, Fiat up to $1,000,000'}
              {currentStatus === 'rejected' && 'Crypto trading available, resubmit KYC for fiat access'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KYC Upgrade Modal */}
      <KYCUpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        currentStatus={currentStatus}
        onStartKYC={handleStartKYC}
      />
    </div>
  );
}