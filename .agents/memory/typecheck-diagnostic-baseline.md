---
name: Typecheck diagnostic baseline
description: Why the release typecheck fingerprints known diagnostics instead of weakening compiler strictness.
---

The root application typecheck must keep `strict` enabled and compile the complete configured client, shared, and server source scope. Until the historical diagnostic backlog is eliminated, the release gate accepts only the exact reviewed diagnostic fingerprint; any added, removed, moved, or changed diagnostic fails.

**Why:** Broad strictness reductions or file-level suppression would hide new production regressions. An exact fingerprint isolates the existing debt while preserving a deterministic regression gate.

**How to apply:** Fix new diagnostics before release. When intentionally removing known diagnostics, regenerate and review the count and fingerprint in the same change. Keep the lockfile versioned so dependency declaration drift cannot silently redefine the baseline.