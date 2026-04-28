/**
 * A2D (Agent-to-Device) x402 Payment Routes
 * 
 * VERSION: 1.0.0 (January 2026)
 * 
 * Enables AI agents to pay IoT devices for data via x402 protocol:
 * - Device owners register data products (sensor readings, streams, etc.)
 * - AI agents discover products via Bazaar/x402scan
 * - Agents pay via x402 (USDC on Base)
 * - Devices deliver data after payment verification
 * - Device accounts receive credits from sales
 * 
 * ENDPOINTS:
 * - POST /api/iot/products - Register a data product for a device
 * - GET /api/iot/products/:productId - Get product details
 * - GET /api/iot/products/device/:deviceId - List products for a device
 * - GET /api/iot/data/:productId - x402-protected data access endpoint
 * - POST /api/iot/data/:productId/verify - Verify payment and get access token
 * - GET /api/iot/sales/:accountId - View sales history for account
 * 
 * REVENUE MODEL:
 * - Platform fee: 15% of data sales
 * - Seller receives: 85% as account credits
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { 
  iotDeviceProducts, 
  iotDataSales, 
  iotDeviceRegistry,
  iotAccounts,
  x402Payments 
} from '../../shared/schema';
import { eq, and, sql, desc, or } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { trackIoTEndpoint } from '../middleware/hitTracker';

const MAX_UNITS_PER_PURCHASE = 100;

const router = Router();

// Apply hit tracking to IoT A2D routes
router.use(trackIoTEndpoint);

const A2D_PLATFORM_FEE = 0.15;
const DATA_ACCESS_TOKEN_EXPIRY_MINUTES = 15;

const SUPPORTED_NETWORKS = ['base', 'ethereum', 'polygon', 'arbitrum'] as const;

const createProductSchema = z.object({
  deviceId: z.string().min(1),
  productName: z.string().min(1).max(100),
  productType: z.enum(['sensor_reading', 'stream', 'api_call', 'bulk_data']),
  description: z.string().max(500).optional(),
  priceUsd: z.number().positive().max(1000),
  unit: z.enum(['request', 'minute', 'mb', 'reading']).default('request'),
  deliveryMode: z.enum(['pull', 'stream']).default('pull'),
  expectedNetwork: z.enum(SUPPORTED_NETWORKS).default('base'),
  dataSchema: z.record(z.any()).optional(),
  tags: z.array(z.string()).max(10).optional(),
  metadata: z.record(z.any()).optional(),
});

const updateProductSchema = z.object({
  productName: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  priceUsd: z.number().positive().max(1000).optional(),
  status: z.enum(['active', 'paused', 'deprecated']).optional(),
  tags: z.array(z.string()).max(10).optional(),
  metadata: z.record(z.any()).optional(),
});

const verifyPaymentSchema = z.object({
  x402PaymentId: z.string().min(1, 'x402PaymentId is required'),
  network: z.enum(['base', 'ethereum', 'polygon', 'arbitrum']),
  txHash: z.string().optional(),
  buyerAgentId: z.string().optional(),
  buyerWallet: z.string().optional(),
  units: z.number().int().positive().default(1),
});

async function getAccountFromApiKey(req: Request): Promise<{ accountId: string; isValid: boolean }> {
  const apiKey = req.headers['x-api-key'] as string;
  if (!apiKey || !apiKey.startsWith('iot_')) {
    return { accountId: '', isValid: false };
  }
  
  const { createHash } = await import('crypto');
  const apiKeyHash = createHash('sha256').update(apiKey).digest('hex');
  
  const account = await db.select()
    .from(iotAccounts)
    .where(eq(iotAccounts.apiKeyHash, apiKeyHash))
    .limit(1);
  
  if (!account.length || account[0].status !== 'active') {
    return { accountId: '', isValid: false };
  }
  
  return { accountId: account[0].id, isValid: true };
}

router.post('/products', async (req: Request, res: Response) => {
  try {
    const auth = await getAccountFromApiKey(req);
    if (!auth.isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or missing API key',
      });
    }
    
    const validation = createProductSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.errors,
      });
    }
    
    const { deviceId, productName, productType, description, priceUsd, unit, deliveryMode, expectedNetwork, dataSchema, tags, metadata } = validation.data;
    
    const device = await db.select()
      .from(iotDeviceRegistry)
      .where(and(
        eq(iotDeviceRegistry.deviceId, deviceId),
        eq(iotDeviceRegistry.accountId, auth.accountId)
      ))
      .limit(1);
    
    if (!device.length) {
      return res.status(404).json({
        success: false,
        error: 'Device not found or does not belong to this account',
      });
    }
    
    if (device[0].status !== 'active') {
      return res.status(403).json({
        success: false,
        error: 'Device is not active',
      });
    }
    
    const productId = `iot_prod_${nanoid(16)}`;
    const x402ServiceId = `iot-${deviceId.substring(0, 8)}-${productType}`;
    const x402Endpoint = `/api/iot/data/${productId}`;
    
    await db.insert(iotDeviceProducts).values({
      id: productId,
      deviceId,
      accountId: auth.accountId,
      productName,
      productType,
      description: description || null,
      priceUsd: priceUsd.toString(),
      unit,
      deliveryMode,
      expectedNetwork,
      dataSchema: dataSchema || {},
      x402ServiceId,
      x402Endpoint,
      tags: tags || [],
      metadata: metadata || {},
      status: 'active',
    });
    
    console.log(`📦 IoT Product created: ${productId} for device ${deviceId} @ $${priceUsd}/${unit}`);
    
    res.status(201).json({
      success: true,
      product: {
        id: productId,
        deviceId,
        productName,
        productType,
        priceUsd,
        unit,
        deliveryMode,
        expectedNetwork,
        x402ServiceId,
        x402Endpoint,
        status: 'active',
      },
      discovery: {
        x402Url: `${process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'https://coinrailz.com'}${x402Endpoint}`,
        message: 'AI agents can discover and purchase this data via x402 protocol',
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ Create product failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create product',
      message: error.message,
    });
  }
});

router.get('/products/:productId', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    
    const product = await db.select()
      .from(iotDeviceProducts)
      .where(eq(iotDeviceProducts.id, productId))
      .limit(1);
    
    if (!product.length) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }
    
    const p = product[0];
    res.json({
      success: true,
      product: {
        id: p.id,
        deviceId: p.deviceId,
        productName: p.productName,
        productType: p.productType,
        description: p.description,
        priceUsd: parseFloat(p.priceUsd),
        unit: p.unit,
        deliveryMode: p.deliveryMode,
        expectedNetwork: p.expectedNetwork || 'base',
        x402ServiceId: p.x402ServiceId,
        x402Endpoint: p.x402Endpoint,
        tags: p.tags,
        status: p.status,
        totalSales: p.totalSales,
        dataSchema: p.dataSchema,
      },
    });
  } catch (error: any) {
    console.error('❌ Get product failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get product',
    });
  }
});

router.get('/products/device/:deviceId', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    
    const products = await db.select()
      .from(iotDeviceProducts)
      .where(eq(iotDeviceProducts.deviceId, deviceId))
      .orderBy(desc(iotDeviceProducts.createdAt));
    
    res.json({
      success: true,
      deviceId,
      products: products.map(p => ({
        id: p.id,
        productName: p.productName,
        productType: p.productType,
        priceUsd: parseFloat(p.priceUsd),
        unit: p.unit,
        expectedNetwork: p.expectedNetwork || 'base',
        status: p.status,
        totalSales: p.totalSales,
        x402Endpoint: p.x402Endpoint,
      })),
      count: products.length,
    });
  } catch (error: any) {
    console.error('❌ List products failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list products',
    });
  }
});

router.patch('/products/:productId', async (req: Request, res: Response) => {
  try {
    const auth = await getAccountFromApiKey(req);
    if (!auth.isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or missing API key',
      });
    }
    
    const { productId } = req.params;
    const validation = updateProductSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.errors,
      });
    }
    
    const product = await db.select()
      .from(iotDeviceProducts)
      .where(and(
        eq(iotDeviceProducts.id, productId),
        eq(iotDeviceProducts.accountId, auth.accountId)
      ))
      .limit(1);
    
    if (!product.length) {
      return res.status(404).json({
        success: false,
        error: 'Product not found or access denied',
      });
    }
    
    const updates: any = { updatedAt: new Date() };
    const data = validation.data;
    if (data.productName) updates.productName = data.productName;
    if (data.description !== undefined) updates.description = data.description;
    if (data.priceUsd) updates.priceUsd = data.priceUsd.toString();
    if (data.status) updates.status = data.status;
    if (data.tags) updates.tags = data.tags;
    if (data.metadata) updates.metadata = data.metadata;
    
    await db.update(iotDeviceProducts)
      .set(updates)
      .where(eq(iotDeviceProducts.id, productId));
    
    res.json({
      success: true,
      message: 'Product updated',
      productId,
    });
  } catch (error: any) {
    console.error('❌ Update product failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update product',
    });
  }
});

router.get('/data/:productId', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const accessToken = req.headers['x-access-token'] as string || req.query.token as string;
    
    const product = await db.select()
      .from(iotDeviceProducts)
      .where(eq(iotDeviceProducts.id, productId))
      .limit(1);
    
    if (!product.length) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }
    
    const p = product[0];
    
    if (p.status !== 'active') {
      return res.status(410).json({
        success: false,
        error: 'Product is no longer available',
      });
    }
    
    if (accessToken) {
      const sale = await db.select()
        .from(iotDataSales)
        .where(and(
          eq(iotDataSales.productId, productId),
          eq(iotDataSales.accessToken, accessToken),
          eq(iotDataSales.status, 'verified')
        ))
        .limit(1);
      
      if (sale.length && sale[0].accessTokenExpiry && new Date(sale[0].accessTokenExpiry) > new Date()) {
        await db.update(iotDataSales)
          .set({
            status: 'delivered',
            deliveryStatus: 'completed',
            deliveredAt: new Date(),
          })
          .where(eq(iotDataSales.id, sale[0].id));
        
        const mockData = generateMockSensorData(p.productType);
        
        return res.json({
          success: true,
          data: mockData,
          productId,
          productType: p.productType,
          unit: p.unit,
          timestamp: new Date().toISOString(),
        });
      }
    }
    
    const priceUsd = parseFloat(p.priceUsd);
    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
      : 'https://coinrailz.com';
    
    res.setHeader('X-Agent-Instructions', 'https://coinrailz.com/.well-known/agent-instructions.json');
    res.setHeader('Link', '<https://coinrailz.com/.well-known/agent-instructions.json>; rel="agent-instructions"');
    res.status(402).json({
      success: false,
      error: 'Payment required',
      x402: {
        version: 2,
        price: priceUsd,
        currency: 'USDC',
        network: p.expectedNetwork || 'base',
        recipient: process.env.PLATFORM_WALLET_ADDRESS || '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91',
        description: `${p.productName} - ${p.description || p.productType}`,
        productId,
        verifyEndpoint: `${baseUrl}/api/iot/data/${productId}/verify`,
      },
      product: {
        id: productId,
        name: p.productName,
        type: p.productType,
        unit: p.unit,
        priceUsd,
        expectedNetwork: p.expectedNetwork || 'base',
      },
      hint: 'Pay via x402 protocol and call verify endpoint with payment details',
    });
  } catch (error: any) {
    console.error('❌ Data access failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to access data',
    });
  }
});

router.post('/data/:productId/verify', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const validation = verifyPaymentSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: validation.error.errors,
      });
    }
    
    const { x402PaymentId, network, txHash, buyerAgentId, buyerWallet, units } = validation.data;
    
    if (units > MAX_UNITS_PER_PURCHASE) {
      return res.status(400).json({
        success: false,
        error: `Maximum ${MAX_UNITS_PER_PURCHASE} units per purchase`,
      });
    }
    
    const product = await db.select()
      .from(iotDeviceProducts)
      .where(eq(iotDeviceProducts.id, productId))
      .limit(1);
    
    if (!product.length) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }
    
    const p = product[0];
    
    if (p.status !== 'active') {
      return res.status(410).json({
        success: false,
        error: 'Product is no longer available',
      });
    }
    
    const expectedPrice = parseFloat(p.priceUsd) * units;
    
    if (txHash) {
      const existingSale = await db.select()
        .from(iotDataSales)
        .where(eq(iotDataSales.txHash, txHash))
        .limit(1);
      
      if (existingSale.length) {
        return res.status(409).json({
          success: false,
          error: 'Transaction already processed',
          existingSaleId: existingSale[0].id,
          hint: 'This transaction hash has already been used for a previous purchase',
        });
      }
    }
    
    if (x402PaymentId) {
      const x402Payment = await db.select()
        .from(x402Payments)
        .where(eq(x402Payments.id, x402PaymentId))
        .limit(1);
      
      if (!x402Payment.length) {
        return res.status(404).json({
          success: false,
          error: 'x402 payment record not found',
          hint: 'Invalid x402PaymentId - payment must be processed through x402 protocol first',
        });
      }
      
      const payment = x402Payment[0];
      
      if (payment.status !== 'completed') {
        res.setHeader('X-Agent-Instructions', 'https://coinrailz.com/.well-known/agent-instructions.json');
        res.setHeader('Link', '<https://coinrailz.com/.well-known/agent-instructions.json>; rel="agent-instructions"');
        return res.status(402).json({
          success: false,
          error: 'Payment not completed',
          status: payment.status,
          hint: 'Payment must be completed before verifying',
        });
      }
      
      const paymentAmount = parseFloat(payment.amount);
      if (paymentAmount < expectedPrice * 0.99) {
        res.setHeader('X-Agent-Instructions', 'https://coinrailz.com/.well-known/agent-instructions.json');
        res.setHeader('Link', '<https://coinrailz.com/.well-known/agent-instructions.json>; rel="agent-instructions"');
        return res.status(402).json({
          success: false,
          error: 'Insufficient payment amount',
          expected: expectedPrice,
          received: paymentAmount,
        });
      }
      
      const expectedRecipient = process.env.PLATFORM_WALLET_ADDRESS || '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91';
      if (payment.walletAddress && payment.walletAddress.toLowerCase() !== expectedRecipient.toLowerCase()) {
        return res.status(400).json({
          success: false,
          error: 'Payment recipient mismatch',
          hint: 'Payment was sent to wrong wallet address',
        });
      }
      
      if (payment.currency && payment.currency !== 'USDC') {
        return res.status(400).json({
          success: false,
          error: 'Invalid payment currency',
          hint: 'Only USDC payments are accepted',
        });
      }
      
      const productExpectedNetwork = p.expectedNetwork || 'base';
      
      if (network !== productExpectedNetwork) {
        return res.status(400).json({
          success: false,
          error: 'Payment network mismatch',
          hint: `This product requires payment on ${productExpectedNetwork} network. Payment request specified: ${network}`,
        });
      }
      
      if (payment.network && payment.network !== network) {
        return res.status(400).json({
          success: false,
          error: 'Payment network does not match request',
          hint: `Payment was made on ${payment.network} but request specified ${network}`,
        });
      }
      
      const metadata = payment.metadata as Record<string, any> | null;
      const hasProductBinding = metadata?.productId || metadata?.serviceId?.includes(productId);
      
      if (!hasProductBinding) {
        return res.status(400).json({
          success: false,
          error: 'Payment not bound to this product',
          hint: 'x402 payment must include productId or serviceId in metadata referencing this product',
        });
      }
      
      if (metadata?.productId && metadata.productId !== productId) {
        return res.status(400).json({
          success: false,
          error: 'Payment product mismatch',
          hint: 'This payment was made for a different product',
        });
      }
      
      const existingX402Sale = await db.select()
        .from(iotDataSales)
        .where(eq(iotDataSales.x402PaymentId, x402PaymentId))
        .limit(1);
      
      if (existingX402Sale.length) {
        return res.status(409).json({
          success: false,
          error: 'x402 payment already used',
          existingSaleId: existingX402Sale[0].id,
        });
      }
    }
    
    const priceUsd = expectedPrice;
    const platformFee = priceUsd * A2D_PLATFORM_FEE;
    const sellerCredit = priceUsd - platformFee;
    
    const saleId = `iot_sale_${nanoid(16)}`;
    const { randomBytes } = await import('crypto');
    const accessToken = randomBytes(32).toString('hex');
    const accessTokenExpiry = new Date();
    accessTokenExpiry.setMinutes(accessTokenExpiry.getMinutes() + DATA_ACCESS_TOKEN_EXPIRY_MINUTES);
    
    await db.transaction(async (tx) => {
      await tx.insert(iotDataSales).values({
        id: saleId,
        productId,
        deviceId: p.deviceId,
        accountId: p.accountId,
        buyerAgentId: buyerAgentId || null,
        buyerWallet: buyerWallet || null,
        x402PaymentId: x402PaymentId || null,
        txHash: txHash || null,
        amount: priceUsd.toString(),
        platformFee: platformFee.toString(),
        sellerCredit: sellerCredit.toString(),
        units,
        status: 'verified',
        deliveryStatus: 'not_started',
        accessToken,
        accessTokenExpiry,
      });
      
      await tx.execute(
        sql`UPDATE iot_accounts 
            SET credits_balance = credits_balance + ${sellerCredit.toFixed(4)}::numeric,
                updated_at = NOW()
            WHERE id = ${p.accountId}`
      );
      
      await tx.execute(
        sql`UPDATE iot_device_products 
            SET total_sales = total_sales + 1,
                total_revenue = total_revenue + ${priceUsd.toFixed(4)}::numeric,
                updated_at = NOW()
            WHERE id = ${productId}`
      );
    });
    
    console.log(`💰 A2D Sale: ${saleId} - $${priceUsd.toFixed(4)} for ${p.productName} (device: ${p.deviceId})`);
    
    res.status(201).json({
      success: true,
      sale: {
        id: saleId,
        productId,
        amount: priceUsd,
        platformFee,
        sellerCredit,
        status: 'verified',
      },
      access: {
        token: accessToken,
        expiresAt: accessTokenExpiry.toISOString(),
        dataEndpoint: `/api/iot/data/${productId}?token=${accessToken}`,
      },
      message: 'Payment verified. Use access token to retrieve data.',
    });
  } catch (error: any) {
    console.error('❌ Payment verification failed:', error);
    res.status(500).json({
      success: false,
      error: 'Payment verification failed',
      message: error.message,
    });
  }
});

router.get('/sales/:accountId', async (req: Request, res: Response) => {
  try {
    const auth = await getAccountFromApiKey(req);
    if (!auth.isValid || auth.accountId !== req.params.accountId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }
    
    const { accountId } = req.params;
    
    const sales = await db.select()
      .from(iotDataSales)
      .where(eq(iotDataSales.accountId, accountId))
      .orderBy(desc(iotDataSales.createdAt))
      .limit(100);
    
    const totalRevenue = sales.reduce((sum, s) => sum + parseFloat(s.amount), 0);
    const totalPlatformFees = sales.reduce((sum, s) => sum + parseFloat(s.platformFee), 0);
    const totalCredits = sales.reduce((sum, s) => sum + parseFloat(s.sellerCredit), 0);
    
    res.json({
      success: true,
      accountId,
      sales: sales.map(s => ({
        id: s.id,
        productId: s.productId,
        amount: parseFloat(s.amount),
        sellerCredit: parseFloat(s.sellerCredit),
        status: s.status,
        buyerAgentId: s.buyerAgentId,
        createdAt: s.createdAt,
      })),
      summary: {
        totalSales: sales.length,
        totalRevenue,
        totalPlatformFees,
        totalCredits,
      },
    });
  } catch (error: any) {
    console.error('❌ Get sales failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get sales',
    });
  }
});

router.get('/catalog', async (req: Request, res: Response) => {
  try {
    const products = await db.select()
      .from(iotDeviceProducts)
      .where(eq(iotDeviceProducts.status, 'active'))
      .orderBy(desc(iotDeviceProducts.totalSales))
      .limit(100);
    
    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}` 
      : 'https://coinrailz.com';
    
    res.json({
      success: true,
      catalog: products.map(p => ({
        id: p.id,
        name: p.productName,
        type: p.productType,
        description: p.description,
        priceUsd: parseFloat(p.priceUsd),
        unit: p.unit,
        expectedNetwork: p.expectedNetwork || 'base',
        tags: p.tags,
        endpoint: `${baseUrl}${p.x402Endpoint}`,
        totalSales: p.totalSales,
      })),
      count: products.length,
      protocol: 'x402',
      currency: 'USDC',
    });
  } catch (error: any) {
    console.error('❌ Get catalog failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get catalog',
    });
  }
});

function generateMockSensorData(productType: string): Record<string, any> {
  const timestamp = new Date().toISOString();
  
  switch (productType) {
    case 'sensor_reading':
      return {
        temperature: 22.5 + Math.random() * 5,
        humidity: 45 + Math.random() * 20,
        pressure: 1013 + Math.random() * 10,
        timestamp,
      };
    case 'stream':
      return {
        streamUrl: `wss://stream.example.com/${nanoid(8)}`,
        format: 'json',
        sampleRate: 1000,
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        timestamp,
      };
    case 'api_call':
      return {
        response: { status: 'ok', data: { value: Math.random() * 100 } },
        latencyMs: Math.floor(Math.random() * 50),
        timestamp,
      };
    case 'bulk_data':
      return {
        records: Array.from({ length: 10 }, (_, i) => ({
          id: i + 1,
          value: Math.random() * 100,
          timestamp: new Date(Date.now() - i * 60000).toISOString(),
        })),
        count: 10,
        timestamp,
      };
    default:
      return { value: Math.random() * 100, timestamp };
  }
}

export default router;
