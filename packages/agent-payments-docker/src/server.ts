/**
 * Coin Railz Agent Payments - Docker REST API Server
 * 
 * Non-custodial USDC payments for AI agents with bundled intelligence services.
 * Processing fee: 1.5% + $0.01 per transaction
 * 
 * Environment Variables:
 * - COINRAILZ_API_KEY: Your API key from https://coinrailz.com/dashboard/api-keys
 * - COINRAILZ_BASE_URL: API base URL (default: https://coinrailz.com)
 * - PORT: Server port (default: 3000)
 */

import express, { Request, Response, NextFunction } from 'express';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.COINRAILZ_API_KEY;
const BASE_URL = process.env.COINRAILZ_BASE_URL || 'https://coinrailz.com';
const SDK_VERSION = '1.0.0';

function requireApiKey(res: Response): boolean {
  if (!API_KEY) {
    res.status(503).json({
      success: false,
      error: 'NOT_CONFIGURED',
      message: 'COINRAILZ_API_KEY environment variable is required. Get your API key at https://coinrailz.com/dashboard/api-keys'
    });
    return false;
  }
  return true;
}

async function proxyRequest(
  method: 'GET' | 'POST',
  path: string,
  body?: any
): Promise<any> {
  const url = `${BASE_URL}/api/sdk${path}`;
  
  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'X-SDK-Version': SDK_VERSION
    },
    body: body ? JSON.stringify(body) : undefined
  });

  return response.json();
}

app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: API_KEY ? 'healthy' : 'unconfigured',
    service: 'coinrailz-agent-payments',
    version: SDK_VERSION,
    configured: !!API_KEY,
    timestamp: new Date().toISOString()
  });
});

app.get('/status', async (req: Request, res: Response) => {
  try {
    const result = await proxyRequest('GET', '/status');
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'SERVICE_UNAVAILABLE', message: error.message });
  }
});

app.get('/pricing', async (req: Request, res: Response) => {
  try {
    const result = await proxyRequest('GET', '/pricing');
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'SERVICE_UNAVAILABLE', message: error.message });
  }
});

app.post('/payments/send', async (req: Request, res: Response) => {
  if (!requireApiKey(res)) return;
  
  try {
    const { to, amount, currency, memo, metadata } = req.body;
    
    if (!to || !amount) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'Required fields: to, amount'
      });
    }

    const result = await proxyRequest('POST', '/payments/send', {
      to, amount, currency, memo, metadata
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'TRANSACTION_FAILED', message: error.message });
  }
});

app.post('/payments/invoice', async (req: Request, res: Response) => {
  if (!requireApiKey(res)) return;
  
  try {
    const { amount, currency, description, expiresIn, metadata } = req.body;
    
    if (!amount) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_REQUEST',
        message: 'Required field: amount'
      });
    }

    const result = await proxyRequest('POST', '/payments/invoice', {
      amount, currency, description, expiresIn, metadata
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'INVOICE_FAILED', message: error.message });
  }
});

app.get('/payments/reports', async (req: Request, res: Response) => {
  if (!requireApiKey(res)) return;
  
  try {
    const { period, format } = req.query;
    const params = new URLSearchParams();
    if (period) params.set('period', period as string);
    if (format) params.set('format', format as string);
    
    const queryString = params.toString();
    const result = await proxyRequest('GET', `/payments/reports${queryString ? `?${queryString}` : ''}`);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'REPORTS_FAILED', message: error.message });
  }
});

app.get('/balance', async (req: Request, res: Response) => {
  if (!requireApiKey(res)) return;
  
  try {
    const result = await proxyRequest('GET', '/balance');
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'BALANCE_FAILED', message: error.message });
  }
});

app.post('/wallet', async (req: Request, res: Response) => {
  if (!requireApiKey(res)) return;
  
  try {
    const result = await proxyRequest('POST', '/wallet');
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'WALLET_FAILED', message: error.message });
  }
});

app.post('/intelligence/:service', async (req: Request, res: Response) => {
  if (!requireApiKey(res)) return;
  
  try {
    const { service } = req.params;
    const result = await proxyRequest('POST', `/intelligence/${service}`, req.body);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: 'INTELLIGENCE_FAILED', message: error.message });
  }
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred'
  });
});

app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════════════════════════════╗
  ║                                                               ║
  ║   🚀 Coin Railz Agent Payments Server                        ║
  ║                                                               ║
  ║   Version: ${SDK_VERSION}                                            ║
  ║   Port: ${PORT}                                                   ║
  ║   API: ${BASE_URL}                                ║
  ║                                                               ║
  ║   Endpoints:                                                  ║
  ║   - GET  /health              Health check                    ║
  ║   - GET  /status              Service status                  ║
  ║   - GET  /pricing             Pricing info                    ║
  ║   - POST /payments/send       Send payment                    ║
  ║   - POST /payments/invoice    Create invoice                  ║
  ║   - GET  /payments/reports    Activity reports                ║
  ║   - GET  /balance             Wallet balance                  ║
  ║   - POST /wallet              Create wallet                   ║
  ║   - POST /intelligence/:svc   Intelligence services           ║
  ║                                                               ║
  ║   Fee: 1.5% + $0.01 per transaction                          ║
  ║                                                               ║
  ╚═══════════════════════════════════════════════════════════════╝
  `);
});
