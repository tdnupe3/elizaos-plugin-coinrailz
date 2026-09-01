---
name: Replit external database publish warning
description: Safe handling of Replit’s external database warning during publishing.
---

The Replit Publishing/Database banner “External database detected. Remove DATABASE_URL from Secrets to use Replit database features.” must be treated as a database-configuration handoff, not a normal frontend publish error. For Coin Railz, the application requires DATABASE_URL at startup and uses it to create the Neon PostgreSQL pool. Removing it without verifying the managed database identity, data, production injection behavior, and rollback path can make a new deployment fail or point at the wrong database.

Removing the manual override switched the development runtime to a different, smaller managed development database while the existing managed production database remained intact and current. The retained NEON_DATABASE_URL targets the production dataset and must not be copied into DATABASE_URL, because that would make development write directly to production. Replit does not provide direct recovery for a deleted Secret; restoring a legacy development connection requires obtaining its original URL from its provider or migrating its data explicitly.

**Why:** A copy-only frontend change was followed by a publish failure that surfaced this banner, while the existing public deployment remained healthy and the production build passed. The architect determined the edits could not cause the database classification.

**How to apply:** Verify schema and non-sensitive data counts in development and production before any secret change. After removing a legacy override, confirm which database development now targets. Never substitute a known production URL into development. Existing production data must remain the source of truth during frontend-only republishes.