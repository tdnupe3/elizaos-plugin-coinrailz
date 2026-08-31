import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BookUser, Shield, Send, Zap, Clock, TrendingDown, AlertCircle } from "@/lib/icons";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { sendMoneySchema, type SendMoney } from "@shared/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { TransactionModal } from "./transaction-modal";
import { useState } from "react";

type SendMoneyInput = Omit<SendMoney, "currency"> & { currency?: string };

export function SendMoneyForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<'usd' | 'xrp' | 'crypto'>('usd');
  const [feeCalculation, setFeeCalculation] = useState<any>(null);

  const form = useForm<SendMoneyInput, unknown, SendMoney>({
    resolver: zodResolver(sendMoneySchema),
    defaultValues: {
      toEmail: "",
      amount: "",
      message: "",
      securityPin: "",
    },
  });

  // Real-time XRP fee calculation
  const { data: xrpFees } = useQuery({
    queryKey: ['/api/fees/calculate-xrp', form.watch('amount')],
    queryFn: async () => {
      const amount = parseFloat(form.watch('amount'));
      if (!amount || amount <= 0) return null;
      
      const response = await fetch('/api/fees/calculate-xrp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount })
      });
      
      const data = await response.json();
      return data.success ? data.fees : null;
    },
    enabled: paymentMethod === 'xrp' && !!form.watch('amount') && parseFloat(form.watch('amount')) > 0
  });

  // Check user's XRP wallet status
  const { data: xrpWallet } = useQuery({
    queryKey: ['/api/wallets/xrp', user?.id],
    queryFn: async () => {
      const response = await fetch('/api/wallets/xrp');
      return response.json();
    },
    enabled: !!user && paymentMethod === 'xrp'
  });

  const sendMoneyMutation = useMutation({
    mutationFn: async (data: SendMoney) => {
      // For XRP payments, check wallet connection first
      if (paymentMethod === 'xrp') {
        if (!xrpWallet?.isConnected) {
          throw new Error('Please connect your XRP wallet first in Wallet Management');
        }
        
        // Check sufficient balance
        const requiredAmount = parseFloat(data.amount);
        const totalCost = xrpFees?.totalCost || requiredAmount;
        
        if (xrpWallet.balance < totalCost) {
          throw new Error(`Insufficient XRP balance. Required: ${totalCost.toFixed(6)} XRP, Available: ${xrpWallet.balance.toFixed(6)} XRP`);
        }
      }

      const endpoint = paymentMethod === 'xrp' ? '/api/xrp/send' : '/api/transactions/send';
      const payload = paymentMethod === 'xrp' ? {
        ...data,
        paymentMethod: 'xrp',
        amount: parseFloat(data.amount),
        fromWallet: xrpWallet?.address
      } : data;
      
      const response = await apiRequest("POST", endpoint, payload);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Payment sent successfully",
      });
      setLastTransaction(data.transaction);
      setShowModal(true);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send payment",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SendMoney) => {
    sendMoneyMutation.mutate(data);
  };

  return (
    <>
      <Card className="bg-white shadow-sm border border-neutral-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-semibold text-neutral-800">Send Money</CardTitle>
            <div className="flex space-x-2">
              <Button 
                size="sm" 
                onClick={() => setPaymentMethod('usd')}
                className={paymentMethod === 'usd' ? "bg-blue-600 text-white" : ""}
                variant={paymentMethod === 'usd' ? "default" : "outline"}
              >
                USD
              </Button>
              <Button 
                size="sm" 
                onClick={() => setPaymentMethod('xrp')}
                className={paymentMethod === 'xrp' ? "bg-blue-600 text-white" : ""}
                variant={paymentMethod === 'xrp' ? "default" : "outline"}
              >
                <Zap className="w-3 h-3 mr-1" />
                XRP
              </Button>
              <Button 
                size="sm" 
                onClick={() => setPaymentMethod('crypto')}
                className={paymentMethod === 'crypto' ? "bg-blue-600 text-white" : ""}
                variant={paymentMethod === 'crypto' ? "default" : "outline"}
              >
                Crypto
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Recipient Input */}
            <div>
              <Label htmlFor="toEmail" className="text-sm font-medium text-neutral-700 mb-2">Send to</Label>
              <div className="relative">
                <Input
                  id="toEmail"
                  type="email"
                  placeholder="Enter email, phone, or username"
                  className="pr-10"
                  {...form.register("toEmail")}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  <BookUser className="w-4 h-4" />
                </Button>
              </div>
              {form.formState.errors.toEmail && (
                <p className="text-sm text-red-500 mt-1">{form.formState.errors.toEmail.message}</p>
              )}
            </div>

            {/* Amount Input */}
            <div>
              <Label htmlFor="amount" className="text-sm font-medium text-neutral-700 mb-2">Amount</Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neutral-500 font-medium">$</span>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="pl-8 text-xl font-semibold"
                  {...form.register("amount")}
                />
              </div>
              <p className="text-sm text-neutral-500 mt-2">
                Available: {user?.usdBalance ? `$${parseFloat(user.usdBalance).toFixed(2)}` : "$0.00"}
              </p>
              {form.formState.errors.amount && (
                <p className="text-sm text-red-500 mt-1">{form.formState.errors.amount.message}</p>
              )}
              
              {/* Fee Breakdown */}
              {form.watch("amount") && parseFloat(form.watch("amount")) > 0 && (
                <div className="mt-4">
                  {paymentMethod === 'xrp' && xrpFees ? (
                    <div className="bg-gradient-to-r from-blue-50 to-emerald-50 p-4 rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <Zap className="w-4 h-4 text-blue-600" />
                          <span className="font-medium text-blue-800">XRP Lightning Transfer</span>
                        </div>
                        <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          3-5 seconds
                        </Badge>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Amount:</span>
                          <span className="font-medium">${parseFloat(form.watch("amount")).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Service Fee:</span>
                          <span className="font-medium">${xrpFees.serviceFee?.toFixed(2) || '0.00'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Platform Fee:</span>
                          <span className="font-medium">${xrpFees.platformFee?.toFixed(2) || '0.00'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Network Fee:</span>
                          <span className="font-medium">${xrpFees.networkFee?.toFixed(2) || '0.00'}</span>
                        </div>
                        <div className="border-t pt-2 flex justify-between">
                          <span className="font-semibold text-blue-800">Total Cost:</span>
                          <span className="font-bold text-blue-800">${xrpFees.totalCost?.toFixed(2) || '0.00'}</span>
                        </div>
                      </div>
                      
                      <div className="mt-3 flex items-center space-x-4 text-xs">
                        <div className="flex items-center text-emerald-600">
                          <TrendingDown className="w-3 h-3 mr-1" />
                          <span>{xrpFees.savingsPercentage || 0}% savings vs wire</span>
                        </div>
                        <div className="flex items-center text-blue-600">
                          <Zap className="w-3 h-3 mr-1" />
                          <span>Instant settlement</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-emerald-700 font-medium">Total Cost:</span>
                        <span className="text-emerald-700 font-semibold">${(parseFloat(form.watch("amount")) + parseFloat(form.watch("amount")) * 0.01).toFixed(2)}</span>
                      </div>
                      <p className="text-xs text-gray-400">
                        Includes 1% Coin Railz fee. See terms for details.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Message Input */}
            <div>
              <Label htmlFor="message" className="text-sm font-medium text-neutral-700 mb-2">Message (optional)</Label>
              <Input
                id="message"
                placeholder="What's this for?"
                {...form.register("message")}
              />
            </div>

            {/* Security PIN */}
            <div>
              <Label htmlFor="securityPin" className="text-sm font-medium text-neutral-700 mb-2">Security PIN</Label>
              <Input
                id="securityPin"
                type="password"
                maxLength={6}
                placeholder="Enter 6-digit PIN"
                {...form.register("securityPin")}
              />
              {form.formState.errors.securityPin && (
                <p className="text-sm text-red-500 mt-1">{form.formState.errors.securityPin.message}</p>
              )}
            </div>

            {/* Security Options */}
            <div className="bg-neutral-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Shield className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-neutral-800">Security PIN Required</p>
                    <p className="text-sm text-neutral-500">Protect your transaction</p>
                  </div>
                </div>
                <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                </div>
              </div>
            </div>

            {/* XRP Wallet Connection Alert */}
            {paymentMethod === 'xrp' && !xrpWallet?.isConnected && (
              <Alert>
                <AlertCircle className="w-4 h-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>Connect your XRP wallet to enable lightning-fast transfers</span>
                  <Button 
                    size="sm" 
                    onClick={() => window.open('/wallet-management', '_blank')}
                    className="ml-2"
                  >
                    Connect Wallet
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Submit Button */}
            <Button 
              type="submit" 
              className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold hover:bg-blue-700 flex items-center justify-center space-x-2"
              disabled={sendMoneyMutation.isPending || (paymentMethod === 'xrp' && !xrpWallet?.isConnected)}
            >
              {paymentMethod === 'xrp' ? (
                <Zap className="w-4 h-4" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>
                {sendMoneyMutation.isPending 
                  ? "Sending..." 
                  : paymentMethod === 'xrp' 
                    ? !xrpWallet?.isConnected
                      ? "Connect XRP Wallet First"
                      : "Send via XRP Lightning" 
                    : "Send Money"
                }
              </span>
            </Button>
          </form>
        </CardContent>
      </Card>

      <TransactionModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        transaction={lastTransaction}
      />
    </>
  );
}
