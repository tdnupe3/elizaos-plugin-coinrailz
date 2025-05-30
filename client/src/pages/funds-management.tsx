import { NavigationHeader } from "@/components/navigation-header";
import { MobileNavigation } from "@/components/mobile-navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, CreditCard, Building, Smartphone, Shield } from "lucide-react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { depositFundsSchema, withdrawFundsSchema, type DepositFunds, type WithdrawFunds } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";

export default function FundsManagement() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("deposit");

  // Get URL params to determine initial tab
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get("action");
    if (action === "withdraw") {
      setActiveTab("withdraw");
    }
  }, []);

  const depositForm = useForm<DepositFunds>({
    resolver: zodResolver(depositFundsSchema),
    defaultValues: {
      amount: "",
      paymentMethod: "bank_transfer",
    },
  });

  const withdrawForm = useForm<WithdrawFunds>({
    resolver: zodResolver(withdrawFundsSchema),
    defaultValues: {
      amount: "",
      bankAccount: "",
      securityPin: "",
    },
  });

  const depositMutation = useMutation({
    mutationFn: async (data: DepositFunds) => {
      const response = await apiRequest("POST", "/api/funds/deposit", data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Funds deposited successfully",
      });
      depositForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to deposit funds",
        variant: "destructive",
      });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async (data: WithdrawFunds) => {
      const response = await apiRequest("POST", "/api/funds/withdraw", data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Withdrawal processed successfully",
      });
      withdrawForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to process withdrawal",
        variant: "destructive",
      });
    },
  });

  const onDepositSubmit = (data: DepositFunds) => {
    depositMutation.mutate(data);
  };

  const onWithdrawSubmit = (data: WithdrawFunds) => {
    withdrawMutation.mutate(data);
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method) {
      case "credit_card":
        return <CreditCard className="w-5 h-5" />;
      case "debit_card":
        return <CreditCard className="w-5 h-5" />;
      case "bank_transfer":
        return <Building className="w-5 h-5" />;
      default:
        return <CreditCard className="w-5 h-5" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <NavigationHeader />
      <MobileNavigation />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20 md:pb-8">
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => setLocation("/")}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-neutral-800">Funds Management</h1>
          <p className="text-neutral-500">Add money or withdraw to your bank account</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="deposit">Add Money</TabsTrigger>
                <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
              </TabsList>

              <TabsContent value="deposit">
                <Card>
                  <CardHeader>
                    <CardTitle>Add Money to Your Account</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={depositForm.handleSubmit(onDepositSubmit)} className="space-y-6">
                      <div>
                        <Label>Payment Method</Label>
                        <Select 
                          value={depositForm.watch("paymentMethod")} 
                          onValueChange={(value: any) => depositForm.setValue("paymentMethod", value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose payment method" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="bank_transfer">
                              <div className="flex items-center space-x-2">
                                <Building className="w-4 h-4" />
                                <span>Bank Transfer</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="debit_card">
                              <div className="flex items-center space-x-2">
                                <CreditCard className="w-4 h-4" />
                                <span>Debit Card</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="credit_card">
                              <div className="flex items-center space-x-2">
                                <CreditCard className="w-4 h-4" />
                                <span>Credit Card</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label>Amount</Label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neutral-500 font-medium">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            className="pl-8 text-xl font-semibold"
                            {...depositForm.register("amount")}
                          />
                        </div>
                        {depositForm.formState.errors.amount && (
                          <p className="text-sm text-red-500 mt-1">{depositForm.formState.errors.amount.message}</p>
                        )}
                      </div>

                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center space-x-3">
                          <Shield className="w-5 h-5 text-blue-600" />
                          <div>
                            <p className="font-medium text-blue-900">Secure Payment</p>
                            <p className="text-sm text-blue-700">Your payment information is encrypted and secure</p>
                          </div>
                        </div>
                      </div>

                      <Button 
                        type="submit" 
                        className="w-full bg-blue-600 hover:bg-blue-700"
                        disabled={depositMutation.isPending}
                      >
                        {depositMutation.isPending ? "Processing..." : "Add Money"}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="withdraw">
                <Card>
                  <CardHeader>
                    <CardTitle>Withdraw to Bank Account</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={withdrawForm.handleSubmit(onWithdrawSubmit)} className="space-y-6">
                      <div>
                        <Label>Amount</Label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-neutral-500 font-medium">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            className="pl-8 text-xl font-semibold"
                            {...withdrawForm.register("amount")}
                          />
                        </div>
                        <p className="text-sm text-neutral-500 mt-2">
                          Available: {user?.usdBalance ? `$${parseFloat(user.usdBalance).toFixed(2)}` : "$0.00"}
                        </p>
                        {withdrawForm.formState.errors.amount && (
                          <p className="text-sm text-red-500 mt-1">{withdrawForm.formState.errors.amount.message}</p>
                        )}
                      </div>

                      <div>
                        <Label>Bank Account</Label>
                        <Input
                          placeholder="Enter bank account details"
                          {...withdrawForm.register("bankAccount")}
                        />
                        {withdrawForm.formState.errors.bankAccount && (
                          <p className="text-sm text-red-500 mt-1">{withdrawForm.formState.errors.bankAccount.message}</p>
                        )}
                      </div>

                      <div>
                        <Label>Security PIN</Label>
                        <Input
                          type="password"
                          maxLength={6}
                          placeholder="Enter 6-digit PIN"
                          {...withdrawForm.register("securityPin")}
                        />
                        {withdrawForm.formState.errors.securityPin && (
                          <p className="text-sm text-red-500 mt-1">{withdrawForm.formState.errors.securityPin.message}</p>
                        )}
                      </div>

                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center space-x-3">
                          <Shield className="w-5 h-5 text-slate-600" />
                          <div>
                            <p className="font-medium text-slate-900">Processing Time</p>
                            <p className="text-sm text-slate-700">Withdrawals typically take 1-3 business days</p>
                          </div>
                        </div>
                      </div>

                      <Button 
                        type="submit" 
                        className="w-full bg-red-600 hover:bg-red-700"
                        disabled={withdrawMutation.isPending}
                      >
                        {withdrawMutation.isPending ? "Processing..." : "Withdraw Funds"}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
          
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Account Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-600">Current Balance</span>
                    <span className="font-semibold text-lg">
                      {user?.usdBalance ? `$${parseFloat(user.usdBalance).toFixed(2)}` : "$0.00"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-600">Account Status</span>
                    <span className="text-green-600 font-medium">Active</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-600">Daily Limit</span>
                    <span className="text-neutral-800">$10,000</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Supported Methods</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <Building className="w-5 h-5 text-blue-600" />
                    <span className="text-neutral-700">Bank Transfer</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <CreditCard className="w-5 h-5 text-green-600" />
                    <span className="text-neutral-700">Debit Card</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <CreditCard className="w-5 h-5 text-purple-600" />
                    <span className="text-neutral-700">Credit Card</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}