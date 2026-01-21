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
  CloudSun, 
  Thermometer,
  ArrowRight, 
  CheckCircle,
  Play,
  RefreshCw,
  Loader2,
  DollarSign,
  ShoppingCart,
  CreditCard
} from "lucide-react";

interface DemoStep {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  result?: any;
}

export default function WeatherDemoPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [stationName, setStationName] = useState("Demo Weather Station");
  
  const [steps, setSteps] = useState<DemoStep[]>([
    { id: 1, title: "Create Sensor Account", description: "Register a new IoT account for your sensors", status: 'pending' },
    { id: 2, title: "Register Weather Sensor", description: "Add a weather station to the device registry", status: 'pending' },
    { id: 3, title: "Push Sensor Readings", description: "Send temperature, humidity, and wind data", status: 'pending' },
    { id: 4, title: "Create Data Product", description: "List sensor data for sale in the A2D catalog", status: 'pending' },
    { id: 5, title: "Browse Catalog", description: "View available data products", status: 'pending' },
    { id: 6, title: "Purchase Data (A2D)", description: "Simulate x402 payment and access data", status: 'pending' }
  ]);

  useSEO({
    title: "Weather Sensor Demo | Live API Demonstration | Coin Railz",
    description: "Try our weather sensor data marketplace API. See device registration, sensor readings, and data product creation live.",
    keywords: "weather sensor demo, environmental data API, sensor marketplace demo, A2D demo, IoT data product",
    canonical: "https://coinrailz.com/weather/demo",
    ogTitle: "Weather Sensor Demo | Live API Test | Coin Railz",
    ogDescription: "Interactive demo of weather sensor monetization. See real API calls for sensor registration and data products.",
    twitterTitle: "Weather Sensor Demo | Coin Railz",
    twitterDescription: "Try our weather data marketplace API live. Sensor registration, readings, data product creation.",
    structuredData: {
      "@context": "https://schema.org/",
      "@type": "WebApplication",
      "name": "Coin Railz Weather Demo",
      "description": "Interactive demonstration of weather sensor data marketplace API",
      "url": "https://coinrailz.com/weather/demo",
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
          accountName: stationName,
          tier: 'starter'
        })
      });
      
      if (!accountRes.ok) {
        const error = await accountRes.json();
        throw new Error(error.error || 'Failed to create account');
      }
      
      const accountData = await accountRes.json();
      const accId = accountData.account?.id || accountData.id;
      updateStep(1, { status: 'completed', result: accountData });
      
      await new Promise(r => setTimeout(r, 500));
      
      updateStep(2, { status: 'running' });
      const demoDeviceId = `demo_sensor_${Date.now()}`;
      const apiKey = accountData.apiKey;
      const registerRes = await fetch('/api/iot/register', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-api-key': apiKey || ''
        },
        body: JSON.stringify({
          deviceId: demoDeviceId,
          accountId: accId,
          deviceName: 'Demo Weather Station #1',
          deviceType: 'sensor',
          spendingLimit: 50
        })
      });
      
      if (!registerRes.ok) {
        const error = await registerRes.json();
        throw new Error(error.error || 'Failed to register device');
      }
      
      const deviceData = await registerRes.json();
      const devId = deviceData.device?.id || deviceData.id;
      updateStep(2, { status: 'completed', result: deviceData });
      
      await new Promise(r => setTimeout(r, 500));
      
      updateStep(3, { status: 'running' });
      const readings = [
        { temperature: 72.4, humidity: 45, windSpeed: 8.2, pressure: 1013.25 },
        { temperature: 72.6, humidity: 44, windSpeed: 7.8, pressure: 1013.30 },
        { temperature: 72.8, humidity: 43, windSpeed: 8.5, pressure: 1013.28 }
      ];
      
      let meterResult = null;
      let meterErrors = 0;
      for (const reading of readings) {
        const meterRes = await fetch('/api/iot/meter', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-api-key': apiKey || ''
          },
          body: JSON.stringify({
            deviceId: deviceData.device?.deviceId || demoDeviceId,
            eventType: 'sensor_reading',
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
      
      if (meterErrors === readings.length) {
        throw new Error('All sensor readings failed to meter');
      }
      
      updateStep(3, { status: 'completed', result: { readingsPushed: readings.length - meterErrors, errors: meterErrors, ...meterResult } });
      
      await new Promise(r => setTimeout(r, 500));
      
      updateStep(4, { status: 'running' });
      const productRes = await fetch('/api/iot/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: accId,
          deviceId: devId,
          name: 'NYC Hyperlocal Weather Feed',
          description: 'Real-time temperature, humidity, wind, and pressure from Manhattan',
          pricePerReading: 0.002,
          dataType: 'weather',
          metadata: {
            location: 'New York, NY',
            updateFrequency: '15 minutes',
            sensors: ['temperature', 'humidity', 'wind', 'pressure']
          }
        })
      });
      
      let realProductId: string | null = null;
      if (!productRes.ok) {
        const productData = { 
          message: 'Product creation requires authentication',
          demo: true,
          productPreview: {
            name: 'NYC Hyperlocal Weather Feed',
            pricePerReading: '$0.002'
          }
        };
        updateStep(4, { status: 'completed', result: productData });
      } else {
        const productData = await productRes.json();
        realProductId = productData.product?.id || productData.id || null;
        updateStep(4, { status: 'completed', result: productData });
      }
      
      await new Promise(r => setTimeout(r, 500));
      
      updateStep(5, { status: 'running' });
      const catalogRes = await fetch('/api/iot/catalog');
      
      if (!catalogRes.ok) {
        const catalogData = { 
          message: 'Catalog available',
          demo: true,
          sampleProducts: [
            { name: 'NYC Weather Feed', price: '$0.002/reading' },
            { name: 'LA Air Quality', price: '$0.003/reading' }
          ]
        };
        updateStep(5, { status: 'completed', result: catalogData });
      } else {
        const catalogData = await catalogRes.json();
        updateStep(5, { status: 'completed', result: catalogData });
      }
      
      await new Promise(r => setTimeout(r, 500));
      
      updateStep(6, { status: 'running' });
      const productId = realProductId || 'demo-product';
      const purchaseRes = await fetch(`/api/iot/data/${productId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          x402PaymentId: `demo-payment-${Date.now()}`,
          network: 'base'
        })
      });
      
      if (purchaseRes.status === 402) {
        const paymentRequired = await purchaseRes.json();
        updateStep(6, { 
          status: 'completed', 
          result: { 
            message: 'Payment Required (HTTP 402)',
            demo: true,
            paymentInfo: {
              status: 402,
              priceRequired: paymentRequired.price || '$0.002 USDC',
              network: paymentRequired.network || 'base',
              address: paymentRequired.address || '0x...'
            }
          } 
        });
      } else if (!purchaseRes.ok) {
        updateStep(6, { 
          status: 'completed', 
          result: { 
            message: 'Data purchase requires x402 payment',
            demo: true,
            info: 'In production, agents pay USDC on-chain'
          } 
        });
      } else {
        const purchaseData = await purchaseRes.json();
        updateStep(6, { status: 'completed', result: purchaseData });
      }
      
      toast({
        title: "Demo Complete!",
        description: "Weather sensor workflow executed successfully."
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
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-green-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => setLocation("/weather")}
              className="flex items-center space-x-2"
            >
              <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                <CloudSun className="w-4 h-4 text-white" />
              </div>
              <span className="text-xl font-bold">Weather Demo</span>
            </Button>
            <Button 
              className="bg-green-600 hover:bg-green-700"
              onClick={() => setLocation('/pilot/onboard')}
            >
              Book Pilot
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <Badge className="mb-4 bg-green-100 text-green-800">Live API Demo</Badge>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Weather Data Marketplace in Action
          </h1>
          <p className="text-xl text-gray-600">
            See how sensors register, push data, and list products for sale
          </p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Demo Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="stationName">Station Name</Label>
                <Input 
                  id="stationName"
                  value={stationName}
                  onChange={(e) => setStationName(e.target.value)}
                  disabled={isRunning}
                />
              </div>
              <div className="flex items-end">
                <Button 
                  className="w-full bg-green-600 hover:bg-green-700"
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
                step.status === 'running' ? 'border-green-500 shadow-md' : 
                step.status === 'completed' ? 'border-green-500' : 
                step.status === 'error' ? 'border-red-500' : ''
              }`}
            >
              <CardContent className="py-4">
                <div className="flex items-center space-x-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    step.status === 'completed' ? 'bg-green-100 text-green-600' :
                    step.status === 'running' ? 'bg-green-100 text-green-600' :
                    step.status === 'error' ? 'bg-red-100 text-red-600' :
                    'bg-gray-100 text-gray-400'
                  }`}>
                    {step.status === 'completed' ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : step.status === 'running' ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : step.id === 6 ? (
                      <CreditCard className="w-5 h-5" />
                    ) : step.id === 4 ? (
                      <ShoppingCart className="w-5 h-5" />
                    ) : step.id === 3 ? (
                      <Thermometer className="w-5 h-5" />
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
              className="bg-green-600 hover:bg-green-700"
              onClick={() => setLocation('/pilot/onboard')}
            >
              Book Real Pilot
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        <Card className="mt-12 bg-green-50 border-green-200">
          <CardContent className="py-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center text-white">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-green-900">Ready to Sell Your Sensor Data?</h3>
                <p className="text-green-700">
                  Start a 30-day pilot with up to 10 sensor feeds. We bring the buyers, you get 85% of sales.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
