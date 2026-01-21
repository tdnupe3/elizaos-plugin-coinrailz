import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSEO } from "@/hooks/useSEO";
import { ArrowLeft, Check, Copy, ExternalLink, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function IntegrationGuidePage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  useSEO({
    title: "Integration Guide - Connect Your Devices | Coin Railz",
    description: "Step-by-step guide to integrate your IoT devices with Coin Railz. REST API integration for fleet telematics, weather sensors, and industrial IoT.",
    keywords: "IoT API integration, device integration guide, telematics API, sensor data API, REST API integration",
    ogTitle: "Integration Guide - Connect Your IoT Devices",
    ogDescription: "Complete checklist for integrating your devices with Coin Railz IoT payment infrastructure.",
    twitterTitle: "Coin Railz Integration Guide",
    twitterDescription: "REST API integration for IoT devices in hours, not weeks.",
    structuredData: {
      "@context": "https://schema.org",
      "@type": "HowTo",
      "name": "Integrate IoT Devices with Coin Railz",
      "description": "Step-by-step integration guide for device data monetization"
    }
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const toggleStep = (step: number) => {
    setCompletedSteps(prev => 
      prev.includes(step) ? prev.filter(s => s !== step) : [...prev, step]
    );
  };

  const integrationSteps = [
    {
      step: 1,
      title: "Create an IoT Account",
      description: "Register your organization to get started",
      code: `curl -X POST https://coinrailz.com/api/iot/account \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "My Fleet Company",
    "type": "fleet",
    "contactEmail": "ops@myfleet.com"
  }'`,
      response: `{
  "success": true,
  "accountId": "iot_acc_abc123",
  "apiKey": "crz_iot_live_..."
}`,
      notes: ["Save your API key securely - you'll need it for all requests", "Account types: fleet, weather, industrial, other"]
    },
    {
      step: 2,
      title: "Register Your Devices",
      description: "Add each device to your account",
      code: `curl -X POST https://coinrailz.com/api/iot/register \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d '{
    "accountId": "iot_acc_abc123",
    "deviceId": "vehicle-001",
    "deviceType": "gps-tracker",
    "metadata": {
      "make": "Ford",
      "model": "Transit",
      "year": 2023
    }
  }'`,
      response: `{
  "success": true,
  "deviceId": "vehicle-001",
  "walletAddress": "0x..."
}`,
      notes: ["Each device gets a unique wallet for receiving payments", "Metadata is optional but helps with catalog listings"]
    },
    {
      step: 3,
      title: "Top Up Credits",
      description: "Add credits to cover metering costs ($0.005/event base)",
      code: `curl -X POST https://coinrailz.com/api/iot/topup \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d '{
    "accountId": "iot_acc_abc123",
    "amount": 100,
    "paymentMethod": "stripe",
    "stripePaymentMethodId": "pm_..."
  }'`,
      response: `{
  "success": true,
  "newBalance": 100.00,
  "transactionId": "txn_..."
}`,
      notes: ["Volume discounts: 10% off $100+, 15% off $500+, 20% off $1000+", "Also supports PayPal via 2-step flow"]
    },
    {
      step: 4,
      title: "Meter Billable Events",
      description: "Send data events as they occur",
      code: `curl -X POST https://coinrailz.com/api/iot/meter \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d '{
    "accountId": "iot_acc_abc123",
    "deviceId": "vehicle-001",
    "eventType": "gps_ping",
    "data": {
      "lat": 40.7128,
      "lng": -74.0060,
      "speed": 45,
      "heading": 180
    }
  }'`,
      response: `{
  "success": true,
  "eventId": "evt_...",
  "cost": 0.005,
  "remainingBalance": 99.995
}`,
      notes: ["Events are deducted from your credits balance", "Data payload is stored and can be sold via A2D"]
    },
    {
      step: 5,
      title: "Create Data Products (Optional)",
      description: "List your data for sale to buyers",
      code: `curl -X POST https://coinrailz.com/api/iot/products \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d '{
    "accountId": "iot_acc_abc123",
    "deviceId": "vehicle-001",
    "name": "NYC Fleet GPS Feed",
    "description": "Real-time GPS data from NYC delivery fleet",
    "pricePerUnit": 0.01,
    "unitType": "reading",
    "expectedNetwork": "base"
  }'`,
      response: `{
  "success": true,
  "productId": "prod_...",
  "catalogUrl": "/api/iot/catalog"
}`,
      notes: ["Products are listed in the public catalog", "You receive 85% of every sale automatically"]
    },
    {
      step: 6,
      title: "Monitor Usage",
      description: "Check balances and transactions",
      code: `# Check balance
curl https://coinrailz.com/api/iot/balance/iot_acc_abc123 \\
  -H "X-API-Key: YOUR_API_KEY"

# View transactions
curl https://coinrailz.com/api/iot/transactions/iot_acc_abc123 \\
  -H "X-API-Key: YOUR_API_KEY"`,
      response: `{
  "balance": 95.50,
  "pendingCharges": 0,
  "lastUpdated": "2026-01-21T..."
}`,
      notes: ["Use the dashboard for visual monitoring", "Export CSV reports anytime"]
    }
  ];

  const sdkExamples = {
    javascript: `import { CoinRailzIoT } from '@coinrailz/iot-payments';

const client = new CoinRailzIoT({
  apiKey: process.env.COINRAILZ_API_KEY
});

// Register a device
const device = await client.devices.register({
  accountId: 'iot_acc_abc123',
  deviceId: 'sensor-001',
  deviceType: 'weather-station'
});

// Send meter events
await client.meter({
  accountId: 'iot_acc_abc123',
  deviceId: 'sensor-001',
  eventType: 'weather_reading',
  data: { temp: 72.5, humidity: 45 }
});`,
    python: `from coinrailz import IoTClient

client = IoTClient(api_key=os.environ['COINRAILZ_API_KEY'])

# Register a device
device = client.devices.register(
    account_id='iot_acc_abc123',
    device_id='sensor-001',
    device_type='weather-station'
)

# Send meter events
client.meter(
    account_id='iot_acc_abc123',
    device_id='sensor-001',
    event_type='weather_reading',
    data={'temp': 72.5, 'humidity': 45}
)`,
    curl: `# All API calls use standard REST conventions
# Base URL: https://coinrailz.com/api/iot

# Headers required:
# Content-Type: application/json
# X-API-Key: YOUR_API_KEY

# See step-by-step examples above`
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

        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Integration Guide</h1>
            <p className="text-xl text-muted-foreground">
              Connect your devices in 6 steps. Most integrations complete in under an hour.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              {completedSteps.length} of {integrationSteps.length} steps completed
            </div>
          </div>

          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Prerequisites</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-500 mt-0.5" />
                  <span>Device(s) capable of making HTTP requests</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-500 mt-0.5" />
                  <span>Internet connectivity for your devices</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="w-5 h-5 text-green-500 mt-0.5" />
                  <span>Payment method for credits (Stripe or PayPal)</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <div className="space-y-6 mb-12">
            {integrationSteps.map((item) => (
              <Card 
                key={item.step} 
                className={`border-2 transition-colors ${
                  completedSteps.includes(item.step) 
                    ? 'border-green-500 bg-green-50/50 dark:bg-green-900/10' 
                    : 'border-border'
                }`}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                        completedSteps.includes(item.step)
                          ? 'bg-green-500 text-white'
                          : 'bg-primary text-primary-foreground'
                      }`}>
                        {completedSteps.includes(item.step) ? <Check className="w-5 h-5" /> : item.step}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{item.title}</CardTitle>
                        <CardDescription>{item.description}</CardDescription>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleStep(item.step)}
                    >
                      {completedSteps.includes(item.step) ? 'Mark Incomplete' : 'Mark Complete'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="relative">
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
                        <code>{item.code}</code>
                      </pre>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2 text-gray-400 hover:text-white"
                        onClick={() => copyToClipboard(item.code)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium mb-2">Response:</p>
                      <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm overflow-x-auto">
                        <code>{item.response}</code>
                      </pre>
                    </div>

                    {item.notes.length > 0 && (
                      <ul className="space-y-1">
                        {item.notes.map((note, i) => (
                          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-primary">•</span>
                            {note}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="mb-12">
            <CardHeader>
              <CardTitle>SDK Examples</CardTitle>
              <CardDescription>Use our SDKs for faster integration</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="javascript">
                <TabsList className="mb-4">
                  <TabsTrigger value="javascript">JavaScript/Node.js</TabsTrigger>
                  <TabsTrigger value="python">Python</TabsTrigger>
                  <TabsTrigger value="curl">cURL</TabsTrigger>
                </TabsList>
                {Object.entries(sdkExamples).map(([lang, code]) => (
                  <TabsContent key={lang} value={lang}>
                    <div className="relative">
                      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
                        <code>{code}</code>
                      </pre>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2 text-gray-400 hover:text-white"
                        onClick={() => copyToClipboard(code)}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>

          <Card className="mb-12">
            <CardHeader>
              <CardTitle>Common Issues</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium">401 Unauthorized</h4>
                  <p className="text-sm text-muted-foreground">
                    Check that your API key is correctly included in the X-API-Key header.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium">Insufficient Balance</h4>
                  <p className="text-sm text-muted-foreground">
                    Top up your credits balance before metering events. Each event costs $0.005 by default.
                  </p>
                </div>
                <div>
                  <h4 className="font-medium">Device Not Found</h4>
                  <p className="text-sm text-muted-foreground">
                    Register your device before sending meter events. Use the /api/iot/register endpoint first.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Need Help?</h2>
            <div className="flex gap-4 justify-center flex-wrap">
              <Button variant="outline" onClick={() => setLocation("/iot/dashboard")}>
                View Dashboard
              </Button>
              <Button variant="outline" asChild>
                <a href="/api-docs" target="_blank" rel="noopener noreferrer">
                  API Reference <ExternalLink className="w-4 h-4 ml-2" />
                </a>
              </Button>
              <Button onClick={() => setLocation("/partners")}>
                Join Partner Program
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
