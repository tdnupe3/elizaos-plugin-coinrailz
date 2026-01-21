import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSEO } from "@/hooks/useSEO";
import { ArrowLeft, Truck, Cloud, Quote, ArrowRight, CheckCircle2, TrendingUp, Users, DollarSign } from "lucide-react";

interface CaseStudy {
  id: string;
  title: string;
  company: string;
  vertical: "fleet" | "weather";
  challenge: string;
  solution: string;
  results: string[];
  quote?: string;
  quoteName?: string;
  quoteTitle?: string;
  metrics: {
    label: string;
    value: string;
    change?: string;
  }[];
  tags: string[];
}

export default function CaseStudiesPage() {
  const [, setLocation] = useLocation();
  const [selectedVertical, setSelectedVertical] = useState<"all" | "fleet" | "weather">("all");

  useSEO({
    title: "Case Studies - IoT Payment Success Stories | Coin Railz",
    description: "See how fleet telematics and weather data companies monetize device data with Coin Railz IoT payment infrastructure.",
    keywords: "IoT case studies, fleet telematics success, weather data monetization, device data revenue, sensor marketplace",
    ogTitle: "IoT Payment Case Studies - Real Results",
    ogDescription: "From zero to recurring revenue: how companies monetize device data with Coin Railz.",
    twitterTitle: "Coin Railz Case Studies",
    twitterDescription: "Fleet and weather data monetization success stories.",
    structuredData: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": "IoT Payment Case Studies",
      "description": "Success stories from fleet telematics and weather data customers"
    }
  });

  const caseStudies: CaseStudy[] = [
    {
      id: "metro-logistics",
      title: "From Data Collector to Data Seller",
      company: "Metro Logistics Co",
      vertical: "fleet",
      challenge: "Metro Logistics had 200+ delivery vehicles generating GPS and engine data, but no way to monetize this valuable asset. They were paying for data storage without extracting value.",
      solution: "Using Coin Railz IoT platform, Metro registered all vehicles, enabled real-time event metering, and listed aggregated fleet data products in our catalog for insurance and logistics buyers.",
      results: [
        "Registered 200 vehicles in under 2 hours",
        "Monetized 50,000+ GPS events in first month",
        "Connected with 3 insurance analytics buyers",
        "Generated recurring revenue from existing infrastructure"
      ],
      quote: "We were sitting on a goldmine of telematics data. Coin Railz helped us turn our cost center into a profit center.",
      quoteName: "Sarah Chen",
      quoteTitle: "VP Operations, Metro Logistics",
      metrics: [
        { label: "Vehicles", value: "200", change: "" },
        { label: "Monthly Events", value: "50K+", change: "" },
        { label: "New Revenue", value: "$2,400/mo", change: "+∞%" },
        { label: "Integration Time", value: "2 hours", change: "" }
      ],
      tags: ["Fleet", "GPS", "Insurance", "B2B"]
    },
    {
      id: "agrisense",
      title: "Hyperlocal Weather Data for Precision Agriculture",
      company: "AgriSense Analytics",
      vertical: "weather",
      challenge: "AgriSense needed hyperlocal weather data for their crop prediction models but existing weather APIs were too coarse. They wanted access to farm-level sensor data.",
      solution: "Through Coin Railz A2D catalog, AgriSense discovered and purchased weather feeds from rural sensor networks, paying per-reading for only the data they needed.",
      results: [
        "Accessed 15 hyperlocal weather stations",
        "Improved crop prediction accuracy by 23%",
        "Reduced weather data costs by 40%",
        "Pay-per-reading model eliminated waste"
      ],
      quote: "The granularity of data we get through Coin Railz is impossible to find elsewhere. It's transformed our prediction models.",
      quoteName: "Dr. James Miller",
      quoteTitle: "Chief Data Scientist, AgriSense",
      metrics: [
        { label: "Sensors", value: "15", change: "" },
        { label: "Prediction Accuracy", value: "+23%", change: "" },
        { label: "Cost Savings", value: "40%", change: "" },
        { label: "Data Points/Day", value: "8,600", change: "" }
      ],
      tags: ["Weather", "Agriculture", "Sensors", "Analytics"]
    },
    {
      id: "parametric-insurance",
      title: "Real-Time Weather for Parametric Insurance",
      company: "CoverGuard Insurance",
      vertical: "weather",
      challenge: "CoverGuard needed verifiable, timestamped weather data to trigger parametric insurance payouts. Traditional weather services lacked the audit trail required for claims.",
      solution: "Coin Railz credits proof and ledger system provided the verifiable data trail CoverGuard needed, with x402 payments creating immutable records of data purchases.",
      results: [
        "Automated claims processing for weather events",
        "Reduced disputes by 85% with verifiable data",
        "Integrated with 8 weather station networks",
        "Sub-second data access via API"
      ],
      quote: "The audit trail is everything in parametric insurance. Coin Railz gives us the proof we need.",
      quoteName: "Michael Torres",
      quoteTitle: "CTO, CoverGuard Insurance",
      metrics: [
        { label: "Claim Disputes", value: "-85%", change: "" },
        { label: "Processing Time", value: "<1 sec", change: "" },
        { label: "Networks", value: "8", change: "" },
        { label: "Monthly Data Spend", value: "$1,200", change: "" }
      ],
      tags: ["Insurance", "Weather", "Audit", "Parametric"]
    }
  ];

  const filteredStudies = selectedVertical === "all" 
    ? caseStudies 
    : caseStudies.filter(cs => cs.vertical === selectedVertical);

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

        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Customer Success Stories</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              See how companies monetize device data with Coin Railz
            </p>
          </div>

          <div className="flex justify-center gap-2 mb-8">
            <Button
              variant={selectedVertical === "all" ? "default" : "outline"}
              onClick={() => setSelectedVertical("all")}
            >
              All
            </Button>
            <Button
              variant={selectedVertical === "fleet" ? "default" : "outline"}
              onClick={() => setSelectedVertical("fleet")}
            >
              <Truck className="w-4 h-4 mr-2" />
              Fleet
            </Button>
            <Button
              variant={selectedVertical === "weather" ? "default" : "outline"}
              onClick={() => setSelectedVertical("weather")}
            >
              <Cloud className="w-4 h-4 mr-2" />
              Weather
            </Button>
          </div>

          <div className="space-y-8">
            {filteredStudies.map((study) => (
              <Card key={study.id} className="overflow-hidden">
                <div className={`h-2 ${study.vertical === "fleet" ? "bg-blue-500" : "bg-cyan-500"}`} />
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        {study.vertical === "fleet" ? (
                          <Truck className="w-5 h-5 text-blue-500" />
                        ) : (
                          <Cloud className="w-5 h-5 text-cyan-500" />
                        )}
                        <Badge variant="secondary">{study.company}</Badge>
                      </div>
                      <CardTitle className="text-2xl">{study.title}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-4 gap-4 mb-6">
                    {study.metrics.map((metric, i) => (
                      <div key={i} className="text-center p-3 bg-muted/50 rounded-lg">
                        <p className="text-2xl font-bold text-primary">{metric.value}</p>
                        <p className="text-sm text-muted-foreground">{metric.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h4 className="font-semibold mb-2">The Challenge</h4>
                      <p className="text-muted-foreground">{study.challenge}</p>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">The Solution</h4>
                      <p className="text-muted-foreground">{study.solution}</p>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">Results</h4>
                      <ul className="space-y-2">
                        {study.results.map((result, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                            <span>{result}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {study.quote && (
                      <div className="bg-primary/5 p-6 rounded-lg border-l-4 border-primary">
                        <Quote className="w-8 h-8 text-primary/30 mb-2" />
                        <p className="text-lg italic mb-4">"{study.quote}"</p>
                        <div>
                          <p className="font-semibold">{study.quoteName}</p>
                          <p className="text-sm text-muted-foreground">{study.quoteTitle}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {study.tags.map((tag) => (
                        <Badge key={tag} variant="outline">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="mt-12 bg-primary text-primary-foreground">
            <CardContent className="py-8 text-center">
              <h2 className="text-2xl font-bold mb-4">Ready to Write Your Success Story?</h2>
              <p className="mb-6 opacity-90">
                Join companies already monetizing their device data with Coin Railz
              </p>
              <div className="flex gap-4 justify-center">
                <Link href="/partners">
                  <Button variant="secondary" size="lg">
                    Join Partner Program
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
                <Link href="/fleet/demo">
                  <Button variant="outline" size="lg" className="bg-transparent border-white hover:bg-white/10">
                    Try Fleet Demo
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
