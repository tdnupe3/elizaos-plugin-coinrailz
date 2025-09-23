import express from 'express';
import { telegramAutoJoinerFixed } from '../services/telegramAutoJoinerFixed.js';

const router = express.Router();

// Simple rate limiting
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 60000; // 1 minute between requests

function rateLimit(req: any, res: any, next: any) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const lastRequest = rateLimitMap.get(ip);
  
  if (lastRequest && (now - lastRequest) < RATE_LIMIT_MS) {
    return res.status(429).json({ 
      success: false, 
      error: 'Too many requests. Please wait before trying again.' 
    });
  }
  
  rateLimitMap.set(ip, now);
  next();
}

/**
 * 🚀 START AUTO-JOINING (WITH RATE LIMITING)
 */
router.post('/start', rateLimit, async (req, res) => {
  try {
    const { apiId, apiHash, phoneNumber, groupUrls } = req.body;
    
    // Input validation
    if (!apiId || !apiHash || !phoneNumber) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required Telegram API credentials' 
      });
    }

    if (!groupUrls || !Array.isArray(groupUrls) || groupUrls.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Please provide an array of group URLs' 
      });
    }

    // Limit number of groups
    if (groupUrls.length > 100) {
      return res.status(400).json({ 
        success: false, 
        error: 'Maximum 100 groups allowed per session' 
      });
    }

    // Start auto-joining
    telegramAutoJoinerFixed.startAutoJoin({
      apiId: apiId.toString(),
      apiHash: apiHash.toString(),
      phoneNumber: phoneNumber.toString(),
      groupUrls: groupUrls.filter(url => typeof url === 'string' && url.trim())
    }).catch(error => {
      console.error('Auto-joiner background error:', error);
    });

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
router.post('/stop', rateLimit, async (req, res) => {
  try {
    telegramAutoJoinerFixed.stopAutoJoin();
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
    const stats = telegramAutoJoinerFixed.getStats();
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
 * 🧹 RESET AUTO-JOINER
 */
router.post('/reset', rateLimit, async (req, res) => {
  try {
    telegramAutoJoinerFixed.reset();
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

/**
 * 🗑️ CLEAR TELEGRAM SESSION
 */
router.post('/clear-session', rateLimit, async (req, res) => {
  try {
    telegramAutoJoinerFixed.clearSession();
    res.json({ 
      success: true, 
      message: 'Telegram session cleared - you will need to login again' 
    });
  } catch (error: any) {
    console.error('Error clearing session:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

export default router;