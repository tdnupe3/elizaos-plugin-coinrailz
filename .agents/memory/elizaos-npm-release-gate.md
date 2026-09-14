---
name: ElizaOS npm release gate
description: Non-obvious release requirements learned after a published artifact diverged from tested source.
---

Never approve an ElizaOS plugin release from source tests alone. The gate must pack the package, install that tarball in a clean consumer, compile its public types, and execute both CommonJS and native ESM imports. It must also reject a version already present on npm, compare the packaged service catalog with the canonical catalog, and fail if release configuration is excluded from version control.

**Why:** A published package retained stale compiled behavior even though source was fixed; later auditing also found a same-version collision, catalog omissions, broken native ESM default unwrapping, and package configuration hidden by a broad JSON ignore rule.

**How to apply:** Use an explicit single-package release target. Before publishing, clean-build, test, pack, inspect contents, run the external-consumer gate, and use a publication dry run. After publishing, reinstall the exact registry version and repeat the smoke test before monitoring production behavior.

The ElizaOS registry entry is a separate, exact version pin and does not advance when npm publishes a new plugin version. A release is not fully distributed until that registry entry is updated and production telemetry shows the new User-Agent on valid paths with older versions analyzed separately.

**Why:** Publishing the fixed npm artifact did not move registry consumers; the registry still advertised an older release, and production continued to show `/undefined` only from older User-Agents.

**How to apply:** Every plugin npm release must include a registry-version update, then a production query grouped by exact User-Agent and request path. Do not combine old and new runtime traffic when validating a fix.

For ElizaOS v2 compatibility, a successful direct `require()` or import is not enough. The release gate must install the packed artifact with the upstream-pinned Bun version and pass its ESM default export through the real `@elizaos/core` `loadPlugin`.

**Why:** Bun can unwrap a TypeScript-generated CommonJS `exports.default` value. An ESM shim that default-imports that bundle may then read named exports from the plugin object and silently export `undefined`, even while direct CommonJS loading succeeds.

**How to apply:** Import the generated CommonJS namespace in the ESM shim, verify default equals named plugin export, and test the registry’s exact v2 core version. Keep the package peer range aligned with every runtime generation claimed by the registry.