---
name: Encryption key secrets required for deploy
description: PII_ENCRYPTION_KEY and ENCRYPTION_KEY must be set as Replit secrets before any production deploy — both have production fail-fast guards that crash startup if missing.
---

# Encryption Secrets — Production Deploy Requirement

## The Rule
Two secrets are required in Replit Secrets before redeploying to production:
- `PII_ENCRYPTION_KEY` — used by `server/utils/piiEncryption.ts` (AES-256-GCM) for GPT session IDs and wallet seeds
- `ENCRYPTION_KEY` — used by `server/utils/encryption.ts` (AES-256-CBC) for general encryption

Both files have production fail-fast guards that `throw` on startup if the env var is missing when `NODE_ENV=production` or `REPLIT_DEPLOYMENT` is set.

**Why:** Without a stable key, every restart generates a new random key (`crypto.randomBytes(32)` fallback), making previously encrypted data permanently unreadable (silent data corruption).

**How to apply:**
- Before any deploy: `viewEnvVars({ type: "secret", keys: ["PII_ENCRYPTION_KEY", "ENCRYPTION_KEY"] })` to confirm both are present
- If missing, generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- Each key must be a 64-character hex string (32 bytes)
- `secureWalletManager` stores encrypted seeds in-memory only (not DB) — no persistent encrypted data risk from a key rotation, as long as no wallet seeds are written to the DB
- `gpt_auth_sessions` table stores encrypted conversation IDs — verify no live rows exist before rotating PII_ENCRYPTION_KEY
