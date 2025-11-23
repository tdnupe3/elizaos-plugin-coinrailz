import { Request, Response, NextFunction } from "express";
import { deductBundleCredits } from "../services/bundleCreditService";

/**
 * Wrapper that deducts bundle credits after successful request execution
 * If bundle subscription exists, credits are deducted. Otherwise, regular payment flow applies.
 */
export function withBundleCredits(
  serviceSlug: string,
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Store original res.json to intercept successful responses
    const originalJson = res.json.bind(res);
    let responseSent = false;

    // Override res.json to intercept response
    res.json = function (body: any) {
      if (responseSent) {
        return res;
      }
      responseSent = true;

      // If bundle subscription exists, deduct credits
      if (req.bundleSubscription && res.statusCode >= 200 && res.statusCode < 300) {
        const endpoint = req.path.replace("/x402/", "");
        
        deductBundleCredits(
          req.bundleSubscription.id,
          serviceSlug,
          endpoint,
          res.statusCode.toString(),
          {
            method: req.method,
            path: req.path,
            ip: req.ip,
          }
        ).then((result) => {
          if (result.success) {
            // Add credit info to response headers
            res.setHeader("X-Bundle-Credits-Used", result.creditsDeducted);
            res.setHeader("X-Bundle-Credits-Remaining", result.creditsRemaining);
            res.setHeader("X-Payment-Method", "bundle-subscription");
          }
          
          originalJson(body);
        }).catch((error) => {
          console.error("Bundle credit deduction failed:", error);
          // Still send response even if credit tracking fails
          originalJson(body);
        });
      } else {
        // No bundle subscription or error response - proceed normally
        originalJson(body);
      }

      return res;
    } as any;

    // Execute the handler
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}
