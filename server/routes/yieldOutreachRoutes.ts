import { Router, Request, Response, NextFunction } from 'express';
import { yieldOutreachService } from '../services/yieldOutreachService';
import { nanoid } from 'nanoid';

const router = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const key = req.headers['x-admin-key'] as string | undefined;
  if (key && key === process.env.ADMIN_KEY) return next();
  return res.status(401).json({ error: 'Admin authentication required. Pass X-Admin-Key header.' });
}

/**
 * POST /api/admin/yield-outreach/dry-run
 *
 * Preview-only: returns exact target list + verbatim message payloads that WOULD be sent.
 * No messages are sent. No funds are moved. Safe to call at any time.
 * Always run this before /send and verify the output.
 */
router.post('/dry-run', requireAdmin, async (req: Request, res: Response) => {
  try {
    console.log('🔍 Yield outreach DRY RUN starting...');
    const result = await yieldOutreachService.dryRun();

    res.json({
      success: true,
      mode: 'dry-run',
      description: 'No messages sent. Verify all fields before calling /send.',
      campaignId: result.campaignId,
      liveRates: result.liveRates,
      targets: {
        a2aAgents: result.targets.a2aAgents.map(t => ({
          name: t.name,
          url: t.url,
          a2aEndpoint: t.a2aEndpoint,
          wallet: t.address || null,
        })),
        onchainWallets: result.targets.onchainWallets.map(t => ({
          wallet: t.address,
          sampleUrl: t.url,
        })),
        totalTargets: result.targets.totalTargets,
      },
      sampleMessages: {
        a2aJson: result.sampleMessages.a2aJson,
        onchainCalldataDecoded: result.sampleMessages.onchainCalldataDecoded,
        onchainCalldataHex: result.sampleMessages.onchainCalldata,
      },
      warnings: result.warnings,
      readyToSend: result.readyToSend,
      nextStep: result.readyToSend
        ? 'Verify the above. If accurate, call POST /api/admin/yield-outreach/send with the same X-Admin-Key header and {"campaignId":"' + result.campaignId + '"}'
        : 'Fix warnings above before sending',
    });
  } catch (err: any) {
    console.error('❌ Yield outreach dry-run failed:', err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

/**
 * POST /api/admin/yield-outreach/send
 *
 * LIVE SEND — sends yield vault outreach to all verified targets.
 * Requires a campaignId from a prior dry-run call (prevents blind sends).
 * On-chain: 0.000001 ETH + calldata per wallet. A2A: JSON payload via message/send.
 * Rate-limited: 3s between on-chain txs, 2s between A2A sends.
 *
 * Body: { campaignId?: string }  (omit to generate a fresh one)
 */
router.post('/send', requireAdmin, async (req: Request, res: Response) => {
  try {
    const campaignId: string = req.body?.campaignId || `yield-vault-v1-${nanoid(8)}`;

    console.log(`🚀 Yield outreach LIVE SEND starting — campaign: ${campaignId}`);
    const result = await yieldOutreachService.runCampaign(campaignId);

    res.json({
      success: true,
      mode: 'live',
      campaignId: result.campaignId,
      stats: result.stats,
      a2aResults: result.a2aResults,
      onchainResults: result.onchainResults.map(r => ({
        wallet: r.wallet,
        success: r.success,
        txHash: r.txHash,
        explorerUrl: r.txHash ? `https://basescan.org/tx/${r.txHash}` : undefined,
        error: r.error,
      })),
    });
  } catch (err: any) {
    console.error('❌ Yield outreach send failed:', err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

export default router;
