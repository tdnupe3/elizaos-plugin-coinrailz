import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { DollarSign, Send, Shield, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { z } from "zod";

const enhancedSendMoneySchema = z.object({
  toEmail: z.string().email("Invalid email address").optional(),
  toPhoneNumber: z.string().optional(),
  amount: z.string().refine((val) => parseFloat(val) > 0, "Amount must be greater than 0"),
  message: z.string().optional(),
  securityPin: z.string().length(6, "Security PIN must be 6 digits"),
  selectedPlatform: z.string().optional(),
}).refine((data) => data.toEmail || data.toPhoneNumber, {
  message: "Either email or phone number is required",
  path: ["toEmail"],
});

type EnhancedSendMoney = z.infer<typeof enhancedSendMoneySchema>;

interface PlatformOption {
  platform: string;
  available: boolean;
  fee: number;
  estimatedTime: string;
  confidence: number;
}

export function EnhancedSendMoneyForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [detectedPlatforms, setDetectedPlatforms] = useState<PlatformOption[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState("");

  const form = useForm<EnhancedSendMoney>({
    resolver: zodResolver(enhancedSendMoneySchema),
    defaultValues: {
      toEmail: "",
      toPhoneNumber: "",
      amount: "",
      message: "",
      securityPin: "",
      selectedPlatform: "",
    },
  });

  // Platform detection when recipient changes
  const { data: platformData, refetch: detectPlatforms } = useQuery({
    queryKey: ["/api/p2p/detect-platforms", form.watch("toEmail"), form.watch("toPhoneNumber")],
    queryFn: async () => {
      const email = form.watch("toEmail");
      const phoneNumber = form.watch("toPhoneNumber");
      
      if (!email && !phoneNumber) return null;
      
      const response = await apiRequest("POST", "/api/p2p/detect-platforms", {
        email,
        phoneNumber,
      });
      return response.json();
    },
    enabled: false,
  });

  useEffect(() => {
    if (platformData?.platforms) {
      setDetectedPlatforms(platformData.platforms);
    }
  }, [platformData]);

  const sendMutation = useMutation({
    mutationFn: async (data: EnhancedSendMoney) => {
      const response = await apiRequest("POST", "/api/transactions/send", data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Transfer Initiated",
        description: `Money sent via ${data.platform}. Transaction ID: ${data.messageId}`,
      });
      form.reset();
      setDetectedPlatforms([]);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/balance"] });
    },
    onError: (error: any) => {
      toast({
        title: "Transfer Failed",
        description: error.message || "Failed to send money",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EnhancedSendMoney) => {
    sendMutation.mutate(data);
  };

  const handleRecipientChange = (field: "toEmail" | "toPhoneNumber", value: string) => {
    form.setValue(field, value);
    setSelectedRecipient(value);
    
    // Detect platforms when recipient has valid input
    if (value && (field === "toEmail" ? value.includes("@") : value.length >= 10)) {
      setTimeout(() => detectPlatforms(), 500); // Debounce platform detection
    }
  };

  const calculateTotalCost = () => {
    const amount = parseFloat(form.watch("amount") || "0");
    const selectedPlatform = form.watch("selectedPlatform");
    
    if (!selectedPlatform || selectedPlatform === "Coin Railz") {
      return amount; // Free internal transfers
    }
    
    return amount + (amount * 0.01); // 1% fee for all external platforms
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "Zelle":
        return "💸";
      case "PayPal":
        return "💙";
      case "Cash App":
        return "💚";
      case "Coin Railz":
        return "🏦";
      default:
        return "💳";
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Send className="w-5 h-5" />
          <span>Send Money</span>
        </CardTitle>
        <CardDescription>
          Send money across platforms with automatic recipient detection
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Recipient Information */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="toEmail">Recipient Email</Label>
              <Input
                id="toEmail"
                type="email"
                placeholder="recipient@example.com"
                {...form.register("toEmail")}
                onChange={(e) => handleRecipientChange("toEmail", e.target.value)}
              />
              {form.formState.errors.toEmail && (
                <p className="text-red-500 text-sm mt-1">
                  {form.formState.errors.toEmail.message}
                </p>
              )}
            </div>

            <div className="text-center text-gray-500">or</div>

            <div>
              <Label htmlFor="toPhoneNumber">Recipient Phone Number</Label>
              <Input
                id="toPhoneNumber"
                type="tel"
                placeholder="+1 (555) 123-4567"
                {...form.register("toPhoneNumber")}
                onChange={(e) => handleRecipientChange("toPhoneNumber", e.target.value)}
              />
            </div>
          </div>

          {/* Platform Detection Results */}
          {detectedPlatforms.length > 0 && (
            <div className="space-y-3">
              <Label>Available Platforms</Label>
              <div className="grid gap-3">
                {detectedPlatforms.map((platform, index) => (
                  <div
                    key={index}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      form.watch("selectedPlatform") === platform.platform
                        ? "border-emerald-500 bg-emerald-50"
                        : platform.available
                        ? "border-gray-200 hover:border-gray-300"
                        : "border-gray-100 bg-gray-50 opacity-50"
                    }`}
                    onClick={() => {
                      if (platform.available) {
                        form.setValue("selectedPlatform", platform.platform);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{getPlatformIcon(platform.platform)}</span>
                        <div>
                          <div className="font-medium">{platform.platform}</div>
                          <div className="text-sm text-gray-500">
                            {platform.estimatedTime} • ${platform.fee > 0 ? platform.fee.toFixed(2) : "Free"}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {platform.available ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-gray-400" />
                        )}
                        <Badge variant={platform.available ? "default" : "secondary"}>
                          {platform.confidence}% match
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Amount */}
          <div>
            <Label htmlFor="amount">Amount (USD)</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                className="pl-10"
                {...form.register("amount")}
              />
            </div>
            {form.formState.errors.amount && (
              <p className="text-red-500 text-sm mt-1">
                {form.formState.errors.amount.message}
              </p>
            )}
          </div>

          {/* Cost Breakdown */}
          {form.watch("amount") && form.watch("selectedPlatform") && (
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span>Transfer Amount:</span>
                <span>${parseFloat(form.watch("amount") || "0").toFixed(2)}</span>
              </div>
              {form.watch("selectedPlatform") !== "Coin Railz" && (
                <div className="flex justify-between text-sm">
                  <span>Coin Railz Fee:</span>
                  <span>${(calculateTotalCost() - parseFloat(form.watch("amount") || "0")).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-medium border-t pt-2">
                <span className="text-emerald-700">Total Cost:</span>
                <span className="text-emerald-700">${calculateTotalCost().toFixed(2)}</span>
              </div>
              <p className="text-xs text-gray-400">
                {form.watch("selectedPlatform") === "Coin Railz" ? "Free internal transfer" : "External platform fees apply"}
              </p>
            </div>
          )}

          {/* Message */}
          <div>
            <Label htmlFor="message">Message (Optional)</Label>
            <Textarea
              id="message"
              placeholder="What's this for?"
              {...form.register("message")}
            />
          </div>

          {/* Security PIN */}
          <div>
            <Label htmlFor="securityPin">Security PIN</Label>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="securityPin"
                type="password"
                placeholder="6-digit PIN"
                maxLength={6}
                className="pl-10"
                {...form.register("securityPin")}
              />
            </div>
            {form.formState.errors.securityPin && (
              <p className="text-red-500 text-sm mt-1">
                {form.formState.errors.securityPin.message}
              </p>
            )}
          </div>

          {/* Balance Check */}
          {user && (
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Available Balance:</span>
              <span>${parseFloat(user.usdBalance || "0").toFixed(2)}</span>
            </div>
          )}

          {/* Insufficient Balance Warning */}
          {user && form.watch("amount") && parseFloat(user.usdBalance || "0") < calculateTotalCost() && (
            <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm">Insufficient balance for this transfer</span>
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={
              sendMutation.isPending ||
              !form.watch("selectedPlatform") ||
              (user && parseFloat(user.usdBalance || "0") < calculateTotalCost())
            }
          >
            {sendMutation.isPending ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Processing...</span>
              </div>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send ${calculateTotalCost().toFixed(2)}
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}