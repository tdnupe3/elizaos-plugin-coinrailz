import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, 
  CreditCard, 
  Users, 
  DollarSign,
  CheckCircle,
  ArrowRight
} from "@/lib/icons";

interface KYCUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStatus: 'basic' | 'pending' | 'rejected';
  onStartKYC: () => void;
}

export function KYCUpgradeModal({ 
  isOpen, 
  onClose, 
  currentStatus,
  onStartKYC 
}: KYCUpgradeModalProps) {
  const [selectedTier, setSelectedTier] = useState<'enhanced' | 'institutional'>('enhanced');

  const features = {
    current: [
      'Account registration',
      'Referral system access',
      'Cryptocurrency trading (all pairs)',
      'Crypto wallet management',
      'DEX aggregator access',
      'Crypto-to-crypto transfers',
      'Credit/debit card purchases',
      'AI agent marketplace browsing',
      'Platform notifications'
    ],
    enhanced: [
      'Bank account deposits/withdrawals',
      'Fiat P2P transfers up to $10,000',
      'Commission withdrawals to bank',
      'Higher transaction limits',
      'Priority customer support',
      'Advanced compliance features'
    ],
    institutional: [
      'Unlimited transaction amounts',
      'Priority customer support',
      'Advanced analytics dashboard',
      'White-label features',
      'API access',
      'Institutional-grade security'
    ]
  };

  const getStatusMessage = () => {
    switch (currentStatus) {
      case 'pending':
        return {
          title: 'KYC Review in Progress',
          description: 'Your verification is being reviewed. You\'ll be notified once approved.',
          action: null
        };
      case 'rejected':
        return {
          title: 'Resubmit KYC Documents',
          description: 'Additional documentation is required to complete verification.',
          action: 'Resubmit Documents'
        };
      default:
        return {
          title: 'Unlock Full Platform Access',
          description: 'Complete KYC verification to access all financial features.',
          action: 'Start Verification'
        };
    }
  };

  const status = getStatusMessage();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            {status.title}
          </DialogTitle>
          <DialogDescription>
            {status.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Access */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Current Access
              </h3>
              <Badge variant="outline">Basic Account</Badge>
            </div>
            <ul className="space-y-1">
              {features.current.map((feature, index) => (
                <li key={index} className="text-sm text-gray-600 flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Verification Tiers */}
          <div className="space-y-4">
            <h3 className="font-semibold">Choose Verification Level:</h3>
            
            {/* Enhanced KYC */}
            <div 
              className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                selectedTier === 'enhanced' ? 'border-blue-500 bg-blue-50' : 'hover:border-gray-300'
              }`}
              onClick={() => setSelectedTier('enhanced')}
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-blue-500" />
                  Enhanced Verification
                </h4>
                <Badge variant={selectedTier === 'enhanced' ? 'default' : 'outline'}>
                  Recommended
                </Badge>
              </div>
              <ul className="space-y-1 mb-3">
                {features.enhanced.map((feature, index) => (
                  <li key={index} className="text-sm text-gray-600 flex items-center gap-2">
                    <ArrowRight className="h-3 w-3 text-blue-500" />
                    {feature}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-gray-500">
                Perfect for individual users and small businesses
              </p>
            </div>

            {/* Institutional KYC */}
            <div 
              className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                selectedTier === 'institutional' ? 'border-purple-500 bg-purple-50' : 'hover:border-gray-300'
              }`}
              onClick={() => setSelectedTier('institutional')}
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple-500" />
                  Institutional Verification
                </h4>
                <Badge variant={selectedTier === 'institutional' ? 'default' : 'outline'}>
                  Enterprise
                </Badge>
              </div>
              <ul className="space-y-1 mb-3">
                {features.institutional.map((feature, index) => (
                  <li key={index} className="text-sm text-gray-600 flex items-center gap-2">
                    <ArrowRight className="h-3 w-3 text-purple-500" />
                    {feature}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-gray-500">
                For businesses, financial institutions, and high-volume users
              </p>
            </div>
          </div>

          {/* Security Notice */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-gray-500 mt-0.5" />
              <div>
                <h4 className="font-semibold text-sm mb-1">Secure & Compliant</h4>
                <p className="text-xs text-gray-600">
                  Your information is encrypted and handled according to financial industry standards. 
                  We comply with KYC/AML regulations to ensure platform security.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Maybe Later
            </Button>
            {status.action && (
              <Button 
                onClick={() => {
                  onStartKYC();
                  onClose();
                }} 
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                <DollarSign className="h-4 w-4 mr-2" />
                {status.action}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}