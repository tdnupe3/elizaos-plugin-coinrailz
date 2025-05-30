import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BookUser, Shield, Send } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { sendMoneySchema, type SendMoney } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { TransactionModal } from "./transaction-modal";
import { useState } from "react";

export function SendMoneyForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<any>(null);

  const form = useForm<SendMoney>({
    resolver: zodResolver(sendMoneySchema),
    defaultValues: {
      toEmail: "",
      amount: "",
      message: "",
      securityPin: "",
    },
  });

  const sendMoneyMutation = useMutation({
    mutationFn: async (data: SendMoney) => {
      const response = await apiRequest("POST", "/api/transactions/send", data);
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
              <Button size="sm" className="bg-blue-600 text-white">USD</Button>
              <Button size="sm" variant="outline">Crypto</Button>
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
                <div className="mt-4 space-y-1">
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

            {/* Submit Button */}
            <Button 
              type="submit" 
              className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold hover:bg-blue-700 flex items-center justify-center space-x-2"
              disabled={sendMoneyMutation.isPending}
            >
              <Send className="w-4 h-4" />
              <span>{sendMoneyMutation.isPending ? "Sending..." : "Send Money"}</span>
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
