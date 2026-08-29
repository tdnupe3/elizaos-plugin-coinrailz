Source: https://docs.x.ai/grok-bot/teams-and-enterprises
Title: Grok Bot for teams and enterprises | SpaceXAI Docs
Fetched: 2026-08-29T02:46:44.234Z

#### [Manage and protect](https://docs.x.ai/grok-bot/teams-and-enterprises\#manage-and-protect)

# [Grok Bot for teams and enterprises](https://docs.x.ai/grok-bot/teams-and-enterprises\#grok-bot-for-teams-and-enterprises)

Copy for LLM [View as Markdown](https://docs.x.ai/grok-bot/teams-and-enterprises.md)

[Create API key](https://console.x.ai/team/default/api-keys?utm_source=docs&utm_medium=referral&utm_campaign=grok-bot-teams-and-enterprises&utm_content=article-api-key) [Meet grok-4.6](https://x.ai/news/grok-4-6)

Grok Bot gives each person on your team a standing Bot for everyday work:
research, operations, documents, browsing, and automations. This guide is for
team admins and organization admins who roll out Grok Bot and manage its
controls.

## [How Grok Bot works](https://docs.x.ai/grok-bot/teams-and-enterprises\#how-grok-bot-works)

- Each member gets one dedicated cloud computer. The computer is a managed Linux
virtual machine. All of that member's Bots share the same computer, so
files, sign-in sessions, and permissions belong to the member, not to an
individual Bot.
- Members use Grok Bot from the desktop app on macOS and Windows, and from the
mobile app (currently iOS only). They sign in with their Cursor account, so
your existing Cursor SSO and team membership apply.
- Bots work inside the computer. They connect to tools through plugins and MCP
servers, browse the web on their computer, can log in to services in the
computer's web browser, and, with the member's permission, run commands on the
member's local computer.
- You manage admin settings for Grok Bot from the Cursor dashboard. The
**Grok Bot** page holds Grok Bot-specific controls. Your existing Team
Settings, including privacy mode, MCP configuration, and team rules, apply to
Bots. You can additionally configure team-wide settings specific to Grok Bot.

## [Availability](https://docs.x.ai/grok-bot/teams-and-enterprises\#availability)

| Plan | Access |
| --- | --- |
| Individuals | Available with SuperGrok Plus, SuperGrok Heavy, Cursor Pro+, Cursor Ultra, or a one-time trial. |
| Self-serve teams | Available. Standard and Premium seats include a weekly Grok Bot usage allowance. |
| Enterprise organizations | Rolling out. Contact your Cursor account team to join. |

## [Before you roll out](https://docs.x.ai/grok-bot/teams-and-enterprises\#before-you-roll-out)

Check these before members join:

- Your team is not on Privacy Mode (Legacy). That mode blocks Grok Bot entirely.
Check your privacy setting in Team Settings. If enabled, you will be prompted
to change this setting before enabling Grok Bot.
- If your company restricts services by source IP, plan for the computer egress
addresses. See [Network](https://docs.x.ai/grok-bot/teams-and-enterprises#network).
- Decide how members sign in to company tools from the computer. See
[Identity and sign-ins](https://docs.x.ai/grok-bot/teams-and-enterprises#identity-and-sign-ins).
- Review the policies Grok Bot inherits: MCP configuration, team rules, and
Auto-review instructions.

## [Set up your team](https://docs.x.ai/grok-bot/teams-and-enterprises\#set-up-your-team)

1. Open **Grok Bot** in the Cursor dashboard. On your first visit, the setup
wizard starts. It walks through privacy mode, the dedicated desktop, API
pricing, pooled billing, model availability, and premium seats. To run it
again later, choose **Admin setup** on the Grok Bot page.
2. Review **Cloud Agents**. This team-wide toggle controls whether Grok Bot
Bots can launch Cursor cloud agents. It is on by default.
3. Recommended: set your password-manager policy. To enforce a password manager,
install it with a Team Setup script. You can also ask members to enroll a
passkey for company sign-ins. See
[Identity and sign-ins](https://docs.x.ai/grok-bot/teams-and-enterprises#identity-and-sign-ins).

## [Security](https://docs.x.ai/grok-bot/teams-and-enterprises\#security)

### [How isolation works](https://docs.x.ai/grok-bot/teams-and-enterprises\#how-isolation-works)

- Each computer is a managed Linux virtual machine dedicated to one member. The
Bot runs as a non-root user.
- All of a member's Bots share one computer. Secrets, sign-in sessions, and
local-computer permissions apply to the member as a whole, not to a single
Bot.
- Sign-in tokens for hosted MCP servers stay with Cursor's backend, which runs
those tool calls on the computer's behalf. The computer never stores those
tokens.
- Grok Bot's computer is not by default enrolled in mobile device management.
See [Identity and sign-ins](https://docs.x.ai/grok-bot/teams-and-enterprises#identity-and-sign-ins) for what that means for
your identity provider.

### [Local computer access](https://docs.x.ai/grok-bot/teams-and-enterprises\#local-computer-access)

Bots can act on a member's own computer: run commands, read files, and move
files between the cloud computer and the local computer. The first local action
asks the member for consent. Every local action then goes through Auto-review,
and the approval card shows the exact command.

Coming soon we will support a team-level ceiling on local execution, with three
levels: Never, Ask every time, and Always. When you set a ceiling, members can
choose a stricter option, but not a looser one.

### [Network](https://docs.x.ai/grok-bot/teams-and-enterprises\#network)

- Computers reach the internet through static egress IP addresses. If your
company restricts services by source IP, ask your account team for the current
ranges.

### [Manage member computers](https://docs.x.ai/grok-bot/teams-and-enterprises\#manage-member-computers)

Organization admins can inspect and remove member computers. Team admin rights
are not enough, because a computer is shared across every team the member
belongs to.

To manage a computer, open **Grok Bot**, then **computers** in the dashboard,
and look up the member. **Kill** deletes the running virtual machine. Durable
storage is kept, and the member's next session creates a fresh computer.

Members can reset their own computer from the desktop app. Reset recreates the
computer and keeps its data. The mobile apps cannot reset a computer.

### [Team rules](https://docs.x.ai/grok-bot/teams-and-enterprises\#team-rules)

Team rules from the dashboard apply to Grok Bot. Scope each rule to Cursor, Grok
Bot, or both. Scoped rules are always in the Bot's context. Members
personalize their Bots with memories rather than personal rules.

Keep rules short and few. For example: "do not create personal access tokens",
"do not create new Slack apps", "never move company data to personal accounts".
For enforcement, use Auto-review instructions instead.

## [Plugins and MCP policy](https://docs.x.ai/grok-bot/teams-and-enterprises\#plugins-and-mcp-policy)

Grok Bot follows your team's existing Cursor plugin and MCP policy. There are no
separate Grok Bot plugin controls.

MCP authentication is shared across Cursor + Grok Bot.

Your controls live in Team Settings under **MCP Configuration**:

- **Disable All MCP Commands Globally** turns MCP off for the team.
- A server allowlist and denylist control which servers members can use.
- A setting controls whether members can add their own servers.
- **Require Team Network Allowlist** requires each server's address to be on the
team network allowlist for fine-grained control.

### [Enable a plugin for your team](https://docs.x.ai/grok-bot/teams-and-enterprises\#enable-a-plugin-for-your-team)

1. Cursor admins can enable a plugin on the team plugins page. Enter any secrets
the plugin needs as plugin variables.
2. If your team uses an MCP allowlist, add the plugin's server URL to it. The
allowlist applies to all of the team's marketplaces, including the default
one.

When policy blocks a server, members see it disabled in the Grok Bot Plugins
page with the message "Disabled by team admin". Sign-in attempts for that server
are refused with the same message.

Some vendors restrict their MCP endpoints to their own administrators. If a
plugin fails for regular members with a vendor-side permission error, check the
MCP provider's requirements.

## [Identity and sign-ins](https://docs.x.ai/grok-bot/teams-and-enterprises\#identity-and-sign-ins)

Members sign in to Grok Bot with their Cursor account, so your existing Cursor
SSO configuration applies to Grok Bot.

Sign-ins inside the computer work differently. The computer is a Linux Virtual
Machine, and device-trust agents such as Okta FastPass are not available for it
natively. We recommend configuring the computer as needed depending on the
security policies that are most applicable to your organization. Enforce these
policies with install scripts.

Hardware security keys work from the computer: WebAuthn prompts in the computer
browser are forwarded to the member's desktop app and their physical key.
Windows support for physical security keys is in progress.

## [Models and providers](https://docs.x.ai/grok-bot/teams-and-enterprises\#models-and-providers)

Grok Bot has no model picker, for members or admins. We do not plan to allow
admin or user choice for models that are used with Grok Bot. Model choice is
fully managed by the product.

Each request routes to a fixed set of models for its surface, with automatic
failover. If your contract limits which subprocessors can handle your data,
contact your account team before rolling out Grok Bot.

Usage analytics show the model that actually served each request, including
failovers. Billing follows the actual serving model.

## [Privacy and data](https://docs.x.ai/grok-bot/teams-and-enterprises\#privacy-and-data)

- While a member is on your team, the team's privacy mode applies to them.
- Privacy Mode (Legacy) blocks Grok Bot entirely. Members on such teams see
"Privacy Mode (Legacy) blocks Grok Bot" and a prompt to ask an admin.
- Data training follows your team's privacy settings, the same as Cursor
settings.
- Spend and usage appear on the dashboard usage page. An audit view of Bot
actions is coming.

## [Usage and billing](https://docs.x.ai/grok-bot/teams-and-enterprises\#usage-and-billing)

- See spend at
[cursor.com/dashboard/usage](https://cursor.com/dashboard/usage), broken down
by product. Invoices combine Cursor and Grok Bot charges; the per-product
split is on the dashboard.
- There is no Grok Bot-specific spend cap yet. Account-level on-demand controls
still apply.

## [FAQ](https://docs.x.ai/grok-bot/teams-and-enterprises\#faq)

### [Can I turn Grok Bot on or off for my team?](https://docs.x.ai/grok-bot/teams-and-enterprises\#can-i-turn-grok-bot-on-or-off-for-my-team)

Yes – you can enable or disable Grok Bot for your organization in the Cursor
Dashboard.

### [Can I restrict which models Grok Bot uses?](https://docs.x.ai/grok-bot/teams-and-enterprises\#can-i-restrict-which-models-grok-bot-uses)

No. Grok Bot uses a fixed, published set of models and providers with automatic
failover. There is no per-team model list. If your contract restricts
subprocessors, contact your account team.

### [Why does a member see "Disabled by team admin" on a plugin?](https://docs.x.ai/grok-bot/teams-and-enterprises\#why-does-a-member-see-disabled-by-team-admin-on-a-plugin)

Your team's MCP policy blocks that server. Enable the plugin on the team plugins
page, add its server URL to your MCP allowlist if you use one, and ask the
member to restart the app.

### [Does privacy mode affect Grok Bot?](https://docs.x.ai/grok-bot/teams-and-enterprises\#does-privacy-mode-affect-grok-bot)

Privacy Mode (Legacy) blocks it entirely. Standard privacy modes work. While a
member is on your team, the team's privacy mode governs; members cannot weaken
it.

### [How do members request access?](https://docs.x.ai/grok-bot/teams-and-enterprises\#how-do-members-request-access)

Members can send a request from the app.

### [Can I see what Bots did on behalf of my team?](https://docs.x.ai/grok-bot/teams-and-enterprises\#can-i-see-what-bots-did-on-behalf-of-my-team)

Spend and usage are on the dashboard today. An audit view of Bot actions is
coming.

### [Can I set a Grok Bot spend cap?](https://docs.x.ai/grok-bot/teams-and-enterprises\#can-i-set-a-grok-bot-spend-cap)

Not yet. Account-level on-demand controls still apply, and per-product spend is
on the dashboard usage page.

### [Why do members have to sign in to company tools again?](https://docs.x.ai/grok-bot/teams-and-enterprises\#why-do-members-have-to-sign-in-to-company-tools-again)

Sign-in sessions inside the computer can drop when the computer is recreated or
its network address changes. Passkeys in the computer's password manager make
re-signing in fast. The beta setting that routes computer traffic through the
member's computer also helps.

### [Do hardware security keys work from the computer?](https://docs.x.ai/grok-bot/teams-and-enterprises\#do-hardware-security-keys-work-from-the-computer)

Yes. WebAuthn prompts in the computer browser are forwarded to the member's
desktop app and their physical key. Windows support for this forwarding is
rolling out.

### [Why do some websites block the Bot?](https://docs.x.ai/grok-bot/teams-and-enterprises\#why-do-some-websites-block-the-bot)

Some services flag datacenter IP addresses. Allowlist the Grok Bot egress ranges
on your own services, or have the member try the beta setting that routes
computer traffic through their own computer.

### [Is there a Linux desktop app?](https://docs.x.ai/grok-bot/teams-and-enterprises\#is-there-a-linux-desktop-app)

No. Computers run Linux, but the desktop app ships for macOS and Windows, plus
the mobile apps.

### [Does each Bot get its own computer?](https://docs.x.ai/grok-bot/teams-and-enterprises\#does-each-bot-get-its-own-computer)

No. Each member gets one computer, shared by all of their Bots. Sign-ins,
files, and local-computer permissions belong to the member, not to a single
Bot.

* * *

Last updated: August 20, 2026