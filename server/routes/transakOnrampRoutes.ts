import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { storage } from '../storage.js';

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
    const estimatedTransakFee = Math.round(amount * 0.015 * 100) / 100;
    const totalFees = coinrailzFee + estimatedTransakFee;
    const cryptoAmount = Math.round((amount - totalFees) * 100) / 100;

    res.json({
      success: true,
      quote: {
        fiatAmount: amount,
        fiatCurrency: 'USD',
        cryptoCurrency: token,
        coinrailzFee,
        estimatedTransakFee,
        totalFees,
        estimatedCryptoAmount: cryptoAmount,
        rate: 1.0,
        expiresIn: 30,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to generate quote' });
  }
});

router.post('/session', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).session?.passport?.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
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

    const widgetConfig = {
      apiKey: transakApiKey,
      environment: process.env.TRANSAK_ENVIRONMENT || 'STAGING',
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
    };

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
        config: widgetConfig,
      },
    });
  } catch (error: any) {
    console.error('Failed to create onramp session:', error);
    res.status(500).json({ success: false, error: 'Failed to create purchase session' });
  }
});

router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const webhookSecret = process.env.TRANSAK_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = req.headers['x-transak-signature'] as string;
      if (signature) {
        const expectedSignature = crypto
          .createHmac('sha256', webhookSecret)
          .update(JSON.stringify(req.body))
          .digest('hex');

        if (signature !== expectedSignature) {
          return res.status(401).json({ error: 'Invalid webhook signature' });
        }
      }
    }

    const { eventID, webhookData } = req.body;

    if (!webhookData) {
      return res.status(400).json({ error: 'Missing webhook data' });
    }

    const {
      id: transakOrderId,
      status: transakStatus,
      cryptoAmount,
      cryptocurrency: cryptoCurrency,
      network,
      transactionHash,
      paymentOptionId: paymentMethod,
      partnerOrderId,
      errorMessage,
    } = webhookData;

    let statusMap: Record<string, string> = {
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

    const mappedStatus = statusMap[transakStatus] || transakStatus?.toLowerCase() || 'unknown';

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

    if (mappedStatus === 'completed' && partnerOrderId) {
      const order = await storage.getOnrampOrder(parseInt(partnerOrderId));
      if (order) {
        try {
          await storage.updateUser(order.userId, {
            kycStatus: 'verified',
            kycProvider: 'transak',
            isKycVerified: true,
          } as any);
        } catch (e) {
          console.warn('Could not update user KYC status:', e);
        }
      }
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
    const userId = (req as any).user?.id || (req as any).session?.passport?.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const limit = parseInt(req.query.limit as string) || 20;
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
        walletAddress: o.walletAddress,
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
    const userId = (req as any).user?.id || (req as any).session?.passport?.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const order = await storage.getOnrampOrder(parseInt(req.params.id));
    if (!order || order.userId !== userId) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    res.json({ success: true, order });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch order' });
  }
});

export default router;
