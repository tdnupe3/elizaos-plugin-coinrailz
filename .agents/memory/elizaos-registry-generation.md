---
name: ElizaOS registry generation
description: Release-listing updates require both source entry and generated runtime artifact changes.
---

When updating an ElizaOS third-party registry entry, regenerate and commit the registry’s generated JSON artifact in the same change.

**Why:** Registry CI enforces source/generated equality, and runtime consumers read the generated artifact. Updating only the source entry can look correct in review while leaving consumers on stale metadata.

**How to apply:** Run the registry package’s generation command, confirm only expected generated fields changed, run registry validation and tests, then push both source and generated changes together.