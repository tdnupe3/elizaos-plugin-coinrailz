Source: https://docs.x.ai/grok/connector-management
Title: Connector Management | SpaceXAI Docs
Fetched: 2026-08-29T02:40:38.666Z

#### [Grok Business / Enterprise](https://docs.x.ai/grok/connector-management\#grok-business--enterprise)

# [Connector Management](https://docs.x.ai/grok/connector-management\#connector-management)

Copy for LLM [View as Markdown](https://docs.x.ai/grok/connector-management.md)

[Meet grok-4.6](https://x.ai/news/grok-4-6)

**On Grok Business and Enterprise plans, a team admin must add a connector in the cloud console before team members can connect and use it.** This gives your organization control over which external services Grok can access.

Access the connectors page by logging into [console.x.ai](https://console.x.ai/?utm_source=docs&utm_medium=referral&utm_campaign=grok-connector-management&utm_content=console-home), selecting your team, and navigating to **Grok Business → Connectors**. Actions like adding or removing connectors require team management permissions—see the [Permissions](https://docs.x.ai/grok/connector-management#permissions) section for details.

![Grok Business connectors page showing your team's available connectors](https://docs.x.ai/_next/image?url=%2Fassets%2Fdocs%2Fgrok-business%2Fconnector-management.png&w=1920&q=75&dpl=b1d4248aa2d76f78be8d304a69265e186e77dc09)

* * *

## [Adding connectors](https://docs.x.ai/grok/connector-management\#adding-connectors)

Team admins can provision connectors from the catalog or add a custom MCP server.

To add a connector from the catalog:

1. On the connectors page, click **\+ Add Connector**.
2. Select the service you want to enable for your team.
3. Complete any required setup steps—some connectors need additional configuration, such as admin consent for Microsoft services. See the connector-specific docs linked below for details.

Once added, the connector appears in your team's available connectors list. Team members can then connect their own accounts on [grok.com/connectors](https://grok.com/connectors).

To add a custom MCP server:

1. On the connectors page, click **\+ Add Connector**.
2. Select **Other** and enter your MCP server URL.
3. Complete any required authentication.

See [Custom MCP Tunneling](https://docs.x.ai/grok/connectors/custom-mcp-tunneling) if your server runs on a local machine.

* * *

## [Managing connectors](https://docs.x.ai/grok/connector-management\#managing-connectors)

After a connector is provisioned, admins can manage it from the connectors page:

- **Configure** — Open a connector's settings to adjust access controls, allowed sites, or other service-specific options.
- **Remove** — Delete a connector from your team. Team members will no longer be able to connect or use it, and any indexed data associated with the connector may be removed.

Some connectors require additional admin setup beyond the initial add step. Refer to the dedicated guides for service-specific instructions:

| Connector | Setup guide |
| --- | --- |
| **SharePoint** | [See details](https://docs.x.ai/grok/connectors/sharepoint) |
| **OneDrive** | [See details](https://docs.x.ai/grok/connectors/onedrive) |
| **Salesforce** | [See details](https://docs.x.ai/grok/connectors/salesforce) |

For a full list of available connectors, see the [Connectors overview](https://docs.x.ai/grok/connectors).

* * *

## [Permissions](https://docs.x.ai/grok/connector-management\#permissions)

Adding and removing connectors requires **Team Read-Write** permissions. This is typically granted to team admins.

If you lack permissions, contact your team admin to provision the connectors your organization needs.

**Need Help?** For white-glove support, Enterprise upgrades, or connector setup
assistance, contact xAI sales at **[x.ai/grok/business/enquire](https://x.ai/grok/business/enquire)**.

* * *

Last updated: June 14, 2026