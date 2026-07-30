---
name: executeSql durable runtime replay
description: Batch parallel executeSql calls in CodeExecution get cached as ROLLBACK; subsequent calls return the same cached result. Use single sequential calls only.
---

# executeSql — durable runtime replay pitfall

## The rule
Never batch `executeSql` calls with `Promise.all` inside CodeExecution. Run each call as a single sequential `await` in its own CodeExecution invocation.

**Why:** The CodeExecution durable runtime records each registered callback's result once and replays it deterministically. When 14+ queries are fired in parallel via `Promise.all` and the underlying DB connection returns `START TRANSACTION / ROLLBACK` for any of them, those rollback results are cached in the replay chain. All subsequent CodeExecution calls that attempt the same (or similar) queries return the same `START TRANSACTION\nROLLBACK` output, regardless of the actual DB state.

A single `await executeSql(...)` in isolation works fine and returns real data.

**How to apply:**
- For assessments needing many queries: run the most critical one first as a connectivity test. If it returns data, run subsequent queries one per CodeExecution turn, not in batch.
- If you get `START TRANSACTION\nROLLBACK` from a single isolated query, it is a genuine DB issue — investigate. If you get it from every query in a batch, it is the replay cache.
- Queries with `NOW()` work fine in isolation. The non-determinism does not cause replay failures for single calls.
