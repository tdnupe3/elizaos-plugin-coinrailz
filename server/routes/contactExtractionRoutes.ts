import { Router } from "express";
import { contactInfoExtractor } from "../services/contactInfoExtractor";

const router = Router();

// Run full contact extraction
router.post("/extract", async (req, res) => {
  try {
    console.log('🚀 Starting contact info extraction...');
    const results = await contactInfoExtractor.runFullExtraction();
    
    res.json({
      success: true,
      results,
    });
  } catch (error: any) {
    console.error('❌ Contact extraction error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Extract from specific source
router.post("/extract/:source", async (req, res) => {
  try {
    const { source } = req.params;
    let results;

    switch (source) {
      case 'a2a':
        results = await contactInfoExtractor.extractFromA2AAgentCards();
        break;
      case 'erc8004':
        results = await contactInfoExtractor.extractFromERC8004OnChain();
        break;
      case 'metadata':
        results = await contactInfoExtractor.extractFromMetadata();
        break;
      case 'url-patterns':
        results = await contactInfoExtractor.extractFromURLPatterns();
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid source. Use: a2a, erc8004, metadata, url-patterns',
        });
    }

    res.json({
      success: true,
      source,
      results,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get extraction statistics
router.get("/stats", async (req, res) => {
  try {
    const stats = await contactInfoExtractor.getExtractionStats();
    
    res.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
