import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';

const router = Router();

const MOONPAY_WIDGET_URL = 'https://buy.moonpay.com';

function isMoonPayConfigured(): boolean {
  return !!(process.env.MOONPAY_PUBLISHABLE_KEY && process.env.MOONPAY_SECRET_KEY);
}

/**
 * GET /api/onramp/moonpay/config
 * Returns availability status. Frontend checks this before showing MoonPay option.
 */
router.get('/config', async (req: Request, res: Response) => {
  if (!isMoonPayConfigured()) {
    return res.json({
      available: false,
      reason: 'MoonPay API keys not configured. Set MOONPAY_PUBLISHABLE_KEY and MOONPAY_SECRET_KEY.'
    });
  }

  res.json({
    available: true,
    publishableKey: process.env.MOONPAY_PUBLISHABLE_KEY,
    widgetUrl: MOONPAY_WIDGET_URL,
    supportedCurrencies: ['USDC', 'USDT'],
    supportedNetworks: ['ethereum', 'base', 'polygon', 'arbitrum', 'optimism'],
    moonpayAgentsCompatible: true
  });
});

const signUrlSchema = z.object({
  url: z.string().url('Must be a valid URL'),
});

/**
 * POST /api/onramp/moonpay/sign-url
 * HMAC-SHA256 signs a MoonPay widget URL using the secret key.
 * MoonPay requires URLs to be signed to prevent tampering.
 */
router.post('/sign-url', async (req: Request, res: Response) => {
  if (!process.env.MOONPAY_SECRET_KEY) {
    return res.status(503).json({
      error: 'MoonPay not configured',
      reason: 'MOONPAY_SECRET_KEY environment variable is not set. Add it via the secrets manager.'
    });
  }

  let parsed;
  try {
    parsed = signUrlSchema.parse(req.body);
  } catch (err: any) {
    return res.status(400).json({
      error: 'Invalid request',
      details: err.errors || err.message
    });
  }

  try {
    const { url } = parsed;

    // Extract the query string from the URL for signing (MoonPay signs the query string only)
    const urlObj = new URL(url);
    const queryString = urlObj.search;

    const signature = crypto
      .createHmac('sha256', process.env.MOONPAY_SECRET_KEY)
      .update(queryString)
      .digest('base64');

    const signedUrl = `${url}&signature=${encodeURIComponent(signature)}`;

    res.json({
      success: true,
      signedUrl,
      signature
    });
  } catch (err: any) {
    console.error('MoonPay URL signing failed:', err.message);
    res.status(500).json({
      error: 'URL signing failed',
      details: err.message
    });
  }
});

export default router;
