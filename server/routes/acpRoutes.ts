import { Router, Request, Response } from 'express';
import { stripe } from '../services/stripeClient';
import { nanoid } from 'nanoid';
import { db } from '../db';
import { acpProducts, acpOrders } from '@shared/schema';
import { eq, and, asc } from 'drizzle-orm';
import { creditsService } from '../services/creditsService';

const router = Router();

const BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://coinrailz.com' 
  : `http://localhost:${process.env.PORT || 5000}`;

router.get('/catalog', async (req: Request, res: Response) => {
  try {
    const products = await db.select()
      .from(acpProducts)
      .where(eq(acpProducts.active, true))
      .orderBy(asc(acpProducts.sortOrder));

    const catalog = products.map(p => ({
      id: p.id,
      title: p.title,
      description: p.description,
      price: parseFloat(p.price || '0'),
      currency: p.currency,
      type: p.productType,
      credits: p.creditsIncluded,
      apiCalls: p.apiCallsIncluded,
      validityDays: p.validityDays,
      services: p.serviceSlugs,
    }));

    res.json({
      success: true,
      catalog,
      message: 'Coin Railz ACP Product Catalog - Digital products for AI agent infrastructure'
    });
  } catch (error: any) {
    console.error('❌ ACP Catalog error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch catalog' });
  }
});

router.get('/catalog/:productId', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    
    const [product] = await db.select()
      .from(acpProducts)
      .where(and(
        eq(acpProducts.id, productId),
        eq(acpProducts.active, true)
      ));

    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    res.json({
      success: true,
      product: {
        id: product.id,
        title: product.title,
        description: product.description,
        price: parseFloat(product.price || '0'),
        currency: product.currency,
        type: product.productType,
        credits: product.creditsIncluded,
        apiCalls: product.apiCallsIncluded,
        validityDays: product.validityDays,
        services: product.serviceSlugs,
      }
    });
  } catch (error: any) {
    console.error('❌ ACP Product fetch error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch product' });
  }
});

router.post('/checkout', async (req: Request, res: Response) => {
  try {
    const { productId, email, successUrl, cancelUrl } = req.body;

    if (!productId) {
      return res.status(400).json({ success: false, error: 'productId is required' });
    }

    const [product] = await db.select()
      .from(acpProducts)
      .where(and(
        eq(acpProducts.id, productId),
        eq(acpProducts.active, true)
      ));

    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const orderId = nanoid(16);
    const host = req.get('host') || '';
    const isLocalDev = host.includes('localhost') || host.includes('127.0.0.1');
    const baseUrl = isLocalDev ? `http://${host}` : 'https://coinrailz.com';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: product.currency?.toLowerCase() || 'usd',
          product_data: {
            name: product.title,
            description: product.description,
          },
          unit_amount: Math.round(parseFloat(product.price || '0') * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: successUrl || `${baseUrl}/acp/success?order_id=${orderId}`,
      cancel_url: cancelUrl || `${baseUrl}/acp/cancel?order_id=${orderId}`,
      customer_email: email || undefined,
      metadata: {
        orderId,
        productId: product.id,
        creditsIncluded: product.creditsIncluded?.toString() || '',
        apiCallsIncluded: product.apiCallsIncluded?.toString() || '',
        source: 'acp_checkout',
      },
    });

    await db.insert(acpOrders).values({
      id: orderId,
      productId: product.id,
      checkoutSessionId: session.id,
      customerEmail: email || null,
      status: 'pending',
      amount: product.price || '0',
      currency: product.currency || 'USD',
      source: 'acp',
    });

    console.log(`🛒 ACP Checkout: Order ${orderId} created for product ${product.id}`);

    res.json({
      success: true,
      orderId,
      checkoutUrl: session.url,
      message: 'Checkout session created. Redirect to checkoutUrl to complete payment.'
    });
  } catch (error: any) {
    console.error('❌ ACP Checkout error:', error);
    res.status(500).json({ success: false, error: 'Failed to create checkout session' });
  }
});

router.get('/orders/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    const [order] = await db.select()
      .from(acpOrders)
      .where(eq(acpOrders.id, orderId));

    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const safeOrder = {
      id: order.id,
      productId: order.productId,
      status: order.status,
      fulfillmentStatus: order.fulfillmentStatus,
      amount: order.amount,
      currency: order.currency,
      creditsAdded: order.creditsAdded,
      apiKeyPrefix: order.apiKeyIssued ? order.apiKeyIssued.substring(0, 12) + '...' : null,
      createdAt: order.createdAt,
      completedAt: order.completedAt,
    };

    res.json({ success: true, order: safeOrder });
  } catch (error: any) {
    console.error('❌ ACP Order fetch error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch order' });
  }
});

export async function fulfillAcpOrder(orderId: string, stripePaymentIntentId?: string): Promise<{
  success: boolean;
  apiKey?: string;
  credits?: number;
  error?: string;
}> {
  try {
    const [order] = await db.select()
      .from(acpOrders)
      .where(eq(acpOrders.id, orderId));

    if (!order) {
      return { success: false, error: 'Order not found' };
    }

    if (order.fulfillmentStatus === 'fulfilled') {
      return { 
        success: true, 
        credits: order.creditsAdded || 0,
        apiKey: order.apiKeyIssued ? '[already issued]' : undefined
      };
    }

    const [product] = await db.select()
      .from(acpProducts)
      .where(eq(acpProducts.id, order.productId));

    if (!product) {
      return { success: false, error: 'Product not found' };
    }

    const userId = `acp_${orderId}`;
    let apiKey: string | undefined;
    let creditsAdded = 0;

    if (product.creditsIncluded && product.creditsIncluded > 0) {
      await creditsService.addCredits({
        userId,
        amount: product.creditsIncluded,
        paymentMethod: 'stripe',
        referenceId: orderId,
        description: `ACP purchase: ${product.title}`,
        metadata: { productId: product.id, orderId }
      });
      creditsAdded = product.creditsIncluded;
    }

    const keyResult = await creditsService.generateApiKey(userId, `ACP - ${product.title}`);
    apiKey = keyResult.apiKey;

    await db.update(acpOrders)
      .set({
        status: 'completed',
        fulfillmentStatus: 'fulfilled',
        apiKeyIssued: keyResult.keyPrefix,
        creditsAdded,
        stripePaymentIntentId: stripePaymentIntentId || order.stripePaymentIntentId,
        completedAt: new Date(),
        fulfillmentDetails: {
          fulfilledAt: new Date().toISOString(),
          creditsAdded,
          apiKeyGenerated: true,
          productTitle: product.title,
          keyPrefix: keyResult.keyPrefix,
        }
      })
      .where(eq(acpOrders.id, orderId));

    console.log(`✅ ACP Order ${orderId} fulfilled: ${creditsAdded} credits, API key ${keyResult.keyPrefix}...`);

    return {
      success: true,
      apiKey,
      credits: creditsAdded
    };
  } catch (error: any) {
    console.error(`❌ ACP Fulfillment error for order ${orderId}:`, error);
    return { success: false, error: error.message };
  }
}

export default router;
