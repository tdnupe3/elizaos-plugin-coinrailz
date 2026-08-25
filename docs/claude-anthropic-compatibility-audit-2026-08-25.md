# Claude / Anthropic Compatibility and Compliance Audit

**Assessment date:** 2026-08-25  
**System assessed:** Coin Railz public remote MCP server at `https://coinrailz.com/mcp`  
**Assessment type:** Evidence-based engineering and policy applicability review, not legal advice  
**Overall result:** **Conditional technical interoperability; not ready for an unqualified “Claude compatible” or “Anthropic compliant” claim.**

## 1. Executive conclusion

Coin Railz has a publicly reachable HTTPS MCP endpoint and successfully completes the basic unauthenticated flow of `initialize` → `tools/list` → `tools/call` payment challenge. Its production payment challenge correctly binds the sampled `coinrailz_ping` call to `https://coinrailz.com/mcp`, uses the advertised Base USDC price, and does not require a real payment merely to discover tools.

That is sufficient evidence for **basic remote MCP discovery interoperability**, not for end-to-end Claude compatibility:

1. Current Claude documentation describes a remote MCP connector that supports tool calls and OAuth Bearer authentication. It does **not** document automatic x402 signing, payment, or retry behavior. A stock Claude client receiving Coin Railz's HTTP `402` cannot be assumed to pay and retry.
2. The production server advertises MCP protocol version `2024-11-05` even when a client requests `2025-11-25`. It does not negotiate or emit the current protocol-version header behavior.
3. `notifications/initialized` returns the plaintext body `Accepted`; JSON-RPC/MCP notifications must not receive a response body.
4. A `GET /mcp` request returns the site HTML through the frontend fallback rather than an MCP response or an explicit unsupported-method response. POST-only Streamable HTTP is a valid baseline, but a successful HTML response is ambiguous to client diagnostics.

**Do not represent this audit as Anthropic endorsement, certification, marketplace approval, or legal approval.** Technical MCP interoperability and compliance with Anthropic agreements are separate questions.

## 2. Scope, client assumptions, and safety limits

### Claude surfaces reviewed

| Surface | Status | Audit position |
| --- | --- | --- |
| Claude API MCP connector | In scope | Primary technical target. Current official documentation describes it as beta and supports public HTTPS Streamable HTTP or SSE servers, limited to tool calls. |
| Claude.ai / custom remote connectors | In scope, documentation review | Public documentation confirms custom remote MCP connectors are available, but no authenticated Claude account was used. |
| Claude Desktop remote MCP | In scope, documentation review | No desktop client was configured in this audit. Claims about a complete Desktop setup remain unverified. |
| Claude Code remote MCP | In scope, documentation review | No Claude Code client or login was used. |
| Claude local stdio server support | Not applicable | Coin Railz exposes a remote HTTP endpoint, not a local stdio server. |

### Safety and evidence boundaries

- All wire tests used only unauthenticated discovery requests and payment challenges.
- No API key, OAuth token, payment signature, wallet private key, or real transaction was sent.
- No tool result was obtained through a paid call, so payment settlement, delivery, and replay behavior are classified as **unknown** unless directly supported by static evidence.
- Production traffic logs were reviewed only for the audit requests and server behavior; payment proof material was neither requested nor retained.
- The review uses public documentation available on 2026-08-25. Anthropic can change beta behavior and terms without notice.

## 3. Normative references reviewed

