import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { storage } from '../storage.js';
import { getSession, isSessionValid } from '../services/sessionManager.js';

const router = Router();

const SUPPORTED_TOKENS = ['USDC', 'USDT'] as const;

const SUPPORTED_NETWORKS: Record<string, { transakNetwork: string; chainId?: number; addressRegex: RegExp }> = {
  ethereum: { transakNetwork: 'ethereum', chainId: 1, addressRegex: /^0x[a-fA-F0-9]{40}$/ },
  base: { transakNetwork: 'base', chainId: 8453, addressRegex: /^0x[a-fA-F0-9]{40}$/ },
  polygon: { transakNetwork: 'polygon', chainId: 137, addressRegex: /^0x[a-fA-F0-9]{40}$/ },
  arbitrum: { transakNetwork: 'arbitrum', chainId: 42161, addressRegex: /^0x[a-fA-F0-9]{40}$/ },
  optimism: { transakNetwork: 'optimism', chainId: 10, addressRegex: /^0x[a-fA-F0-9]{40}$/ },
  tron: { transakNetwork: 'tron', addressRegex: /^T[a-zA-Z0-9]{33}$/ },
};

const COINRAILZ_FEE_RATE = 0.03;
const MAX_TRANSACTION_AMOUNT = 2500;
const MIN_TRANSACTION_AMOUNT = 10;
const ORDER_EXPIRY_MINUTES = 60;

const sessionRateLimiter = new Map<string, { count: number; resetAt: number }>();
const SESSION_RATE_LIMIT = 10;
const SESSION_RATE_WINDOW_MS = 60 * 60 * 1000;

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

function checkSessionRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = sessionRateLimiter.get(userId);
  if (!entry || now > entry.resetAt) {
    sessionRateLimiter.set(userId, { count: 1, resetAt: now + SESSION_RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= SESSION_RATE_LIMIT) return false;
  entry.count++;
  return true;
}

async function resolveUserId(req: Request): Promise<string | null> {
  const existingId = (req as any).user?.id || (req as any).session?.passport?.user?.id;
  if (existingId) return existingId;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    if (token) {
      const valid = await isSessionValid(token);
      if (valid) {
        const session = await getSession(token);
        if (session) return session.userId;
      }
    }
  }
  return null;
}

function getTransakGatewayUrl(): string {
  const isProduction = (process.env.TRANSAK_ENVIRONMENT || 'STAGING') === 'PRODUCTION';
  return isProduction
    ? 'https://api-gateway.transak.com'
    : 'https://api-gateway-stg.transak.com';
}

function getTransakApiUrl(): string {
  const isProduction = (process.env.TRANSAK_ENVIRONMENT || 'STAGING') === 'PRODUCTION';
  return isProduction
    ? 'https://api.transak.com'
    : 'https://api-stg.transak.com';
}

function getTransakWidgetUrl(): string {
  const isProduction = (process.env.TRANSAK_ENVIRONMENT || 'STAGING') === 'PRODUCTION';
  return isProduction
    ? 'https://global.transak.com'
    : 'https://global-stg.transak.com';
}

async function getTransakAccessToken(): Promise<string | null> {
  if (cachedAccessToken && Date.now() < cachedAccessToken.expiresAt) {
    return cachedAccessToken.token;
  }

  const apiSecret = process.env.TRANSAK_API_SECRET;
  const apiKey = process.env.TRANSAK_API_KEY;
  if (!apiSecret || !apiKey) return null;

  const endpoints = [
    `${getTransakGatewayUrl()}/api/v2/auth/refresh-token`,
    `${getTransakApiUrl()}/api/v2/auth/refresh-token`,
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-secret': apiSecret.trim(),
        },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });

      if (response.status === 404) continue;

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.warn(`Transak refresh token (${endpoint}): ${response.status} ${response.statusText}`, errorText);
        continue;
      }

      const data = await response.json();
      const accessToken = data?.data?.accessToken || data?.data?.token;
      if (accessToken) {
        cachedAccessToken = {
          token: accessToken,
          expiresAt: Date.now() + 6 * 24 * 60 * 60 * 1000,
        };
        console.log('✅ Transak access token refreshed successfully');
        return accessToken;
      }
      console.warn('Transak refresh token: no accessToken in response', JSON.stringify(data));
    } catch (err: any) {
      console.warn(`Transak refresh token error (${endpoint}):`, err.message);
    }
  }

  console.warn('⚠️ Transak access token unavailable - widget will use direct URL mode (still functional)');
  return null;
}

