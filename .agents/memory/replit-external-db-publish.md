---
name: Replit external database publish warning
description: Safe handling of Replit’s external database warning during publishing.
---

The Replit Publishing/Database banner “External database detected. Remove DATABASE_URL from Secrets to use Replit database features.” must be treated as a database-configuration handoff, not a normal frontend publish error. For Coin Railz, the application requires DATABASE_URL at startup and uses it to create the Neon PostgreSQL pool. Removing it without verifying the managed database identity, data, production injection behavior, and rollback path can make a new deployment fail or point at the wrong database.

**Why:** A copy-only frontend change was followed by a publish failure that surfaced this banner, while the existing public deployment remained healthy and the production build passed. The architect determined the edits could not cause the database classification.

**How to apply:** Preserve the existing DATABASE_URL until Replit confirms whether it is a legacy override or the active data source and documents a safe migration/handoff. Verify schema and non-sensitive data counts in both databases before any secret change. Do not use “remove DATABASE_URL” as a blind fix.