| Reference | Relevance |
| --- | --- |
| [Anthropic MCP connector documentation](https://platform.claude.com/docs/en/agents-and-tools/mcp-connector) | States that the connector is beta, supports remote public HTTP MCP servers using Streamable HTTP or SSE, and currently supports tool calls only. The example uses beta header `mcp-client-2025-11-20`; authentication is OAuth Bearer token based. |
| [Anthropic custom remote MCP connector guidance](https://support.anthropic.com/en/articles/11175166-getting-started-with-custom-connectors-using-remote-mcp) | Current end-user guidance for connecting Claude products to third-party remote MCP services, including third-party security and privacy considerations. |
| [MCP lifecycle specification, 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle) | Initialization, version negotiation, notifications, capabilities, and lifecycle rules. |
| [MCP Streamable HTTP transport specification, 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports) | JSON-RPC transport, media types, session/version headers, POST requirements, and optional SSE behavior. |
| [MCP tools specification, 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) | `tools/list`, `tools/call`, tool schemas, result content, structured content, and error semantics. |
| [Anthropic Privacy Policy](https://www.anthropic.com/legal/privacy), [Acceptable Use Policy](https://www.anthropic.com/legal/aup), and [Commercial Terms](https://www.anthropic.com/legal/commercial-terms) | Applicable only to the party using the relevant Anthropic service and agreement. They do not certify independent MCP servers. |

## 4. Live wire evidence

The following production requests were made to `https://coinrailz.com/mcp` with `Content-Type: application/json` and a non-sensitive audit user-agent.

| Check | Observed production behavior | Classification |
| --- | --- | --- |
| HTTPS remote endpoint | Public endpoint responded over HTTPS. Deployment is public and healthy. | **Pass** |
| `initialize` with requested `2025-11-25` | HTTP 200 JSON-RPC response; `result.protocolVersion` was `2024-11-05`. | **Fail — current protocol alignment** |
| `notifications/initialized` without JSON-RPC id | HTTP 202, `text/plain`, body was `Accepted`. | **Fail — notification body** |
| `tools/list` | HTTP 200 JSON-RPC response with 80 tools. Tool names were unique, matched `coinrailz_[a-z0-9_]+`, and every inspected schema had an object root and documented properties. | **Pass — discovery baseline** |
| `tools/call` without credentials for `coinrailz_ping` | HTTP 402 JSON body and `PAYMENT-REQUIRED`; challenge contained Base network, USDC asset, `maxAmountRequired: "250000"`, configured payee, and resource `https://coinrailz.com/mcp`. | **Pass — challenge generation and public resource binding** |
| Unsupported `server/discover` | JSON-RPC `-32601`, but HTTP 404 rather than a normal JSON-RPC success transport response. | **Unknown / interoperability risk** |
| `GET /mcp` with `Accept: text/event-stream` | HTTP 200 `text/html` application page, not an MCP response. | **Partial — optional transport path is ambiguous** |

The development preview was also checked. Its MCP challenge used `http://localhost:5000/mcp` as the resource URL. Production correctly used `https://coinrailz.com/mcp`; therefore this is a **development-preview limitation**, not a production payment-binding finding.

## 5. Claude client compatibility matrix

| Capability | Claude API MCP connector | Claude.ai / Desktop / Code remote use | Evidence and result |
| --- | --- | --- | --- |
| Public HTTPS connection | Expected | Expected for remote connector use | **Pass.** Production endpoint is public HTTPS. |
| TLS/proxy behavior | Required in practice | Required in practice | **Partial.** Public TLS endpoint responded; no certificate-chain, proxy, or enterprise-network client test was performed. |
| Initialize handshake | Required | Required | **Partial.** JSON-RPC works, but returned protocol version is stale versus current MCP specification. |
| `notifications/initialized` | Required by MCP lifecycle after initialize | Required by strict clients | **Fail.** HTTP 202 is reasonable, but plaintext `Accepted` violates the no-response-body expectation. |
| Tool discovery | Supported by Claude API connector | Expected by clients | **Pass.** `tools/list` returned 80 well-formed baseline tool definitions. |
| Tool invocation using a prepaid credential | Claude docs provide `authorization_token` for OAuth Bearer credentials | Client-specific configuration varies | **Unknown.** The server accepts `Authorization: Bearer` as a prepaid-key alternative, but an authorized Claude integration was intentionally not run. |
| Native x402 payment after HTTP 402 | Not documented as a Claude connector capability | Not documented as automatic client behavior | **Fail for out-of-box paid use.** Do not promise that Claude automatically signs, settles, or retries an x402 challenge. |
| Error handling | Tool-only feature is supported | Client-specific UX | **Unknown.** HTTP 404 around JSON-RPC method errors needs a real Claude/Inspector compatibility test. |
| Sessions | Session support is optional for stateless MCP servers | Client-specific | **Not applicable / partial.** No `Mcp-Session-Id` is issued; a separate advisory session endpoint exists but is not MCP transport session management. |
| Resources and prompts | Claude API connector documentation says only tool calls are supported | Client-specific | **Not applicable to Claude API connector.** Coin Railz implements them, but they do not establish Claude compatibility. |
| Cancellation/progress | Relevant to long-running servers | Client-specific | **Unknown.** No cancellation or progress behavior was proven. |
| Timeout and retry behavior | Client-specific | Client-specific | **Unknown.** No authenticated tool invocation was executed. |

## 6. MCP protocol conformance matrix

| Area | Result | Evidence / implication |
| --- | --- | --- |
| JSON-RPC envelope on valid calls | **Pass** | `initialize` and `tools/list` returned JSON-RPC `2.0` envelopes with request IDs. |
| Invalid request error | **Partial** | Missing `jsonrpc` returns `-32600`, but transport status is HTTP 400. Validate against the chosen client library. |
| Version negotiation | **Fail** | The server ignores a client request for `2025-11-25` and always returns `2024-11-05`. Upgrade or explicitly negotiate supported versions before current-spec claims. |
| Lifecycle notification body | **Fail** | `res.sendStatus(202)` emits `Accepted`; replace with a bodyless 202 response. |
| `MCP-Protocol-Version` request/response behavior | **Fail / not implemented** | No production response header was emitted and no incoming header validation was observed. |
| Streamable HTTP POST | **Pass — baseline** | POST JSON-RPC is available and returns JSON responses for normal discovery methods. |
| Streamable HTTP GET / SSE path | **Partial** | GET is optional for a stateless server, but the frontend fallback returns HTML with HTTP 200. Return a clear MCP-specific 405/404 or implement the supported SSE behavior. |
| Tool names and input schemas | **Pass — sampled complete inventory** | 80 names were unique and conventionally formatted; no missing descriptions or malformed object schemas were found by the schema audit. |
| Tool results | **Partial** | Success responses use `result.content` text blocks, which is broadly compatible. `outputSchema` describes a `content` object while successful calls do not expose matching `structuredContent`; remove it or return schema-aligned structured content. |
| JSON-RPC method errors | **Unknown / risk** | The server uses HTTP 404 alongside `-32601`. Test the current MCP Inspector and the selected Claude client before relying on this status combination. |
| Resources/prompts | **Pass for implemented methods; not Claude API evidence** | Supported in the server, but current Anthropic MCP connector documentation limits its feature set to tools. |
| Cancellation/progress | **Unknown** | General notifications receive 202, but no supported request-cancellation or progress contract was demonstrated. |

## 7. x402 payment behavior matrix

| Control or behavior | Result | Evidence / boundary |
| --- | --- | --- |
| Challenge generation | **Pass** | Payment challenge returned 402, `PAYMENT-REQUIRED`, a USDC amount, facilitator, payee, and MCP resource. |
| Price/resource binding in sampled production challenge | **Pass** | `coinrailz_ping` challenge showed 250,000 micro-USDC and `https://coinrailz.com/mcp`. |
| v1/v2 ingress headers | **Pass — static review** | MCP route accepts both `X-PAYMENT` and `PAYMENT-SIGNATURE`. |
| Payment proof redaction in MCP telemetry | **Pass — static review** | MCP tracking records only header presence, parsed wallet/amount where available, and auth mode; it explicitly avoids raw proof storage. |
| Payment verification | **Unknown** | Verification is delegated to the upstream `/x402` service. No signed proof was sent. |
| Settlement and post-verification delivery | **Unknown** | No real settlement or authenticated prepaid request was made. |
| Replay prevention / authorization expiry | **Unknown** | The payment layer contains replay, nonce, expiry, and format-handling code, but this audit did not use a controlled signed fixture to prove the live path. |
| Idempotency across MCP gateway and upstream service | **Unknown** | No duplicate authorized request was sent; this must be tested with a dedicated disposable or simulated fixture. |
| Automatic Claude x402 payment | **Fail** | Anthropic's documented connector authentication is OAuth Bearer token based; no documented x402 signing/settlement/retry capability was found. |
| Prepaid credential fallback | **Partial** | Server accepts `X-API-KEY` and `Authorization: Bearer`; compatibility requires a safe Claude-side credential configuration and an authorized end-to-end test. |

## 8. Privacy and security data-flow review

### Confirmed collection and handling

`x402InteractionTracker` persists the following MCP/x402 observability data to `x402_interactions`:

- service identity, path, method, HTTP result, timestamps, latency, and request ID;
- raw IP address, user-agent, referrer/origin, and client-identification headers;
- wallet address and amount only when a presented payment envelope can be parsed;
- event type, payment state, selected non-sensitive metadata, and error message.

The MCP route deliberately avoids recording raw payment header values and only tracks that a payment header was present. This is a meaningful defense against retaining signed authorization material. The unauthenticated rate limiter also treats payment and credential-bearing requests differently so that a genuine retry reaches the verifier.

### Open privacy and security questions

| Topic | Result | Required owner action |
| --- | --- | --- |
| Payment proof retention | **Pass — route-level evidence** | Preserve the no-raw-proof rule in all logs, error paths, reverse proxies, and vendor monitoring systems. Add regression coverage. |
| IP, user-agent, referrer, wallet, and telemetry retention | **Unknown** | Confirm a documented retention schedule, deletion process, access roles, and lawful basis. The code reviewed stores these values but does not itself establish policy compliance. |
| Referrer/client-header minimization | **Partial** | Referrer and client-provided identifiers may contain personal data or sensitive query content. Define truncation/redaction rules before using data for outreach or analytics. |
| Database and operations access | **Unknown** | Review production roles, backups, exports, and incident-log access with the security/privacy owner. |
| Third-party delivery and model/provider data flow | **Unknown** | For each paid tool, inventory downstream vendors and whether tool inputs are forwarded, logged, or used for model improvement. |
| Authenticated Claude credential handling | **Unknown** | Ensure an OAuth/prepaid-token integration never logs bearer tokens and is scoped/rotated/revocable. |
| Financial/tool-risk safeguards | **Unknown** | Coin Railz exposes trading, wallet, and financial tools. Product/legal owners must assess Anthropic policy applicability, user disclosures, and human-review boundaries for the exact use case. |

## 9. Anthropic applicability matrix

This section identifies decision owners; it is not legal advice or a conclusion that a policy is satisfied.

| Topic | Applicability | Result |
| --- | --- | --- |
| Anthropic MCP connector technical requirements | Directly relevant when advertising Claude API connector support | **Partial.** HTTPS and tool discovery work; payment and lifecycle gaps remain. |
| Anthropic beta feature status | Directly relevant | **Pass — disclosure needed.** Treat connector support as beta and version-sensitive in documentation. |
| Anthropic API commercial terms | Applies to the party using Anthropic API keys/services | **Unknown.** Contract owner must confirm the actual account, service tier, and data terms. Coin Railz cannot self-certify compliance for every customer. |
| Anthropic consumer terms | May apply to individual Claude users | **Not determinable by server audit.** Do not make product claims about a user's account rights or plan entitlement. |
| Anthropic privacy commitments | Applies to Anthropic's services; Coin Railz has independent controller/processor obligations for its own telemetry | **Unknown.** Coin Railz privacy notice and downstream vendors require owner/legal review. |
| Acceptable Use Policy | Applies to Anthropic service use and to use cases involving Claude | **Unknown.** Trading, wallet, and financial workflows need a product-specific policy review; a generic MCP implementation cannot prove compliant use. |
| Third-party MCP server security disclosure | Directly relevant to custom connector users | **Partial.** Document data collection, supported auth, paid-call behavior, and the fact that Coin Railz is an independent third party. |
| Brand, trademarks, endorsement, certification | Directly relevant to public marketing | **Fail-safe requirement.** Use factual interoperability wording only. Do not use Anthropic/Claude marks, imply partnership, or claim certification without written permission and brand-owner approval. |
| Marketplace/directory distribution | Relevant only if pursuing a particular Claude directory or listing | **Not applicable until a specific program is selected.** Treat its terms and security review as a separate intake. |

## 10. Prioritized findings and remediation plan

| Priority | Finding | Why it matters | Recommended remediation | Validation |
| --- | --- | --- | --- | --- |
| P0 | Native Claude clients cannot be assumed to pay x402 challenges | Tool discovery succeeds but paid tools stop at HTTP 402 without a documented Claude x402 payer/retry mechanism. | Provide and document an approved prepaid/OAuth-compatible path, or build a narrowly scoped payment proxy/agent flow with explicit user authorization. Do not market automatic x402 payment to Claude until proven. | Run an authorized Claude API/Claude Desktop test using a disposable low-privilege credential; verify no credential leaks and successful delivery. |
| P1 | Notification sends a response body | Strict MCP lifecycle implementations can reject or mis-handle a notification response. | Return HTTP 202 with an empty body, and update the current test to assert exact empty bytes. | Wire test `notifications/initialized` and a current MCP Inspector test. |
| P1 | Protocol version is stale and not negotiated | Current clients may reject a server that does not agree on a supported protocol version. | Implement version negotiation and current MCP transport headers, or explicitly document/test the intentionally supported legacy version. | Test current MCP Inspector plus each marketed Claude client/version. |
| P1 | `GET /mcp` falls through to site HTML | A client or operator attempting Streamable HTTP/SSE diagnostics gets a misleading success response. | Implement supported GET/SSE behavior or return a clear MCP-specific unsupported response before the static frontend fallback. | Assert `Accept: text/event-stream` behavior in integration tests. |
| P2 | Tool output schema does not align with returned structured result | Future clients can validate tool output against `outputSchema`; current text-only content may not satisfy a declared structured contract. | Remove `outputSchema` until returning `structuredContent`, or return schema-conformant structured content. | Schema-aware MCP client test for a successful low-risk tool call. |
| P2 | JSON-RPC method error uses HTTP 404 | Some MCP clients treat non-2xx as transport failure instead of inspecting `-32601`. | Normalize the chosen transport/error contract after validating against current MCP tooling. | Inspector and Claude client negative-method tests. |
| P2 | Privacy governance evidence is incomplete | Code-level redaction does not prove retention, role access, vendor handling, or disclosure compliance. | Create a data inventory with retention, access, deletion, subprocessors, and privacy-notice mapping. | Security/privacy owner sign-off and operational evidence review. |

## 11. Regression suite required before compatibility marketing

1. A transport suite that covers supported protocol versions, headers, `initialize`, bodyless notifications, `tools/list`, unknown methods, POST content types, and clear GET/SSE behavior.
2. A Claude API MCP connector test using the documented beta header and an allowlisted low-risk tool.
3. A Claude Desktop and Claude Code configuration test for every product that will be named in marketing.
4. A prepaid credential test confirming `Authorization: Bearer` is accepted, revoked credentials fail safely, and credentials never reach logs or analytics.
5. A controlled payment-verification test using a disposable test fixture or explicitly approved tiny settlement: correct proof, malformed proof, expired proof, wrong resource, wrong price, replay, duplicate delivery, and result delivery.
6. A privacy regression test that inspects application logs and `x402_interactions` for accidental storage of raw payment headers, bearer credentials, or full sensitive referrers.

## 12. Approved communication posture

Until the P0/P1 findings are resolved and the required client tests pass, use wording such as:

> “Coin Railz exposes a public remote MCP endpoint with paid tools. Basic MCP tool discovery has been tested against the published protocol. Claude product compatibility, payment behavior, and account availability depend on the specific Claude client and configuration.”

Do **not** say:

- “Anthropic approved,” “Anthropic certified,” or “official Anthropic partner,” unless independently and contractually true;
- “Works with every Claude product”;
- “Claude pays automatically with x402”; or
- “This audit proves legal or policy compliance.”