# Coin Railz Readiness for Grok Bot Agents

**Research date:** August 29, 2026  
**Audience:** Coin Railz founder and technical leadership  
**Decision:** Make the generic MCP endpoint current-spec compatible, then run one private trial-key test. Do not build a Grok-specific payment adapter.

## Executive decision

Coin Railz has a real, officially documented path into Grok Bot today:

1. An individual Grok user goes to `grok.com/connectors`.
2. The user selects **New Connector → Custom**.
3. The user enters `https://coinrailz.com/mcp` and completes any required authentication.
4. Grok discovers the server's tools and can make them available in conversations.

xAI documents custom MCP connectors for all Grok users. Business and Enterprise accounts add an administrative provisioning step. xAI's Grok Bot overview separately states that Bots can use connectors/MCP “where available.” Together, these are sufficient to justify a private compatibility test. They are not proof that Coin Railz works end to end in Grok Bot today. [[1]](https://docs.x.ai/grok/connectors) [[2]](https://docs.x.ai/grok-bot/overview) [[3]](https://docs.x.ai/grok/connector-management)

Coin Railz already has most of the discovery foundation:

- a public HTTPS MCP endpoint;
- successful `initialize` and `tools/list` responses;
- 80 public tool definitions with schemas and prices;
- read-only annotations and a five-tool quick-start set;
- public MCP manifests and a server card;
- trial/API-key and x402 payment paths;
- MCP funnel telemetry.

The principal blocker is protocol compatibility, not discoverability. Coin Railz currently replies with MCP version `2024-11-05` and explicitly rejects `server/discover`. The July 2026 MCP specification now requires servers to implement `server/discover`. Coin Railz's current error text—“server/discover is not an MCP method”—is stale. [[4]](https://modelcontextprotocol.io/specification/2026-07-28/basic/lifecycle)

