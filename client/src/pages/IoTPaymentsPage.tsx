import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSEO } from "@/hooks/useSEO";
import { 
  Truck, 
  CloudSun, 
  Shield, 
  Zap, 
  Globe, 
  ArrowRight, 
  CheckCircle,
  Cpu,
  Database,
  CreditCard,
  BarChart3
} from "lucide-react";

export default function IoTPaymentsPage() {
  const [, setLocation] = useLocation();

  useSEO({
    title: "IoT Payments - Monetize Device Data | Fleet Telematics & Weather Sensors | Coin Railz",
    description: "Payment infrastructure for IoT devices and sensor networks. Usage-based billing for fleet telematics ($19-49/vehicle/month) and weather data ($49-199/month). EU Data Act compliant. 85% revenue share.",
    keywords: "IoT payments, fleet telematics billing, weather data monetization, sensor data marketplace, device data payments, M2M payments, DePIN, connected car data, environmental sensors, usage-based billing, IoT credits",
    canonical: "https://coinrailz.com/iot",
    ogTitle: "IoT Payments - Monetize Your Device Data | Coin Railz",
    ogDescription: "Usage-based billing for IoT devices. Fleet telematics, weather sensors, and M2M transactions. 85% revenue share for device owners.",
    twitterTitle: "IoT Payments - Monetize Device Data | Coin Railz",
    twitterDescription: "Payment infrastructure for IoT devices. Fleet telematics, weather data, sensor networks. EU Data Act compliant.",
    structuredData: {
      "@context": "https://schema.org/",
      "@type": "SoftwareApplication",
      "name": "Coin Railz IoT Payments",
      "description": "Payment infrastructure for IoT devices and sensor networks. Monetize fleet telematics, weather data, and machine-to-machine transactions.",
      "url": "https://coinrailz.com/iot",
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
        "lowPrice": "0.001",
        "highPrice": "199",
        "description": "Fleet: $19-49/vehicle/month or $0.001-0.01/event. Weather: $49-199/month or $0.001-0.005/reading."
      }
    }
  });

  const verticals = [
    {
      title: "Fleet Telematics",
      description: "Monetize vehicle data with usage-based billing for GPS, diagnostics, and driver behavior",
      icon: <Truck className="w-8 h-8" />,
      color: "blue",
      features: [
        "Per-vehicle or per-event billing",
        "GPS, speed, engine data metering",
        "Insurance telematics integration",
        "ELD/compliance data monetization"
      ],
      pricing: "$19-49/vehicle/month or $0.001-0.01/event",
      buyers: "Insurers, logistics, smart city, mapping services"
    },
    {
      title: "Weather & Environmental",
      description: "Sell hyperlocal sensor data to agriculture, insurance, and energy companies",
      icon: <CloudSun className="w-8 h-8" />,
      color: "green",
      features: [
        "Temperature, humidity, air quality feeds",
        "Soil moisture for agriculture",
        "Per-reading or subscription pricing",
        "Multi-buyer access control"
      ],
      pricing: "$49-199/month per feed or $0.001-0.005/reading",
      buyers: "Agtech, parametric insurance, energy, logistics"
    }
  ];

  const capabilities = [
    {
      title: "Device Registry",
      description: "Register devices with spending limits and payment permissions",
      icon: <Cpu className="w-6 h-6" />,
      endpoint: "POST /api/iot/register"
    },
    {
      title: "Event Metering",
      description: "Track billable events with volume-based pricing tiers",
      icon: <BarChart3 className="w-6 h-6" />,
      endpoint: "POST /api/iot/meter"
    },
    {
      title: "Credits System",
      description: "Pre-purchase credits with Stripe or PayPal, 2x value on large packs",
      icon: <CreditCard className="w-6 h-6" />,
      endpoint: "POST /api/iot/topup"
    },
    {
      title: "Data Products (A2D)",
      description: "List data for sale, AI agents pay via x402 protocol",
      icon: <Database className="w-6 h-6" />,
      endpoint: "POST /api/iot/products"
    }
  ];

  const pricingTiers = [
    { events: "Base rate", price: "$0.005/event", note: "Standard pricing" },
    { events: "100K-1M events/mo", price: "$0.0025/event", note: "50% discount" },
    { events: "1M+ events/mo", price: "$0.001/event", note: "80% discount" }
  ];

  const creditPacks = [
    { amount: "$25", credits: "5,000", perCredit: "$0.005" },
    { amount: "$100", credits: "25,000", perCredit: "$0.004" },
    { amount: "$500", credits: "200,000", perCredit: "$0.0025" }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-emerald-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => setLocation("/")}
                className="flex items-center space-x-2"
              >
                <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                  <Cpu className="w-4 h-4 text-white" />
                </div>
                <span className="text-xl font-bold">Coin Railz IoT</span>
              </Button>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                onClick={() => setLocation("/")}
              >
                Main Platform
              </Button>
              <Button 
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => window.open('https://calendly.com', '_blank')}
              >
                Book Pilot
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-16">
          <Badge className="mb-4 bg-emerald-100 text-emerald-800">IoT Payment Infrastructure</Badge>
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Monetize Your Device Data
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-4">
            Usage-based billing and payment rails for IoT devices, sensor networks, and machine-to-machine transactions.
          </p>
          <p className="text-lg text-emerald-700 max-w-2xl mx-auto mb-8">
            Fleet telematics. Weather sensors. Industrial IoT. Get paid for your data.
          </p>
          <div className="flex justify-center space-x-4">
            <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700">
              Start 30-Day Pilot
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => setLocation("/developers")}>
              View API Docs
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
          {verticals.map((vertical, index) => (
            <Card key={index} className="bg-white shadow-xl hover:shadow-2xl transition-shadow border-0 overflow-hidden">
              <CardHeader className={`bg-gradient-to-r ${vertical.color === 'blue' ? 'from-blue-600 to-blue-700' : 'from-emerald-600 to-emerald-700'} text-white`}>
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-white/20 rounded-xl">
                    {vertical.icon}
                  </div>
                  <div>
                    <CardTitle className="text-2xl">{vertical.title}</CardTitle>
                    <p className="text-white/80 mt-1">{vertical.description}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3 mb-6">
                  {vertical.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center space-x-3">
                      <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                      <span className="text-gray-700">{feature}</span>
                    </div>
                  ))}
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600">Pricing</span>
                    <span className="text-sm font-bold text-gray-900">{vertical.pricing}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-600">Data Buyers</span>
                    <span className="text-sm text-gray-700">{vertical.buyers}</span>
                  </div>
                </div>
                
                <Button 
                  className={`w-full ${vertical.color === 'blue' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                >
                  Learn More
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8 mb-16">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">
            Platform Capabilities
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {capabilities.map((cap, index) => (
              <div key={index} className="text-center p-4">
                <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <div className="text-emerald-600">{cap.icon}</div>
                </div>
                <h3 className="font-semibold mb-2">{cap.title}</h3>
                <p className="text-gray-600 text-sm mb-3">{cap.description}</p>
                <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">
                  {cap.endpoint}
                </code>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
          <Card className="bg-white shadow-lg border-0">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="w-5 h-5 text-emerald-600" />
                <span>Volume Pricing</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pricingTiers.map((tier, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <span className="font-medium text-gray-900">{tier.events}</span>
                      <span className="text-sm text-gray-500 ml-2">({tier.note})</span>
                    </div>
                    <span className="font-bold text-emerald-600">{tier.price}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-lg border-0">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                <span>Credit Packs</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {creditPacks.map((pack, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <span className="font-bold text-gray-900">{pack.amount}</span>
                      <span className="text-gray-500 mx-2">=</span>
                      <span className="font-medium text-gray-700">{pack.credits} credits</span>
                    </div>
                    <span className="text-sm text-emerald-600">{pack.perCredit}/credit</span>
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-500 mt-4 text-center">
                Pay with Stripe or PayPal
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8 mb-16">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                1
              </div>
              <h3 className="font-semibold mb-2">Register Devices</h3>
              <p className="text-gray-600 text-sm">Add your fleet vehicles or sensors to the platform</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                2
              </div>
              <h3 className="font-semibold mb-2">Meter Events</h3>
              <p className="text-gray-600 text-sm">Send telemetry data, we track billable events</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                3
              </div>
              <h3 className="font-semibold mb-2">List Data Products</h3>
              <p className="text-gray-600 text-sm">Create products from your data feeds</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                4
              </div>
              <h3 className="font-semibold mb-2">Get Paid</h3>
              <p className="text-gray-600 text-sm">Buyers pay via x402, you get 85% revenue</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8 mb-16">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">
            Who Buys IoT Data?
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { name: "Insurance", desc: "Usage-based pricing", icon: <Shield className="w-6 h-6" /> },
              { name: "Logistics", desc: "Route optimization", icon: <Truck className="w-6 h-6" /> },
              { name: "Agriculture", desc: "Precision farming", icon: <CloudSun className="w-6 h-6" /> },
              { name: "Energy", desc: "Demand forecasting", icon: <Zap className="w-6 h-6" /> },
              { name: "Smart Cities", desc: "Traffic & environment", icon: <Globe className="w-6 h-6" /> },
              { name: "Mapping", desc: "Road conditions", icon: <Globe className="w-6 h-6" /> },
              { name: "AI/ML Companies", desc: "Training data", icon: <Cpu className="w-6 h-6" /> },
              { name: "Manufacturers", desc: "Predictive maintenance", icon: <BarChart3 className="w-6 h-6" /> }
            ].map((buyer, index) => (
              <div key={index} className="text-center p-4 bg-gray-50 rounded-xl">
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mx-auto mb-3 text-emerald-600">
                  {buyer.icon}
                </div>
                <h3 className="font-semibold text-gray-900">{buyer.name}</h3>
                <p className="text-sm text-gray-500">{buyer.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-8 text-center text-white mb-16">
          <Badge className="mb-4 bg-white/20 text-white border-0">EU Data Act Compliant</Badge>
          <h2 className="text-3xl font-bold mb-4">Ready to Monetize Your Device Data?</h2>
          <p className="text-xl mb-6 text-emerald-100">
            Start a 30-day pilot with up to 50 devices. $500 pilot fee or $500 in credits.
          </p>
          <div className="flex justify-center space-x-4">
            <Button size="lg" className="bg-white text-emerald-700 hover:bg-gray-100">
              Book Pilot Call
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
              View API Docs
            </Button>
          </div>
        </div>

        <div className="text-center text-gray-500 text-sm">
          <p>Coin Railz IoT Payments v1.1.0 | Multi-chain support: Base, Ethereum, Polygon, Arbitrum, Solana</p>
          <p className="mt-2">
            Questions? <a href="mailto:hello@coinrailz.com" className="text-emerald-600 hover:underline">hello@coinrailz.com</a>
          </p>
        </div>
      </div>
    </div>
  );
}
