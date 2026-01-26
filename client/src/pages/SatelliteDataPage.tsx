import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSEO } from "@/hooks/useSEO";
import { 
  Satellite, 
  Flame,
  CloudSun,
  Leaf,
  Droplets,
  Wind,
  Map,
  ArrowRight, 
  CheckCircle,
  Shield,
  Zap,
  Globe,
  Eye,
  Database,
  Lock,
  Code
} from "lucide-react";

export default function SatelliteDataPage() {
  const [, setLocation] = useLocation();

  useSEO({
    title: "Satellite Data APIs | NASA & ESA Space Intelligence | Coin Railz",
    description: "Access satellite data from NASA Earthdata and ESA Copernicus via x402 micropayments. Fire alerts, weather imagery, vegetation health, flood detection. Powered by space agencies.",
    keywords: "satellite data API, NASA API, ESA Copernicus, earth observation, fire detection, NDVI vegetation, flood monitoring, air quality, space data, x402 payments",
    canonical: "https://coinrailz.com/satellite",
    ogTitle: "Satellite Data APIs | Powered by NASA & ESA | Coin Railz",
    ogDescription: "Access space-based intelligence via micropayments. Fire alerts, weather imagery, vegetation health. Pay only for what you use.",
    twitterTitle: "Satellite Data APIs | Coin Railz",
    twitterDescription: "NASA & ESA satellite data via x402 micropayments. Fire alerts from $0.05/request.",
    structuredData: {
      "@context": "https://schema.org/",
      "@type": "SoftwareApplication",
      "name": "Coin Railz Satellite Data APIs",
      "description": "Satellite data APIs providing access to NASA Earthdata and ESA Copernicus Earth observation data via x402 micropayments.",
      "url": "https://coinrailz.com/satellite",
      "applicationCategory": "DataAPI",
      "provider": {
        "@type": "Organization",
        "name": "Coin Railz",
        "url": "https://coinrailz.com"
      },
      "operatingSystem": "Web",
      "offers": {
        "@type": "AggregateOffer",
        "priceCurrency": "USD",
        "lowPrice": "0.02",
        "highPrice": "0.15",
        "description": "$0.02-0.15 per API request"
      }
    }
  });

  const dataProducts = [
    { 
      id: "sat_fire_alerts",
      icon: <Flame className="w-6 h-6 text-orange-500" />,
      name: "Active Fire Alerts", 
      description: "Real-time wildfire and thermal anomaly detection",
      price: "$0.05",
      unit: "request",
      source: "NASA FIRMS",
      features: ["375m resolution", "Updated every 3 hours", "Global coverage"],
      useCases: "Wildfire monitoring, insurance risk, forestry management"
    },
    { 
      id: "sat_weather_imagery",
      icon: <CloudSun className="w-6 h-6 text-blue-500" />,
      name: "Weather Satellite Imagery", 
      description: "Current cloud cover and atmospheric conditions",
      price: "$0.02",
      unit: "request",
      source: "NASA GIBS",
      features: ["250m resolution", "Daily updates", "Multiple layers"],
      useCases: "Weather apps, aviation, maritime planning"
    },
    { 
      id: "sat_vegetation_health",
      icon: <Leaf className="w-6 h-6 text-green-500" />,
      name: "Vegetation Health (NDVI)", 
      description: "Crop and forest health monitoring indices",
      price: "$0.10",
      unit: "km²",
      source: "NASA MODIS + ESA Sentinel-2",
      features: ["250m resolution", "8-day composites", "Health classification"],
      useCases: "Agriculture, forestry, land management"
    },
    { 
      id: "sat_flood_monitoring",
      icon: <Droplets className="w-6 h-6 text-cyan-500" />,
      name: "Flood Detection", 
      description: "Surface water extent and flood risk monitoring",
      price: "$0.08",
      unit: "request",
      source: "ESA Sentinel-1 SAR",
      features: ["Sees through clouds", "Day/night operation", "Change detection"],
      useCases: "Disaster response, insurance, infrastructure"
    },
    { 
      id: "sat_air_quality",
      icon: <Wind className="w-6 h-6 text-purple-500" />,
      name: "Air Quality Index", 
      description: "Atmospheric pollutant levels and AQI",
      price: "$0.05",
      unit: "request",
      source: "ESA Sentinel-5P",
      features: ["NO2, O3, SO2, CO levels", "PM2.5 estimates", "Quality classification"],
      useCases: "Health apps, smart cities, environmental monitoring"
    },
    { 
      id: "sat_land_use",
      icon: <Map className="w-6 h-6 text-amber-500" />,
      name: "Land Use Classification", 
      description: "Land cover type identification and analysis",
      price: "$0.15",
      unit: "km²",
      source: "NASA Landsat + ESA Sentinel-2",
      features: ["10m resolution", "6 land cover classes", "Change tracking"],
      useCases: "Urban planning, real estate, environmental impact"
    }
  ];

  const dataSources = [
    {
      name: "NASA Earthdata",
      logo: "🛰️",
      description: "30+ years of Earth observation data from the world's premier space agency",
      features: ["GIBS Real-time Imagery", "FIRMS Fire Detection", "MODIS Vegetation", "Landsat Archive"],
      status: "Connected"
    },
    {
      name: "ESA Copernicus",
      logo: "🌍",
      description: "European Space Agency's flagship Earth observation program",
      features: ["Sentinel-1 Radar (SAR)", "Sentinel-2 Optical", "Sentinel-5P Atmosphere"],
      status: "Available"
    }
  ];

  const targetBuyers = [
    { 
      title: "Insurance & Risk Analytics",
      description: "Catastrophe modeling, claims verification, parametric triggers",
      budget: "$50K-500K/year",
      icon: <Shield className="w-6 h-6" />
    },
    { 
      title: "Agriculture & Agtech",
      description: "Crop health monitoring, yield prediction, irrigation planning",
      budget: "$25K-200K/year",
      icon: <Leaf className="w-6 h-6" />
    },
    { 
      title: "Climate & ESG Analytics",
      description: "Carbon monitoring, environmental compliance, sustainability reporting",
      budget: "$100K-1M/year",
      icon: <Globe className="w-6 h-6" />
    },
    { 
      title: "Logistics & Supply Chain",
      description: "Route optimization, weather impact, infrastructure monitoring",
      budget: "$10K-100K/year",
      icon: <Zap className="w-6 h-6" />
    }
  ];

  const apiEndpoints = [
    { method: "GET", path: "/api/satellite/catalog", description: "List all data products" },
    { method: "GET", path: "/api/satellite/status", description: "Check service status" },
    { method: "GET", path: "/api/satellite/fire-alerts", description: "Active fire detection (x402)" },
    { method: "GET", path: "/api/satellite/weather-imagery", description: "Weather satellite images (x402)" },
    { method: "GET", path: "/api/satellite/vegetation", description: "Vegetation health NDVI (x402)" },
    { method: "GET", path: "/api/satellite/flood-detection", description: "Flood monitoring (x402)" },
    { method: "GET", path: "/api/satellite/air-quality", description: "Air quality index (x402)" },
    { method: "GET", path: "/api/satellite/land-use", description: "Land use classification (x402)" }
  ];

  const creditPacks = [
    { amount: "$50", requests: "500+", perRequest: "~$0.10 avg" },
    { amount: "$200", requests: "2,500+", perRequest: "~$0.08 avg" },
    { amount: "$500", requests: "7,500+", perRequest: "~$0.07 avg" }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900">
      <div className="bg-black/20 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => setLocation("/")}
                className="text-white/80 hover:text-white hover:bg-white/10"
              >
                ← Back
              </Button>
              <div className="flex items-center space-x-2">
                <Satellite className="w-6 h-6 text-indigo-400" />
                <span className="text-xl font-bold text-white">Satellite Data APIs</span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Live</Badge>
              <Badge className="bg-indigo-500/20 text-indigo-400 border-indigo-500/30">x402 Enabled</Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-4 mb-6">
            <span className="text-4xl">🛰️</span>
            <span className="text-4xl">🌍</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Space Intelligence for AI Agents & IoT
          </h1>
          <p className="text-xl text-white/70 max-w-3xl mx-auto mb-6">
            Access satellite data from <span className="text-indigo-400 font-semibold">NASA Earthdata</span> and{" "}
            <span className="text-cyan-400 font-semibold">ESA Copernicus</span> via x402 micropayments.
            Pay only for what you use.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <div className="flex items-center gap-2 text-white/80 bg-white/5 px-4 py-2 rounded-full">
              <Eye className="w-4 h-4 text-green-400" />
              <span>Real-time Updates</span>
            </div>
            <div className="flex items-center gap-2 text-white/80 bg-white/5 px-4 py-2 rounded-full">
              <Globe className="w-4 h-4 text-blue-400" />
              <span>Global Coverage</span>
            </div>
            <div className="flex items-center gap-2 text-white/80 bg-white/5 px-4 py-2 rounded-full">
              <Lock className="w-4 h-4 text-yellow-400" />
              <span>x402 Payments</span>
            </div>
          </div>
          <div className="flex justify-center gap-4">
            <Button 
              size="lg" 
              onClick={() => window.open('/api/satellite/catalog', '_blank')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Code className="w-4 h-4 mr-2" />
              View API Catalog
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => setLocation('/pilots/buy')}
              className="border-white/30 text-white hover:bg-white/10"
            >
              Buy Credits
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-16">
          {dataSources.map((source) => (
            <Card key={source.name} className="bg-white/5 border-white/10 backdrop-blur">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{source.logo}</span>
                    <div>
                      <CardTitle className="text-white">{source.name}</CardTitle>
                      <p className="text-white/60 text-sm">{source.description}</p>
                    </div>
                  </div>
                  <Badge className={source.status === 'Connected' 
                    ? 'bg-green-500/20 text-green-400 border-green-500/30' 
                    : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                  }>
                    {source.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {source.features.map((feature) => (
                    <Badge key={feature} variant="outline" className="border-white/20 text-white/80">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mb-16">
          <h2 className="text-2xl font-bold text-white text-center mb-8">
            <Database className="w-6 h-6 inline mr-2 text-indigo-400" />
            Available Data Products
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dataProducts.map((product) => (
              <Card key={product.id} className="bg-white/5 border-white/10 backdrop-blur hover:bg-white/10 transition-all">
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    {product.icon}
                    <Badge className="bg-indigo-500/20 text-indigo-400 border-indigo-500/30">
                      {product.price}/{product.unit}
                    </Badge>
                  </div>
                  <CardTitle className="text-white text-lg">{product.name}</CardTitle>
                  <p className="text-white/60 text-sm">{product.description}</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="text-xs text-white/50">
                      Source: <span className="text-indigo-400">{product.source}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {product.features.map((feature) => (
                        <Badge key={feature} variant="outline" className="border-white/10 text-white/70 text-xs">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                    <div className="text-xs text-white/40 pt-2 border-t border-white/10">
                      {product.useCases}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="mb-16">
          <h2 className="text-2xl font-bold text-white text-center mb-8">
            Target Markets
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {targetBuyers.map((buyer) => (
              <Card key={buyer.title} className="bg-white/5 border-white/10 backdrop-blur">
                <CardContent className="pt-6">
                  <div className="text-indigo-400 mb-3">{buyer.icon}</div>
                  <h3 className="text-white font-semibold mb-2">{buyer.title}</h3>
                  <p className="text-white/60 text-sm mb-3">{buyer.description}</p>
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                    {buyer.budget}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="mb-16">
          <h2 className="text-2xl font-bold text-white text-center mb-8">
            <Code className="w-6 h-6 inline mr-2 text-indigo-400" />
            API Reference
          </h2>
          <Card className="bg-white/5 border-white/10 backdrop-blur">
            <CardContent className="pt-6">
              <div className="space-y-3">
                {apiEndpoints.map((endpoint) => (
                  <div key={endpoint.path} className="flex items-center justify-between p-3 bg-black/20 rounded-lg">
                    <div className="flex items-center gap-4">
                      <Badge className={
                        endpoint.method === 'GET' 
                          ? 'bg-green-500/20 text-green-400 border-green-500/30' 
                          : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                      }>
                        {endpoint.method}
                      </Badge>
                      <code className="text-indigo-400 font-mono text-sm">{endpoint.path}</code>
                    </div>
                    <span className="text-white/60 text-sm">{endpoint.description}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mb-16">
          <h2 className="text-2xl font-bold text-white text-center mb-8">
            Credits Packages
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {creditPacks.map((pack) => (
              <Card key={pack.amount} className="bg-white/5 border-white/10 backdrop-blur text-center">
                <CardContent className="pt-6">
                  <div className="text-3xl font-bold text-white mb-2">{pack.amount}</div>
                  <div className="text-white/60 mb-4">{pack.requests} requests</div>
                  <div className="text-indigo-400 text-sm">{pack.perRequest}</div>
                  <Button 
                    className="mt-4 w-full bg-indigo-600 hover:bg-indigo-700"
                    onClick={() => setLocation('/pilots/buy')}
                  >
                    Get Started
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Card className="bg-gradient-to-r from-indigo-600/20 to-cyan-600/20 border-indigo-500/30">
          <CardContent className="py-12 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to Access Space Data?
            </h2>
            <p className="text-white/70 mb-6 max-w-2xl mx-auto">
              Start using NASA and ESA satellite data in your applications today.
              No complex procurement, no long contracts - just API calls and micropayments.
            </p>
            <div className="flex justify-center gap-4">
              <Button 
                size="lg" 
                className="bg-white text-indigo-900 hover:bg-white/90"
                onClick={() => setLocation('/pilots/buy')}
              >
                Buy Credits Package
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10"
                onClick={() => window.open('/api/satellite/status', '_blank')}
              >
                Check API Status
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="mt-12 text-center">
          <p className="text-white/40 text-sm">
            Powered by{" "}
            <span className="text-indigo-400">NASA Earthdata</span> and{" "}
            <span className="text-cyan-400">ESA Copernicus</span>
          </p>
          <p className="text-white/30 text-xs mt-2">
            Contains data from NASA's Earth Observing System Data and Information System (EOSDIS) 
            and the Copernicus Earth observation programme.
          </p>
        </div>
      </div>
    </div>
  );
}
