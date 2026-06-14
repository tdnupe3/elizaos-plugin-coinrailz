---
name: db:push non-interactive schema drift
description: When db:push runs with stdin closed (post-merge scripts), it silently aborts on rename prompts — leaving tables out of sync without reporting failure.
---

# db:push Non-Interactive Rename Prompt Failure

## The Rule
When `drizzle-kit push` encounters a column that exists in the schema but not in the DB (possible rename), it prompts interactively: "was this renamed from X?" With stdin closed (as in `scripts/post-merge.sh`), Drizzle gets EOF and **aborts that operation silently** — the post-merge script still exits 0.

**Why:** Drizzle treats the rename question as mandatory. EOF causes it to skip that change (and all subsequent changes in the same push run), leaving the table partially or fully unsynced with the schema.

**How to apply:**
- Never rely on post-merge db:push to resolve rename ambiguities — it will silently fail
- After any merge that changes column names in the schema, manually verify with `information_schema.columns` that the DB matches
- Fix with targeted `ALTER TABLE ... RENAME COLUMN` SQL (safe even with live data)
- Do NOT use `db:push --force` globally — it scans all tables and will drop live data columns on unrelated tables if schema doesn't define them
- Use `--tablesFilter=tablename` if you must use db:push on a specific table non-interactively
