---
name: Publish revision verification
description: How to distinguish a healthy prior deployment from the newly published workspace revision.
---

A successful deployment status only proves that some production build is healthy; it does not prove the latest workspace changes have finished publishing.

**Why:** During a rollout, deployment metadata still reported a successful public build while production continued serving the prior behavior. The new publish commit appeared later, after which the expected route and schema sentinels changed.

**How to apply:** Before declaring a publish missing, failed, or complete, compare the publish commit/timestamp with the workspace revision and verify one harmless live behavior sentinel plus any expected production schema diff. Treat readiness responses during rollout as transient until the revision identity is confirmed.