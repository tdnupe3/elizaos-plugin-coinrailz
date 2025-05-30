import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { NavigationHeader } from "@/components/navigation-header";
import { Share2, Copy, Users, DollarSign, Gift, Clock } from "lucide-react";

export default function Referrals() {
  const [referralCodeInput, setReferralCodeInput] = useState("");
  const { toast } = useToast();

  const { data: referralStats, isLoading } = useQuery({
    queryKey: ["/api/referrals/stats"],
  });

  // Type-safe access to referral stats
  const stats = referralStats || {};

  const generateCodeMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/referrals/generate-code"),
    onSuccess: (response) => {
      toast({
        title: "Referral Code Generated",
        description: "Your new referral code is ready to share!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/referrals/stats"] });
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
      apiRequest("POST", "/api/referrals/apply", { referralCode }),
    onSuccess: () => {
      toast({
        title: "Referral Applied",
        description: "You'll receive your bonus after your first transaction!",
      });
      setReferralCodeInput("");
      queryClient.invalidateQueries({ queryKey: ["/api/referrals/stats"] });
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
        text: "Get $15 bonus when you join Coin Railz using my referral code!",
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
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Referral Program
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Earn $15 for every friend you refer to Coin Railz
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Users className="h-8 w-8 text-emerald-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                      Total Referrals
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {(stats as any)?.totalReferrals || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-8 w-8 text-emerald-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                      Total Earned
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      ${referralStats?.totalEarned?.toFixed(2) || "0.00"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Gift className="h-8 w-8 text-emerald-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                      Completed
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {referralStats?.completedReferrals || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Clock className="h-8 w-8 text-amber-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                      Pending
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {referralStats?.pendingReferrals || 0}
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
                Share this code with friends to earn $15 for each successful referral
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {referralStats?.referralCode ? (
                <div className="flex items-center space-x-2">
                  <Input
                    value={referralStats.referralCode}
                    readOnly
                    className="font-mono text-lg"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(referralStats.referralCode)}
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
                  >
                    {generateCodeMutation.isPending ? "Generating..." : "Generate Referral Code"}
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
                Enter a friend's referral code to get your $15 bonus
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
                <span className="text-red-600 text-xs">*</span> Bonus is paid after your first transaction
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
                    Your friend signs up and makes their first transaction
                  </p>
                </div>
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900 rounded-full flex items-center justify-center mx-auto">
                    <span className="text-xl font-bold text-emerald-600">3</span>
                  </div>
                  <h3 className="font-semibold">Both Get $15</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    You and your friend each receive $15 bonus
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