The commercial blocker is payment. No official evidence shows Grok Bot signing x402 payments, controlling a Base USDC wallet, producing EIP-3009 authorizations, or automatically retrying a `402 Payment Required` response. xAI keeps purchases, transfers, and payment confirmations behind approval or human takeover. A reported Stripe Link path, even if confirmed, would provide human-approved card credentials, not a Coin Railz-compatible x402 payment signature. [[5]](https://docs.x.ai/grok-bot/approvals-security-and-privacy) [[6]](https://stripe.com/blog/giving-agents-the-ability-to-pay) [[7]](https://support.link.com/questions/link-agent-wallet-faq) [[8]](https://docs.x402.org/core-concepts/http-402)

**Recommendation:** fix generic MCP interoperability first, then validate a focused read-only diligence workflow using a capped trial/API key. Do not build Grok-specific wallet or x402 code until a live client or official interface proves the need.

## What Grok Bot can discover today

### 1. Custom MCP connector: the primary path

xAI says connectors are available to all Grok users and that users can add a custom public MCP server by URL at `grok.com/connectors`. Grok then discovers the server's tools. Business and Enterprise users need a team administrator to provision the connector before members can use it. [[1]](https://docs.x.ai/grok/connectors) [[3]](https://docs.x.ai/grok/connector-management)

The Grok Bot overview says each Bot can use connectors/MCP where available. This is the official bridge from the general Grok connector feature to the Bot product. It retains an availability qualification: plan, tenant, rollout, and administrator policy can still matter. [[2]](https://docs.x.ai/grok-bot/overview)

### 2. Grok Bot Plugins UI: a secondary distribution path

Cursor's official help documentation describes a **Plugins** sidebar in Grok Bot where a user can browse, add, and authorize a plugin. Cursor team administrators control which marketplace plugins are available. [[9]](https://cursor.com/help/grok-bot/connect-plugins)

This supports a future Cursor Marketplace experiment, but only after Coin Railz is actually listed and visible in the Bot's plugin UI. It does not prove that every Cursor Marketplace listing is automatically installable in every Grok Bot account.

### 3. Paths that must not be conflated with Grok Bot

- **xAI API remote MCP:** API developers configure `server_url`, `server_label`, descriptions, authorization, headers, and optional tool allowlists in an API request. This is useful compatibility guidance, but it is an API/SDK surface, not proof of Grok Bot behavior. [[10]](https://docs.x.ai/developers/tools/remote-mcp)
- **Grok developer/CLI plugins and marketplaces:** local `.grok` skills, plugin directories, and CLI marketplace sources are a coding-agent surface. They do not establish cloud Grok Bot support.
- **Passive public manifests:** Coin Railz's `.well-known` documents help registries and generic clients, but xAI's documented self-service flow still requires a user or administrator to add the MCP URL.

## Coin Railz readiness audit

### Already satisfies

| Requirement | Current status | Evidence |
|---|---|---|
| Public HTTPS endpoint | **Pass** | `https://coinrailz.com/mcp` is publicly reachable |
| Streamable HTTP-style JSON-RPC POST | **Mostly pass** | Production `initialize` and `tools/list` return valid JSON-RPC |
| Public tool discovery | **Pass** | `POST /mcp` `tools/list` and `GET /mcp/tools/list` expose 80 tools |
| Clear tool schemas | **Pass** | Tools include input schemas and structured output schemas |
| Read-only signaling | **Pass** | Diligence tools carry `readOnlyHint`, non-destructive, idempotent annotations |
| Price visibility | **Pass** | Descriptions and metadata state per-call USDC prices |
| Focused starter set | **Pass in metadata** | Five quick-start tools are tagged and exposed as a starter resource |
| Trial path | **Pass server-side** | A free trial/API-key path exists |
| Generic x402 v2 server support | **Pass server-side** | Coin Railz emits `PAYMENT-REQUIRED` and accepts `PAYMENT-SIGNATURE` |
| Discovery manifests | **Pass** | MCP manifest and server-card endpoints are public |
| Measurement foundation | **Pass with identity gap** | MCP stages are tracked, but durable client identity is incomplete |

Production probes on August 29, 2026 confirmed:

- `POST /mcp` `initialize`: HTTP 200;
- `POST /mcp` `tools/list`: HTTP 200;
- `GET /mcp/tools/list`: HTTP 200;
- `GET /.well-known/mcp.json`: HTTP 200;
- `POST /mcp` `server/discover`: HTTP 404 / JSON-RPC `-32601`.

### Missing or risky

#### P0 — Current MCP discovery compatibility

Coin Railz advertises protocol version `2024-11-05`. The current MCP lifecycle specification is `2026-07-28` and requires `server/discover`. A newer client has already been observed repeatedly calling that method, while Coin Railz rejects it.

This is the only clear protocol-level defect identified in the research. It should be fixed generically, not behind Grok-specific detection.

#### P0 — A proven Grok authentication path

Coin Railz accepts API keys in `X-API-KEY` or Bearer form, but no authorized Grok Bot account was available to verify which custom-connector authentication controls the UI exposes and whether it safely persists or sends the required header.

The first test should prefer a capped Bearer trial token if the connector UI natively supports authorization. Do not paste a credential into ordinary chat.

#### P1 — Tool overload

Coin Railz exposes 80 tools. xAI warns that all exposed definitions consume model context and recommends `allowed_tools` for narrow access. [[10]](https://docs.x.ai/developers/tools/remote-mcp)

The first Grok workflow should expose or instruct around only:

1. wallet risk;
2. portfolio context;
3. token metadata;
4. token approval review;
5. gas-price context.

The user outcome should be one read-only diligence memo, not “browse 80 APIs.”

#### P1 — Clean transport behavior

`GET /mcp` currently returns Coin Railz website HTML. Streamable HTTP clients primarily use POST, so this is not proven to block Grok. Still, an MCP transport URL should not masquerade as an HTML page. The expected GET behavior should be verified against the current transport specification when implementing compatibility changes.

#### P1 — Authorization standards for broader distribution

Coin Railz has practical API-key authorization, but not a demonstrated MCP OAuth protected-resource flow with `WWW-Authenticate`, protected-resource metadata, scopes, and resource indicators. Current MCP authorization guidance uses those mechanisms. [[11]](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization)

OAuth is not required to run the private test if Grok can send a capped static Bearer credential. It becomes important before broad self-service or enterprise distribution.

#### P1 — Client attribution

Current telemetry can distinguish MCP funnel stages but cannot reliably prove “this was Grok Bot.” The initialize payload's client name/version and a safe connector/test identifier should be retained so the experiment can be evaluated without relying on generic browser user agents.

## Prioritized no-code readiness checklist

These steps can be completed before implementation:

1. **Choose the direct custom-connector route first.** Use `grok.com/connectors`, not a Grok-specific adapter or direct partnership request.
2. **Get one authorized Grok Bot account.** Confirm that connectors/MCP are available for the account and note whether administrator provisioning is required.
3. **Create one capped test credential.** Use a trial/API key with low value and a short test window. Never place a private key or broadly funded wallet in the Bot's shared computer.
4. **Define the five-tool diligence workflow.** Use the prompt: “Before I interact with this wallet or token, produce a sourced diligence memo and stop before any transaction.”
5. **Write three fixed test cases.** Use known wallets/tokens and expected tool selections so results can be compared.
6. **Record setup friction.** Measure time to add the connector, authenticate, see tools, and complete the first memo.
7. **Inspect production telemetry using the authoritative boundaries.** Tool discovery and challenges are not conversion. Payment requires a successful non-canary row in `x402_payment_intents`; delivery must be tied to the same session.
8. **Do not submit to a marketplace yet.** First prove the direct connector and workflow privately.

## Implementation backlog justified by the research

No code was changed during this research. If implementation is approved, the order should be:

1. Implement MCP `server/discover` and coherent current-version negotiation.
2. Verify Streamable HTTP behavior, including the correct `GET /mcp` response.
3. Capture MCP client identity and version from initialization.
4. Verify or add a safe Bearer-token path that the Grok connector UI can configure.
5. Add OAuth protected-resource discovery only if required for public/enterprise distribution.
6. Package a focused plugin only after the direct connector test passes.

Do not start with a Grok user-agent branch, custom x402 wallet adapter, card-to-USDC bridge, or autonomous-wallet feature.

## Safe compatibility experiment

### Setup

- One authorized Grok Bot account.
- `https://coinrailz.com/mcp` as the custom connector URL.
- One capped trial/API credential.
- Five read-only diligence tools.
- No wallet private key, no exchange credential, no transaction tools.
- Three fixed prompts with expected tools and expected stop-before-transaction behavior.

### Pass criteria

All of the following:

1. Connector setup completes in 10 minutes or less.
2. Initialization, discovery, and tool listing complete without retries or unsupported-method loops.
3. Three of three prompts select the expected tools.
4. At least 90% of expected calls return usable results.
5. The Bot produces a coherent, sourced diligence memo.
6. No credential is entered into ordinary chat or exposed in output.
7. No transaction or payment occurs without explicit human approval.
8. Telemetry identifies the client and ties calls to the same test session.

### Stop criteria

Stop and reassess if:

- `server/discover` or protocol negotiation still prevents connection;
- the connector cannot safely send a capped credential;
- 80-tool overload persists and cannot be narrowed;
- two of three workflows select the wrong tools;
- the test requires a Grok-specific server fork;
- the Bot requests a private key or broadly funded wallet;
- Coin Railz must misrepresent x402 support as native Grok functionality.

## Go/no-go gates

### Go: private connector test

Proceed after generic MCP discovery compatibility is current and an authorized account is available.

### Go: five-user pilot

Proceed only if the private test passes. Success requires at least:

- 3 of 5 users complete a useful memo;
- 2 repeat within 14 days;
- 1 completes a real paid call or makes a concrete paid-pilot commitment.

Installs, tool lists, free trials, and positive comments are not paid conversion.

### Conditional go: Cursor Marketplace

Submit only after the private compatibility test and five-user activation test pass. Treat marketplace approval as distribution, not traction.

### No-go: Grok-specific payment build

Do not build until at least one of these occurs:

- xAI documents a native x402 or programmable wallet interface;
- a controlled Grok Bot test reaches a valid x402 signing boundary;
- an external Grok user reaches paid delivery;
- multiple users explicitly request maintained autonomous payment support.

## Founder conclusion

Coin Railz does not need a Grok-specific integration to become discoverable. It needs a standards-current MCP server, one focused workflow, a safe trial credential, and a measured private test.

The opportunity is credible because the official connector path exists. It is not yet commercial proof because there is no verified Grok-origin paid delivery and no native Grok x402 rail. The rational sequence is:

> **Fix generic discovery → test direct connector → prove workflow value → prove willingness to pay → then package distribution.**

Anything that skips those gates risks mistaking platform compatibility for customer demand.

## Sources

1. [xAI: Connectors](https://docs.x.ai/grok/connectors)
2. [xAI: Grok Bot overview](https://docs.x.ai/grok-bot/overview)
3. [xAI: Grok connector management](https://docs.x.ai/grok/connector-management)
4. [MCP lifecycle specification, 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/lifecycle)
5. [xAI: Grok Bot approvals, security, and privacy](https://docs.x.ai/grok-bot/approvals-security-and-privacy)
6. [Stripe: Giving agents the ability to pay](https://stripe.com/blog/giving-agents-the-ability-to-pay)
7. [Link agent wallet FAQ](https://support.link.com/questions/link-agent-wallet-faq)
8. [x402: HTTP 402 and v2 payment headers](https://docs.x402.org/core-concepts/http-402)
9. [Cursor: Connect plugins to Grok Bot](https://cursor.com/help/grok-bot/connect-plugins)
10. [xAI: Remote MCP tools](https://docs.x.ai/developers/tools/remote-mcp)
11. [MCP authorization specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization)
12. [Cursor: Model Context Protocol](https://cursor.com/docs/mcp)
13. [MCP servers specification](https://modelcontextprotocol.io/specification/2026-07-28/server)
14. [Coinbase x402 exact EVM scheme](https://github.com/coinbase/x402/blob/main/specs/schemes/exact/scheme_exact_evm.md)

## Limitations

- No authorized Grok Bot account was available for an end-to-end connector test.
- The Grok Bot-to-connectors linkage is established by reading two official xAI pages together; no page states that every connector is available to every Bot.
- Cursor documents Grok Bot's plugin UI, but does not guarantee universal availability of every Marketplace listing.
- The reported direct Grok Bot–Stripe Link integration remains secondary-source reporting rather than a primary xAI or Stripe announcement.
- Generic user agents can hide Grok-origin traffic, and Coin Railz does not yet persist sufficient MCP client identity.
- Production probes establish the current public protocol behavior, not future xAI client compatibility.