import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { NavigationHeader } from "@/components/navigation-header";
import { Share2, Copy, Users, DollarSign, Gift, Clock, Sparkles, Trophy, Star } from "@/lib/icons";
import ReferralAPITest from "@/components/ReferralAPITest";

export default function Referrals() {
  const [referralCodeInput, setReferralCodeInput] = useState("");
  const { toast } = useToast();

  const { data: referralStats, isLoading } = useQuery({
    queryKey: ["/api/referrals/my-stats"],
  });

  // Type-safe access to referral stats
  const stats = referralStats || {};

  const generateCodeMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/referrals/generate-link"),
    onSuccess: (response) => {
      toast({
        title: "Referral Code Generated",
        description: "Your new referral code is ready to share!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/referrals/my-stats"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate referral code",
        variant: "destructive",
      });
    },
  });

  const applyReferralMutation = useMutation({
    mutationFn: (referralCode: string) =>
      apiRequest("POST", "/api/referrals/process-signup", { referralCode }),
    onSuccess: () => {
      toast({
        title: "Referral Applied",
        description: "You'll receive your bonus after your first transaction!",
      });
      setReferralCodeInput("");
      queryClient.invalidateQueries({ queryKey: ["/api/referrals/my-stats"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to apply referral code",
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Referral code copied to clipboard",
    });
  };

  const shareReferral = () => {
    const referralUrl = `${window.location.origin}?ref=${(stats as any)?.referralCode}`;
    if (navigator.share) {
      navigator.share({
        title: "Join Coin Railz",
        text: "Join Coin Railz and earn commission bonuses on transactions using my referral code!",
        url: referralUrl,
      });
    } else {
      copyToClipboard(referralUrl);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-sky-50 dark:from-emerald-950 dark:to-sky-950">
        <NavigationHeader />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-sky-50 dark:from-emerald-950 dark:to-sky-950">
      <NavigationHeader />
      
      <div className="container mx-auto px-4 py-8">

        
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center space-x-2">
              <Sparkles className="h-8 w-8 text-purple-500 animate-pulse" />
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-emerald-600 bg-clip-text text-transparent">
                Referral Program
              </h1>
              <Sparkles className="h-8 w-8 text-purple-500 animate-pulse" />
            </div>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              Earn commission for every friend you refer to Coin Railz!
            </p>
            <div className="flex items-center justify-center space-x-1 text-emerald-600">
              <Star className="h-4 w-4 fill-current" />
              <Star className="h-4 w-4 fill-current" />
              <Star className="h-4 w-4 fill-current" />
              <Star className="h-4 w-4 fill-current" />
              <Star className="h-4 w-4 fill-current" />
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900 dark:to-purple-800 border-purple-200 dark:border-purple-700">
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <div className="relative">
                    <Users className="h-8 w-8 text-purple-600" />
                    {(stats as any)?.totalReferrals > 0 && (
                      <Trophy className="h-4 w-4 text-cyan-400 absolute -top-1 -right-1" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-purple-700 dark:text-purple-300">
                      Total Referrals
                    </p>
                    <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                      {(stats as any)?.totalReferrals || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900 dark:to-emerald-800 border-emerald-200 dark:border-emerald-700">
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <div className="relative">
                    <DollarSign className="h-8 w-8 text-emerald-600" />
                    {(stats as any)?.totalEarned > 0 && (
                      <Sparkles className="h-4 w-4 text-cyan-400 absolute -top-1 -right-1 animate-pulse" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                      Total Earned
                    </p>
                    <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                      ${(stats as any)?.totalEarned?.toFixed(2) || "0.00"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900 dark:to-blue-800 border-blue-200 dark:border-blue-700">
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Gift className="h-8 w-8 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      Completed
                    </p>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                      {(stats as any)?.completedReferrals || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border-slate-200 dark:border-slate-700">
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Clock className="h-8 w-8 text-slate-600 animate-pulse" />
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Pending
                    </p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                      {(stats as any)?.pendingReferrals || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Your Referral Code */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Share2 className="h-5 w-5" />
                <span>Your Referral Code</span>
              </CardTitle>
              <CardDescription>
                Share this code with friends to earn commission on their transactions (0.3-0.6% based on amount)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(stats as any)?.referralCode ? (
                <div className="flex items-center space-x-2">
                  <Input
                    value={(stats as any).referralCode}
                    readOnly
                    className="font-mono text-lg"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard((stats as any).referralCode)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button onClick={shareReferral}>
                    <Share2 className="h-4 w-4 mr-2" />
                    Share
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-gray-600 dark:text-gray-300">
                    You don't have a referral code yet. Generate one to start earning!
                  </p>
                  <Button
                    onClick={() => generateCodeMutation.mutate()}
                    disabled={generateCodeMutation.isPending}
                    className="bg-gradient-to-r from-purple-600 to-emerald-600 hover:from-purple-700 hover:to-emerald-700 text-white font-semibold px-6 py-2 rounded-lg transition-all duration-300 transform hover:scale-105"
                  >
                    {generateCodeMutation.isPending ? (
                      <>
                        <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Gift className="h-4 w-4 mr-2" />
                        Generate Referral Code
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Apply Referral Code */}
          <Card>
            <CardHeader>
              <CardTitle>Have a Referral Code?</CardTitle>
              <CardDescription>
                Enter a friend's referral code to get commission bonuses on transactions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex space-x-2">
                <div className="flex-1">
                  <Label htmlFor="referralCode">Referral Code</Label>
                  <Input
                    id="referralCode"
                    placeholder="Enter referral code"
                    value={referralCodeInput}
                    onChange={(e) => setReferralCodeInput(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={() => applyReferralMutation.mutate(referralCodeInput)}
                    disabled={!referralCodeInput || applyReferralMutation.isPending}
                  >
                    {applyReferralMutation.isPending ? "Applying..." : "Apply"}
                  </Button>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                <span className="text-red-600 text-xs">*</span> Commission paid after qualifying transaction ($50+ minimum)
              </p>
            </CardContent>
          </Card>

          {/* How It Works */}
          <Card>
            <CardHeader>
              <CardTitle>How It Works</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900 rounded-full flex items-center justify-center mx-auto">
                    <span className="text-xl font-bold text-emerald-600">1</span>
                  </div>
                  <h3 className="font-semibold">Share Your Code</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Send your referral code to friends and family
                  </p>
                </div>
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900 rounded-full flex items-center justify-center mx-auto">
                    <span className="text-xl font-bold text-emerald-600">2</span>
                  </div>
                  <h3 className="font-semibold">They Join & Transact</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Your friend signs up and makes a qualifying transaction ($50+ minimum)
                  </p>
                </div>
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900 rounded-full flex items-center justify-center mx-auto">
                    <span className="text-xl font-bold text-emerald-600">3</span>
                  </div>
                  <h3 className="font-semibold">Earn Commission</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    You earn 0.3-0.6% commission based on transaction amount (max $15)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}