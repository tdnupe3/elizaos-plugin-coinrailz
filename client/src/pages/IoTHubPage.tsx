import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Truck, 
  Cloud, 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  Target, 
  FileText, 
  Receipt,
  Rocket,
  CreditCard,
  BarChart3,
  ArrowRight,
  Zap
} from "lucide-react";

export default function IoTHubPage() {
  const [, setLocation] = useLocation();

  const quickActions = [
    { label: "Start Pilot", icon: Rocket, path: "/pilot/onboard", variant: "default" as const },
    { label: "Top Up Credits", icon: CreditCard, path: "/iot/dashboard", variant: "outline" as const },
    { label: "View Analytics", icon: BarChart3, path: "/iot/analytics", variant: "outline" as const },
  ];

  const verticalPages = [
    {
      title: "Fleet Telematics",
      description: "Usage-based billing for vehicle fleets. $19-49/vehicle/month.",
      icon: Truck,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-900/20",
      links: [
        { label: "Landing Page", path: "/fleet" },
        { label: "Interactive Demo", path: "/fleet/demo" },
      ]
    },
    {
      title: "Weather Data",
      description: "Monetize sensor feeds for agtech, insurance, energy. $49-199/month.",
      icon: Cloud,
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-900/20",
      links: [
        { label: "Landing Page", path: "/weather" },
        { label: "Interactive Demo", path: "/weather/demo" },
      ]
    },
  ];

  const operationalPages = [
    {
      title: "IoT Dashboard",
      description: "Monitor device usage, export data, view catalog",
      icon: LayoutDashboard,
      path: "/iot/dashboard",
      badge: "Operations"
    },
    {
      title: "Analytics",
      description: "Track pilot conversions, revenue, device metrics",
      icon: BarChart3,
      path: "/iot/analytics",
      badge: "Metrics"
    },
    {
      title: "Credits Proof",
      description: "Balance breakdown, transaction history, audit trail",
      icon: Receipt,
      path: "/credits/proof",
      badge: "Ledger"
    },
  ];

  const salesPages = [
    {
      title: "Partner Program",
      description: "Device owners join to list data feeds (85/15 split)",
      icon: Users,
      path: "/partners",
    },
    {
      title: "Integration Guide",
      description: "Step-by-step checklist for device integration",
      icon: BookOpen,
      path: "/integrate",
    },
    {
      title: "Pilot Tracking",
      description: "CRM for managing pilot customers and conversions",
      icon: Target,
      path: "/admin/pilots",
    },
    {
      title: "Case Studies",
      description: "Customer success stories by vertical",
      icon: FileText,
      path: "/case-studies",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <Badge variant="secondary" className="mb-4">IoT Payment Infrastructure</Badge>
            <h1 className="text-4xl font-bold mb-4">Coin Railz IoT Hub</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Monetize device data from fleet telematics and weather sensors. 
              Complete payment infrastructure for the IoT economy.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-4 mb-12">
            {quickActions.map((action) => (
              <Button 
                key={action.path}
                variant={action.variant}
                size="lg"
                onClick={() => setLocation(action.path)}
                className="gap-2"
              >
                <action.icon className="w-5 h-5" />
                {action.label}
              </Button>
            ))}
          </div>

          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Zap className="w-6 h-6 text-primary" />
              Verticals
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {verticalPages.map((vertical) => (
                <Card key={vertical.title} className={`${vertical.bgColor} border-0`}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <vertical.icon className={`w-8 h-8 ${vertical.color}`} />
                      <div>
                        <CardTitle>{vertical.title}</CardTitle>
                        <CardDescription className="mt-1">{vertical.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-3">
                      {vertical.links.map((link) => (
                        <Button 
                          key={link.path}
                          variant="secondary" 
                          size="sm"
                          onClick={() => setLocation(link.path)}
                          className="gap-1"
                        >
                          {link.label}
                          <ArrowRight className="w-3 h-3" />
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <LayoutDashboard className="w-6 h-6 text-primary" />
              Operations & Analytics
            </h2>
            <div className="grid md:grid-cols-3 gap-4">
              {operationalPages.map((page) => (
                <Card 
                  key={page.path} 
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setLocation(page.path)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <page.icon className="w-6 h-6 text-primary" />
                      <Badge variant="outline">{page.badge}</Badge>
                    </div>
                    <CardTitle className="text-lg">{page.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{page.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" />
              Partner & Sales Tools
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {salesPages.map((page) => (
                <Card 
                  key={page.path} 
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setLocation(page.path)}
                >
                  <CardHeader className="pb-2">
                    <page.icon className="w-6 h-6 text-primary" />
                    <CardTitle className="text-lg">{page.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{page.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section>
            <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="py-8">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                  <div>
                    <h3 className="text-xl font-bold mb-2">Ready to Start a Pilot?</h3>
                    <p className="text-muted-foreground">
                      Get started in minutes with our self-serve onboarding. 
                      30-day pilot with up to 50 devices.
                    </p>
                  </div>
                  <Button size="lg" onClick={() => setLocation("/pilot/onboard")} className="gap-2">
                    <Rocket className="w-5 h-5" />
                    Start Pilot Now
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
