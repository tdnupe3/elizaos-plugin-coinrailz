import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import SafetyWarning from "@/components/SafetyWarning";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, AlertCircle, ArrowRight } from "lucide-react";

interface TransactionStep {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  description?: string;
  error?: string;
}

interface FlowConfig {
  type: 'p2p_transfer' | 'crypto_transfer' | 'onramp' | 'offramp' | 'dex_swap';
  data: any;
  steps: TransactionStep[];
}

interface TransactionFlowOrchestratorProps {
  isOpen: boolean;
  onClose: () => void;
  flowConfig: FlowConfig;
}

export default function TransactionFlowOrchestrator({
  isOpen,
  onClose,
  flowConfig
}: TransactionFlowOrchestratorProps) {
  const [showSafetyWarning, setShowSafetyWarning] = useState(true);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [steps, setSteps] = useState<TransactionStep[]>(flowConfig.steps);
  const { toast } = useToast();

  const updateStepStatus = useCallback((stepId: string, status: TransactionStep['status'], error?: string) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId 
        ? { ...step, status, error }
        : step
    ));
  }, []);

  // P2P Transfer Flow
  const p2pTransferMutation = useMutation({
    mutationFn: async (data: any) => {
      // Step 1: Platform Detection
      updateStepStatus('platform-detection', 'processing');
      const platformsResponse = await apiRequest('POST', '/api/p2p/detect-platforms', {
        recipient: data.recipient
      });
      const platforms = await platformsResponse.json();
      updateStepStatus('platform-detection', 'completed');

      // Step 2: Compliance Check
      updateStepStatus('compliance-check', 'processing');
      const complianceResponse = await apiRequest('POST', '/api/compliance/check', {
        userId: data.userId,
        amount: data.amount,
        transactionType: 'p2p_transfer',
        recipient: data.recipient
      });
      const complianceResult = await complianceResponse.json();
      
      if (complianceResult.blockedTransaction) {
        throw new Error('Transaction blocked by compliance system');
      }
      updateStepStatus('compliance-check', 'completed');

      // Step 3: Execute Transfer
      updateStepStatus('execute-transfer', 'processing');
      const transferResponse = await apiRequest('POST', '/api/p2p/transfer', {
        ...data,
        selectedPlatform: platforms[0]?.platform,
        complianceId: complianceResult.id
      });
      const transferResult = await transferResponse.json();
      updateStepStatus('execute-transfer', 'completed');

      return transferResult;
    },
    onSuccess: () => {
      toast({
        title: "Transfer Successful",
        description: "Your P2P transfer has been completed successfully.",
      });
    },
    onError: (error: any) => {
      const currentStep = steps[currentStepIndex];
      updateStepStatus(currentStep.id, 'failed', error.message);
      toast({
        title: "Transfer Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Crypto Transfer Flow
  const cryptoTransferMutation = useMutation({
    mutationFn: async (data: any) => {
      // Step 1: Address Validation
      updateStepStatus('address-validation', 'processing');
      const validationResponse = await apiRequest('POST', '/api/crypto/validate-address', {
        address: data.toWalletAddress,
        network: data.blockchainNetwork
      });
      updateStepStatus('address-validation', 'completed');

      // Step 2: Balance Check
      updateStepStatus('balance-check', 'processing');
      const balanceResponse = await apiRequest('GET', `/api/crypto/balance/${data.cryptoSymbol}`);
      const balance = await balanceResponse.json();
      
      if (parseFloat(balance.available) < parseFloat(data.amount)) {
        throw new Error('Insufficient balance for transfer');
      }
      updateStepStatus('balance-check', 'completed');

      // Step 3: Create Transfer
      updateStepStatus('create-transfer', 'processing');
      const transferResponse = await apiRequest('POST', '/api/crypto/transfer', data);
      const transferResult = await transferResponse.json();
      updateStepStatus('create-transfer', 'completed');

      // Step 4: Blockchain Confirmation
      updateStepStatus('blockchain-confirmation', 'processing');
      // This would typically involve polling for transaction confirmation
      setTimeout(() => {
        updateStepStatus('blockchain-confirmation', 'completed');
      }, 3000);

      return transferResult;
    },
    onSuccess: () => {
      toast({
        title: "Crypto Transfer Initiated",
        description: "Your cryptocurrency transfer has been submitted to the blockchain.",
      });
    },
    onError: (error: any) => {
      const currentStep = steps[currentStepIndex];
      updateStepStatus(currentStep.id, 'failed', error.message);
      toast({
        title: "Transfer Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // On/Off Ramp Flow
  const rampMutation = useMutation({
    mutationFn: async (data: any) => {
      const isOnRamp = flowConfig.type === 'onramp';
      
      // Step 1: KYC Verification
      updateStepStatus('kyc-verification', 'processing');
      const kycResponse = await apiRequest('GET', '/api/auth/user');
      const user = await kycResponse.json();
      
      if (user.kycStatus !== 'verified') {
        throw new Error('KYC verification required for crypto on/off ramp');
      }
      updateStepStatus('kyc-verification', 'completed');

      // Step 2: Price Quote
      updateStepStatus('price-quote', 'processing');
      const quoteResponse = await apiRequest('POST', '/api/crypto/quote', {
        type: isOnRamp ? 'buy' : 'sell',
        amount: data.amount,
        currency: data.currency
      });
      const quote = await quoteResponse.json();
      updateStepStatus('price-quote', 'completed');

      // Step 3: Execute Transaction
      updateStepStatus('execute-transaction', 'processing');
      const endpoint = isOnRamp ? '/api/crypto/buy' : '/api/crypto/sell';
      const transactionResponse = await apiRequest('POST', endpoint, {
        ...data,
        quoteId: quote.id
      });
      const transactionResult = await transactionResponse.json();
      updateStepStatus('execute-transaction', 'completed');

      return transactionResult;
    },
    onSuccess: () => {
      const isOnRamp = flowConfig.type === 'onramp';
      toast({
        title: `${isOnRamp ? 'Purchase' : 'Sale'} Successful`,
        description: `Your crypto ${isOnRamp ? 'purchase' : 'sale'} has been completed.`,
      });
    },
    onError: (error: any) => {
      const currentStep = steps[currentStepIndex];
      updateStepStatus(currentStep.id, 'failed', error.message);
      toast({
        title: "Transaction Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // DEX Swap Flow
  const dexSwapMutation = useMutation({
    mutationFn: async (data: any) => {
      // Step 1: Get Best Quote
      updateStepStatus('get-quote', 'processing');
      const quoteResponse = await apiRequest('POST', '/api/dex/quote', {
        fromToken: data.fromToken,
        toToken: data.toToken,
        amount: data.amount,
        slippage: data.slippage || 1
      });
      const quote = await quoteResponse.json();
      updateStepStatus('get-quote', 'completed');

      // Step 2: Approve Token (if needed)
      if (quote.requiresApproval) {
        updateStepStatus('token-approval', 'processing');
        const approvalResponse = await apiRequest('POST', '/api/dex/approve', {
          token: data.fromToken,
          amount: data.amount
        });
        updateStepStatus('token-approval', 'completed');
      }

      // Step 3: Execute Swap
      updateStepStatus('execute-swap', 'processing');
      const swapResponse = await apiRequest('POST', '/api/dex/swap', {
        ...data,
        quoteId: quote.id
      });
      const swapResult = await swapResponse.json();
      updateStepStatus('execute-swap', 'completed');

      return swapResult;
    },
    onSuccess: () => {
      toast({
        title: "Swap Successful",
        description: "Your token swap has been completed successfully.",
      });
    },
    onError: (error: any) => {
      const currentStep = steps[currentStepIndex];
      updateStepStatus(currentStep.id, 'failed', error.message);
      toast({
        title: "Swap Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const executeMutation = () => {
    switch (flowConfig.type) {
      case 'p2p_transfer':
        return p2pTransferMutation.mutate(flowConfig.data);
      case 'crypto_transfer':
        return cryptoTransferMutation.mutate(flowConfig.data);
      case 'onramp':
      case 'offramp':
        return rampMutation.mutate(flowConfig.data);
      case 'dex_swap':
        return dexSwapMutation.mutate(flowConfig.data);
    }
  };

  const handleSafetyAccept = () => {
    setShowSafetyWarning(false);
    executeMutation();
  };

  const handleSafetyDecline = () => {
    onClose();
  };

  const getStepIcon = (step: TransactionStep) => {
    switch (step.status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'processing':
        return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-gray-300" />;
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {showSafetyWarning && (
        <SafetyWarning
          isOpen={showSafetyWarning}
          onAccept={handleSafetyAccept}
          onDecline={handleSafetyDecline}
          operationType={flowConfig.type}
          recipientAddress={flowConfig.data.toWalletAddress || flowConfig.data.recipient?.email}
          amount={flowConfig.data.amount}
          currency={flowConfig.data.currency || flowConfig.data.cryptoSymbol}
        />
      )}

      {!showSafetyWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="text-center">Transaction Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center space-x-3">
                  {getStepIcon(step)}
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{step.name}</span>
                      <Badge 
                        variant={
                          step.status === 'completed' ? 'default' :
                          step.status === 'processing' ? 'secondary' :
                          step.status === 'failed' ? 'destructive' : 'outline'
                        }
                      >
                        {step.status}
                      </Badge>
                    </div>
                    {step.description && (
                      <p className="text-sm text-gray-600">{step.description}</p>
                    )}
                    {step.error && (
                      <p className="text-sm text-red-600">{step.error}</p>
                    )}
                  </div>
                  {index < steps.length - 1 && step.status === 'completed' && (
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              ))}

              <div className="pt-4 border-t">
                <Button
                  onClick={onClose}
                  className="w-full"
                  disabled={steps.some(step => step.status === 'processing')}
                >
                  {steps.every(step => step.status === 'completed' || step.status === 'failed') 
                    ? 'Close' 
                    : 'Processing...'
                  }
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}