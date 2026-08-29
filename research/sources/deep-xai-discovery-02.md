Source: https://docs.x.ai/grok/connectors
Title: Connectors | SpaceXAI Docs
Fetched: 2026-08-29T17:32:35.201Z

#### [Grok](https://docs.x.ai/grok/connectors\#grok)

# [Connectors](https://docs.x.ai/grok/connectors\#connectors)

Copy for LLM [View as Markdown](https://docs.x.ai/grok/connectors.md)

[Meet grok-4.6](https://x.ai/news/grok-4-6)

Connectors are available to all Grok users and let Grok access your external tools and data sources directly within a conversation. Search your email, browse files in cloud storage, check your calendar, and more without leaving the chat.

For Grok Business and Enterprise users, a team admin must first provision a connector in the [cloud console](https://docs.x.ai/grok/connector-management) before it is available to members of the organization.

There are three kinds of connectors:

## [Built-in connectors](https://docs.x.ai/grok/connectors\#built-in-connectors)

Built-in connectors are maintained by xAI and integrate natively with Grok. Each one authenticates via OAuth, so you connect once and Grok can access your data on demand. No configuration beyond the initial sign-in is required.

The following built in connectors are available:

| Connector | What it connects |  |
| --- | --- | --- |
| **Gmail & Google Calendar** | Gmail messages and Google Calendar events | [See details](https://docs.x.ai/grok/connectors/gmail-google-calendar) |
| **Google Drive** | Google Drive files, Docs, Sheets, and Slides | [See details](https://docs.x.ai/grok/connectors/google-drive) |
| **OneDrive** | Microsoft OneDrive personal storage | [See details](https://docs.x.ai/grok/connectors/onedrive) |
| **Outlook Mail & Calendar** | Outlook email and calendar events | [See details](https://docs.x.ai/grok/connectors/outlook) |
| **Microsoft Teams** | Microsoft Teams messages, channels, and chats | [See details](https://docs.x.ai/grok/connectors/microsoft-teams) |
| **SharePoint** | Microsoft SharePoint sites and document libraries | [See details](https://docs.x.ai/grok/connectors/sharepoint) |
| **Salesforce** | Salesforce CRM - explore objects, query records, create and update | [See details](https://docs.x.ai/grok/connectors/salesforce) |

To add a builtin connector:

1. Go to [grok.com/connectors](https://grok.com/connectors).
2. Click **New Connector** and select the service you want to connect.
3. Complete the OAuth sign-in flow. Grok will request only the permissions it needs.

Once connected, Grok can use the connector's tools automatically whenever your questions relate to that service.

## [Connector catalog](https://docs.x.ai/grok/connectors\#connector-catalog)

In addition to the built-in connectors, Grok provides a catalog of pre-configured OAuth connectors for many popular third-party services. These require no extra setup beyond signing in.

Browse the full catalog at [grok.com/connectors](https://grok.com/connectors).

**Notable connectors available in the catalog**

| Connector | What it connects |
| --- | --- |
| **Box** | Files, folders, and content in Box |
| **Canva** | Designs, presentations, and visual assets in Canva |
| **Gamma** | Presentations and documents created in Gamma |
| **GitHub** | Repositories, issues, pull requests, and code in GitHub |
| **Linear** | Issues, projects, and roadmaps in Linear |
| **Meltwater** | Media and social intelligence — news articles, social posts, live metrics, trends, and sentiment. Requires an active Meltwater subscription. |
| **Notion** | Pages, databases, and workspaces in Notion |
| **S&P Global** | Financial data, market intelligence, and company information |
| **Vercel** | Projects, deployments, and logs in Vercel |

## [Custom MCP connectors](https://docs.x.ai/grok/connectors\#custom-mcp-connectors)

If you need to connect Grok to a service not available in the catalog, you can bring your own [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server. MCP is an open standard that lets AI assistants interact with external tools and data sources through a unified protocol.

With a custom MCP connector you can:

- Expose any internal API, database, or SaaS tool to Grok.
- Define your own tools with custom schemas and logic.
- Control authentication and access on your own infrastructure.

To add a custom MCP connector:

1. Go to [grok.com/connectors](https://grok.com/connectors).
2. Click **New Connector**, then select **Custom**.
3. Enter the MCP server URL and complete any required authentication.

Grok will discover the tools your MCP server exposes and make them available in conversations, just like the built-in and catalog connectors.

Your MCP server must be reachable over the public internet. If it is running on your local machine, you will need a tunneling service to make it accessible. See [Custom MCP Server Tunneling](https://docs.x.ai/grok/connectors/custom-mcp-tunneling) for setup instructions.

* * *

Last updated: July 17, 2026