import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSEO } from "@/hooks/useSEO";
import { 
  Truck, 
  MapPin, 
  Shield, 
  Zap, 
  ArrowRight, 
  CheckCircle,
  Cpu,
  DollarSign,
  BarChart3,
  Gauge,
  Route,
  FileCheck
} from "lucide-react";

export default function FleetTelematicsPage() {
  const [, setLocation] = useLocation();

  useSEO({
    title: "Fleet Telematics Data | Reduce Claims, Improve ETAs | Coin Railz",
    description: "Access fleet telematics data to reduce insurance claims 3-8% and improve ETA accuracy 15-25%. Usage-based pricing - pay only for the data you use. GPS, driver behavior, diagnostics.",
    keywords: "fleet telematics data, insurance loss ratio, UBI data, usage-based insurance data, fleet ETA optimization, telematics for insurers, logistics route data, driver behavior analytics, fleet risk assessment",
    canonical: "https://coinrailz.com/fleet",
    ogTitle: "Fleet Telematics Data | Reduce Claims, Improve ETAs",
    ogDescription: "Access real-time fleet data to cut claims loss ratios and optimize logistics. Pay only for data you use.",
    twitterTitle: "Fleet Telematics Data | Coin Railz",
    twitterDescription: "Insurance underwriters cut loss ratios 3-8%. Logistics teams improve ETA accuracy 15-25%. Usage-based fleet data.",
    structuredData: {
      "@context": "https://schema.org/",
      "@type": "SoftwareApplication",
      "name": "Coin Railz Fleet Telematics Billing",
      "description": "Usage-based billing platform for fleet telematics data. Monetize GPS, diagnostics, driver behavior, and ELD compliance data.",
      "url": "https://coinrailz.com/fleet",
      "applicationCategory": "BusinessApplication",
      "provider": {
        "@type": "Organization",
        "name": "Coin Railz",
        "url": "https://coinrailz.com"
      },
      "operatingSystem": "Web",
      "offers": {
        "@type": "AggregateOffer",
        "priceCurrency": "USD",
        "lowPrice": "19",
        "highPrice": "49",
        "description": "$19-49/vehicle/month or $0.001-0.01 per event"
      }
    }
  });

  const pricingTiers = [
    { 
      name: "Starter", 
      price: "$19", 
      period: "/vehicle/month", 
      description: "Small fleets (<50 vehicles)",
      features: ["Device registration", "GPS event metering", "Basic dashboard", "Email support"]
    },
    { 
      name: "Growth", 
      price: "$29", 
      period: "/vehicle/month", 
      description: "Mid-size fleets (50-200 vehicles)",
      features: ["Everything in Starter", "Driver behavior scoring", "Insurance data feeds", "Priority support"],
      popular: true
    },
    { 
      name: "Enterprise", 
      price: "$0.005", 
      period: "/event", 
      description: "High-volume (200+ vehicles)",
      features: ["Everything in Growth", "Volume discounts", "Custom integrations", "Dedicated account manager"]
    }
  ];

  const dataTypes = [
    { icon: <MapPin className="w-5 h-5" />, name: "GPS Location", description: "Real-time and historical positions" },
    { icon: <Gauge className="w-5 h-5" />, name: "Speed & Engine", description: "Velocity, RPM, fuel levels" },
    { icon: <Route className="w-5 h-5" />, name: "Trip Data", description: "Routes, stops, mileage" },
    { icon: <Shield className="w-5 h-5" />, name: "Driver Behavior", description: "Harsh braking, acceleration" },
    { icon: <FileCheck className="w-5 h-5" />, name: "ELD Compliance", description: "Hours of service, FMCSA data" },
    { icon: <BarChart3 className="w-5 h-5" />, name: "Diagnostics", description: "OBD-II codes, maintenance alerts" }
  ];

  const buyers = [
    { 
      title: "Insurance Underwriters",
      description: "Usage-based insurance (UBI) programs need real driving data",
      budget: "$10K-100K/year",
      examples: "Progressive, State Farm, Allstate programs"
    },
    { 
      title: "Logistics Companies",
      description: "Route optimization, fuel efficiency, delivery tracking",
      budget: "$5K-50K/year",
      examples: "Last-mile delivery, cold chain logistics"
    },
    { 
      title: "Smart City / DOT",
      description: "Traffic patterns, road conditions, hazard detection",
      budget: "$10K-200K/year",
      examples: "Municipal traffic management"
    },
    { 
      title: "Mapping Services",
      description: "Real-time road conditions, construction alerts",
      budget: "$25K-500K/year",
      examples: "Navigation apps, fleet routing"
    }
  ];

  const pilotSteps = [
    { step: 1, title: "Define Your Outcome", description: "Tell us what you're trying to improve: claims loss, ETA, route efficiency" },
    { step: 2, title: "Access Data Feed", description: "Connect to real-time GPS, driver behavior, and diagnostic data" },
    { step: 3, title: "Pay Per Use", description: "Only pay for the data points you actually consume - no contracts" },
    { step: 4, title: "Measure Results", description: "Track your improvement metrics over the 30-day pilot period" }
  ];

  const apiEndpoints = [
    { method: "POST", path: "/api/iot/account", description: "Create fleet account" },
    { method: "POST", path: "/api/iot/register", description: "Register vehicle/device" },
    { method: "POST", path: "/api/iot/meter", description: "Meter billable events" },
    { method: "GET", path: "/api/iot/balance", description: "Check credits balance" },
    { method: "POST", path: "/api/iot/topup", description: "Top up credits (Stripe/PayPal)" },
    { method: "POST", path: "/api/iot/products", description: "List data for sale" }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => setLocation("/")}
                className="flex items-center space-x-2"
              >
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Truck className="w-4 h-4 text-white" />
                </div>
                <span className="text-xl font-bold">Coin Railz Fleet</span>
              </Button>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={() => setLocation("/iot")}>
                IoT Overview
              </Button>
              <Button variant="ghost" onClick={() => setLocation("/weather")}>
                Weather Data
              </Button>
              <Button 
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => setLocation('/pilot/onboard')}
              >
                Book Pilot
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-16">
          <Badge className="mb-4 bg-blue-100 text-blue-800">For Fleet Data Buyers</Badge>
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Reduce Claims. Improve ETAs. Pay Only for Data You Use.
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-4">
            Access real-time fleet telematics from thousands of vehicles. 
            Usage-based pricing means you pay per data point, not per contract.
          </p>
          <p className="text-lg text-blue-700 max-w-2xl mx-auto mb-8">
            Insurance underwriters cut loss ratios 3-8%. Logistics teams improve ETA accuracy 15-25%.
          </p>
          <div className="flex justify-center space-x-4">
            <Button 
              size="lg" 
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => setLocation('/pilot/onboard')}
            >
              Start 30-Day Pilot
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => setLocation("/fleet/demo")}
            >
              Try Live Demo
            </Button>
          </div>
        </div>

        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8">Who Uses This Data?</h2>
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {buyers.map((buyer, index) => (
              <Card key={index} className="hover:shadow-md transition-shadow border-l-4 border-l-blue-500">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {buyer.title}
                    <Badge variant="secondary" className="bg-green-100 text-green-800">{buyer.budget}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-2">{buyer.description}</p>
                  <p className="text-sm text-gray-400">{buyer.examples}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8">Data Types Available</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {dataTypes.map((type, index) => (
              <Card key={index} className="text-center hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3 text-blue-600">
                    {type.icon}
                  </div>
                  <h3 className="font-semibold text-sm">{type.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">{type.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8">Simple, Transparent Pricing</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {pricingTiers.map((tier, index) => (
              <Card 
                key={index} 
                className={`relative ${tier.popular ? 'border-blue-500 border-2 shadow-lg' : ''}`}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-blue-600">Most Popular</Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-xl">{tier.name}</CardTitle>
                  <p className="text-gray-500 text-sm">{tier.description}</p>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{tier.price}</span>
                    <span className="text-gray-500">{tier.period}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {tier.features.map((feature, fIndex) => (
                      <li key={fIndex} className="flex items-center text-sm">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Button 
                    className={`w-full mt-6 ${tier.popular ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                    variant={tier.popular ? 'default' : 'outline'}
                    onClick={() => setLocation('/pilot/onboard')}
                  >
                    Start Pilot
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-center text-gray-500 mt-4">
            Volume discounts: 100K-1M events = 50% off, 1M+ events = 80% off
          </p>
        </div>


        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8">How the Pilot Works</h2>
          <div className="grid md:grid-cols-4 gap-6">
            {pilotSteps.map((item, index) => (
              <div key={index} className="text-center">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                  {item.step}
                </div>
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-gray-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8">API Endpoints</h2>
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {apiEndpoints.map((endpoint, index) => (
                  <div key={index} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                    <Badge variant={endpoint.method === 'POST' ? 'default' : 'secondary'} className="w-16 justify-center">
                      {endpoint.method}
                    </Badge>
                    <code className="font-mono text-sm flex-1">{endpoint.path}</code>
                    <span className="text-gray-500 text-sm">{endpoint.description}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="text-center py-12 bg-blue-600 rounded-2xl text-white">
          <h2 className="text-3xl font-bold mb-4">Ready to Improve Your Outcomes?</h2>
          <p className="text-xl mb-8 opacity-90">
            30-day pilot. Real fleet data. Measure your actual claims reduction or ETA improvement.
          </p>
          <div className="flex justify-center items-center space-x-4 mb-6">
            <Badge className="bg-white/20 text-white">Pay Per Data Point</Badge>
            <Badge className="bg-white/20 text-white">No Contracts</Badge>
            <Badge className="bg-white/20 text-white">Cancel Anytime</Badge>
          </div>
          <Button 
            size="lg" 
            className="bg-white text-blue-600 hover:bg-gray-100"
            onClick={() => setLocation('/pilot/onboard')}
          >
            Book Discovery Call
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