function startOrderExpiryJob() {
  setInterval(async () => {
    try {
      const expired = await storage.expireStaleOnrampOrders(ORDER_EXPIRY_MINUTES);
      if (expired > 0) {
        console.log(`Transak: expired ${expired} stale onramp orders (>${ORDER_EXPIRY_MINUTES}min old)`);
      }
    } catch (e) {
      console.warn('Transak order expiry job error:', e);
    }
  }, 5 * 60 * 1000);
}

startOrderExpiryJob();

const createSessionSchema = z.object({
  fiatAmount: z.number().min(MIN_TRANSACTION_AMOUNT).max(MAX_TRANSACTION_AMOUNT),
  fiatCurrency: z.string().default('USD'),
  cryptoCurrency: z.enum(SUPPORTED_TOKENS),
  network: z.string().refine((n) => n in SUPPORTED_NETWORKS, { message: 'Unsupported network' }),
  walletAddress: z.string().min(1),
});

router.get('/config', (_req: Request, res: Response) => {
  res.json({
    success: true,
    config: {
      supportedTokens: SUPPORTED_TOKENS,
      supportedNetworks: Object.entries(SUPPORTED_NETWORKS).map(([key, val]) => ({
        id: key,
        name: key.charAt(0).toUpperCase() + key.slice(1),
        transakNetwork: val.transakNetwork,
        chainId: val.chainId,
      })),
      feeRate: COINRAILZ_FEE_RATE,
      feeRateDisplay: `${COINRAILZ_FEE_RATE * 100}%`,
      limits: {
        min: MIN_TRANSACTION_AMOUNT,
        max: MAX_TRANSACTION_AMOUNT,
        currency: 'USD',
      },
      paymentMethods: ['credit_debit_card', 'apple_pay', 'google_pay'],
    },
  });
});

