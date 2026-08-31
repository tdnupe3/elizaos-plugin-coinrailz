import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Circle, Wallet, DollarSign, ArrowRight, Users, Bot } from "@/lib/icons";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  status: 'completed' | 'current' | 'pending';
  action?: () => void;
}
interface CircleWallet {
  address?: string;
  balance?: string;
}

export default function OnboardingFlow() {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);

  const { data: circleWallet, isLoading } = useQuery<CircleWallet>({
    queryKey: ["/api/user-circle/balance"],
  });

  const hasWallet = circleWallet?.address;
  const hasBalance = circleWallet?.balance && parseFloat(circleWallet.balance) > 0;

  const steps: OnboardingStep[] = [
    {
      id: 'wallet',
      title: 'Circle Wallet Created',
      description: 'Your secure USDC wallet is ready to use',
      icon: Wallet,
      status: hasWallet ? 'completed' : 'current'
    },
    {
      id: 'deposit',
      title: 'Add USDC Funds',
      description: 'Deposit USDC to start making ultra-low cost payments',
      icon: DollarSign,
      status: hasBalance ? 'completed' : hasWallet ? 'current' : 'pending'
    },
    {
      id: 'explore',
      title: 'Explore Services',
      description: 'Discover AI marketplace, P2P transfers, and more',
      icon: Bot,
      status: hasBalance ? 'current' : 'pending'
    },
    {
      id: 'connect',
      title: 'Connect & Earn',
      description: 'Start earning with referrals and marketplace activities',
      icon: Users,
      status: hasBalance ? 'current' : 'pending'
    }
  ];

  const completedSteps = steps.filter(step => step.status === 'completed').length;
  const progress = (completedSteps / steps.length) * 100;

  if (isLoading) {
    return (
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
          <CardDescription>Loading your account status...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (completedSteps === steps.length) {
    return (
      <Card className="w-full max-w-2xl border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-800">
            <CheckCircle className="w-5 h-5" />
            Account Setup Complete!
          </CardTitle>
          <CardDescription className="text-green-700">
            Your account is fully set up and ready to use all platform features.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Button className="flex-1">
              <Bot className="w-4 h-4 mr-2" />
              Explore AI Marketplace
            </Button>
            <Button variant="outline" className="flex-1">
              <Users className="w-4 h-4 mr-2" />
              Start P2P Transfer
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Getting Started</span>
          <Badge variant="outline">{completedSteps}/3 Steps</Badge>
        </CardTitle>
        <CardDescription>
          Complete these steps to unlock the full potential of your USDC wallet
        </CardDescription>
        <Progress value={progress} className="mt-2" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                step.status === 'completed' ? 'bg-green-100 text-green-600' :
                step.status === 'current' ? 'bg-blue-100 text-blue-600' :
                'bg-gray-100 text-gray-400'
              }`}>
                {step.status === 'completed' ? 
                  <CheckCircle className="w-5 h-5" /> : 
                  <step.icon className="w-5 h-5" />
                }
              </div>
              
              <div className="flex-1">
                <h3 className={`font-semibold ${
                  step.status === 'completed' ? 'text-green-800' :
                  step.status === 'current' ? 'text-blue-800' :
                  'text-gray-600'
                }`}>
                  {step.title}
                </h3>
                <p className="text-sm text-gray-600">{step.description}</p>
                
                {step.status === 'current' && (
                  <div className="mt-2">
                    {step.id === 'wallet' && (
                      <div className="text-sm text-green-600 font-medium">
                        ✅ Your wallet address: {circleWallet?.address || 'Creating...'}
                      </div>
                    )}
                    {step.id === 'deposit' && (
                      <Button size="sm" className="mt-1">
                        <ArrowRight className="w-4 h-4 mr-1" />
                        Add USDC Now
                      </Button>
                    )}
                    {step.id === 'explore' && (
                      <Button size="sm" className="mt-1">
                        <ArrowRight className="w-4 h-4 mr-1" />
                        Explore Services
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <div className="text-sm text-blue-800">
            <strong>💡 Next Step:</strong> {
              !hasWallet ? 'Your wallet is being created automatically' :
              !hasBalance ? 'Add USDC to your wallet to unlock all features' :
              'You\'re ready to explore all platform services!'
            }
          </div>
        </div>
      </CardContent>
    </Card>
  );
}