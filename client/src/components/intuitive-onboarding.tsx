import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Wallet, 
  CreditCard, 
  CheckCircle, 
  ArrowRight, 
  DollarSign,
  Zap,
  Shield
} from "@/lib/icons";
import { useAuth } from "@/hooks/useAuth";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  completed: boolean;
}

export function IntuitiveOnboarding() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);
  const [fundingAmount, setFundingAmount] = useState("50");
  
  // Check user's Circle wallet status with proper error handling
  const { data: walletStatus, error: walletError } = useQuery({
    queryKey: ['/api/user-circle/wallet/info'],
    enabled: !!user,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 30000,
    throwOnError: false
  });

  // Check USDC balance with proper error handling
  const { data: usdcBalance, error: balanceError } = useQuery({
    queryKey: ['/api/user-circle/balance'],
    enabled: !!user,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 30000,
    throwOnError: false
  });

  // Auto-create wallet mutation
  const createWalletMutation = useMutation({
    mutationFn: () => apiRequest('/api/user-circle/wallet/create', 'POST'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user-circle/wallet/info'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user-circle/balance'] });
    },
    onError: (error) => {
      console.error('Wallet creation failed:', error);
    }
  });

  const steps: OnboardingStep[] = [
    {
      id: 'wallet',
      title: 'Create Your Digital Wallet',
      description: 'Connect or provision a supported wallet for agent-ready payments',
      icon: <Wallet className="w-6 h-6" />,
      completed: !!(walletStatus && (walletStatus as any)?.success && (walletStatus as any)?.wallet?.address)
    },
    {
      id: 'fund',
      title: 'Add Money to Your Wallet',
      description: 'Fund your wallet instantly with your debit card or bank account',
      icon: <CreditCard className="w-6 h-6" />,
      completed: parseFloat((usdcBalance as any)?.success ? (usdcBalance as any)?.balance || '0' : '0') > 0
    },
    {
      id: 'ready',
      title: 'You\'re Ready to Go!',
      description: 'Send money, trade crypto, or hire AI agents - all in one place',
      icon: <CheckCircle className="w-6 h-6" />,
      completed: parseFloat((usdcBalance as any)?.success ? (usdcBalance as any)?.balance || '0' : '0') > 0
    }
  ];

  const progress = (steps.filter(s => s.completed).length / steps.length) * 100;

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl flex items-center justify-center gap-2">
          <Zap className="w-6 h-6 text-blue-500" />
          Get Started in 2 Minutes
        </CardTitle>
        <div className="mt-4">
          <Progress value={progress} className="w-full" />
          <p className="text-sm text-gray-600 mt-2">
            {Math.round(progress)}% complete
          </p>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {steps.map((step, index) => (
          <div key={step.id} className={`
            flex items-start gap-4 p-4 rounded-lg border-2 transition-all
            ${step.completed 
              ? 'border-green-200 bg-green-50' 
              : currentStep === index 
                ? 'border-blue-200 bg-blue-50' 
                : 'border-gray-200 bg-gray-50'
            }
          `}>
            <div className={`
              flex items-center justify-center w-10 h-10 rounded-full
              ${step.completed 
                ? 'bg-green-500 text-white' 
                : currentStep === index 
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-300 text-gray-600'
              }
            `}>
              {step.completed ? <CheckCircle className="w-5 h-5" /> : step.icon}
            </div>
            
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{step.title}</h3>
              <p className="text-gray-600 mb-3">{step.description}</p>
              
              {/* Step-specific content */}
              {step.id === 'wallet' && !step.completed && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Shield className="w-4 h-4" />
                    Secure wallet workflows with controlled transaction signing
                  </div>
                  <Button 
                    onClick={() => createWalletMutation.mutate()}
                    disabled={createWalletMutation.isPending}
                    className="w-full"
                  >
                    {createWalletMutation.isPending ? 'Creating Wallet...' : 'Create My Wallet'}
                  </Button>
                </div>
              )}

              {step.id === 'wallet' && step.completed && (
                <div className="space-y-2">
                  <Badge variant="outline" className="bg-green-100 text-green-800">
                    ✓ Wallet Created
                  </Badge>
                  <p className="text-sm text-gray-600 font-mono">
                    {(walletStatus as any)?.wallet?.address?.slice(0, 20)}...
                  </p>
                </div>
              )}

              {step.id === 'fund' && !step.completed && (walletStatus as any)?.wallet?.address && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    {['25', '50', '100'].map(amount => (
                      <Button
                        key={amount}
                        variant={fundingAmount === amount ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFundingAmount(amount)}
                      >
                        ${amount}
                      </Button>
                    ))}
                  </div>
                  
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={fundingAmount}
                      onChange={(e) => setFundingAmount(e.target.value)}
                      placeholder="Amount"
                      className="flex-1"
                    />
                    <Button className="flex-shrink-0" disabled>
                      Coming Soon
                    </Button>
                  </div>
                  
                  <div className="text-xs text-gray-600 bg-yellow-50 p-3 rounded border">
                    <strong>Demo Mode:</strong> This interface shows the planned user experience. 
                    Full Circle wallet integration and fiat onramp capabilities in development.
                  </div>
                  
                  <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
                    <strong>Pro tip:</strong> Your first $50 gets 1% back as a welcome bonus!
                  </div>
                </div>
              )}

              {step.id === 'ready' && step.completed && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Button variant="outline" size="sm" className="text-left justify-start">
                    <DollarSign className="w-4 h-4 mr-2" />
                    Send Money
                  </Button>
                  <Button variant="outline" size="sm" className="text-left justify-start">
                    <Zap className="w-4 h-4 mr-2" />
                    Trade Crypto
                  </Button>
                  <Button variant="outline" size="sm" className="text-left justify-start">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Hire AI Agent
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}