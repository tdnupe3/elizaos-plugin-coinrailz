---
name: ElizaOS npm release gate
description: Non-obvious release requirements learned after a published artifact diverged from tested source.
---

Never approve an ElizaOS plugin release from source tests alone. The gate must pack the package, install that tarball in a clean consumer, compile its public types, and execute both CommonJS and native ESM imports. It must also reject a version already present on npm, compare the packaged service catalog with the canonical catalog, and fail if release configuration is excluded from version control.

**Why:** A published package retained stale compiled behavior even though source was fixed; later auditing also found a same-version collision, catalog omissions, broken native ESM default unwrapping, and package configuration hidden by a broad JSON ignore rule.

**How to apply:** Use an explicit single-package release target. Before publishing, clean-build, test, pack, inspect contents, run the external-consumer gate, and use a publication dry run. After publishing, reinstall the exact registry version and repeat the smoke test before monitoring production behavior.