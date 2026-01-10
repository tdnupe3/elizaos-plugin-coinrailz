import { Router, Request, Response } from 'express';
import { launchOrchestrator, CampaignConfig } from '../services/launch/launchOrchestrator';
import { launcherWalletService } from '../services/launch/launcherWalletService';
import { pumpfunService, generateBotAttractiveMetadata } from '../services/launch/pumpfunService';

const router = Router();

const LAUNCHER_API_SECRET = process.env.TOKEN_LAUNCHER_API_SECRET || '';

function requireLiveModeAuth(req: Request, res: Response, next: Function) {
  const { mode } = req.body;
  
  if (mode === 'live') {
    const authHeader = req.headers.authorization;
    const providedSecret = authHeader?.replace('Bearer ', '');
    
    if (!LAUNCHER_API_SECRET) {
      return res.status(403).json({
        success: false,
        error: 'Live mode disabled: TOKEN_LAUNCHER_API_SECRET not configured'
      });
    }
    
    if (!providedSecret || providedSecret !== LAUNCHER_API_SECRET) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid API secret for live mode'
      });
    }
  }
  
  next();
}

router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = await launchOrchestrator.getStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/wallet', async (req: Request, res: Response) => {
  try {
    const wallet = await launcherWalletService.getStatus();
    res.json({
      success: true,
      data: wallet
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/estimate', async (req: Request, res: Response) => {
  try {
    const liquiditySol = parseFloat(req.query.liquidity as string) || 0.5;
    const estimate = await pumpfunService.estimateLaunchCost(liquiditySol);
    res.json({
      success: true,
      data: estimate
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/single-launch', requireLiveModeAuth, async (req: Request, res: Response) => {
  try {
    const { mode = 'paper' } = req.body;
    
    if (mode !== 'paper' && mode !== 'live') {
      return res.status(400).json({
        success: false,
        error: 'Mode must be "paper" or "live"'
      });
    }

    const result = await launchOrchestrator.runSingleLaunch(mode);
    
    res.json({
      success: result.success,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/campaigns', requireLiveModeAuth, async (req: Request, res: Response) => {
  try {
    const { name, config, mode = 'paper' } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Campaign name is required'
      });
    }

    const campaign = await launchOrchestrator.createCampaign(name, config || {}, mode);
    
    res.json({
      success: true,
      data: campaign
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/campaigns', async (req: Request, res: Response) => {
  try {
    const campaigns = await launchOrchestrator.getAllCampaigns();
    res.json({
      success: true,
      data: campaigns
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/campaigns/:id', async (req: Request, res: Response) => {
  try {
    const campaign = await launchOrchestrator.getCampaign(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }
    
    res.json({
      success: true,
      data: campaign
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/campaigns/:id/start', async (req: Request, res: Response) => {
  try {
    const campaign = await launchOrchestrator.getCampaign(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    if (campaign.mode === 'live') {
      const authHeader = req.headers.authorization;
      const providedSecret = authHeader?.replace('Bearer ', '');
      
      if (!LAUNCHER_API_SECRET) {
        return res.status(403).json({
          success: false,
          error: 'Live mode disabled: TOKEN_LAUNCHER_API_SECRET not configured'
        });
      }
      
      if (!providedSecret || providedSecret !== LAUNCHER_API_SECRET) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized: Invalid API secret for live mode'
        });
      }
    }

    const result = await launchOrchestrator.startCampaign(req.params.id);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }
    
    res.json({
      success: true,
      message: 'Campaign started'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/campaigns/:id/stop', async (req: Request, res: Response) => {
  try {
    const success = await launchOrchestrator.stopCampaign(req.params.id);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Campaign stopped'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/preview-metadata', async (req: Request, res: Response) => {
  try {
    const metadata = generateBotAttractiveMetadata();
    res.json({
      success: true,
      data: metadata
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
