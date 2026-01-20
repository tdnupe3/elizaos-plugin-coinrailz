import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSEO } from "@/hooks/useSEO";
import { 
  CloudSun, 
  Thermometer, 
  Droplets, 
  Wind, 
  Sun,
  ArrowRight, 
  CheckCircle,
  Leaf,
  Shield,
  Zap,
  Factory,
  MapPin
} from "lucide-react";

export default function WeatherDataPage() {
  const [, setLocation] = useLocation();

  useSEO({
    title: "Weather & Environmental Data Marketplace | Sensor Monetization | Coin Railz",
    description: "Sell hyperlocal weather and environmental sensor data. $49-199/month per feed or per-reading pricing. Agriculture, insurance, energy buyers waiting.",
    keywords: "weather data marketplace, environmental sensor data, hyperlocal weather, agtech data, parametric insurance data, soil moisture data, air quality data, sensor monetization, DePIN weather, IoT sensors",
    canonical: "https://coinrailz.com/weather",
    ogTitle: "Weather & Environmental Data Marketplace | Coin Railz",
    ogDescription: "Monetize hyperlocal sensor data. Sell to agtech, insurance, and energy companies. $49-199/month per feed.",
    twitterTitle: "Weather Data Marketplace | Coin Railz",
    twitterDescription: "Sell hyperlocal weather and environmental data. Per-reading or subscription pricing. 85% revenue share.",
    structuredData: {
      "@context": "https://schema.org/",
      "@type": "SoftwareApplication",
      "name": "Coin Railz Weather Data Marketplace",
      "description": "Marketplace for hyperlocal weather and environmental sensor data. Connect sensor networks to buyers in agriculture, insurance, and energy.",
      "url": "https://coinrailz.com/weather",
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
        "lowPrice": "49",
        "highPrice": "199",
        "description": "$49-199/month per sensor feed or $0.001-0.005 per reading"
      }
    }
  });

  const pricingTiers = [
    { 
      name: "Single Feed", 
      price: "$49", 
      period: "/month", 
      description: "One sensor location",
      features: ["1 sensor feed", "Hourly readings", "API access", "Basic analytics"]
    },
    { 
      name: "Regional", 
      price: "$199", 
      period: "/month", 
      description: "5 sensor locations",
      features: ["5 sensor feeds", "15-min readings", "Historical data", "Priority support"],
      popular: true
    },
    { 
      name: "Metered", 
      price: "$0.002", 
      period: "/reading", 
      description: "High-volume analytics",
      features: ["Unlimited feeds", "Real-time streaming", "Bulk data export", "Custom integrations"]
    }
  ];

  const dataTypes = [
    { icon: <Thermometer className="w-5 h-5" />, name: "Temperature", description: "Ambient, soil, water temps" },
    { icon: <Droplets className="w-5 h-5" />, name: "Humidity", description: "Relative humidity, dew point" },
    { icon: <Wind className="w-5 h-5" />, name: "Wind", description: "Speed, direction, gusts" },
    { icon: <Sun className="w-5 h-5" />, name: "Solar Radiation", description: "UV index, PAR levels" },
    { icon: <Droplets className="w-5 h-5" />, name: "Precipitation", description: "Rain, snow accumulation" },
    { icon: <Factory className="w-5 h-5" />, name: "Air Quality", description: "PM2.5, CO2, ozone levels" }
  ];

  const buyers = [
    { 
      title: "Agtech & Farm Management",
      description: "Precision agriculture, crop prediction, irrigation scheduling",
      budget: "$5K-100K/year",
      examples: "Sentera, Prospera, Taranis, FarmLogs",
      icon: <Leaf className="w-6 h-6" />
    },
    { 
      title: "Parametric Insurance",
      description: "Weather-triggered payouts for crop, property, and event insurance",
      budget: "$10K-200K/year",
      examples: "Arbol, Descartes, Nephila, Swiss Re",
      icon: <Shield className="w-6 h-6" />
    },
    { 
      title: "Energy & Utilities",
      description: "Demand forecasting, renewable output prediction, grid management",
      budget: "$25K-500K/year",
      examples: "AutoGrid, GridX, energy trading desks",
      icon: <Zap className="w-6 h-6" />
    },
    { 
      title: "Logistics & Supply Chain",
      description: "Route optimization, delay prediction, cold chain monitoring",
      budget: "$5K-50K/year",
      examples: "Last-mile delivery, perishable goods transport",
      icon: <MapPin className="w-6 h-6" />
    }
  ];

  const pilotSteps = [
    { step: 1, title: "Register Sensors", description: "Add 3-10 sensor feeds via API with location metadata" },
    { step: 2, title: "Push Readings", description: "Send temperature, humidity, air quality data to our platform" },
    { step: 3, title: "List Products", description: "Create data products in our A2D catalog with your pricing" },
    { step: 4, title: "Collect Revenue", description: "We handle payments, you get 85% of every sale" }
  ];

  const apiEndpoints = [
    { method: "POST", path: "/api/iot/account", description: "Create sensor network account" },
    { method: "POST", path: "/api/iot/register", description: "Register sensor device" },
    { method: "POST", path: "/api/iot/meter", description: "Push sensor readings" },
    { method: "POST", path: "/api/iot/products", description: "Create data product listing" },
    { method: "GET", path: "/api/iot/catalog", description: "Browse data marketplace" },
    { method: "POST", path: "/api/iot/data/:productId", description: "x402 purchase (for buyers)" }
  ];

  const creditPacks = [
    { amount: "$100", readings: "25,000", perReading: "$0.004" },
    { amount: "$500", readings: "200,000", perReading: "$0.0025" }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-green-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => setLocation("/")}
                className="flex items-center space-x-2"
              >
                <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                  <CloudSun className="w-4 h-4 text-white" />
                </div>
                <span className="text-xl font-bold">Coin Railz Weather</span>
              </Button>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={() => setLocation("/iot")}>
                IoT Overview
              </Button>
              <Button variant="ghost" onClick={() => setLocation("/fleet")}>
                Fleet Data
              </Button>
              <Button 
                className="bg-green-600 hover:bg-green-700"
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
          <Badge className="mb-4 bg-green-100 text-green-800">Environmental Sensors</Badge>
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Sell Your Sensor Data
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-4">
            Hyperlocal weather and environmental data marketplace. 
            Connect your sensors, we bring the buyers.
          </p>
          <p className="text-lg text-green-700 max-w-2xl mx-auto mb-8">
            Agriculture, insurance, and energy companies pay $5K-500K/year for quality sensor feeds.
          </p>
          <div className="flex justify-center space-x-4">
            <Button 
              size="lg" 
              className="bg-green-600 hover:bg-green-700"
              onClick={() => window.open('https://calendly.com', '_blank')}
            >
              Start 30-Day Pilot
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => setLocation("/weather/demo")}
            >
              Try Live Demo
            </Button>
          </div>
        </div>

        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8">Data Types We Support</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {dataTypes.map((type, index) => (
              <Card key={index} className="text-center hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 text-green-600">
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
                className={`relative ${tier.popular ? 'border-green-500 border-2 shadow-lg' : ''}`}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-green-600">Most Popular</Badge>
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
                    className={`w-full mt-6 ${tier.popular ? 'bg-green-600 hover:bg-green-700' : ''}`}
                    variant={tier.popular ? 'default' : 'outline'}
                    onClick={() => window.open('https://calendly.com', '_blank')}
                  >
                    Start Pilot
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="text-center mt-6">
            <p className="text-gray-600 mb-4">Or buy reading credits in bulk:</p>
            <div className="flex justify-center space-x-4">
              {creditPacks.map((pack, index) => (
                <Badge key={index} variant="secondary" className="px-4 py-2 text-base">
                  {pack.amount} = {pack.readings} readings ({pack.perReading}/each)
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8">Who Buys Environmental Data?</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {buyers.map((buyer, index) => (
              <Card key={index} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center text-green-600">
                        {buyer.icon}
                      </div>
                      <span>{buyer.title}</span>
                    </div>
                    <Badge variant="secondary">{buyer.budget}</Badge>
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
          <h2 className="text-3xl font-bold text-center mb-8">How the Pilot Works</h2>
          <div className="grid md:grid-cols-4 gap-6">
            {pilotSteps.map((item, index) => (
              <div key={index} className="text-center">
                <div className="w-12 h-12 bg-green-600 text-white rounded-full flex items-center justify-center mx-auto mb-4 text-xl font-bold">
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

        <div className="mb-16 bg-green-50 border border-green-200 rounded-xl p-8">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center text-white flex-shrink-0">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-green-900 mb-2">EU Data Act Compliant</h3>
              <p className="text-green-800">
                The EU Data Act (effective September 2025) requires IoT device makers to enable data portability. 
                Our platform is designed as the neutral billing and payment layer for this new data economy. 
                Device owners control their data and pricing - we handle the payments.
              </p>
            </div>
          </div>
        </div>

        <div className="text-center py-12 bg-green-600 rounded-2xl text-white">
          <h2 className="text-3xl font-bold mb-4">Ready to Monetize Your Sensors?</h2>
          <p className="text-xl mb-8 opacity-90">
            30-day pilot. Up to 10 sensor feeds. $500 pilot fee or credits top-up.
          </p>
          <div className="flex justify-center items-center space-x-4 mb-6">
            <Badge className="bg-white/20 text-white">85% Revenue Share</Badge>
            <Badge className="bg-white/20 text-white">We Bring Buyers</Badge>
            <Badge className="bg-white/20 text-white">No Lock-in</Badge>
          </div>
          <Button 
            size="lg" 
            className="bg-white text-green-600 hover:bg-gray-100"
            onClick={() => window.open('https://calendly.com', '_blank')}
          >
            Book Discovery Call
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
