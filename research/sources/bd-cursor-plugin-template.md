Source: https://github.com/cursor/plugin-template/blob/main/README.md
Title: plugin-template/README.md at main · cursor/plugin-template · GitHub
Fetched: 2026-08-29T02:47:55.263Z

[Skip to content](https://github.com/cursor/plugin-template/blob/main/README.md#start-of-content)

You signed in with another tab or window. [Reload](https://github.com/cursor/plugin-template/blob/main/README.md) to refresh your session.You signed out in another tab or window. [Reload](https://github.com/cursor/plugin-template/blob/main/README.md) to refresh your session.You switched accounts on another tab or window. [Reload](https://github.com/cursor/plugin-template/blob/main/README.md) to refresh your session.Dismiss alert

{{ message }}

### Uh oh!

There was an error while loading. [Please reload this page](https://github.com/cursor/plugin-template/blob/main/README.md).

[cursor](https://github.com/cursor)/ **[plugin-template](https://github.com/cursor/plugin-template)** Public template

- [Notifications](https://github.com/login?return_to=%2Fcursor%2Fplugin-template) You must be signed in to change notification settings
- [Fork\\
30](https://github.com/login?return_to=%2Fcursor%2Fplugin-template)
- [Star\\
92](https://github.com/login?return_to=%2Fcursor%2Fplugin-template)


## Collapse file tree

## Files

main

Search this repository(forward slash)` forward slash/`

/

# README.md

Copy path

Blame

More file actions

Blame

More file actions

## Latest commit

![ericzakariasson](https://avatars.githubusercontent.com/u/25622412?v=4&size=40)![cursoragent](https://avatars.githubusercontent.com/u/199161495?v=4&size=40)

[ericzakariasson](https://github.com/cursor/plugin-template/commits?author=ericzakariasson)

and

[cursoragent](https://github.com/cursor/plugin-template/commits?author=cursoragent)

[Simplify README](https://github.com/cursor/plugin-template/commit/8cbb16496a1d03986f72cd7123f6d6a0a17dcc8e)

Open commit details

6 months agoFeb 11, 2026

[8cbb164](https://github.com/cursor/plugin-template/commit/8cbb16496a1d03986f72cd7123f6d6a0a17dcc8e) · 6 months agoFeb 11, 2026

## History

[History](https://github.com/cursor/plugin-template/commits/main/README.md)

Open commit details

[View commit history for this file.](https://github.com/cursor/plugin-template/commits/main/README.md) History

34 lines (22 loc) · 1.5 KB

/

# README.md

Copy path

Top

## File metadata and controls

- Preview

- Code

- Blame


34 lines (22 loc) · 1.5 KB

[Raw](https://github.com/cursor/plugin-template/raw/refs/heads/main/README.md)

Copy raw file

Download raw file

You must be signed in to make or propose changes

More edit options

Outline

Edit and raw actions

# Cursor plugin template

[Permalink: Cursor plugin template](https://github.com/cursor/plugin-template/blob/main/README.md#cursor-plugin-template)

Build and publish Cursor Marketplace plugins from a single repo.

Two starter plugins are included:

- **starter-simple**: rules and skills only
- **starter-advanced**: rules, skills, agents, commands, hooks, MCP, and scripts

## Getting started

[Permalink: Getting started](https://github.com/cursor/plugin-template/blob/main/README.md#getting-started)

[Use this template](https://github.com/cursor/plugin-template/generate) to create a new repository, then customize:

1. `.cursor-plugin/marketplace.json`: set marketplace `name`, `owner`, and `metadata`.
2. `plugins/*/.cursor-plugin/plugin.json`: set `name` (lowercase kebab-case), `displayName`, `author`, `description`, `keywords`, `license`, and `version`.
3. Replace placeholder rules, skills, agents, commands, hooks, scripts, and logos.

To add more plugins, see `docs/add-a-plugin.md`.

## Single plugin vs multi-plugin

[Permalink: Single plugin vs multi-plugin](https://github.com/cursor/plugin-template/blob/main/README.md#single-plugin-vs-multi-plugin)

This template defaults to **multi-plugin** (multiple plugins in one repo).

For a **single plugin**, move your plugin folder contents to the repository root, keep one `.cursor-plugin/plugin.json`, and remove `.cursor-plugin/marketplace.json`.

## Submission checklist

[Permalink: Submission checklist](https://github.com/cursor/plugin-template/blob/main/README.md#submission-checklist)

- Each plugin has a valid `.cursor-plugin/plugin.json`.
- Plugin names are unique, lowercase, and kebab-case.
- `.cursor-plugin/marketplace.json` entries map to real plugin folders.
- All frontmatter metadata is present in rule, skill, agent, and command files.
- Logos are committed and referenced with relative paths.
- `node scripts/validate-template.mjs` passes.
- Repository link is ready for submission to the Cursor team (Slack or `kniparko@anysphere.com`).

You can’t perform that action at this time.