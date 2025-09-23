import express from 'express';
import { telegramAutoJoiner } from '../services/telegramAutoJoiner.js';

const router = express.Router();

/**
 * 🚀 START AUTO-JOINING CRYPTO GROUPS (FREE!)
 */
router.post('/start', async (req, res) => {
  try {
    const { apiId, apiHash, phoneNumber, groupUrls } = req.body;
    
    // Validate input
    if (!apiId || !apiHash || !phoneNumber) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required Telegram API credentials (apiId, apiHash, phoneNumber)' 
      });
    }

    if (!groupUrls || !Array.isArray(groupUrls) || groupUrls.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Please provide an array of group URLs to join' 
      });
    }

    // Start auto-joining in background
    telegramAutoJoiner.startAutoJoin({
      apiId,
      apiHash, 
      phoneNumber,
      groupUrls
    }).catch(console.error);

    res.json({ 
      success: true, 
      message: `🚀 Started auto-joining ${groupUrls.length} crypto groups!` 
    });

  } catch (error: any) {
    console.error('Error starting auto-joiner:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * ⏸️ STOP AUTO-JOINER
 */
router.post('/stop', async (req, res) => {
  try {
    telegramAutoJoiner.stopAutoJoin();

    res.json({ 
      success: true, 
      message: 'Auto-joiner stopped' 
    });

  } catch (error: any) {
    console.error('Error stopping auto-joiner:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * 📊 GET AUTO-JOINER STATISTICS
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = telegramAutoJoiner.getStats();

    res.json({ 
      success: true, 
      stats 
    });

  } catch (error: any) {
    console.error('Error getting stats:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * 📜 GET AUTO-JOINER LOGS
 */
router.get('/logs', async (req, res) => {
  try {
    const logs = telegramAutoJoiner.getLogs();

    res.json({ 
      success: true, 
      logs 
    });

  } catch (error: any) {
    console.error('Error getting logs:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * 🧹 RESET AUTO-JOINER
 */
router.post('/reset', async (req, res) => {
  try {
    telegramAutoJoiner.reset();

    res.json({ 
      success: true, 
      message: 'Auto-joiner reset successfully' 
    });

  } catch (error: any) {
    console.error('Error resetting auto-joiner:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

export default router;