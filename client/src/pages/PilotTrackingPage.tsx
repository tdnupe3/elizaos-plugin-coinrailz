import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useSEO } from "@/hooks/useSEO";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Users, Truck, Cloud, DollarSign, Calendar, TrendingUp, Loader2 } from "lucide-react";

interface Pilot {
  id: string;
  companyName: string;
  vertical: "fleet" | "weather";
  status: "prospect" | "discovery" | "pilot" | "converted" | "churned";
  deviceCount: number;
  revenue: number;
  startDate: string;
  notes: string;
  contactEmail: string;
}

export default function PilotTrackingPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [pilots, setPilots] = useState<Pilot[]>([]);

  const [newPilot, setNewPilot] = useState({
    companyName: "",
    vertical: "fleet" as "fleet" | "weather",
    status: "prospect" as Pilot["status"],
    deviceCount: 0,
    revenue: 0,
    startDate: new Date().toISOString().split("T")[0],
    notes: "",
    contactEmail: ""
  });

  useSEO({
    title: "Pilot Tracking - Admin Dashboard | Coin Railz",
    description: "Track IoT pilot customers, monitor conversions, and manage the sales pipeline for fleet telematics and weather data verticals.",
    keywords: "pilot tracking, sales pipeline, IoT customers, fleet telematics sales, weather data sales"
  });

  useEffect(() => {
    const fetchPilots = async () => {
      try {
        const res = await fetch("/api/iot/pilots");
        if (res.ok) {
          const data = await res.json();
          setPilots(data.pilots || []);
        }
      } catch (error) {
        console.error("Failed to fetch pilots:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPilots();
  }, []);

  const handleAddPilot = async () => {
    if (!newPilot.companyName || !newPilot.contactEmail) {
      toast({ title: "Error", description: "Company name and email are required" });
      return;
    }
    
    setIsSaving(true);
    try {
      const res = await fetch("/api/iot/pilots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPilot)
      });
      
      if (res.ok) {
        const data = await res.json();
        setPilots([...pilots, data.pilot]);
        toast({ title: "Pilot Added", description: `${newPilot.companyName} added to tracking` });
        setNewPilot({
          companyName: "",
          vertical: "fleet",
          status: "prospect",
          deviceCount: 0,
          revenue: 0,
          startDate: new Date().toISOString().split("T")[0],
          notes: "",
          contactEmail: ""
        });
      } else {
        toast({ title: "Error", description: "Failed to add pilot" });
      }
    } catch (error) {
      console.error("Failed to add pilot:", error);
      toast({ title: "Error", description: "Failed to add pilot" });
    } finally {
      setIsSaving(false);
    }
  };

  const updatePilotStatus = async (id: string, status: Pilot["status"]) => {
    try {
      const res = await fetch(`/api/iot/pilots/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      
      if (res.ok) {
        setPilots(pilots.map(p => p.id === id ? { ...p, status } : p));
        toast({ title: "Status Updated" });
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  const getStatusColor = (status: Pilot["status"]) => {
    switch (status) {
      case "prospect": return "bg-gray-500";
      case "discovery": return "bg-blue-500";
      case "pilot": return "bg-yellow-500";
      case "converted": return "bg-green-500";
      case "churned": return "bg-red-500";
    }
  };

  const stats = {
    total: pilots.length,
    fleet: pilots.filter(p => p.vertical === "fleet").length,
    weather: pilots.filter(p => p.vertical === "weather").length,
    converted: pilots.filter(p => p.status === "converted").length,
    totalDevices: pilots.reduce((sum, p) => sum + p.deviceCount, 0),
    totalRevenue: pilots.reduce((sum, p) => sum + p.revenue, 0)
  };

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
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold">Pilot Tracking</h1>
              <p className="text-muted-foreground">Monitor sales pipeline and customer conversions</p>
            </div>
            <Button onClick={() => setShowAddForm(!showAddForm)} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Add Pilot
            </Button>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}

          {!isLoading && (
            <>

          <div className="grid md:grid-cols-6 gap-4 mb-8">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{stats.total}</p>
                    <p className="text-xs text-muted-foreground">Total Pilots</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Truck className="w-5 h-5 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold">{stats.fleet}</p>
                    <p className="text-xs text-muted-foreground">Fleet</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Cloud className="w-5 h-5 text-cyan-500" />
                  <div>
                    <p className="text-2xl font-bold">{stats.weather}</p>
                    <p className="text-xs text-muted-foreground">Weather</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold">{stats.converted}</p>
                    <p className="text-xs text-muted-foreground">Converted</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-purple-500" />
                  <div>
                    <p className="text-2xl font-bold">{stats.totalDevices}</p>
                    <p className="text-xs text-muted-foreground">Devices</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-2xl font-bold">${stats.totalRevenue}</p>
                    <p className="text-xs text-muted-foreground">Revenue</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {showAddForm && (
            <Card className="mb-8 border-2 border-primary">
              <CardHeader>
                <CardTitle>Add New Pilot</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Company Name</Label>
                    <Input
                      value={newPilot.companyName}
                      onChange={(e) => setNewPilot({ ...newPilot, companyName: e.target.value })}
                      placeholder="Acme Logistics"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Email</Label>
                    <Input
                      type="email"
                      value={newPilot.contactEmail}
                      onChange={(e) => setNewPilot({ ...newPilot, contactEmail: e.target.value })}
                      placeholder="ops@acme.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Vertical</Label>
                    <Select
                      value={newPilot.vertical}
                      onValueChange={(v) => setNewPilot({ ...newPilot, vertical: v as "fleet" | "weather" })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fleet">Fleet Telematics</SelectItem>
                        <SelectItem value="weather">Weather/Environmental</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={newPilot.status}
                      onValueChange={(v) => setNewPilot({ ...newPilot, status: v as Pilot["status"] })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="prospect">Prospect</SelectItem>
                        <SelectItem value="discovery">Discovery Call</SelectItem>
                        <SelectItem value="pilot">Active Pilot</SelectItem>
                        <SelectItem value="converted">Converted</SelectItem>
                        <SelectItem value="churned">Churned</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Device Count</Label>
                    <Input
                      type="number"
                      value={newPilot.deviceCount}
                      onChange={(e) => setNewPilot({ ...newPilot, deviceCount: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Revenue ($)</Label>
                    <Input
                      type="number"
                      value={newPilot.revenue}
                      onChange={(e) => setNewPilot({ ...newPilot, revenue: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={newPilot.notes}
                      onChange={(e) => setNewPilot({ ...newPilot, notes: e.target.value })}
                      placeholder="Details about the pilot..."
                      rows={2}
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button onClick={handleAddPilot}>Add Pilot</Button>
                  <Button variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Active Pipeline</CardTitle>
              <CardDescription>Track progress from prospect to converted customer</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pilots.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No pilots yet. Add your first pilot to start tracking.
                  </p>
                ) : (
                  pilots.map((pilot) => (
                    <div 
                      key={pilot.id} 
                      className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            pilot.vertical === "fleet" ? "bg-blue-100 text-blue-600" : "bg-cyan-100 text-cyan-600"
                          }`}>
                            {pilot.vertical === "fleet" ? <Truck className="w-5 h-5" /> : <Cloud className="w-5 h-5" />}
                          </div>
                          <div>
                            <h3 className="font-semibold">{pilot.companyName}</h3>
                            <p className="text-sm text-muted-foreground">{pilot.contactEmail}</p>
                            <p className="text-sm mt-1">{pilot.notes}</p>
                            <div className="flex items-center gap-4 mt-2 text-sm">
                              <span>{pilot.deviceCount} devices</span>
                              <span>${pilot.revenue} revenue</span>
                              <span>Started: {pilot.startDate}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getStatusColor(pilot.status)}>
                            {pilot.status.charAt(0).toUpperCase() + pilot.status.slice(1)}
                          </Badge>
                          <Select
                            value={pilot.status}
                            onValueChange={(v) => updatePilotStatus(pilot.id, v as Pilot["status"])}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="prospect">Prospect</SelectItem>
                              <SelectItem value="discovery">Discovery</SelectItem>
                              <SelectItem value="pilot">Pilot</SelectItem>
                              <SelectItem value="converted">Converted</SelectItem>
                              <SelectItem value="churned">Churned</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <div className="mt-8 text-center">
            <Button variant="outline" onClick={() => setLocation("/case-studies")}>
              View Case Studies
            </Button>
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  );
}
