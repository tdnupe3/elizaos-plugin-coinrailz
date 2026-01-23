import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Code, DollarSign, Zap, Shield, ExternalLink, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ServiceEntry {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  priceUSD: string;
  priceUSDC: string;
  network: string;
  category: string;
  capabilities: string[];
  x402Compatible: boolean;
  stripeCompatible: boolean;
}

interface ServiceCatalog {
  services: ServiceEntry[];
  categories: string[];
  totalServices: number;
}

export default function ServiceDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const { data: catalog, isLoading, error } = useQuery<ServiceCatalog>({
    queryKey: ['/api/services/catalog'],
  });

  const service = catalog?.services.find(s => s.id === slug);
  const relatedServices = catalog?.services.filter(
    s => s.category === service?.category && s.id !== slug
  ).slice(0, 4);

  useEffect(() => {
    if (service) {
      document.title = `${service.name} - API Service | Coin Railz`;
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.setAttribute('content', `${service.description}. Price: ${service.priceUSD} per call. Available via x402 protocol on Base network.`);
      }
    }
  }, [service]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: "Copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const getTypeScriptExample = (service: ServiceEntry) => `import { CoinRailz } from '@coinrailz/agent-payments';

const client = new CoinRailz({
  apiKey: process.env.COINRAILZ_API_KEY,
  network: 'base'
});

// Call ${service.name}
const response = await fetch('https://coinrailz.com${service.endpoint}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-PAYMENT': '<x402-payment-header>'
  },
  body: JSON.stringify({
    // Your request parameters
  })
});

const data = await response.json();
console.log(data);`;

  const getPythonExample = (service: ServiceEntry) => `from coinrailz import CoinRailz
import requests

client = CoinRailz(api_key=os.environ["COINRAILZ_API_KEY"])

# Call ${service.name}
response = requests.post(
    "https://coinrailz.com${service.endpoint}",
    headers={
        "Content-Type": "application/json",
        "X-PAYMENT": "<x402-payment-header>"
    },
    json={
        # Your request parameters
    }
)

