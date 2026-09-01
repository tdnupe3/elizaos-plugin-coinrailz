import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  HelpCircle, 
  DollarSign, 
  Send, 
  Bot, 
  Wallet, 
  Shield,
  CheckCircle,
  ArrowRight,
  Video,
  FileText,
  MessageSquare
} from "@/lib/icons";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface GuidanceStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  videoUrl?: string;
  benefits: string[];
}

const guidanceSteps: GuidanceStep[] = [
  {
    id: 'usdc-wallet',
    title: 'Your USDC Wallet',
    description: 'On-chain USDC payment guidance for supported workflows',
    icon: Wallet,
    videoUrl: '/videos/usdc-setup.mp4',
    benefits: [
      'Use a wallet you control',
      'Network-dependent confirmation time',
      'Review network fees before submitting',
      'Works globally, 24/7'
    ]
  },
  {
    id: 'p2p-transfers',
    title: 'Send USDC On-Chain',
    description: 'USDC transfer workflows using a user-controlled wallet',
    icon: Send,
    videoUrl: '/videos/p2p-transfer.mp4',
    benefits: [
      'Send to email or username',
      'Multiple payment methods',
      'Real-time notifications',
      'Transaction history tracking'
    ]
  },
  {
    id: 'ai-marketplace',
    title: 'AI Marketplace',
    description: 'Hire AI agents or offer your services',
    icon: Bot,
    videoUrl: '/videos/ai-marketplace.mp4',
    benefits: [
      'Escrow protection for all orders',
      'Verified AI agents',
      'Milestone-based payments',
      'Quality guarantee'
    ]
  },
  {
    id: 'security',
    title: 'Security & Safety',
    description: 'Security guidance for on-chain wallet use',
    icon: Shield,
    videoUrl: '/videos/security.mp4',
    benefits: [
      'End-to-end encryption',
      'User-controlled wallet workflows',
      'Multi-factor authentication',
      'Wallet-security best practices'
    ]
  }
];

const faqs = [
  {
    question: "How do I get USDC?",
    answer: "Coin Railz does not currently offer fiat USDC purchases. You can obtain USDC through a wallet or provider of your choice for supported on-chain payment flows."
  },
  {
    question: "Is my money safe?",
    answer: "Use a wallet you control and follow wallet-security best practices. On-chain transactions and wallet security involve risk, and Coin Railz does not provide custody or deposit insurance."
  },
  {
    question: "What are the fees?",
    answer: "USDC transfers have ultra-low fees (1.25% total) compared to traditional methods (4.5%+). You can see exact fees before confirming any transaction."
  },
  {
    question: "How fast are transfers?",
    answer: "Confirmation time and transaction fees depend on the selected blockchain network and its current conditions."
  },
  {
    question: "Can I use this internationally?",
    answer: "Coin Railz supports on-chain USDC payment workflows. It does not currently provide cross-border remittance, bank delivery, or foreign-exchange services."
  },
  {
    question: "How do I withdraw money?",
    answer: "Coin Railz does not currently offer bank withdrawals or fiat off-ramp services. Use a wallet or provider of your choice for conversion outside Coin Railz."
  }
];

export function UserGuidanceModal() {
  const [selectedStep, setSelectedStep] = useState<string>('usdc-wallet');

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <HelpCircle className="h-4 w-4 mr-2" />
          Help & Guide
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Platform Guide</DialogTitle>
          <DialogDescription>
            Learn how to use Coin Railz for fast, secure financial services
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="features" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="features">Features</TabsTrigger>
            <TabsTrigger value="tutorials">Tutorials</TabsTrigger>
            <TabsTrigger value="faq">FAQ</TabsTrigger>
          </TabsList>
          
          <TabsContent value="features" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {guidanceSteps.map((step) => (
                <Card 
                  key={step.id} 
                  className={`cursor-pointer transition-all ${
                    selectedStep === step.id 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' 
                      : 'hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedStep(step.id)}
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center text-base">
                      <step.icon className="h-5 w-5 mr-2" />
                      {step.title}
                    </CardTitle>
                    <CardDescription className="text-sm">
                      {step.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {step.benefits.map((benefit, index) => (
                        <div key={index} className="flex items-center text-sm">
                          <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                          {benefit}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="tutorials" className="space-y-4">
            <Alert>
              <Video className="h-4 w-4" />
              <AlertDescription>
                Step-by-step video tutorials to get you started quickly
              </AlertDescription>
            </Alert>
            
            <div className="space-y-3">
              {guidanceSteps.map((step) => (
                <Card key={step.id}>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center justify-between text-base">
                      <div className="flex items-center">
                        <step.icon className="h-5 w-5 mr-2" />
                        {step.title}
                      </div>
                      <Badge variant="outline">3 min</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        {step.description}
                      </p>
                      <Button size="sm" variant="ghost" disabled>
                        <Video className="h-4 w-4 mr-1" />
                        Watch
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="faq" className="space-y-4">
            <Alert>
              <MessageSquare className="h-4 w-4" />
              <AlertDescription>
                Frequently asked questions about using Coin Railz
              </AlertDescription>
            </Alert>
            
            <div className="space-y-3">
              {faqs.map((faq, index) => (
                <Card key={index}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">
                      {faq.question}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {faq.answer}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export function FeatureTooltip({ 
  children, 
  title, 
  description 
}: { 
  children: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent>
          <div className="max-w-xs">
            <p className="font-medium">{title}</p>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function USDCSavingsBadge({ amount }: { amount: number }) {
  const traditionalFee = amount * 0.045 + 7.50;
  const usdcFee = amount * 0.0125 + 1.00;
  const savings = traditionalFee - usdcFee;
  const savingsPercentage = ((savings / traditionalFee) * 100).toFixed(0);
  
  if (amount <= 0) return null;
  
  return (
    <FeatureTooltip
      title="USDC Savings"
      description={`Traditional methods charge ~4.5% + fees. USDC only charges 1.25% total. You save $${savings.toFixed(2)} (${savingsPercentage}%) on this transaction.`}
    >
      <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-200 cursor-help">
        <DollarSign className="h-3 w-3 mr-1" />
        {savingsPercentage}% Savings
      </Badge>
    </FeatureTooltip>
  );
}