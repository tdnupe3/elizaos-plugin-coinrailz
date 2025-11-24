# XMTP Scanner Migration Guide

## Safe Deployment Steps

The XMTP scanner adds new columns to `discovered_agents` table. Follow this migration path to avoid database errors.

### Step 1: Deploy Schema Changes (NO UNIQUE INDEX YET)

The schema now includes:
- `xmtpAddress` - varchar, nullable
- `xmtpCanMessage` - boolean, default false
- `xmtpLastChecked` - timestamp, nullable
- `agentCardData` - jsonb, nullable
- `canonicalUrl` - varchar, nullable (NO UNIQUE INDEX YET)

```bash
# Deploy will automatically run db:push
npm run db:push
```

### Step 2: Backfill Canonical URLs

After deployment, run the cleanup endpoint to:
1. Set canonical URLs for all existing agents
2. Consolidate duplicate agents
3. Remove inferior duplicates

```bash
# Backfill and consolidate duplicates
curl -X POST https://coinrailz.com/api/xmtp/cleanup-duplicates

# Expected response:
{
  "success": true,
  "results": {
    "canonicalUrlsSet": 1000,
    "duplicatesFound": 50,
    "duplicatesRemoved": 50
  }
}
```

### Step 3: Verify No Duplicates Remain

```bash
# Check for remaining duplicates
curl https://coinrailz.com/api/xmtp/duplicate-stats

# Expected response (0 duplicates):
{
  "success": true,
  "stats": {
    "totalAgents": 950,
    "uniqueCanonicalUrls": 950,
    "duplicateCount": 0,
    "agentsWithoutCanonical": 0
  }
}
```

### Step 4: Add Unique Index (MANUAL SQL)

Once all canonical URLs are set and duplicates removed, add the unique index:

```sql
-- Connect to production database
-- Run this SQL manually:
CREATE UNIQUE INDEX IDX_discovered_agents_canonical_url_unique 
ON discovered_agents(canonical_url) 
WHERE canonical_url IS NOT NULL;
```

### Step 5: Uncomment Unique Index in Schema

After manual index creation, update `shared/schema.ts`:

```typescript
uniqueIndex("IDX_discovered_agents_canonical_url_unique").on(table.canonicalUrl),
```

Then run `npm run db:push` again to sync schema.

---

## Why This Migration Path?

**Problem:** If we add a UNIQUE INDEX immediately on a column with existing duplicates, database will reject the migration.

**Solution:** 
1. Add column without index (allows duplicates temporarily)
2. Backfill + consolidate via API
3. Add index manually after duplicates are eliminated
4. Update schema to match

---

## Testing the XMTP Scanner

### Test 1: Manual Scan
```bash
curl -X POST https://coinrailz.com/api/xmtp/scan \
  -H "Content-Type: application/json" \
  -d '{"maxAgents": 100, "batchSize": 10}'
```

### Test 2: Check Statistics
```bash
curl https://coinrailz.com/api/xmtp/stats
```

### Test 3: Get XMTP-Enabled Agents
```bash
curl https://coinrailz.com/api/xmtp/agents?limit=50
```

### Test 4: High-Value Targets
```bash
curl https://coinrailz.com/api/xmtp/high-value-targets
```

---

## Rollback Plan

If issues occur:

1. **Remove unique index:**
   ```sql
   DROP INDEX IF EXISTS IDX_discovered_agents_canonical_url_unique;
   ```

2. **Comment out schema index:**
   ```typescript
   // uniqueIndex("IDX_discovered_agents_canonical_url_unique").on(table.canonicalUrl),
   ```

3. **Run db:push** to sync:
   ```bash
   npm run db:push
   ```

---

## Monitoring

### Nightly Scanner Logs
Check server logs for:
```
⏰ XMTP scan scheduler started (runs nightly at 2:00 AM)
🔍 Starting scheduled XMTP agent scan...
✅ Scheduled XMTP scan complete
```

### Database Queries for Verification

```sql
-- Check XMTP adoption rate
SELECT 
  COUNT(*) FILTER (WHERE xmtp_can_message = true) as enabled,
  COUNT(*) FILTER (WHERE xmtp_last_checked IS NOT NULL) as checked,
  ROUND(100.0 * COUNT(*) FILTER (WHERE xmtp_can_message = true) / 
    NULLIF(COUNT(*) FILTER (WHERE xmtp_last_checked IS NOT NULL), 0), 2) as adoption_rate
FROM discovered_agents;

-- Check for duplicates
SELECT canonical_url, COUNT(*) as count 
FROM discovered_agents 
WHERE canonical_url IS NOT NULL 
GROUP BY canonical_url 
HAVING COUNT(*) > 1;

-- View XMTP-enabled agents
SELECT url, xmtp_address, xmtp_last_checked 
FROM discovered_agents 
WHERE xmtp_can_message = true 
ORDER BY score DESC 
LIMIT 20;
```

---

**Status:** Schema deployed, awaiting backfill + index creation
