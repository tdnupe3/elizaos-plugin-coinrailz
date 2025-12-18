import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

export default function ConsolePage() {
  const [apiKey, setApiKey] = useState('');
  const [endpoint, setEndpoint] = useState('/api/gpt/gas-prices');
  const [method, setMethod] = useState('GET');
  const [requestBody, setRequestBody] = useState('');
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const endpoints = [
    { value: '/api/gpt/gas-prices', label: 'Gas Prices (FREE)', method: 'GET' },
    { value: '/api/gpt/token-info?symbol=ETH', label: 'Token Info (FREE)', method: 'GET' },
    { value: '/api/gpt/trending', label: 'Trending Tokens (FREE)', method: 'GET' },
    { value: '/api/gpt/trade-signals?symbol=ETH', label: 'Trade Signals ($0.75)', method: 'GET' },
    { value: '/api/gpt/wallet-analysis?address=0x...', label: 'Wallet Analysis ($0.50)', method: 'GET' },
    { value: '/api/gpt/analyze-wallet', label: 'Analyze Wallet ($0.50)', method: 'POST' },
    { value: '/api/gpt/polymarket?query=bitcoin', label: 'Polymarket Odds ($0.50)', method: 'GET' },
    { value: '/api/gpt/stock-sentiment?symbol=AAPL', label: 'Stock Sentiment ($0.40)', method: 'GET' },
    { value: '/api/gpt/forex-sentiment?pair=EURUSD', label: 'Forex Sentiment ($0.40)', method: 'GET' },
    { value: '/api/gpt/multi-chain-balance?wallet=0x...', label: 'Multi-Chain Balance ($0.50)', method: 'GET' },
    { value: '/api/gpt/arbitrage-scanner?token=ETH', label: 'Arbitrage Scanner ($1.25)', method: 'GET' },
    { value: '/api/gpt/instant-wallet', label: 'Create Instant Wallet ($1.00)', method: 'GET' },
  ];

  const runRequest = async () => {
    setLoading(true);
    setResponse(null);
    
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (apiKey) {
        headers['X-API-KEY'] = apiKey;
      }

      const options: RequestInit = {
        method,
        headers,
      };

      if (method === 'POST' && requestBody) {
        options.body = requestBody;
      }

      const res = await fetch(endpoint, options);
      const data = await res.json();
      
      setResponse({
        status: res.status,
        statusText: res.statusText,
        data,
      });

      if (res.ok) {
        toast({
          title: 'Request Successful',
          description: `${method} ${endpoint} returned ${res.status}`,
        });
      } else {
        toast({
          title: 'Request Failed',
          description: data.error || data.message || 'Unknown error',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      setResponse({
        status: 0,
        statusText: 'Network Error',
        data: { error: error.message },
      });
      toast({
        title: 'Network Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent" data-testid="console-title">
            Coin Railz API Console
          </h1>
          <p className="text-slate-400 mt-2">Test API endpoints directly from your browser</p>
        </div>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">API Key</CardTitle>
            <CardDescription className="text-slate-400">
              Enter your API key to access premium endpoints. Get one at{' '}
              <a href="/credits" className="text-emerald-400 hover:underline">/credits</a>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              type="password"
              placeholder="cr_live_xxxxxxxxxxxxx"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="bg-slate-900 border-slate-600 text-white"
              data-testid="input-api-key"
            />
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Request</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">Method</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger className="bg-slate-900 border-slate-600 text-white" data-testid="select-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-slate-300">Quick Select</Label>
                <Select 
                  value={endpoint} 
                  onValueChange={(val) => {
                    setEndpoint(val);
                    const ep = endpoints.find(e => e.value === val);
                    if (ep) setMethod(ep.method);
                  }}
                >
                  <SelectTrigger className="bg-slate-900 border-slate-600 text-white" data-testid="select-endpoint">
                    <SelectValue placeholder="Select endpoint" />
                  </SelectTrigger>
                  <SelectContent>
                    {endpoints.map((ep) => (
                      <SelectItem key={ep.value} value={ep.value}>
                        {ep.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-slate-300">Endpoint URL</Label>
              <Input
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="/api/gpt/gas-prices"
                className="bg-slate-900 border-slate-600 text-white font-mono"
                data-testid="input-endpoint"
              />
            </div>

            {method === 'POST' && (
              <div>
                <Label className="text-slate-300">Request Body (JSON)</Label>
                <Textarea
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  placeholder='{"address": "0x...", "chain": "ethereum"}'
                  className="bg-slate-900 border-slate-600 text-white font-mono min-h-[100px]"
                  data-testid="textarea-body"
                />
              </div>
            )}

            <Button 
              onClick={runRequest} 
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              data-testid="button-send"
            >
              {loading ? 'Sending...' : 'Send Request'}
            </Button>
          </CardContent>
        </Card>

        {response && (
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                Response
                <span className={`text-sm px-2 py-1 rounded ${
                  response.status >= 200 && response.status < 300 
                    ? 'bg-emerald-600' 
                    : 'bg-red-600'
                }`}>
                  {response.status} {response.statusText}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-slate-900 p-4 rounded-lg overflow-auto max-h-[400px] text-sm font-mono text-slate-300" data-testid="response-output">
                {JSON.stringify(response.data, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Example: Analyze Wallet (POST)</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-slate-900 p-4 rounded-lg text-sm font-mono text-slate-300">
{`POST /api/gpt/analyze-wallet

Headers:
  X-API-KEY: cr_live_your_key_here
  Content-Type: application/json

Body:
{
  "address": "0x3A95e1934b99E866C78f404672f4d79baf1fA876",
  "chain": "ethereum"
}`}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
