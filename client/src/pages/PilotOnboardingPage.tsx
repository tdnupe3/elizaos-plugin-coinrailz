import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  ArrowRight,
  Rocket, 
  Building2, 
  Truck, 
  Cloud, 
  Check,
  Copy,
  Loader2,
  BookOpen,
  CreditCard
} from "lucide-react";

type Step = "company" | "vertical" | "details" | "success";

interface OnboardingData {
  companyName: string;
  contactName: string;
  contactEmail: string;
  vertical: "fleet" | "weather" | "";
  estimatedDevices: string;
  useCase: string;
}

interface OnboardingResult {
  accountId: string;
  apiKey: string;
  pilotId: string;
}

export default function PilotOnboardingPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("company");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<OnboardingResult | null>(null);
  const [data, setData] = useState<OnboardingData>({
    companyName: "",
    contactName: "",
    contactEmail: "",
    vertical: "",
    estimatedDevices: "",
    useCase: "",
  });

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied", description: `${label} copied to clipboard` });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const accountRes = await fetch("/api/iot/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountName: data.companyName,
          metadata: {
            contactEmail: data.contactEmail,
            contactName: data.contactName,
            vertical: data.vertical,
          }
        })
      });

      if (!accountRes.ok) {
        const err = await accountRes.json().catch(() => ({}));
        throw new Error(err.error || err.details?.[0]?.message || "Failed to create account");
      }

      const accountData = await accountRes.json();
      const accountId = accountData.account?.id || accountData.accountId;
      const apiKey = accountData.apiKey;

      const pilotRes = await fetch("/api/iot/pilots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: data.companyName,
          vertical: data.vertical,
          status: "pilot",
          deviceCount: parseInt(data.estimatedDevices) || 0,
          revenue: 500,
          startDate: new Date().toISOString().split("T")[0],
          notes: `Use case: ${data.useCase}`,
          contactEmail: data.contactEmail,
          accountId: accountId,
          contactName: data.contactName,
        })
      });

      if (!pilotRes.ok) {
        const err = await pilotRes.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create pilot record");
      }

      const pilotData = await pilotRes.json();

      setResult({
        accountId: accountId,
        apiKey: apiKey,
        pilotId: pilotData.pilotId || pilotData.pilot?.id,
      });
      setStep("success");
      toast({ title: "Pilot Created", description: "Your pilot account is ready!" });
    } catch (error) {
      console.error("Onboarding error:", error);
      toast({ 
        title: "Setup Failed", 
        description: error instanceof Error ? error.message : "Please try again or contact support.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case "company":
        return data.companyName && data.contactName && data.contactEmail;
      case "vertical":
        return data.vertical !== "";
      case "details":
        return data.estimatedDevices && data.useCase;
      default:
        return false;
    }
  };

  const renderStep = () => {
    switch (step) {
      case "company":
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                value={data.companyName}
                onChange={(e) => setData({ ...data, companyName: e.target.value })}
                placeholder="Acme Logistics Inc."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactName">Your Name</Label>
              <Input
                id="contactName"
                value={data.contactName}
                onChange={(e) => setData({ ...data, contactName: e.target.value })}
                placeholder="Jane Smith"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactEmail">Email</Label>
              <Input
                id="contactEmail"
                type="email"
                value={data.contactEmail}
                onChange={(e) => setData({ ...data, contactEmail: e.target.value })}
                placeholder="jane@acmelogistics.com"
              />
            </div>
          </div>
        );

      case "vertical":
        return (
          <div className="grid md:grid-cols-2 gap-4">
            <Card 
              className={`cursor-pointer transition-all ${data.vertical === "fleet" ? "ring-2 ring-primary" : "hover:shadow-md"}`}
              onClick={() => setData({ ...data, vertical: "fleet" })}
            >
              <CardHeader className="text-center">
                <Truck className="w-12 h-12 mx-auto text-blue-500 mb-2" />
                <CardTitle>Fleet Telematics</CardTitle>
                <CardDescription>
                  Vehicle tracking, GPS, engine diagnostics, driver behavior
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-center">
                  <Badge variant="secondary">$19-49/vehicle/month</Badge>
                </div>
              </CardContent>
            </Card>

            <Card 
              className={`cursor-pointer transition-all ${data.vertical === "weather" ? "ring-2 ring-primary" : "hover:shadow-md"}`}
              onClick={() => setData({ ...data, vertical: "weather" })}
            >
              <CardHeader className="text-center">
                <Cloud className="w-12 h-12 mx-auto text-green-500 mb-2" />
                <CardTitle>Weather Data</CardTitle>
                <CardDescription>
                  Temperature, humidity, precipitation, air quality sensors
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-center">
                  <Badge variant="secondary">$49-199/month</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case "details":
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="estimatedDevices">Estimated Device Count</Label>
              <Input
                id="estimatedDevices"
                type="number"
                value={data.estimatedDevices}
                onChange={(e) => setData({ ...data, estimatedDevices: e.target.value })}
                placeholder="50"
              />
              <p className="text-xs text-muted-foreground">
                Pilots include up to 50 devices. We can discuss scaling after the pilot.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="useCase">Describe Your Use Case</Label>
              <Textarea
                id="useCase"
                value={data.useCase}
                onChange={(e) => setData({ ...data, useCase: e.target.value })}
                placeholder="We want to monetize GPS data from our delivery fleet by selling anonymized route insights to logistics analytics companies..."
                rows={4}
              />
            </div>
          </div>
        );

      case "success":
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold">Pilot Account Created!</h3>
              <p className="text-muted-foreground">
                Your 30-day pilot is active. Here are your credentials:
              </p>
            </div>

            <Card className="bg-muted/50">
              <CardContent className="pt-6 space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Account ID</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-2 bg-background rounded text-sm font-mono">
                      {result?.accountId}
                    </code>
                    <Button 
                      size="icon" 
                      variant="ghost"
                      onClick={() => handleCopy(result?.accountId || "", "Account ID")}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">API Key</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-2 bg-background rounded text-sm font-mono break-all">
                      {result?.apiKey}
                    </code>
                    <Button 
                      size="icon" 
                      variant="ghost"
                      onClick={() => handleCopy(result?.apiKey || "", "API Key")}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Save this key securely. It won't be shown again.
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-4">
              <Button 
                variant="outline" 
                className="w-full gap-2"
                onClick={() => setLocation("/integrate")}
              >
                <BookOpen className="w-4 h-4" />
                Integration Guide
              </Button>
              <Button 
                variant="outline" 
                className="w-full gap-2"
                onClick={() => setLocation("/iot/dashboard")}
              >
                <CreditCard className="w-4 h-4" />
                Top Up Credits
              </Button>
            </div>

            <Button 
              className="w-full" 
              onClick={() => setLocation("/iot")}
            >
              Go to IoT Hub
            </Button>
          </div>
        );
    }
  };

  const steps = [
    { key: "company", label: "Company", icon: Building2 },
    { key: "vertical", label: "Vertical", icon: Truck },
    { key: "details", label: "Details", icon: Rocket },
    { key: "success", label: "Complete", icon: Check },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === step);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        <Button 
          variant="ghost" 
          onClick={() => setLocation("/iot")}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to IoT Hub
        </Button>

        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <Badge variant="secondary" className="mb-4">Self-Serve Onboarding</Badge>
            <h1 className="text-3xl font-bold mb-2">Start Your 30-Day Pilot</h1>
            <p className="text-muted-foreground">
              Get started in minutes. Up to 50 devices, full platform access.
            </p>
          </div>

          <div className="flex justify-center mb-8">
            {steps.map((s, i) => (
              <div key={s.key} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                  i <= currentStepIndex 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted text-muted-foreground"
                }`}>
                  <s.icon className="w-5 h-5" />
                </div>
                {i < steps.length - 1 && (
                  <div className={`w-12 h-1 ${
                    i < currentStepIndex ? "bg-primary" : "bg-muted"
                  }`} />
                )}
              </div>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>
                {step === "company" && "Company Information"}
                {step === "vertical" && "Select Your Vertical"}
                {step === "details" && "Pilot Details"}
                {step === "success" && "You're All Set!"}
              </CardTitle>
              {step !== "success" && (
                <CardDescription>
                  {step === "company" && "Tell us about your organization"}
                  {step === "vertical" && "What type of device data will you be monetizing?"}
                  {step === "details" && "Help us understand your use case"}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {renderStep()}

              {step !== "success" && (
                <div className="flex justify-between mt-8">
                  {step !== "company" ? (
                    <Button 
                      variant="outline"
                      onClick={() => {
                        if (step === "vertical") setStep("company");
                        if (step === "details") setStep("vertical");
                      }}
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back
                    </Button>
                  ) : (
                    <div />
                  )}

                  {step === "details" ? (
                    <Button 
                      onClick={handleSubmit}
                      disabled={!canProceed() || isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creating Pilot...
                        </>
                      ) : (
                        <>
                          <Rocket className="w-4 h-4 mr-2" />
                          Start Pilot
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button 
                      onClick={() => {
                        if (step === "company") setStep("vertical");
                        if (step === "vertical") setStep("details");
                      }}
                      disabled={!canProceed()}
                    >
                      Continue
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
