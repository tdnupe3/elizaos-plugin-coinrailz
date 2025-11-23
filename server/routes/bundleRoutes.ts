import { Router } from "express";
import { SERVICE_BUNDLES, getBundlesForService, getServicesInBundle, calculateBundleSavings } from "../config/serviceBundles";

const router = Router();

// GET /api/bundles/service/:serviceSlug - Get bundles that include a specific service
// CRITICAL: This route MUST be registered BEFORE the generic /:bundleId route
router.get("/service/:serviceSlug", (req, res) => {
  const { serviceSlug } = req.params;
  const bundles = getBundlesForService(serviceSlug);
  
  if (bundles.length === 0) {
    return res.status(404).json({ error: "Service not found in any bundle" });
  }

  res.json({ bundles });
});

// GET /api/bundles - List all service bundles
router.get("/", (req, res) => {
  res.json({
    bundles: SERVICE_BUNDLES.map(bundle => ({
      ...bundle,
      savings: {
        starter: calculateBundleSavings(bundle.id, 'starter'),
        professional: calculateBundleSavings(bundle.id, 'professional'),
        enterprise: calculateBundleSavings(bundle.id, 'enterprise')
      }
    }))
  });
});

// GET /api/bundles/:bundleId - Get details for a specific bundle
// CRITICAL: This route must be AFTER /service/:serviceSlug to avoid conflicts
router.get("/:bundleId", (req, res) => {
  const { bundleId } = req.params;
  const bundle = SERVICE_BUNDLES.find(b => b.id === bundleId);
  
  if (!bundle) {
    return res.status(404).json({ error: "Bundle not found" });
  }

  const services = getServicesInBundle(bundleId);
  const savings = {
    starter: calculateBundleSavings(bundleId, 'starter'),
    professional: calculateBundleSavings(bundleId, 'professional'),
    enterprise: calculateBundleSavings(bundleId, 'enterprise')
  };

  res.json({
    ...bundle,
    services,
    savings
  });
});

export default router;
