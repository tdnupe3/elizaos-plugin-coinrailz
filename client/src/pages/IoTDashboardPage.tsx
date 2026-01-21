import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSEO } from "@/hooks/useSEO";
import { useQuery } from "@tanstack/react-query";
import { 
  Cpu, 
  DollarSign,
  Activity,
  CreditCard,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Loader2,
  Download
} from "lucide-react";

export default function IoTDashboardPage() {
  const [, setLocation] = useLocation();

  useSEO({
    title: "IoT Dashboard | Device Usage & Credits | Coin Railz",
    description: "Monitor your IoT device activity, credits balance, and transactions. Real-time billing dashboard.",
    keywords: "IoT dashboard, device usage monitoring, credits balance, transaction history, billing dashboard, IoT analytics",
    canonical: "https://coinrailz.com/iot/dashboard",
    ogTitle: "IoT Dashboard | Monitor Device Usage | Coin Railz",
    ogDescription: "Real-time monitoring of IoT device activity, credits balance, and billing transactions.",
    twitterTitle: "IoT Dashboard | Coin Railz",
    twitterDescription: "Monitor IoT devices, credits, and transactions in real-time.",
    structuredData: {
      "@context": "https://schema.org/",
      "@type": "WebApplication",
      "name": "Coin Railz IoT Dashboard",
      "description": "Real-time dashboard for IoT device usage monitoring and credits management",
      "url": "https://coinrailz.com/iot/dashboard",
      "applicationCategory": "BusinessApplication"
    }
  });

  const { data: catalogData, isLoading: catalogLoading, refetch: refetchCatalog } = useQuery<{ products?: any[]; length?: number } | any[]>({
    queryKey: ['/api/iot/catalog'],
    staleTime: 30000
  });

  const products = Array.isArray(catalogData) ? catalogData : (catalogData?.products || []);
  const productCount = products.length;

  const stats = [
    {
      title: "Products Listed",
      value: productCount,
      change: "+3 this week",
      trend: "up",
      icon: <Cpu className="w-5 h-5" />
    },
    {
      title: "Total Events Metered",
      value: "—",
      change: "Sign in to view",
      trend: "neutral",
      icon: <Activity className="w-5 h-5" />
    },
    {
      title: "Credits Balance",
      value: "—",
      change: "Sign in to view",
      trend: "neutral",
      icon: <CreditCard className="w-5 h-5" />
    },
    {
      title: "Revenue (This Month)",
      value: "—",
      change: "Sign in to view",
      trend: "neutral",
      icon: <DollarSign className="w-5 h-5" />
    }
  ];

  const recentActivity = [
    { type: "meter", description: "GPS event metered", device: "Vehicle #1", time: "2 min ago", cost: "$0.005" },
    { type: "meter", description: "Sensor reading", device: "Weather Station #3", time: "5 min ago", cost: "$0.002" },
    { type: "sale", description: "Data product sold", device: "NYC Weather Feed", time: "1 hour ago", revenue: "+$2.50" },
    { type: "topup", description: "Credits added", device: "Account", time: "2 hours ago", revenue: "+$100" },
    { type: "meter", description: "Engine diagnostic", device: "Truck #7", time: "3 hours ago", cost: "$0.01" }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => setLocation("/iot")}
                className="flex items-center space-x-2"
              >
                <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                  <Cpu className="w-4 h-4 text-white" />
                </div>
                <span className="text-xl font-bold">IoT Dashboard</span>
              </Button>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={() => setLocation("/fleet")}>
                Fleet
              </Button>
              <Button variant="ghost" onClick={() => setLocation("/weather")}>
                Weather
              </Button>
              <Button variant="ghost" onClick={() => setLocation("/credits/proof")}>
                Audit Trail
              </Button>
              <Button 
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => setLocation("/iot/topup")}
              >
                Top Up Credits
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Usage Dashboard</h1>
            <p className="text-gray-500">Monitor devices, events, and credits</p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                const csvContent = [
                  ['Type', 'Description', 'Device', 'Time', 'Amount'].join(','),
                  ...recentActivity.map(a => [a.type, a.description, a.device, a.time, a.revenue || a.cost].join(','))
                ].join('\n');
                const blob = new Blob([csvContent], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `iot-activity-${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button 
              variant="outline" 
              onClick={() => refetchCatalog()}
              disabled={catalogLoading}
            >
              {catalogLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <Card key={index}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">
                    {stat.icon}
                  </div>
                  {stat.trend === "up" && <ArrowUpRight className="w-5 h-5 text-green-500" />}
                  {stat.trend === "down" && <ArrowDownRight className="w-5 h-5 text-red-500" />}
                </div>
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-sm text-gray-500">{stat.title}</div>
                <div className={`text-xs mt-1 ${stat.trend === 'up' ? 'text-green-600' : stat.trend === 'down' ? 'text-red-600' : 'text-gray-400'}`}>
                  {stat.change}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Recent Activity</span>
                <Badge variant="secondary">Demo Data</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        activity.type === 'sale' || activity.type === 'topup' 
                          ? 'bg-green-100 text-green-600' 
                          : 'bg-blue-100 text-blue-600'
                      }`}>
                        {activity.type === 'sale' || activity.type === 'topup' ? (
                          <DollarSign className="w-4 h-4" />
                        ) : (
                          <Activity className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-sm">{activity.description}</div>
                        <div className="text-xs text-gray-500">{activity.device}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-medium text-sm ${
                        activity.revenue ? 'text-green-600' : 'text-gray-600'
                      }`}>
                        {activity.revenue || activity.cost}
                      </div>
                      <div className="text-xs text-gray-400">{activity.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Data Products Catalog</span>
                <Badge variant="secondary">{catalogLoading ? 'Loading...' : `${productCount} products`}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {catalogLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                </div>
              ) : products.length > 0 ? (
                <div className="space-y-3">
                  {products.slice(0, 5).map((product: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-medium text-sm">{product.name}</div>
                        <div className="text-xs text-gray-500">{product.dataType || product.type || 'data'}</div>
                      </div>
                      <Badge variant="secondary">
                        ${product.pricePerReading || product.price || '0.00'}/read
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Cpu className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No products listed yet</p>
                  <Button 
                    variant="link" 
                    onClick={() => setLocation("/weather/demo")}
                    className="mt-2"
                  >
                    Try the demo to create one
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="bg-gradient-to-r from-emerald-600 to-green-600 text-white">
          <CardContent className="py-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-bold mb-2">Ready to Start Your Pilot?</h3>
                <p className="opacity-90">
                  30-day pilot with full platform access. Up to 50 vehicles or 10 sensors.
                </p>
              </div>
              <Button 
                size="lg"
                className="bg-white text-emerald-600 hover:bg-gray-100"
                onClick={() => window.open('https://calendly.com', '_blank')}
              >
                Book Discovery Call
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
