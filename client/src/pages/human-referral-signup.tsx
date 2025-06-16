import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  Users, 
  DollarSign, 
  CheckCircle, 
  ArrowRight,
  Gift,
  TrendingUp
} from "@/lib/icons";

export default function HumanReferralSignup() {
  const [, setLocation] = useLocation();
  const [referralCode, setReferralCode] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [isRegistered, setIsRegistered] = useState<boolean>(false);
  const { toast } = useToast();

  // Extract referral code from URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref');
    if (ref) {
      setReferralCode(ref);
    }
  }, []);

  // Register user with referral mutation
  const registerMutation = useMutation({
    mutationFn: async (userData: any) => {
      // First create the user account (simplified for demo)
      const userId = `user_${Date.now()}`;
      
      // Then register the referral relationship
      if (referralCode) {
        return await apiRequest("POST", "/api/referrals/register-human", {
          referralCode,
          userId
        });
      }
      
      return { success: true, message: "User registered successfully" };
    },
    onSuccess: (data: any) => {
      if (data?.success) {
        setIsRegistered(true);
        toast({
          title: "Welcome to Coin Railz!",
          description: "Your account has been created with referral benefits active",
        });
      } else {
        toast({
          title: "Registration Error",
          description: data?.message || "Registration failed",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Registration Failed",
        description: "Please try again or contact support",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !firstName || !lastName) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    registerMutation.mutate({
      email,
      firstName,
      lastName,
      referralCode
    });
  };

  if (isRegistered) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-6">
        <Card className="w-full max-w-md bg-white dark:bg-gray-800 shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">
              Welcome to Coin Railz!
            </CardTitle>
            <p className="text-gray-600 dark:text-gray-300 mt-2">
              Your account is ready with referral benefits active
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
              <h3 className="font-semibold text-green-800 dark:text-green-200 mb-2">
                Referral Benefits Active
              </h3>
              <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
                <li>• 2% reward for your first transaction ($5 minimum)</li>
                <li>• 1% ongoing rewards for all future transactions</li>
                <li>• $10 minimum transaction to qualify</li>
                <li>• Rewards paid automatically in USDT</li>
              </ul>
            </div>
            
            <div className="space-y-3">
              <Button 
                onClick={() => setLocation("/dashboard")}
                className="w-full"
                size="lg"
              >
                Start Using Coin Railz
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              
              <Button 
                onClick={() => setLocation("/buy-sell")}
                variant="outline"
                className="w-full"
              >
                Make Your First Transaction
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-6">
      <div className="w-full max-w-4xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Benefits Panel */}
          <div className="space-y-6">
            <div className="text-center lg:text-left">
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                Join Coin Railz
              </h1>
              {referralCode && (
                <div className="mb-4">
                  <Badge variant="secondary" className="text-lg px-4 py-2">
                    Referred by AI Agent: {referralCode}
                  </Badge>
                </div>
              )}
              <p className="text-xl text-gray-600 dark:text-gray-300">
                Get rewarded for every transaction with our AI-powered referral system
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                  <Gift className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    First Transaction Bonus
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    Earn 2% on your first transaction (minimum $5 reward)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Ongoing Rewards
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    Continue earning 1% on all future transactions
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Automatic Payouts
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300">
                    Rewards automatically credited to your USDT wallet
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Registration Form */}
          <Card className="bg-white dark:bg-gray-800 shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-center">
                Create Your Account
              </CardTitle>
              <p className="text-center text-gray-600 dark:text-gray-300">
                Start earning rewards on every transaction
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {referralCode && (
                  <div>
                    <Label htmlFor="referral-code">Referral Code</Label>
                    <Input
                      id="referral-code"
                      value={referralCode}
                      disabled
                      className="bg-gray-50 dark:bg-gray-700"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="first-name">First Name</Label>
                    <Input
                      id="first-name"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="last-name">Last Name</Label>
                    <Input
                      id="last-name"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  size="lg"
                  disabled={registerMutation.isPending}
                >
                  {registerMutation.isPending ? "Creating Account..." : "Create Account & Start Earning"}
                </Button>

                <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                  By creating an account, you agree to our Terms of Service and Privacy Policy
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}