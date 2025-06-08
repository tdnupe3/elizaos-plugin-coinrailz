
/**
 * Integration Readiness Assessment Routes
 */

import { Router } from "express";
import { kycAmlPreparation } from "./services/kycAmlPreparationService";

const router = Router();

/**
 * Get integration readiness assessment
 */
router.get("/integration-readiness", async (req, res) => {
  try {
    const assessment = await kycAmlPreparation.assessIntegrationReadiness();
    
    res.json({
      success: true,
      assessment,
      timestamp: new Date().toISOString(),
      recommendations: {
        immediate: assessment.overallScore < 70 ? [
          "Complete KYC document validation framework",
          "Enhance AML transaction monitoring",
          "Set up regulatory reporting automation"
        ] : [],
        short_term: assessment.overallScore < 85 ? [
          "Prepare webhook endpoints for provider integration",
          "Set up case management workflows",
          "Enhance audit trail capabilities"
        ] : [],
        long_term: [
          "Consider multi-provider strategy for redundancy",
          "Implement advanced ML-based risk scoring",
          "Set up automated regulatory filing"
        ]
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get provider configurations
 */
router.get("/provider-configs", async (req, res) => {
  try {
    const kycConfig = kycAmlPreparation.createIntegrationConfig('jumio', 'chainalysis');
    
    res.json({
      success: true,
      configs: kycConfig,
      providers: {
        kyc: ['jumio', 'onfido', 'sumsub', 'shufti_pro', 'persona'],
        aml: ['chainalysis', 'elliptic', 'trulioo', 'refinitiv', 'lexisnexis']
      },
      webhooks: kycAmlPreparation.generateWebhookEndpoints()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get test data for integration testing
 */
router.get("/integration-test-data", async (req, res) => {
  try {
    const testData = kycAmlPreparation.generateTestData();
    
    res.json({
      success: true,
      testData,
      note: "Use this data for testing KYC/AML provider integrations"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
