# Research Notes: Grok Bot Agentic Commerce

**Status:** complete
**Depth:** Deep

## Plan

- **Question:** What must Coin Railz do for Grok Bot agents to discover, safely invoke, and eventually pay for its services?
- **Scope:** First-party Grok discovery and connector controls, Cursor/Agent Plugin distribution, MCP interoperability, x402 and payment boundaries, security, user activation, and Coin Railz measurement.
- **Audience:** Coin Railz founder and technical leadership.
- **Deliverable:** Deep, source-linked founder briefing with a concrete readiness checklist, experiment gates, and explicit unknowns.

## Focus Areas

| # | Area | Status | Sources |
|---|---|---|---|
| 1 | Official Grok discovery, connectors, and access controls | complete | xAI Grok connectors, Bot overview, connector management |
| 2 | Cursor plugins and cross-agent distribution | complete | Cursor Grok Bot plugin help, plugins, MCP |
| 3 | MCP interoperability and remote-server requirements | complete | MCP 2026-07-28 lifecycle and authorization specs |
| 4 | x402, wallets, approval, and secure payment boundaries | complete | xAI approvals, Stripe/Link, x402 v2 |
| 5 | Coin Railz readiness, activation, and measurement | complete | public production probes and project evidence |

## Coverage Checklist

- [x] Can Grok Bot browse, use applications, and work in the background?
- [x] Can it complete shopping workflows and reach checkout?
- [x] Can it authorize payment without a person?
- [x] What payment rails are verified, reported, or absent?
- [x] Does it support MCP or x402?
- [x] What safety and credential boundaries apply?
- [x] Has Coin Railz observed Grok-originated traffic or payment?
- [x] Should Coin Railz build a Grok-specific integration now?
- [x] What exact supported mechanism lets a Grok user discover or add a third-party MCP service?
- [x] What must a hosted MCP server, plugin, auth flow, and tool description provide for reliable Grok use?
- [x] Can any supported Grok path satisfy Coin Railz's x402 payment challenge, or is an API-key/trial flow required?
- [x] Which distribution route can reach Grok users without a direct xAI partnership?
- [x] What is the minimum safe experiment and what evidence would justify broader investment?

## Findings Log

- Grok Bot is a persistent cloud-computer agent that uses browser sessions, command-line tools, files, and connectors.
- Bots on one user account share browser sessions, files, and command-line credentials; they are not security boundaries.
- Official xAI guidance puts purchases, transfers, payment confirmations, passwords, two-factor authentication, and CAPTCHAs behind explicit approval or human takeover.
- A public user walkthrough demonstrates cart building, product selection, CAPTCHA takeover, delivery-slot selection, and a supervised final payment.
- Stripe independently offers Link agent wallets with one-time-use credentials and biometric approval for every purchase.
- One media report claims a direct Grok Bot–Stripe Link integration; no primary xAI or Stripe announcement naming that integration was found.
- All Grok users can add a public custom MCP connector at `grok.com/connectors`; Business and Enterprise require an administrator to provision it before members can connect.
- xAI's Grok Bot overview says Bots can use connectors/MCP where available, linking the connector path to the Bot product.
- Cursor officially documents a Plugins sidebar inside Grok Bot. This proves UI-based plugin installation for plugins surfaced to the account, not that every Cursor Marketplace listing is automatically available.
- xAI API remote MCP and the Grok developer/CLI plugin system are separate surfaces. Neither should be cited as proof of Grok Bot behavior.
- xAI's API remote MCP client supports Streaming HTTP and SSE, optional authorization/additional headers, server descriptions, and tool allowlists.
- Coin Railz's public `POST /mcp` successfully initializes and lists 80 tools. Its descriptions include prices, read-only annotations, input schemas, and quick-start metadata.
- Coin Railz currently negotiates MCP `2024-11-05` and returns method-not-found for `server/discover`.
- MCP `2026-07-28` introduced mandatory `server/discover`; the current Coin Railz response saying it is not an MCP method is now stale.
- Coin Railz's current `GET /mcp` returns the website HTML rather than an MCP transport response. This is not known to block xAI's POST-based connection, but it is not clean Streamable HTTP behavior.
- Coin Railz has public server-card and MCP manifests, but xAI's documented install path requires the user or administrator to enter the MCP URL; passive manifests alone do not create Grok discovery.
- Exposing all 80 tools at once is a model-context and selection-quality risk. xAI recommends narrow tool allowlists; the first workflow should expose only the five read-only diligence tools.
- Trial/API-key access is the only defensible first payment path. No official source establishes native Grok x402 signing, Base USDC wallet custody, EIP-3009, or automatic paid retry.
- No official Grok Bot documentation was found for a native crypto wallet, x402 signing/retry, autonomous stablecoin settlement, agent-card payment discovery, or unattended spending.
- An unrelated third-party project named grok-cli implements x402; it is not evidence about xAI Grok Bot.
- Coin Railz production telemetry showed no Grok/xAI/Cursor fingerprint in the last 30 days; MCP client identity is not currently captured.

## Conflicts & Open Questions

- The direct Grok Bot–Stripe Link integration is reported by secondary media but not confirmed by a primary xAI or Stripe source found in this review.
- A Bot can execute the shopping workflow, but payment remains human-approved; this is assisted agentic commerce rather than autonomous economic agency.
- Custom MCP is documented for all Grok users, with administrator provisioning on Business/Enterprise; no end-to-end Coin Railz call from Grok Bot has been demonstrated.
- No official xAI page says verbatim that every connector added at `grok.com/connectors` becomes available to every Bot. The supported reading combines the connectors page with the Bot overview's “connectors/MCP where available.”
- Cursor's Grok Bot plugin documentation establishes the plugin UI and team governance, but it does not guarantee that a future Coin Railz Marketplace listing will be surfaced to every Grok Bot account.
- The July 2026 MCP discovery addition conflicts with Coin Railz's current explicit rejection of `server/discover`; compatibility must be tested after the server is updated.

## Gaps

- No authorized Grok Bot account was available for a live Coin Railz compatibility test.
- Generic or missing user-agent strings could hide Grok-originated browser traffic.
- Current MCP telemetry does not preserve a reliable client name, so absence of a fingerprint is not proof of absence.
- No authorized Grok Bot account was available to verify connector setup fields, API-key header support, tool selection, or trial-key use end to end.
- No primary xAI or Stripe source was found confirming the reported direct Grok Bot–Link integration.
- No official evidence establishes autonomous x402 payment from Grok Bot.

## Final Output

- Founder brief: `research/coinrailz-grok-bot-readiness-2026-08-29.md`
- Product-boundary evidence: `research/sources/gapfill-grok-bot-boundary-01.md` through `-04.md`
- Product-boundary excerpts: `research/sources/gapfill-grok-bot-boundary-snippets.md`