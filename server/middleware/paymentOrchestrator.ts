import { Request, Response, NextFunction } from "express";
import { verifyTransactionPayment } from "./hybridPaymentMiddleware";

/**
 * Payment Orchestrator - Routes payment verification before middleware chain
 * 
 * Decision tree:
 * 1. If Base64 JSON with txHash → verify on-chain, execute handler directly
 * 2. If EIP-712 signature → delegate to x402-express middleware
 * 3. If no payment → return 402 with payment requirements
 * 
 * This prevents middleware conflict by choosing verification path upfront
 */
export function createPaymentOrchestrator(
  serviceName: string,
  requiredAmount: number,
  handler: (req: Request, res: Response) => Promise<void>
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const xPayment = req.headers["x-payment"] as string | undefined;

    // No payment header → let x402-express middleware generate the 402 response
    if (!xPayment) {
      return next();
    }

    // Try to decode as Base64 JSON (raw transaction hash)
    try {
      const decoded = JSON.parse(Buffer.from(xPayment, "base64").toString("utf-8"));
      
      if (decoded.txHash && typeof decoded.txHash === "string") {
        // This is a raw transaction hash payment
        console.log(`🔐 Orchestrator: Raw hash payment detected for ${serviceName}`);
        
        const verified = await verifyTransactionPayment(
          decoded.txHash,
          serviceName,
          requiredAmount
        );

        if (verified) {
          console.log(`✅ Orchestrator: Payment verified, executing handler for ${serviceName}`);
          // Payment verified → execute handler directly (bypass x402-express)
          return await handler(req, res);
        } else {
          console.log(`❌ Orchestrator: Payment verification failed for ${serviceName}`);
          return res.status(402).json({
            x402Version: 1,
            error: "Payment verification failed",
            message: "Transaction not found, insufficient amount, or already used",
            accepts: [{
              scheme: "exact",
              network: "base",
              maxAmountRequired: requiredAmount.toString(),
              resource: `http://localhost:5000/${serviceName}`,
              mimeType: "application/json",
              payTo: "0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91"
            }]
          });
        }
      }
    } catch (e) {
      // Not Base64 JSON → probably EIP-712 signature
      console.log(`🔐 Orchestrator: EIP-712 signature detected for ${serviceName}, delegating to x402-express`);
      // Delegate to x402-express middleware by continuing
      return next();
    }

    // Fallback → let x402-express handle it
    return next();
  };
}
