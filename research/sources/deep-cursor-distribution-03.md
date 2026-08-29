Source: https://docs.customer.io/ai/plugins/cursor-grok-bot/
Title: Customer.io plugin for Cursor and Grok bot - Customer.io Documentation
Fetched: 2026-08-29T17:32:15.872Z

10

# Customer.io plugin for Cursor and Grok bot

Copy pageCopyCopy linkCopy link[View MarkdownMarkdown](https://docs.customer.io/ai/plugins/cursor-grok-bot.md)Ask your LLMAsk LLM

Install the official Customer.io plugin in Cursor or Grok bot to add the Customer.io MCP connector and skills so your agent can work in your workspace.

Connect Cursor or Grok bot to your Customer.io workspace with the official **Customer.io** plugin. It adds the Customer.io MCP connector and skills so your agent can work with automations, profiles, Design Studio, Pipelines, and SDKs—right inside your editor. The same plugin works in both Cursor and Grok bot; the steps below use Cursor’s UI, and the [Grok bot](https://docs.customer.io/ai/plugins/cursor-grok-bot/#using-grok-bot) flow is equivalent.

You need a Customer.io account with MCP enabled. Your editor installs the plugin; you still **Connect** once to authorize workspaces and permission scopes.

Other editors

Using Windsurf, VS Code, or the Gemini CLI instead? See [Cursor and other IDEs](https://docs.customer.io/ai/mcp/ide/).

## Before you start [Copy link to "Before you start"](https://docs.customer.io/ai/plugins/cursor-grok-bot/\#before-you-start)

- A **Customer.io account** with MCP enabled. If MCP is off, ask an account admin to turn it on. See [Get started with MCP](https://docs.customer.io/ai/mcp/get-started/) for the toggle, permission scopes, and live-data settings.
- **Cursor Desktop**.
- If you already connected Customer.io under **Settings > Tools & MCP** or in `~/.cursor/mcp.json`, remove that server first. See [Already using MCP in Cursor?](https://docs.customer.io/ai/plugins/cursor-grok-bot/#already-using-mcp-in-cursor).

## Install the plugin [Copy link to "Install the plugin"](https://docs.customer.io/ai/plugins/cursor-grok-bot/\#install-the-plugin)

1. Open the [Cursor Marketplace ↗](https://cursor.com/marketplace).
2. Install **Customer.io**.
3. Reload the window if Cursor asks you to.

## Connect your account [Copy link to "Connect your account"](https://docs.customer.io/ai/plugins/cursor-grok-bot/\#connect-your-account)

1. Go to **Settings > Tools & MCP**.
2. Connect the **customerio** server.
3. Complete Customer.io OAuth. Choose the workspaces and permission scopes you want to grant, then allow access. See [permission scopes](https://docs.customer.io/ai/mcp/get-started/#permission-scopes-for-mcp-users) for details.
4. Confirm Cursor shows a single Customer.io server named `customerio`.

You should see the Customer.io consent screen, then a connected server. If Connect opens a GitHub “search issues” page instead, see [Troubleshooting](https://docs.customer.io/ai/plugins/cursor-grok-bot/#troubleshooting).

The connector is `mcp.customer.io`. After you log in, the session uses your account’s home region automatically—EU and US accounts use the same **Connect** button. You never pick a data center or type a region-specific URL.

## What you can ask [Copy link to "What you can ask"](https://docs.customer.io/ai/plugins/cursor-grok-bot/\#what-you-can-ask)

Once you’re connected, describe what you want in plain language. A few examples:

- List my Customer.io workspaces—which region am I on?
- List the active automations in my workspace.
- Find people who haven’t opened an email in 30 days and create a win-back segment.
- Draft or review a Design Studio welcome email.
- Add a JavaScript or React Native source in Pipelines.
- Set up Customer.io for my React Native app.

The agent looks up Customer.io skills and API schema instead of guessing endpoints, and it previews writes with a dry run before changing anything. When it does make a live change, Cursor shows you an approval first.

The plugin’s skills cover:

- **Journeys** — automations, profiles, segments, broadcasts, transactional, and in-app messages
- **Design Studio** — emails, components, global styles, review, and publish
- **Pipelines** — sources, destinations, reverse ETL, and moving data in and out
- **SDKs** — JavaScript and mobile SDK setup, sandbox testing, and going live

## Using Grok bot [Copy link to "Using Grok bot"](https://docs.customer.io/ai/plugins/cursor-grok-bot/\#using-grok-bot)

The same Customer.io plugin works in Grok bot, which installs plugins from the Cursor Marketplace. Install and connect it the same way:

1. From the [Cursor Marketplace ↗](https://cursor.com/marketplace), install **Customer.io**.
2. In Grok bot’s MCP or tools settings, connect the **customerio** server.
3. Complete Customer.io OAuth—choose your workspaces and permission scopes, then allow access.
4. Confirm a single Customer.io server named `customerio` is connected.

Everything else on this page—example prompts, the single-server guidance, and troubleshooting—applies to Grok bot too. Some menu and button labels may differ from Cursor’s, so match them to Grok bot’s current UI.

## Already using MCP in Cursor? [Copy link to "Already using MCP in Cursor?"](https://docs.customer.io/ai/plugins/cursor-grok-bot/\#already-using-mcp-in-cursor)

If you previously connected Customer.io in Cursor by hand—using **Add to Cursor** in your personal settings or a `mcp.json` edit—switch to the plugin so you’re not running two connections to the same account:

1. Remove the user-level Customer.io / `CustomerIO` server from **Settings > Tools & MCP**, and from `~/.cursor/mcp.json` if it’s there.
2. Install and connect the plugin as described above.

If you need Windsurf, VS Code, or the Gemini CLI, those stay on [Cursor and other IDEs](https://docs.customer.io/ai/mcp/ide/).

## Troubleshooting [Copy link to "Troubleshooting"](https://docs.customer.io/ai/plugins/cursor-grok-bot/\#troubleshooting)

| Symptom | What to do |
| --- | --- |
| No Customer.io plugin in the Marketplace | Make sure you’re on the latest version of Cursor and signed in. |
| Connect shows a GitHub “search issues” page | A user-level MCP is shadowing the plugin. Remove any extra Customer.io servers and keep only the plugin’s `customerio` server. |
| ”Needs login” or you can’t authorize | Confirm an admin enabled [Customer.io MCP](https://docs.customer.io/ai/mcp/get-started/), then retry Connect. |
| The agent can’t see any tools | Reload the MCP servers or reload the Cursor window, and confirm **customerio** is connected. |
| Writes are blocked, or you get a 403 about live data | The workspace’s **Allow agent to edit live data** setting is off. That’s an admin setting—see [Get started with MCP](https://docs.customer.io/ai/mcp/get-started/). |
| You have an EU account and worry you need a different URL | You don’t. The `mcp.customer.io` Connect flow selects your region after OAuth. |
| An old `mcp-eu.customer.io` data center setting | Reconnect once on `customerio`. The data center picker was removed. |

The plugin is open source—see [github.com/customerio/cursor-plugin ↗](https://github.com/customerio/cursor-plugin) (MIT).

Was this page helpful?

Updated August 27, 2026

![](https://avatars.githubusercontent.com/u/1152079?s=200&v=4)Ask AI

Loading more...