Source: https://cursor.com/docs/plugins
Title: Plugins | Cursor Docs
Fetched: 2026-08-29T02:47:51.502Z

[Skip to main content](https://cursor.com/docs/plugins#main-content)

## Command Palette

Search for a command to run...

## Get Started

[Welcome](https://cursor.com/docs) [Quickstart](https://cursor.com/docs/get-started/quickstart)
Models & Pricing
[Changelog](https://cursor.com/changelog)

## Agent

[Overview](https://cursor.com/docs/agent/overview) [Agents Window](https://cursor.com/docs/agent/agents-window) [Agent Review](https://cursor.com/docs/agent/agent-review) [Planning](https://cursor.com/docs/agent/plan-mode) [Prompting](https://cursor.com/docs/agent/prompting) [Debugging](https://cursor.com/docs/agent/debug-mode) [Design Mode](https://cursor.com/docs/agent/design-mode)
Tools

Security

## Customize

[Overview](https://cursor.com/docs/customize-cursor) [Plugins](https://cursor.com/docs/plugins) [Rules](https://cursor.com/docs/rules) [Skills](https://cursor.com/docs/skills) [Subagents](https://cursor.com/docs/subagents) [Hooks](https://cursor.com/docs/hooks) [MCP](https://cursor.com/docs/mcp)

## Cloud Agents

[Overview](https://cursor.com/docs/cloud-agent) [Setup](https://cursor.com/docs/cloud-agent/setup) [Builds](https://cursor.com/docs/cloud-agent/builds)
Capabilities
[Best Practices](https://cursor.com/docs/cloud-agent/best-practices) [Automations](https://cursor.com/docs/cloud-agent/automations) [Bugbot](https://cursor.com/docs/bugbot) [Security Agents](https://cursor.com/docs/security-agents) [PR Routing & Approval](https://cursor.com/docs/approval-agents) [Mobile](https://cursor.com/docs/cloud-agent/mobile)
Security
[Settings](https://cursor.com/docs/cloud-agent/settings) [API](https://cursor.com/docs/cloud-agent/api/endpoints)

## Origin

[Overview](https://cursor.com/docs/origin)
CLI
[Create a repository](https://cursor.com/docs/origin/create-repository) [Clone, Push & Pull](https://cursor.com/docs/origin/git) [Mirror GitHub](https://cursor.com/docs/origin/mirror-github) [Pull requests](https://cursor.com/docs/origin/pull-requests) [Browse & Search](https://cursor.com/docs/origin/browse) [Settings](https://cursor.com/docs/origin/settings) [Codebase settings](https://cursor.com/docs/origin/codebase-settings) [Integrations](https://cursor.com/docs/origin/integrations)

## Integrations

[Slack](https://cursor.com/docs/integrations/slack) [Microsoft Teams](https://cursor.com/docs/integrations/microsoft-teams) [Jira](https://cursor.com/docs/integrations/jira) [Linear](https://cursor.com/docs/integrations/linear) [Notion](https://cursor.com/docs/integrations/notion) [GitHub](https://cursor.com/docs/integrations/github) [GitLab](https://cursor.com/docs/integrations/gitlab) [Azure DevOps](https://cursor.com/docs/integrations/azure-devops) [Bitbucket](https://cursor.com/docs/integrations/bitbucket) [JetBrains](https://cursor.com/docs/integrations/jetbrains) [Xcode](https://cursor.com/docs/integrations/xcode) [Deeplinks](https://cursor.com/docs/reference/deeplinks)

## SDK

[TypeScript](https://cursor.com/docs/sdk/typescript) [Python](https://cursor.com/docs/sdk/python) [Bridge](https://cursor.com/docs/sdk/bridge) [Changelog](https://cursor.com/docs/sdk/changelog)

## CLI

[Overview](https://cursor.com/docs/cli/overview) [Installation](https://cursor.com/docs/cli/installation) [Capabilities](https://cursor.com/docs/cli/using) [Changelog](https://cursor.com/docs/cli/changelog) [Shell Mode](https://cursor.com/docs/cli/shell-mode) [ACP](https://cursor.com/docs/cli/acp) [Headless / CI](https://cursor.com/docs/cli/headless)
Reference

## Teams & Enterprise

Teams

Enterprise

Customize

# Plugins

Plugins package rules, skills, agents, commands, MCP servers, and hooks into distributable bundles.

Cursor supports the [Agent Plugins](https://agent-plugins.org/) open standard alongside its own plugin format. Install and manage them from the [Customize](https://cursor.com/docs/customize-cursor) page or browse official plugins in the [Cursor Marketplace](https://cursor.com/marketplace). For community plugins and MCP servers, browse [cursor.directory](https://cursor.directory/). You can also [build your own](https://cursor.com/docs/plugins#creating-plugins) to share with other developers.

media loading

### Network Error

A network error caused the media download to fail.



PlayPause

en0:00

en0:00

PlayPause10

Seek backward
10
10

Seek forward
10
0:00 / 0:00

MuteUnmute

Quality1x

Playback rate

Audio

Captions

start airplaystop airplay

Start castingStop casting

Enter picture in picture modeExit picture in picture mode

Enter fullscreen modeExit fullscreen mode![](https://image.mux.com/lbKgS0200DGdWs00x401tDEaxtxX1lc1yzFZtqw00oTWPib8/thumbnail.webp)

## [What plugins contain](https://cursor.com/docs/plugins\#what-plugins-contain)

A plugin can bundle any combination of these components:

| Component | Available in | Description |
| --- | --- | --- |
| **Rules** | Cursor Plugins | Persistent AI guidance and coding standards (`.mdc` files) |
| **Skills** | Both formats | Specialized agent capabilities for complex tasks |
| **Agents** | Cursor Plugins | Custom agent configurations and prompts |
| **Commands** | Cursor Plugins | Agent-executable command files |
| **MCP Servers** | Both formats | Model Context Protocol integrations |
| **Hooks** | Cursor Plugins | Automation scripts triggered by events |

## [The Agent Plugins standard](https://cursor.com/docs/plugins\#the-agent-plugins-standard)

Plugins bundle reusable components an agent can use. [Agent Plugins](https://agent-plugins.org/)
is the open standard for packaging portable skills and MCP servers, much like
[Agent Skills](https://cursor.com/docs/skills) defines a standard for individual skills. Cursor
supports Agent Plugins alongside Cursor Plugins.

- **Agent Plugins**: spec-conformant plugins with a `plugin.json` manifest at the plugin root, packaging skills and MCP servers
- **Cursor Plugins**: plugins with a `.cursor-plugin/plugin.json` manifest, which add rules, agents, commands, hooks, and [variables](https://cursor.com/docs/reference/plugins#variables)

A plugin that follows the Agent Plugins specification loads in Cursor without changes. Cursor Plugins continue to develop in parallel with the standard, so Cursor-specific components and marketplace features keep working as they do today.

Learn more at [agent-plugins.org](https://agent-plugins.org/) or read the [specification on GitHub](https://github.com/agentplugins/agent-plugins-spec).

## [Cursor Plugin canvases](https://cursor.com/docs/plugins\#cursor-plugin-canvases)

Plugins now ship with prebuilt **canvases**: shared setup templates your team can open and reuse.

- **Hex Canvas** — Build data visualizations. At Cursor, we use the Hex Canvas to explore and share analytics.
- **Atlassian Canvas** — See a realtime view of your issues, projects, and documents from Jira and Confluence.

Open a canvas from an installed plugin in Customize to get a guided starting point instead of configuring everything from scratch.

## [The marketplace](https://cursor.com/docs/plugins\#the-marketplace)

The [Cursor Marketplace](https://cursor.com/marketplace) is where you discover and install official Cursor Plugins. Plugins are distributed as Git repositories and submitted through the Cursor team.

Every plugin is [manually reviewed](https://cursor.com/help/security-and-privacy/marketplace-security) before it's listed. Browse official plugins at [cursor.com/marketplace](https://cursor.com/marketplace) or search by keyword in **Customize**. For community plugins and MCP servers, browse [cursor.directory](https://cursor.directory/).

## [Team marketplaces](https://cursor.com/docs/plugins\#team-marketplaces)

media loading

### Network Error

A network error caused the media download to fail.



PlayPause

en0:00

en0:00

PlayPause10

Seek backward
10
10

Seek forward
10
0:00 / 0:00

MuteUnmute

Quality1x

Playback rate

Audio

Captions

start airplaystop airplay

Start castingStop casting

Enter picture in picture modeExit picture in picture mode

Enter fullscreen modeExit fullscreen mode![](https://image.mux.com/CdVMfFAlX7IT9jlLWEy011I1200TBeR9Ip3JN01xujhjmI/thumbnail.webp)

Team marketplaces are available on Teams and Enterprise plans.
They can distribute Agent Plugins and Cursor Plugins through the same
marketplace.

- Teams plan: up to 1 team marketplace
- Enterprise plan: unlimited team marketplaces

[Contact sales](https://cursor.com/contact-sales?source=docs-plugins) for unlimited team marketplaces and Enterprise admin controls.

Open **Dashboard -> Plugins** to manage Team Marketplaces.

On Enterprise plans, only admins can add team marketplaces from **Dashboard**
**-\> Plugins**.

### [Default team marketplace](https://cursor.com/docs/plugins\#default-team-marketplace)

The **Default** team marketplace connects shared plugins and MCP servers across Cursor. Admins can add Team MCP servers that are already available to Cloud Agents, then make the same servers available for teammates to install and configure in the Agent Window, IDE, and CLI.

Adding a Team MCP server to the Default marketplace does not install or enable it for every developer. Admins still control marketplace access and plugin installation modes. Each developer may also need to authenticate with the MCP provider.

### [Migrate existing Team MCPs](https://cursor.com/docs/plugins\#migrate-existing-team-mcps)

Admins can link standalone Team MCP servers to the Default marketplace:

1. Open **Dashboard -> Integrations & MCP**.
2. Find **Team MCP Servers**.
3. Select **Add to Team Marketplace** in the migration prompt.
4. Open **Dashboard -> Plugins** to review the Default marketplace, its access, and plugin installation modes.

Cursor creates the Default marketplace if needed and links the existing MCP servers to it. The servers remain available to Cloud Agents while teammates gain the option to install and configure them locally.

Removing a linked MCP plugin from the marketplace or deleting the marketplace
can delete the Team MCP server. This removes it for local users and Cloud
Agents. Review the confirmation message before continuing.

### [Marketplace access](https://cursor.com/docs/plugins\#marketplace-access)

Team marketplaces are available to everyone in their team by default. Under **Marketplace Settings -> Marketplace Access**, admins can restrict a marketplace to selected [Organization Groups](https://cursor.com/docs/enterprise/organization-groups). Only members of the marketplace's team who belong to a selected group receive access. Team admins retain access.

### [How does SCIM work?](https://cursor.com/docs/plugins\#how-does-scim-work)

Organization Groups can sync membership from your identity provider through [SCIM](https://cursor.com/docs/account/teams/scim). Manage membership in your identity provider, and Cursor syncs those updates to the Organization Group.

Existing marketplaces that use team-level SCIM directory groups keep that configuration. Cursor does not migrate those assignments automatically. Organizations without Organization Groups continue to use SCIM directory groups.

### [Plugin installation modes](https://cursor.com/docs/plugins\#plugin-installation-modes)

After setting marketplace access, choose how each plugin is distributed to that audience:

- **Default Off**: Developers can find the plugin and choose whether to install it.
- **Default On**: The plugin is installed by default, but developers can opt out.
- **Required**: The plugin is always installed and cannot be uninstalled.

## [Add a team marketplace](https://cursor.com/docs/plugins\#add-a-team-marketplace)

Use this flow to import a GitHub repository as a team marketplace:

1. Go to **Dashboard -> Plugins**.
2. In **Team Marketplaces**, click **Add Marketplace**.
3. Follow the instructions to create a marketplace from scratch, or use "Import from Repo" if importing from GitHub.
4. Add and review plugins using "Add to Marketplace".
5. Under **Marketplace Settings**, set **Marketplace Access**, optionally enable Auto Refresh, then save.

Example repository to try:

- [fieldsphere/cursor-team-marketplace-template](https://github.com/fieldsphere/cursor-team-marketplace-template)

## [Keep plugins up to date](https://cursor.com/docs/plugins\#keep-plugins-up-to-date)

When importing from GitHub, plugins are indexed when you first import the repository. You can refresh plugins in two ways:

- **Automatically**: Turn on **Enable Auto Refresh** to update plugins automatically whenever changes are pushed to the branch the marketplace tracks. This requires the [Cursor GitHub App](https://cursor.com/docs/integrations/github) installed on the repository. Cursor re-indexes a marketplace at most once every 10 minutes, batching rapid pushes to the latest commit.
- **Manually**: Click "Refresh" to manually update.

For marketplaces created with "Import from Repo", Auto Refresh re-reads the full manifest on each push, so new plugins added to the repository are picked up automatically.

For marketplaces where plugins were added individually, Auto Refresh only updates existing plugins. Re-import the repository URL to pick up newly added plugins.

## [Where developers find team marketplaces](https://cursor.com/docs/plugins\#where-developers-find-team-marketplaces)

Developers can find team marketplaces in Customize.

- Open **Customize** in the sidebar
- Look for plugins from your team marketplace.
- Install Default Off plugins directly from that panel.
- Default On plugins are installed automatically, but developers can opt out.
- Required plugins are installed automatically and cannot be uninstalled.
- Install and configure marketplace MCP servers for use in the Agent Window, IDE, and CLI.

## [Installing plugins](https://cursor.com/docs/plugins\#installing-plugins)

Install Agent Plugins and Cursor Plugins from a marketplace. Cursor detects the
format from the plugin manifest, so the installation flow is the same for both:

1. Open **Customize** in the sidebar.
2. Find the plugin you want to use.
3. Select **Install** and choose a project or user scope.

An Agent Plugin has a `plugin.json` manifest at its root. A Cursor Plugin has a
`.cursor-plugin/plugin.json` manifest. Team marketplaces can distribute either
format using the same access and installation modes described above.

You can also develop either format from `~/.cursor/plugins/local`. See
[Test plugins locally](https://cursor.com/docs/plugins#test-plugins-locally) for the folder layout and when
Cursor loads it.

### [MCP Apps deeplinks](https://cursor.com/docs/plugins\#mcp-apps-deeplinks)

Share MCP server configurations using install links:

```
cursor://anysphere.cursor-deeplink/mcp/install?name=$NAME&config=$BASE64_ENCODED_CONFIG
```

See [MCP install links](https://cursor.com/docs/mcp/install-links) for details on generating these links.

## [Managing installed plugins](https://cursor.com/docs/plugins\#managing-installed-plugins)

Open **Customize** in the sidebar to manage installed Agent Plugins, Cursor
Plugins, MCP servers, rules, and skills from one page. Filter by user, workspace,
or team scope to see what is installed.

### [MCP servers](https://cursor.com/docs/plugins\#mcp-servers)

Toggle personal and team-distributed MCP servers on or off from Customize:

1. Open **Customize** in the sidebar
2. Find the MCP server you want to change
3. Use the toggle to enable or disable it

Disabled servers won't load or appear in chat.

### [Rules and skills](https://cursor.com/docs/plugins\#rules-and-skills)

Manage rules and skills from Customize. Toggle individual rules between **Always**, **Agent Decides**, and **Manual** modes. Skills appear in the **Agent Decides** section and can be invoked manually with `/skill-name` in chat.

## [Using the workspaceOpen hook](https://cursor.com/docs/plugins\#using-the-workspaceopen-hook)

A `workspaceOpen` hook can return plugin paths to load on workspace open, which is useful when the set of plugins depends on the workspace itself.

[Hooks reference\\
\\
Register plugin paths from a `workspaceOpen` hook script](https://cursor.com/docs/hooks#workspaceopen)

## [Creating plugins](https://cursor.com/docs/plugins\#creating-plugins)

A plugin is a directory with a manifest and its components. Choose Agent Plugins
when you want to package portable skills and MCP servers. Choose Cursor Plugins
when you also need Cursor-specific components such as rules, agents, commands,
hooks, or variables.

Agent PluginCursor Plugin

```
my-plugin/
├── plugin.json
├── skills/
│   └── code-reviewer/
│       └── SKILL.md
└── mcp.json
```

Agent Plugins require a root `plugin.json` with the standard's schema identifier:

```
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  "name": "my-plugin",
  "description": "Portable code review tools",
  "version": "1.0.0",
  "author": { "name": "Your Name" }
}
```

Start from the [Cursor Plugin template repository](https://github.com/cursor/plugin-template),
or read the [Agent Plugins authoring guide](https://agent-plugins.org/plugin-authors)
to create an Agent Plugin.

### [Test plugins locally](https://cursor.com/docs/plugins\#test-plugins-locally)

Before you publish, put either plugin format in `~/.cursor/plugins/local`:

1. Create a folder for your plugin:
`~/.cursor/plugins/local/my-plugin`
2. Copy your plugin files into that folder. Include either a root `plugin.json`
for an Agent Plugin or `.cursor-plugin/plugin.json` for a Cursor Plugin.
3. Restart Cursor, or run **Developer: Reload Window**.
4. Open **Customize** and confirm the plugin components you expect, such as
rules, skills, or MCP servers.

After a reload, Cursor discovers plugins in this folder if local plugin
imports are allowed.

On Teams and Enterprise, admins control this with **Allow Local Plugin**
**Imports** under **Dashboard -> Settings -> Security & Identity ->**
**Marketplace and Plugins**. The setting is off by default on Enterprise. If a
marketplace plugin with the same name is already installed, that install
takes precedence over the local copy.

For faster iteration, symlink your plugin repository:

```
ln -s /path/to/my-plugin ~/.cursor/plugins/local/my-plugin
```

When your plugin is ready, submit it for review at [cursor.com/marketplace/publish](https://cursor.com/marketplace/publish).
Cursor Plugins can use `.cursor-plugin/marketplace.json` for multi-plugin
repositories.

See the [Plugins reference](https://cursor.com/docs/reference/plugins) for the full manifest schema, component formats, and submission checklist.

Team and Enterprise marketplaces

Upgrade for private team marketplaces and organization-wide plugin distribution.

[Contact Sales](https://cursor.com/contact-sales?source=docs-plugins)

## [FAQ](https://cursor.com/docs/plugins\#faq)

### Are marketplace plugins reviewed for security?

Yes. Every plugin is manually reviewed before it's listed. All plugins must be open source, and we review each update before publishing. See [Marketplace security](https://cursor.com/help/security-and-privacy/marketplace-security) for details on vetting, update reviews, and how to report issues.

### How do I create a plugin?

For a portable Agent Plugin, add a root `plugin.json` manifest and package
skills or MCP servers. For a Cursor Plugin, add a
`.cursor-plugin/plugin.json` manifest and any Cursor components you need.
See the [Plugins reference](https://cursor.com/docs/reference/plugins) for examples of both
formats.

### How do Cursor Plugins relate to the Agent Plugins standard?

[Agent Plugins](https://agent-plugins.org/) is an open, vendor-neutral specification for packaging skills and MCP servers into portable plugins. Cursor supports the standard, so spec-conformant plugins load in Cursor without changes. Cursor Plugins are developed in parallel and add Cursor-specific components like rules, agents, commands, hooks, and variables.

## [Related](https://cursor.com/docs/plugins\#related)

- [Plugins help](https://cursor.com/help/customization/plugins)

English

- English
- 简体中文
- Русский
- 日本語
- Português
- Español