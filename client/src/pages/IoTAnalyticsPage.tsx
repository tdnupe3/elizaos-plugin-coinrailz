import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, 
  Users, 
  Truck, 
  Cloud, 
  DollarSign, 
  Cpu,
  TrendingUp,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
  BarChart3,
  Target
} from "lucide-react";

interface Pilot {
  id: string;
  companyName: string;
  vertical: "fleet" | "weather";
  status: "prospect" | "discovery" | "pilot" | "converted" | "churned";
  deviceCount: number;
  revenue: number;
  startDate: string;
  contactEmail: string;
}

interface AnalyticsData {
  pilots: Pilot[];
  stats: {
    total: number;
    fleet: number;
    weather: number;
    converted: number;
    totalDevices: number;
    totalRevenue: number;
  };
}

export default function IoTAnalyticsPage() {
  const [, setLocation] = useLocation();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/iot/pilots");
        if (res.ok) {
          const result = await res.json();
          setData(result);
        } else {
          setError("Failed to load analytics data");
        }
      } catch (err) {
        console.error("Failed to fetch analytics:", err);
        setError("Network error - please try again");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const calculateConversionRate = () => {
    if (!data || data.stats.total === 0) return 0;
    return Math.round((data.stats.converted / data.stats.total) * 100);
  };

  const calculatePipelineValue = () => {
    if (!data) return 0;
    return data.pilots
      .filter(p => p.status !== "churned")
      .reduce((sum, p) => sum + p.revenue, 0);
  };

  const getStatusCounts = () => {
    if (!data) return { prospect: 0, discovery: 0, pilot: 0, converted: 0, churned: 0 };
    return {
      prospect: data.pilots.filter(p => p.status === "prospect").length,
      discovery: data.pilots.filter(p => p.status === "discovery").length,
      pilot: data.pilots.filter(p => p.status === "pilot").length,
      converted: data.pilots.filter(p => p.status === "converted").length,
      churned: data.pilots.filter(p => p.status === "churned").length,
    };
  };

  const statusCounts = getStatusCounts();
  const conversionRate = calculateConversionRate();
  const pipelineValue = calculatePipelineValue();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Error Loading Analytics</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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

        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <BarChart3 className="w-8 h-8 text-primary" />
                IoT Analytics
              </h1>
              <p className="text-muted-foreground">Track pilot conversions, revenue, and device metrics</p>
            </div>
            <Button variant="outline" onClick={() => setLocation("/admin/pilots")}>
              <Target className="w-4 h-4 mr-2" />
              Manage Pilots
            </Button>
          </div>

          <div className="grid md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Pilots</CardDescription>
                <CardTitle className="text-3xl flex items-center gap-2">
                  <Users className="w-6 h-6 text-primary" />
                  {data?.stats.total || 0}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Devices</CardDescription>
                <CardTitle className="text-3xl flex items-center gap-2">
                  <Cpu className="w-6 h-6 text-blue-500" />
                  {data?.stats.totalDevices || 0}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Pipeline Revenue</CardDescription>
                <CardTitle className="text-3xl flex items-center gap-2">
                  <DollarSign className="w-6 h-6 text-green-500" />
                  ${pipelineValue.toLocaleString()}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Conversion Rate</CardDescription>
                <CardTitle className="text-3xl flex items-center gap-2">
                  <TrendingUp className="w-6 h-6 text-purple-500" />
                  {conversionRate}%
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle>Vertical Breakdown</CardTitle>
                <CardDescription>Pilots by industry vertical</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Truck className="w-5 h-5 text-blue-500" />
                    <span>Fleet Telematics</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{data?.stats.fleet || 0} pilots</Badge>
                    <span className="text-sm text-muted-foreground">
                      {data?.stats.total ? Math.round((data.stats.fleet / data.stats.total) * 100) : 0}%
                    </span>
                  </div>
                </div>
                <Progress 
                  value={data?.stats.total ? (data.stats.fleet / data.stats.total) * 100 : 0} 
                  className="h-2"
                />
                
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-2">
                    <Cloud className="w-5 h-5 text-green-500" />
                    <span>Weather Data</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{data?.stats.weather || 0} pilots</Badge>
                    <span className="text-sm text-muted-foreground">
                      {data?.stats.total ? Math.round((data.stats.weather / data.stats.total) * 100) : 0}%
                    </span>
                  </div>
                </div>
                <Progress 
                  value={data?.stats.total ? (data.stats.weather / data.stats.total) * 100 : 0} 
                  className="h-2 [&>div]:bg-green-500"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Conversion Funnel</CardTitle>
                <CardDescription>Pipeline status distribution</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <span>Prospect</span>
                  </div>
                  <Badge variant="outline">{statusCounts.prospect}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-blue-500" />
                    <span>Discovery</span>
                  </div>
                  <Badge variant="outline">{statusCounts.discovery}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-yellow-500" />
                    <span>Active Pilot</span>
                  </div>
                  <Badge variant="outline">{statusCounts.pilot}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span>Converted</span>
                  </div>
                  <Badge className="bg-green-500">{statusCounts.converted}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-500" />
                    <span>Churned</span>
                  </div>
                  <Badge variant="destructive">{statusCounts.churned}</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Pilots</CardTitle>
              <CardDescription>Latest pilot customers in the pipeline</CardDescription>
            </CardHeader>
            <CardContent>
              {data?.pilots.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No pilots yet. Start onboarding customers!</p>
                  <Button 
                    className="mt-4" 
                    onClick={() => setLocation("/pilot/onboard")}
                  >
                    Add First Pilot
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2">Company</th>
                        <th className="text-left py-2 px-2">Vertical</th>
                        <th className="text-left py-2 px-2">Status</th>
                        <th className="text-right py-2 px-2">Devices</th>
                        <th className="text-right py-2 px-2">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.pilots.slice(0, 10).map((pilot) => (
                        <tr key={pilot.id} className="border-b last:border-0">
                          <td className="py-3 px-2 font-medium">{pilot.companyName}</td>
                          <td className="py-3 px-2">
                            <Badge variant="outline" className="capitalize">
                              {pilot.vertical === "fleet" ? (
                                <Truck className="w-3 h-3 mr-1" />
                              ) : (
                                <Cloud className="w-3 h-3 mr-1" />
                              )}
                              {pilot.vertical}
                            </Badge>
                          </td>
                          <td className="py-3 px-2">
                            <Badge 
                              variant={pilot.status === "converted" ? "default" : "secondary"}
                              className="capitalize"
                            >
                              {pilot.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-2 text-right">{pilot.deviceCount}</td>
                          <td className="py-3 px-2 text-right">${pilot.revenue.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
