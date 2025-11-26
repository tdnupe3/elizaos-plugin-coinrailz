import { Request, Response, NextFunction } from "express";
import { 
  verifyTransactionPayment, 
  markPaymentIntentSucceeded, 
  markPaymentIntentFailed 
} from "./hybridPaymentMiddleware";
import { offerLinkService } from "../services/offerLinkService";

// Service pricing in USD for conversion tracking
const SERVICE_PRICING_USD: Record<string, number> = {
  "ping": 0.25,
  "multi-chain-balance": 1.00,
  "gas-price-oracle": 0.50,
  "token-price": 0.75,
  "contract-scan": 2.50,
  "wallet-risk": 5.00,
  "trade-signals": 10.00,
  "default": 1.00
};

/**
 * Payment Orchestrator - Routes payment verification before middleware chain
 * 
 * Decision tree:
 * 1. If raw 0x transaction hash → verify on-chain, execute handler directly
 * 2. If Base64 JSON with txHash → verify on-chain, execute handler directly
 * 3. If EIP-712 signature → delegate to x402-express middleware
 * 4. If no payment → return 402 with payment requirements
 * 
 * This prevents middleware conflict by choosing verification path upfront
 */
export function createPaymentOrchestrator(
  serviceName: string,
  requiredAmount: number,
  handler: (req: Request, res: Response) => Promise<void>
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Check if bundle subscription exists (set by bundleAuthMiddleware)
    if (req.bundleSubscription) {
      const priceUsd = SERVICE_PRICING_USD[serviceName] || SERVICE_PRICING_USD["default"];
      console.log(`🎫 Bundle subscription detected for ${serviceName}, executing handler directly`);
      res.locals.payment = { method: "bundle-subscription", subscriptionId: req.bundleSubscription.id, amount: priceUsd, status: 'paid' };
      await handler(req, res);
      
      // CONVERSION TRACKING: Record conversion for offer attribution (bundle payments)
      const offerTrackingId = req.query?.offer_tracking as string;
      if (offerTrackingId) {
        const priceUsd = SERVICE_PRICING_USD[serviceName] || SERVICE_PRICING_USD["default"];
        console.log(`💰 BUNDLE CONVERSION: ${serviceName} via offer ${offerTrackingId} ($${priceUsd})`);
        try {
          await offerLinkService.recordConversion(offerTrackingId, priceUsd);
          console.log(`✅ Bundle conversion recorded for offer ${offerTrackingId}`);
        } catch (convErr: any) {
          console.error(`⚠️ Failed to record bundle conversion: ${convErr.message}`);
        }
      }
      return;
    }

    const xPayment = req.headers["x-payment"] as string | undefined;

    // No payment header → let x402-express middleware generate the 402 response
    if (!xPayment) {
      return next();
    }

    let txHash: string | null = null;

    // ARCHITECT FIX: Accept both raw 0x hashes AND Base64 JSON
    // Case 1: Raw transaction hash (what agents actually send)
    if (xPayment.startsWith("0x")) {
      txHash = xPayment;
      console.log(`🔐 Orchestrator: Raw 0x hash payment detected for ${serviceName}: ${xPayment.substring(0, 10)}...`);
    } 
    // Case 2: Base64-encoded JSON (legacy format)
    else {
      try {
        const decoded = JSON.parse(Buffer.from(xPayment, "base64").toString("utf-8"));
        if (decoded.txHash && typeof decoded.txHash === "string") {
          txHash = decoded.txHash;
          console.log(`🔐 Orchestrator: Base64 JSON hash payment detected for ${serviceName}: ${decoded.txHash.substring(0, 10)}...`);
        }
      } catch (e) {
        // Not Base64 JSON → probably EIP-712 signature, delegate to x402-express
        console.log(`🔐 Orchestrator: Non-hash payment header for ${serviceName}, delegating to x402-express`);
        return next();
      }
    }

    // If we have a transaction hash, verify it on-chain
    if (txHash) {
      try {
        const verified = await verifyTransactionPayment(
          txHash,
          serviceName,
          requiredAmount
        );

        if (verified) {
          const priceUsd = SERVICE_PRICING_USD[serviceName] || SERVICE_PRICING_USD["default"];
          console.log(`✅ Orchestrator: Payment verified for ${serviceName} ($${priceUsd}), executing handler directly`);
          // Store verification result for handler and tracking - INCLUDE AMOUNT FOR TRACKING
          res.locals.payment = { method: "raw-hash", txHash, verified: true, amount: priceUsd, status: 'paid' };
          
          // ARCHITECT FIX: Execute handler with proper intent tracking
          try {
            await handler(req, res);
            // Handler succeeded - mark intent as SUCCEEDED
            await markPaymentIntentSucceeded(txHash, serviceName);
            
            // CONVERSION TRACKING: Record conversion for offer attribution
            const offerTrackingId = req.query?.offer_tracking as string;
            if (offerTrackingId) {
              const priceUsd = SERVICE_PRICING_USD[serviceName] || SERVICE_PRICING_USD["default"];
              console.log(`💰 ORCHESTRATOR CONVERSION: ${serviceName} paid via offer ${offerTrackingId} ($${priceUsd})`);
              try {
                await offerLinkService.recordConversion(offerTrackingId, priceUsd);
                console.log(`✅ Conversion recorded for offer ${offerTrackingId}`);
              } catch (convErr: any) {
                console.error(`⚠️ Failed to record conversion: ${convErr.message}`);
              }
            }
          } catch (handlerError: any) {
            // Handler failed - mark intent as ALLOW_RETRY
            console.error(`❌ Handler error for ${serviceName}:`, handlerError.message);
            await markPaymentIntentFailed(txHash, serviceName, handlerError.message);
            // Re-throw to let Express error handler deal with it
            throw handlerError;
          }
          return;
        } else {
          console.log(`❌ Orchestrator: Payment verification failed for ${serviceName}, returning 402`);
          // Verification failed → let x402-express middleware generate 402 response
          return next();
        }
      } catch (error: any) {
        console.error(`❌ Orchestrator: Payment verification error for ${serviceName}:`, error.message);
        // Verification error → let x402-express middleware generate 402 response
        return next();
      }
    }

    // Fallback → let x402-express handle it
    return next();
  };
}