router.get('/quote', (req: Request, res: Response) => {
  try {
    const amount = parseFloat(req.query.amount as string);
    const token = (req.query.token as string || 'USDC').toUpperCase();

    if (!amount || amount < MIN_TRANSACTION_AMOUNT || amount > MAX_TRANSACTION_AMOUNT) {
      return res.status(400).json({
        success: false,
        error: `Amount must be between $${MIN_TRANSACTION_AMOUNT} and $${MAX_TRANSACTION_AMOUNT}`,
      });
    }

    if (!SUPPORTED_TOKENS.includes(token as any)) {
      return res.status(400).json({ success: false, error: 'Unsupported token' });
    }

    const coinrailzFee = Math.round(amount * COINRAILZ_FEE_RATE * 100) / 100;
    const estimatedProcessingFee = Math.round(amount * 0.015 * 100) / 100;
    const totalFees = Math.round((coinrailzFee + estimatedProcessingFee) * 100) / 100;
    const cryptoAmount = Math.round((amount - totalFees) * 100) / 100;

    res.json({
      success: true,
      quote: {
        fiatAmount: amount,
        fiatCurrency: 'USD',
        cryptoCurrency: token,
        totalFees,
        estimatedCryptoAmount: cryptoAmount,
        feeLabel: `~$${totalFees.toFixed(2)} (${(COINRAILZ_FEE_RATE * 100).toFixed(0)}% inclusive of all network & transfer fees)`,
        rate: 1.0,
        expiresIn: 30,
        disclaimer: 'Fee includes Coin Railz platform fee plus network and processing costs. Final crypto amount determined at time of purchase.',
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to generate quote' });
  }
});

router.post('/session', async (req: Request, res: Response) => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    if (!checkSessionRateLimit(userId)) {
      return res.status(429).json({
        success: false,
        error: 'Too many purchase attempts. Please try again later.',
      });
    }

    const validation = createSessionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.flatten().fieldErrors,
      });
    }

    const { fiatAmount, fiatCurrency, cryptoCurrency, network, walletAddress } = validation.data;

    const networkConfig = SUPPORTED_NETWORKS[network];
    if (!networkConfig.addressRegex.test(walletAddress)) {
      const expectedFormat = network === 'tron' ? 'T followed by 33 characters' : '0x followed by 40 hex characters';
      return res.status(400).json({
        success: false,
        error: `Invalid wallet address for ${network}. Expected format: ${expectedFormat}`,
      });
    }

    const coinrailzFee = Math.round(fiatAmount * COINRAILZ_FEE_RATE * 100) / 100;

    const order = await storage.createOnrampOrder({
      userId,
      status: 'created',
      fiatCurrency,
      fiatAmount: fiatAmount.toString(),
      coinrailzFee: coinrailzFee.toString(),
      cryptoCurrency,
      network,
      walletAddress,
    });

    const transakApiKey = process.env.TRANSAK_API_KEY;
    if (!transakApiKey) {
      return res.json({
        success: true,
        order: {
          id: order.id,
          status: 'created',
          fiatAmount,
          coinrailzFee,
          cryptoCurrency,
          network,
          walletAddress,
        },
        widget: {
          mode: 'staging',
          message: 'Transak API key not configured. Widget will load in demo mode.',
          config: {
            apiKey: 'staging-placeholder',
            environment: 'STAGING',
            cryptoCurrencyCode: cryptoCurrency,
            network: networkConfig.transakNetwork,
            defaultFiatAmount: fiatAmount,
            fiatCurrency,
            walletAddress,
            disableWalletAddressForm: true,
            hideMenu: true,
            themeColor: '3B82F6',
          },
        },
      });
    }

    const widgetParams: Record<string, any> = {
      apiKey: transakApiKey,
      productsAvailed: 'BUY',
      cryptoCurrencyCode: cryptoCurrency,
      network: networkConfig.transakNetwork,
      defaultFiatAmount: fiatAmount,
      fiatCurrency,
      walletAddress,
      disableWalletAddressForm: true,
      hideMenu: true,
      themeColor: '3B82F6',
      partnerOrderId: order.id.toString(),
      partnerCustomerId: userId,
      exchangeScreenTitle: 'Buy Crypto — Coin Railz',
      referrerDomain: 'coinrailz.com',
    };

    const transakEnv = process.env.TRANSAK_ENVIRONMENT || 'STAGING';

    let widgetUrl: string | null = null;
    const accessToken = await getTransakAccessToken();
    if (accessToken) {
      try {
        const gatewayUrl = getTransakGatewayUrl();

        const createWidgetResp = await fetch(`${gatewayUrl}/api/v2/auth/session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'accept': 'application/json',
            'access-token': accessToken,
          },
          body: JSON.stringify({
            widgetParams,
          }),
        });

        if (createWidgetResp.ok) {
          const widgetData = await createWidgetResp.json();
          widgetUrl = widgetData?.data?.widgetUrl || null;
          if (widgetUrl) {
            console.log('✅ Transak secure widget URL generated');
          }
        } else {
          const errText = await createWidgetResp.text().catch(() => '');
          console.warn(`Transak Create Widget URL failed: ${createWidgetResp.status}`, errText);
        }
      } catch (err: any) {
        console.warn('Transak Create Widget URL error:', err.message);
      }
    }

    res.json({
      success: true,
      order: {
        id: order.id,
        status: 'created',
        fiatAmount,
        coinrailzFee,
        cryptoCurrency,
        network,
        walletAddress,
      },
      widget: {
        mode: 'live',
        widgetUrl,
        config: {
          ...widgetParams,
          environment: transakEnv,
          partnerFeePercentage: COINRAILZ_FEE_RATE * 100,
        },
      },
    });
  } catch (error: any) {
    console.error('Failed to create onramp session:', error);
    res.status(500).json({ success: false, error: 'Failed to create purchase session' });
  }
});

router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const { data: jwtPayload } = req.body;

    if (!jwtPayload) {
      return res.status(400).json({ error: 'Missing webhook data (JWT payload)' });
    }

    let webhookData: any;
    let eventID: string | undefined;
    let verified = false;

    const verificationKeys: string[] = [];
    const accessToken = await getTransakAccessToken();
    if (accessToken) verificationKeys.push(accessToken);
    const apiSecret = process.env.TRANSAK_API_SECRET?.trim();
    if (apiSecret) verificationKeys.push(apiSecret);

    for (const key of verificationKeys) {
      try {
        const decoded = jwt.verify(jwtPayload, key) as any;
        webhookData = decoded.webhookData || decoded;
        eventID = decoded.eventID || decoded.event_id;
        verified = true;
        break;
      } catch {
        continue;
      }
    }

    if (!verified) {
      try {
        const decoded = jwt.decode(jwtPayload) as any;
        if (!decoded) {
          return res.status(400).json({ error: 'Invalid webhook JWT format' });
        }
        webhookData = decoded.webhookData || decoded;
        eventID = decoded.eventID || decoded.event_id;
        console.warn('⚠️ Transak webhook: JWT signature NOT verified (access token unavailable). Applying order-level validation.');
      } catch {
        return res.status(400).json({ error: 'Failed to decode webhook payload' });
      }
    }

    if (!webhookData) {
      return res.status(400).json({ error: 'Missing webhook data after decoding' });
    }

    if (eventID) {
      const alreadyProcessed = await storage.isWebhookEventProcessed(eventID);
      if (alreadyProcessed) {
        console.log(`Transak webhook: duplicate eventID ${eventID}, skipping`);
        return res.json({ success: true, message: 'Already processed' });
      }
    }

    const {
      id: transakOrderId,
      status: transakStatus,
      cryptoAmount,
      cryptoCurrency,
      network,
      transactionHash,
      paymentOptionId: paymentMethod,
      partnerOrderId,
      errorMessage,
      partnerFeeInLocalCurrency,
    } = webhookData;

    if (!verified && partnerOrderId) {
      const existingOrder = await storage.getOnrampOrder(parseInt(partnerOrderId));
      if (!existingOrder) {
        console.error(`Transak webhook REJECTED: unverified + partnerOrderId ${partnerOrderId} not found in database`);
        return res.status(403).json({ error: 'Order validation failed' });
      }
      if (existingOrder.cryptoCurrency?.toUpperCase() !== cryptoCurrency?.toUpperCase()) {
        console.error(`Transak webhook REJECTED: unverified + currency mismatch (expected ${existingOrder.cryptoCurrency}, got ${cryptoCurrency})`);
        return res.status(403).json({ error: 'Order validation failed' });
      }
      if (existingOrder.network?.toLowerCase() !== network?.toLowerCase()) {
        console.error(`Transak webhook REJECTED: unverified + network mismatch (expected ${existingOrder.network}, got ${network})`);
        return res.status(403).json({ error: 'Order validation failed' });
      }
      console.log(`Transak webhook: unverified but passed order-level validation for order ${partnerOrderId}`);
    } else if (!verified && !partnerOrderId) {
      console.error('Transak webhook REJECTED: unverified + no partnerOrderId for cross-reference');
      return res.status(403).json({ error: 'Cannot validate webhook without order reference' });
    }

    const eventStatusMap: Record<string, Record<string, string>> = {
      ORDER_CREATED: { AWAITING_PAYMENT_FROM_USER: 'pending_payment' },
      ORDER_PAYMENT_VERIFYING: { PAYMENT_DONE_MARKED_BY_USER: 'payment_received' },
      ORDER_PROCESSING: {
        PROCESSING: 'processing',
        PENDING_DELIVERY_FROM_TRANSAK: 'delivering',
        ON_HOLD_PENDING_DELIVERY_FROM_TRANSAK: 'on_hold',
      },
      ORDER_COMPLETED: { COMPLETED: 'completed' },
      ORDER_FAILED: {
        CANCELLED: 'cancelled',
        FAILED: 'failed',
        EXPIRED: 'expired',
      },
      ORDER_REFUNDED: { REFUNDED: 'refunded' },
      ORDER_EXPIRED: { EXPIRED: 'expired' },
    };

    const statusFallback: Record<string, string> = {
      AWAITING_PAYMENT_FROM_USER: 'pending_payment',
      PAYMENT_DONE_MARKED_BY_USER: 'payment_received',
      PROCESSING: 'processing',
      PENDING_DELIVERY_FROM_TRANSAK: 'delivering',
      ON_HOLD_PENDING_DELIVERY_FROM_TRANSAK: 'on_hold',
      COMPLETED: 'completed',
      CANCELLED: 'cancelled',
      FAILED: 'failed',
      REFUNDED: 'refunded',
      EXPIRED: 'expired',
    };

    let mappedStatus: string;
    if (eventID && eventStatusMap[eventID]?.[transakStatus]) {
      mappedStatus = eventStatusMap[eventID][transakStatus];
    } else {
      mappedStatus = statusFallback[transakStatus] || transakStatus?.toLowerCase() || 'unknown';
    }

    const updates: any = {
      transakOrderId,
      transakStatus,
      status: mappedStatus,
      paymentMethod,
      updatedAt: new Date(),
    };

    if (cryptoAmount) updates.cryptoAmount = cryptoAmount.toString();
    if (transactionHash) updates.transactionHash = transactionHash;
    if (errorMessage) updates.errorMessage = errorMessage;
    if (mappedStatus === 'completed') updates.completedAt = new Date();

    if (partnerOrderId) {
      await storage.updateOnrampOrder(parseInt(partnerOrderId), updates);
    } else if (transakOrderId) {
      const existingOrder = await storage.getOnrampOrderByTransakId(transakOrderId);
      if (existingOrder) {
        await storage.updateOnrampOrder(existingOrder.id, updates);
      }
    }

    if (eventID) {
      await storage.recordWebhookEvent(eventID, transakOrderId, mappedStatus);
    }

    console.log(`Transak webhook: ${eventID} → order ${partnerOrderId || transakOrderId} → ${mappedStatus}`);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Transak webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

router.get('/orders', async (req: Request, res: Response) => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const orders = await storage.getUserOnrampOrders(userId, limit);

    res.json({
      success: true,
      orders: orders.map((o) => ({
        id: o.id,
        status: o.status,
        fiatAmount: o.fiatAmount,
        fiatCurrency: o.fiatCurrency,
        coinrailzFee: o.coinrailzFee,
        cryptoAmount: o.cryptoAmount,
        cryptoCurrency: o.cryptoCurrency,
        network: o.network,
        walletAddress: maskWalletAddress(o.walletAddress),
        paymentMethod: o.paymentMethod,
        transactionHash: o.transactionHash,
        completedAt: o.completedAt,
        createdAt: o.createdAt,
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch orders' });
  }
});

router.get('/order/:id', async (req: Request, res: Response) => {
  try {
    const userId = await resolveUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const order = await storage.getOnrampOrder(parseInt(req.params.id));
    if (!order || order.userId !== userId) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    res.json({
      success: true,
      order: {
        ...order,
        walletAddress: maskWalletAddress(order.walletAddress),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch order' });
  }
});

function maskWalletAddress(address: string): string {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default router;