data = response.json()
print(data)`;

  const getCurlExample = (service: ServiceEntry) => `curl -X POST "https://coinrailz.com${service.endpoint}" \\
  -H "Content-Type: application/json" \\
  -H "X-PAYMENT: <x402-payment-header>" \\
  -d '{
    // Your request parameters
  }'`;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" data-testid="loading-spinner"></div>
      </div>
    );
  }

  if (error || !service) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white p-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-4">Service Not Found</h1>
          <p className="text-gray-400 mb-8">The service you're looking for doesn't exist.</p>
          <Link href="/ai-marketplace">
            <Button data-testid="button-back-marketplace">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Marketplace
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const categoryLabels: Record<string, string> = {
    'discovery': 'Discovery & Testing',
    'trading-intelligence': 'Trading Intelligence',
    'execution': 'Execution & Infrastructure',
    'premium': 'Premium Enterprise',
    'real-estate': 'Real Estate',
    'banking': 'Banking & Finance',
    'trading': 'Trading & Investment',
    'market-intelligence': 'Market Intelligence',
    'prediction-markets': 'Prediction Markets',
    'traditional-markets': 'Traditional Markets',
    'sdk-payments': 'SDK Payments'
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Link href="/ai-marketplace">
          <Button variant="ghost" className="mb-6 text-gray-400 hover:text-white" data-testid="button-back">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Marketplace
          </Button>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div>
              <Badge variant="secondary" className="mb-3" data-testid="badge-category">
                {categoryLabels[service.category] || service.category}
              </Badge>
              <h1 className="text-4xl font-bold mb-4" data-testid="text-service-name">{service.name}</h1>
              <p className="text-xl text-gray-300" data-testid="text-service-description">{service.description}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {service.capabilities.map((cap) => (
                <Badge key={cap} variant="outline" className="text-blue-400 border-blue-400" data-testid={`badge-capability-${cap}`}>
                  {cap}
                </Badge>
              ))}
            </div>

            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Code className="h-5 w-5" />
                  API Integration
                </CardTitle>
                <CardDescription>Use our SDK or make direct HTTP calls</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="typescript" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 bg-gray-700">
                    <TabsTrigger value="typescript" data-testid="tab-typescript">TypeScript</TabsTrigger>
                    <TabsTrigger value="python" data-testid="tab-python">Python</TabsTrigger>
                    <TabsTrigger value="curl" data-testid="tab-curl">cURL</TabsTrigger>
                  </TabsList>
                  <TabsContent value="typescript" className="mt-4">
                    <div className="relative">
                      <pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm text-gray-300" data-testid="code-typescript">
                        <code>{getTypeScriptExample(service)}</code>
                      </pre>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(getTypeScriptExample(service))}
                        data-testid="button-copy-typescript"
                      >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </TabsContent>
                  <TabsContent value="python" className="mt-4">
                    <div className="relative">
                      <pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm text-gray-300" data-testid="code-python">
                        <code>{getPythonExample(service)}</code>
                      </pre>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(getPythonExample(service))}
                        data-testid="button-copy-python"
                      >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </TabsContent>
                  <TabsContent value="curl" className="mt-4">
                    <div className="relative">
                      <pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm text-gray-300" data-testid="code-curl">
                        <code>{getCurlExample(service)}</code>
                      </pre>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(getCurlExample(service))}
                        data-testid="button-copy-curl"
                      >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Technical Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-400 text-sm">Endpoint</p>
                    <code className="text-blue-400 text-sm" data-testid="text-endpoint">{service.endpoint}</code>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Network</p>
                    <p className="text-white" data-testid="text-network">{service.network === 'eip155:8453' ? 'Base (EIP-155:8453)' : service.network}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">x402 Compatible</p>
                    <p className="text-white" data-testid="text-x402">{service.x402Compatible ? '✅ Yes' : '❌ No'}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Stripe Compatible</p>
                    <p className="text-white" data-testid="text-stripe">{service.stripeCompatible ? '✅ Yes' : '❌ No'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 border-blue-500/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Pricing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <p className="text-4xl font-bold text-white" data-testid="text-price">{service.priceUSD}</p>
                  <p className="text-gray-400">per API call</p>
                </div>
                <div className="text-center text-sm text-gray-400">
                  <p>{service.priceUSDC}</p>
                </div>
                <Link href="/developers">
                  <Button className="w-full bg-blue-600 hover:bg-blue-700" data-testid="button-get-api-key">
                    <Zap className="mr-2 h-4 w-4" />
                    Get API Key ($1)
                  </Button>
                </Link>
                <Link href="/documentation">
                  <Button variant="outline" className="w-full" data-testid="button-view-docs">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View Full Documentation
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Features
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-gray-300">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Pay-per-use pricing
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    No monthly minimums
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    USDC payments on Base
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    x402 protocol support
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Machine-readable errors
                  </li>
                </ul>
              </CardContent>
            </Card>

            {relatedServices && relatedServices.length > 0 && (
              <Card className="bg-gray-800/50 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">Related Services</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {relatedServices.map((related) => (
                    <Link key={related.id} href={`/services/${related.id}`}>
                      <div 
                        className="p-3 bg-gray-900 rounded-lg hover:bg-gray-700 transition-colors cursor-pointer"
                        data-testid={`link-related-${related.id}`}
                      >
                        <p className="text-white font-medium">{related.name}</p>
                        <p className="text-sm text-gray-400">{related.priceUSD}</p>
                      </div>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Product",
              "name": service.name,
              "description": service.description,
              "offers": {
                "@type": "Offer",
                "price": service.priceUSD.replace('$', ''),
                "priceCurrency": "USD"
              },
              "brand": {
                "@type": "Organization",
                "name": "Coin Railz"
              }
            })
          }}
        />
      </div>
    </div>
  );
}
