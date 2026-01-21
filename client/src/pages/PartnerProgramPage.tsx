import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useSEO } from "@/hooks/useSEO";
import { ArrowLeft, Check, DollarSign, Shield, Zap, Users, BarChart3, Globe } from "lucide-react";

export default function PartnerProgramPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    companyName: "",
    contactName: "",
    email: "",
    deviceType: "",
    deviceCount: "",
    dataDescription: "",
    currentMonetization: ""
  });

  useSEO({
    title: "Get Paid for Fleet & Weather Data | Enterprise Buyers Waiting | Coin Railz",
    description: "Enterprise buyers are spending $10K-500K/year on fleet and weather data. Share your device data and earn 85% of every sale. No upfront costs.",
    keywords: "sell fleet data, sell weather data, IoT data revenue, telematics data buyers, sensor data monetization, device data income",
    ogTitle: "Enterprise Buyers Want Your Fleet & Weather Data",
    ogDescription: "Insurers, logistics, and agtech firms pay $10K-500K/year for device data. You keep 85%.",
    twitterTitle: "Get Paid for Your Device Data | Coin Railz",
    twitterDescription: "Enterprise buyers want fleet and weather data. Share yours, earn 85% per sale.",
    structuredData: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "Partner Program",
      "description": "IoT device data monetization partner program with 85% revenue share"
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const res = await fetch("/api/iot/partners/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        toast({
          title: "Application Submitted",
          description: "We'll review your application and contact you within 48 hours."
        });
        setFormData({
          companyName: "",
          contactName: "",
          email: "",
          deviceType: "",
          deviceCount: "",
          dataDescription: "",
          currentMonetization: ""
        });
      } else {
        const data = await res.json().catch(() => ({}));
        toast({
          title: "Submission Failed",
          description: data.error || data.message || "Please check your information and try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Partner application error:", error);
      toast({
        title: "Network Error",
        description: "Unable to submit application. Please check your connection and try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const benefits = [
    {
      icon: Users,
      title: "Buyers Already Waiting",
      description: "Enterprise buyers actively seeking fleet and weather data. You supply, they pay."
    },
    {
      icon: DollarSign,
      title: "85% Revenue Share",
      description: "You keep 85% of every sale. We handle payments, billing, and buyer matching."
    },
    {
      icon: Zap,
      title: "Demand-Driven Income",
      description: "Earn because buyers need your data - not because you hope someone will find it."
    },
    {
      icon: Shield,
      title: "Proven Buyer Budgets",
      description: "Insurance, logistics, agtech companies spend $10K-500K/year on this data."
    },
    {
      icon: BarChart3,
      title: "Real-time Sales Tracking",
      description: "See exactly who's buying, how much you're earning, and export reports."
    },
    {
      icon: Globe,
      title: "Zero Upfront Cost",
      description: "No setup fees, no monthly minimums. Only pay when you earn."
    }
  ];

  const howItWorks = [
    { step: 1, title: "Tell Us What You Have", description: "Submit device details - we'll match you with active buyer demand" },
    { step: 2, title: "We Find Your Buyers", description: "Our buyer network sees your data and expresses purchase intent" },
    { step: 3, title: "Connect & Earn", description: "Push your data via API, buyers pay per use, you get 85%" },
    { step: 4, title: "Scale With Demand", description: "More buyers = more revenue. We grow your income together." }
  ];

  const partnerTypes = [
    { type: "Fleet Telematics", examples: "GPS trackers, OBD devices, ELD systems", buyers: "Insurers, logistics, smart city" },
    { type: "Weather Sensors", examples: "Temperature, humidity, air quality, UV", buyers: "Agtech, insurance, energy" },
    { type: "Industrial IoT", examples: "Machinery sensors, predictive maintenance", buyers: "Manufacturers, utilities" },
    { type: "Smart Infrastructure", examples: "Traffic, parking, building sensors", buyers: "Cities, real estate, retail" }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        <Button 
          variant="ghost" 
          onClick={() => setLocation("/iot")}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to IoT
        </Button>

        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Enterprise Buyers Want Your Data</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-4">
              Insurers, logistics companies, and agtech firms are spending $10K-500K/year on fleet and weather data.
            </p>
            <p className="text-lg text-primary font-medium">
              Get paid for sharing data they already want. You keep 85%.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-16">
            {benefits.map((benefit, i) => (
              <Card key={i} className="border-2 hover:border-primary/50 transition-colors">
                <CardHeader>
                  <benefit.icon className="w-10 h-10 text-primary mb-2" />
                  <CardTitle className="text-lg">{benefit.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{benefit.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="mb-16">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">From Your Data to Buyer Revenue</CardTitle>
              <CardDescription>We connect your devices to paying enterprise customers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-4 gap-8">
                {howItWorks.map((item) => (
                  <div key={item.step} className="text-center">
                    <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mx-auto mb-4">
                      {item.step}
                    </div>
                    <h3 className="font-semibold mb-2">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="mb-16">
            <CardHeader>
              <CardTitle>Partner Types We Work With</CardTitle>
              <CardDescription>Data from any connected device can be monetized</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                {partnerTypes.map((pt, i) => (
                  <div key={i} className="p-4 bg-muted/50 rounded-lg">
                    <h3 className="font-semibold text-lg mb-2">{pt.type}</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      <span className="font-medium">Examples:</span> {pt.examples}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">Typical Buyers:</span> {pt.buyers}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="mb-16 border-2 border-primary">
            <CardHeader className="text-center bg-primary/5">
              <CardTitle className="text-2xl">Revenue Share Model</CardTitle>
              <CardDescription>Transparent, simple pricing</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid md:grid-cols-3 gap-8 text-center">
                <div>
                  <div className="text-4xl font-bold text-primary mb-2">85%</div>
                  <div className="text-lg font-medium">Your Share</div>
                  <p className="text-sm text-muted-foreground mt-2">
                    You receive 85% of every data sale, automatically credited to your account
                  </p>
                </div>
                <div>
                  <div className="text-4xl font-bold text-muted-foreground mb-2">15%</div>
                  <div className="text-lg font-medium">Platform Fee</div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Covers payment processing, buyer acquisition, infrastructure, and support
                  </p>
                </div>
                <div>
                  <div className="text-4xl font-bold text-green-600 mb-2">$0</div>
                  <div className="text-lg font-medium">Upfront Cost</div>
                  <p className="text-sm text-muted-foreground mt-2">
                    No setup fees, no monthly minimums. Only pay when you earn.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card id="apply">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Match Your Data to Buyer Demand</CardTitle>
              <CardDescription>Tell us what you have - we'll find buyers who want it</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="max-w-xl mx-auto space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Company Name</Label>
                    <Input
                      id="companyName"
                      value={formData.companyName}
                      onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                      placeholder="Acme Sensors Inc."
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactName">Contact Name</Label>
                    <Input
                      id="contactName"
                      value={formData.contactName}
                      onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                      placeholder="John Smith"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="john@acmesensors.com"
                    required
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="deviceType">Device Type</Label>
                    <Select
                      value={formData.deviceType}
                      onValueChange={(value) => setFormData({ ...formData, deviceType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fleet">Fleet/Telematics</SelectItem>
                        <SelectItem value="weather">Weather/Environmental</SelectItem>
                        <SelectItem value="industrial">Industrial IoT</SelectItem>
                        <SelectItem value="smart-city">Smart City/Infrastructure</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deviceCount">Number of Devices</Label>
                    <Select
                      value={formData.deviceCount}
                      onValueChange={(value) => setFormData({ ...formData, deviceCount: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1-10">1-10 devices</SelectItem>
                        <SelectItem value="11-50">11-50 devices</SelectItem>
                        <SelectItem value="51-200">51-200 devices</SelectItem>
                        <SelectItem value="201-1000">201-1,000 devices</SelectItem>
                        <SelectItem value="1000+">1,000+ devices</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dataDescription">Describe Your Data</Label>
                  <Textarea
                    id="dataDescription"
                    value={formData.dataDescription}
                    onChange={(e) => setFormData({ ...formData, dataDescription: e.target.value })}
                    placeholder="What data do your devices collect? (e.g., GPS location, temperature readings, engine diagnostics)"
                    rows={3}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currentMonetization">Current Monetization (Optional)</Label>
                  <Textarea
                    id="currentMonetization"
                    value={formData.currentMonetization}
                    onChange={(e) => setFormData({ ...formData, currentMonetization: e.target.value })}
                    placeholder="Are you currently monetizing this data? If so, how?"
                    rows={2}
                  />
                </div>

                <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Submitting..." : "Submit Application"}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  We'll review your application and respond within 48 hours.
                </p>
              </form>
            </CardContent>
          </Card>

          <div className="mt-16 text-center">
            <h2 className="text-2xl font-bold mb-4">Ready to Start?</h2>
            <p className="text-muted-foreground mb-6">
              Already have an account? Start listing your data products now.
            </p>
            <div className="flex gap-4 justify-center">
              <Link href="/iot/dashboard">
                <Button variant="outline">Go to Dashboard</Button>
              </Link>
              <Link href="/integrate">
                <Button>Integration Guide</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
