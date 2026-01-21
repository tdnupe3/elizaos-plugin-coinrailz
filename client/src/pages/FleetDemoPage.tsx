import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSEO } from "@/hooks/useSEO";
import { useToast } from "@/hooks/use-toast";
import { 
  Truck, 
  MapPin,
  ArrowRight, 
  CheckCircle,
  Play,
  RefreshCw,
  Loader2,
  DollarSign
} from "lucide-react";

interface DemoStep {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  result?: any;
}

export default function FleetDemoPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [accountId, setAccountId] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [companyName, setCompanyName] = useState("Demo Fleet Co");
  
  const [steps, setSteps] = useState<DemoStep[]>([
    { id: 1, title: "Create Fleet Account", description: "Register a new IoT account for your fleet", status: 'pending' },
    { id: 2, title: "Register Vehicle", description: "Add a vehicle to the device registry", status: 'pending' },
    { id: 3, title: "Meter GPS Events", description: "Send GPS location updates (metered billing)", status: 'pending' },
    { id: 4, title: "Check Balance", description: "View credits balance after metering", status: 'pending' }
  ]);

  useSEO({
    title: "Fleet Telematics Demo | Live API Demonstration | Coin Railz",
    description: "Try our fleet telematics billing API in real-time. See device registration, event metering, and credits deduction live.",
    keywords: "fleet telematics demo, IoT billing demo, vehicle data API, GPS metering demo, telematics API test",
    canonical: "https://coinrailz.com/fleet/demo",
    ogTitle: "Fleet Telematics Demo | Live API Test | Coin Railz",
    ogDescription: "Interactive demo of fleet telematics billing. See real API calls for device registration and event metering.",
    twitterTitle: "Fleet Telematics Demo | Coin Railz",
    twitterDescription: "Try our fleet billing API live. Device registration, GPS metering, credits deduction.",
    structuredData: {
      "@context": "https://schema.org/",
      "@type": "WebApplication",
      "name": "Coin Railz Fleet Demo",
      "description": "Interactive demonstration of fleet telematics billing API",
      "url": "https://coinrailz.com/fleet/demo",
      "applicationCategory": "DemoApplication"
    }
  });

  const updateStep = (stepId: number, updates: Partial<DemoStep>) => {
    setSteps(prev => prev.map(s => s.id === stepId ? { ...s, ...updates } : s));
  };

  const runDemo = async () => {
    setIsRunning(true);
    
    try {
      updateStep(1, { status: 'running' });
      const accountRes = await fetch('/api/iot/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          accountName: companyName,
          tier: 'starter'
        })
      });
      
      if (!accountRes.ok) {
        const error = await accountRes.json();
        throw new Error(error.error || 'Failed to create account');
      }
      
      const accountData = await accountRes.json();
      setAccountId(accountData.account?.id || accountData.id);
      updateStep(1, { status: 'completed', result: accountData });
      
      await new Promise(r => setTimeout(r, 500));
      
      updateStep(2, { status: 'running' });
      const demoDeviceId = `demo_truck_${Date.now()}`;
      const apiKey = accountData.apiKey;
      const registerRes = await fetch('/api/iot/register', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-api-key': apiKey || ''
        },
        body: JSON.stringify({
          deviceId: demoDeviceId,
          accountId: accountData.account?.id || accountData.id,
          deviceName: 'Demo Truck #1',
          deviceType: 'sensor',
          spendingLimit: 100
        })
      });
      
      if (!registerRes.ok) {
        const error = await registerRes.json();
        throw new Error(error.error || 'Failed to register device');
      }
      
      const deviceData = await registerRes.json();
      setDeviceId(deviceData.device?.id || deviceData.id);
      updateStep(2, { status: 'completed', result: deviceData });
      
      await new Promise(r => setTimeout(r, 500));
      
      updateStep(3, { status: 'running' });
      const events = [
        { lat: 40.7128, lng: -74.0060, speed: 45 },
        { lat: 40.7135, lng: -74.0055, speed: 48 },
        { lat: 40.7142, lng: -74.0048, speed: 42 }
      ];
      
      let meterResult = null;
      let meterErrors = 0;
      const apiKey = accountData.apiKey;
      for (const event of events) {
        const meterRes = await fetch('/api/iot/meter', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-api-key': apiKey || ''
          },
          body: JSON.stringify({
            deviceId: deviceData.device?.deviceId || demoDeviceId,
            eventType: 'gps_update',
            units: 1
          })
        });
        
        if (meterRes.ok) {
          meterResult = await meterRes.json();
        } else {
          meterErrors++;
          console.error('Meter event failed:', await meterRes.text());
        }
        await new Promise(r => setTimeout(r, 200));
      }
      
      if (meterErrors === events.length) {
        throw new Error('All metering events failed');
      }
      
      updateStep(3, { status: 'completed', result: { eventsMetered: events.length - meterErrors, errors: meterErrors, ...meterResult } });
      
      await new Promise(r => setTimeout(r, 500));
      
      updateStep(4, { status: 'running' });
      const balanceRes = await fetch(`/api/iot/balance?accountId=${accountData.account?.id || accountData.id}`);
      
      if (!balanceRes.ok) {
        const balanceData = { balance: 0, message: 'Balance check requires authentication' };
        updateStep(4, { status: 'completed', result: balanceData });
      } else {
        const balanceData = await balanceRes.json();
        updateStep(4, { status: 'completed', result: balanceData });
      }
      
      toast({
        title: "Demo Complete!",
        description: "All fleet telematics operations executed successfully."
      });
      
    } catch (error: any) {
      const failedStep = steps.find(s => s.status === 'running');
      if (failedStep) {
        updateStep(failedStep.id, { status: 'error', result: { error: error.message } });
      }
      toast({
        title: "Demo Error",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsRunning(false);
    }
  };

  const resetDemo = () => {
    setSteps(steps.map(s => ({ ...s, status: 'pending', result: undefined })));
    setAccountId("");
    setDeviceId("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setLocation("/fleet")}
              className="flex items-center space-x-2"
            >
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Truck className="w-4 h-4 text-white" />
              </div>
              <span className="text-xl font-bold">Fleet Demo</span>
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

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <Badge className="mb-4 bg-blue-100 text-blue-800">Live API Demo</Badge>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Fleet Telematics in Action
          </h1>
          <p className="text-xl text-gray-600">
            Watch real API calls to our IoT billing infrastructure
          </p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Demo Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="companyName">Company Name</Label>
                <Input 
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  disabled={isRunning}
                />
              </div>
              <div className="flex items-end">
                <Button 
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  onClick={runDemo}
                  disabled={isRunning}
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Run Demo
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4 mb-8">
          {steps.map((step, index) => (
            <Card 
              key={step.id} 
              className={`transition-all ${
                step.status === 'running' ? 'border-blue-500 shadow-md' : 
                step.status === 'completed' ? 'border-green-500' : 
                step.status === 'error' ? 'border-red-500' : ''
              }`}
            >
              <CardContent className="py-4">
                <div className="flex items-center space-x-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    step.status === 'completed' ? 'bg-green-100 text-green-600' :
                    step.status === 'running' ? 'bg-blue-100 text-blue-600' :
                    step.status === 'error' ? 'bg-red-100 text-red-600' :
                    'bg-gray-100 text-gray-400'
                  }`}>
                    {step.status === 'completed' ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : step.status === 'running' ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <span className="font-bold">{step.id}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{step.title}</h3>
                    <p className="text-sm text-gray-500">{step.description}</p>
                  </div>
                  {step.status !== 'pending' && (
                    <Badge variant={step.status === 'completed' ? 'default' : step.status === 'error' ? 'destructive' : 'secondary'}>
                      {step.status}
                    </Badge>
                  )}
                </div>
                
                {step.result && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <pre className="text-xs overflow-x-auto">
                      {JSON.stringify(step.result, null, 2)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {steps.some(s => s.status !== 'pending') && (
          <div className="flex justify-center space-x-4">
            <Button variant="outline" onClick={resetDemo}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Reset Demo
            </Button>
            <Button 
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => setLocation('/pilot/onboard')}
            >
              Book Real Pilot
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        <Card className="mt-12 bg-blue-50 border-blue-200">
          <CardContent className="py-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-blue-900">Ready for Production?</h3>
                <p className="text-blue-700">
                  Start a 30-day pilot with up to 50 vehicles. $500 pilot fee includes integration support.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
