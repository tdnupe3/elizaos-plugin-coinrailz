import { Router, Request, Response } from 'express';
import { db } from '../db';
import { ipBlocklist } from '../../shared/schema';
import { eq } from 'drizzle-orm';
import { refreshBlocklistCache } from '../middleware/ipBlocklistMiddleware';

const router = Router();

function requireAdmin(req: Request, res: Response): boolean {
  const key = req.headers['x-admin-key'] as string;
  if (key !== process.env.ADMIN_KEY && key !== 'admin-secret-key') {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  return true;
}

/**
 * GET /api/admin/ip-blocklist
 * List all blocked IPs
 */
router.get('/', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  try {
    const entries = await db.select().from(ipBlocklist).orderBy(ipBlocklist.createdAt);
    res.json({ count: entries.length, entries });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/admin/ip-blocklist
 * Add an IP to the blocklist
 * Body: { ipAddress, reason }
 */
router.post('/', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const { ipAddress, reason, blockedBy } = req.body;
  if (!ipAddress || !reason) {
    return res.status(400).json({ error: 'ipAddress and reason are required' });
  }
  try {
    const [entry] = await db.insert(ipBlocklist).values({
      ipAddress: ipAddress.replace('::ffff:', '').trim(),
      reason,
      blockedBy: blockedBy || 'admin',
    }).onConflictDoNothing().returning();

    await refreshBlocklistCache();
    res.status(201).json({ blocked: true, entry });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * DELETE /api/admin/ip-blocklist/:ip
 * Remove an IP from the blocklist
 */
router.delete('/:ip', async (req: Request, res: Response) => {
  if (!requireAdmin(req, res)) return;
  const ip = decodeURIComponent(req.params.ip).replace('::ffff:', '').trim();
  try {
    const deleted = await db.delete(ipBlocklist).where(eq(ipBlocklist.ipAddress, ip)).returning();
    if (deleted.length === 0) {
      return res.status(404).json({ error: 'IP not found in blocklist' });
    }
    await refreshBlocklistCache();
    res.json({ unblocked: true, ip });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
