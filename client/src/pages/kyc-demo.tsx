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
      id: 'payments',
      title: 'Send/Receive Money',
      description: 'Transfer funds securely worldwide',
      requiredStatus: 'verified' as const,
      component: (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Transfer
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
              <Button className="w-full">Send Payment</Button>
            </div>
          </CardContent>
        </Card>
      )
    },
    {
      id: 'trading',
      title: 'Crypto Trading',
      description: 'Trade cryptocurrencies with low fees',
      requiredStatus: 'verified' as const,
      component: (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Crypto Exchange
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span>BTC Balance:</span>
                <span className="font-semibold">0.00543 BTC</span>
              </div>
              <div className="flex justify-between">
                <span>USD Balance:</span>
                <span className="font-semibold">$1,247.30</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline">Buy Crypto</Button>
                <Button variant="outline">Sell Crypto</Button>
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
      <Tabs defaultValue="referrals" className="w-full">
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
            <div className="text-sm font-medium mb-2">Your Current Limits:</div>
            <div className="text-xs text-gray-600">
              {currentStatus === 'basic' && 'Complete KYC verification to unlock financial features'}
              {currentStatus === 'pending' && 'Verification in progress - limits will apply once approved'}
              {currentStatus === 'verified' && complianceLevel === 'basic' && 'Up to $10,000 per transaction'}
              {currentStatus === 'verified' && complianceLevel === 'enhanced' && 'Up to $50,000 per transaction'}
              {currentStatus === 'verified' && complianceLevel === 'institutional' && 'Up to $1,000,000 per transaction'}
              {currentStatus === 'rejected' && 'Resubmit documents to restore access'}
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