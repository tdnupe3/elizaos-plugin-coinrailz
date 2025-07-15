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
    description: 'Secure, instant, and ultra-low cost payments with USDC',
    icon: Wallet,
    videoUrl: '/videos/usdc-setup.mp4',
    benefits: [
      '72% cheaper than traditional methods',
      '2-5 second settlement time',
      'No hidden fees or surprises',
      'Works globally, 24/7'
    ]
  },
  {
    id: 'p2p-transfers',
    title: 'Send Money Instantly',
    description: 'Fast P2P transfers to anyone, anywhere',
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
    description: 'Bank-level security for your peace of mind',
    icon: Shield,
    videoUrl: '/videos/security.mp4',
    benefits: [
      'End-to-end encryption',
      'Circle programmable wallets',
      'Multi-factor authentication',
      'Insurance protection'
    ]
  }
];

const faqs = [
  {
    question: "How do I get USDC?",
    answer: "You can buy USDC directly through our platform using your bank account or credit card. We support multiple purchase methods with competitive rates."
  },
  {
    question: "Is my money safe?",
    answer: "Yes! We use Circle's programmable wallets with bank-level security. Your funds are protected by encryption and stored in secure, regulated infrastructure."
  },
  {
    question: "What are the fees?",
    answer: "USDC transfers have ultra-low fees (1.25% total) compared to traditional methods (4.5%+). You can see exact fees before confirming any transaction."
  },
  {
    question: "How fast are transfers?",
    answer: "USDC transfers settle in 2-5 seconds. Other methods typically take 1-3 minutes. All transfers are processed instantly with real-time confirmations."
  },
  {
    question: "Can I use this internationally?",
    answer: "Yes! Our platform works globally. USDC enables instant cross-border payments without the high fees and delays of traditional banking."
  },
  {
    question: "How do I withdraw money?",
    answer: "You can withdraw USDC to your bank account or exchange it for other cryptocurrencies. Multiple withdrawal methods are available."
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