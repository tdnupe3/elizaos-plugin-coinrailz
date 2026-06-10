---
name: ElizaOS registry submission
description: How to submit a community plugin to the elizaOS plugin registry — correct repo, path, format, and PR target branch.
---

## The correct registry location

The elizaOS plugin registry is inside the main `elizaOS/eliza` GitHub repo, NOT the `elizaos-plugins/registry` org (which 404s for non-members).

- **Repo:** `github.com/elizaOS/eliza`
- **Path:** `packages/registry/entries/third-party/<plugin-name>.json`
- **PR target branch:** `develop` (not main)

## JSON format (verified from merged PRs)

```json
{
  "package": "elizaos-plugin-coinrailz",
  "repository": "github:tdnupe3/elizaos-plugin-coinrailz",
  "kind": "plugin",
  "description": "...",
  "homepage": "https://coinrailz.com",
  "version": "2.1.0",
  "tags": ["payments", "x402", "usdc", "yield"]
}
```

- `package` = npm package name
- `repository` = `github:owner/repo` pointing to the plugin's GitHub repo
- `generated-registry.json` is updated by maintainers on merge — submitters do NOT need to edit it

## PR title convention

`feat(registry): register <plugin-name> as third-party plugin`

## Requirements before submitting

1. Plugin published to npm
2. Plugin code in a public GitHub repo (value in the `repository` field must be a real repo)
3. `agentConfig` block in `package.json` with `pluginType` and `pluginParameters`
4. `keywords: ["elizaos", "plugin"]` in package.json

**Why:** Registry PRs that add files other than the entry JSON are rejected. The generated-registry.json is auto-managed.

**How to apply:** Fork elizaOS/eliza → create one JSON file → PR to develop branch.
