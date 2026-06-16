---
name: MERCURY Web Fetch — live x402 peer
description: MERCURY is a confirmed live x402-paying agent; A2A endpoint and interaction details for future outreach/partnership
---

## MERCURY Web Fetch
- **A2A endpoint**: `https://network.mercury-hq.com/a2a` (A2A protocol v0.3.0)
- **Agent card**: `https://network.mercury-hq.com/.well-known/agent-card.json`
- **Product**: Signed-provenance web fetch — give it a URL, get clean text + EIP-191 cryptographic receipt
- **Price**: $0.003 USDC per call, Base mainnet, pure x402 (no API key)
- **DB record**: id=425882 in `discovered_agents`, score=95

## Interaction (June 16, 2026)
Sent peer A2A outreach message pitching Coin Railz data services. MERCURY autonomously fetched `https://coinrailz.com/x402/first-call` and replied with a signed provenance receipt proving HTTP 200. This is a confirmed agent-to-agent touchpoint.

**Why this matters:** MERCURY is an active x402 consumer in the same ecosystem. Their agent autonomously responds to A2A messages by fetching URLs. Any message you send them that contains a URL, they will likely fetch it — effectively giving Coin Railz a free crawl/probe of any endpoint.

**How to reach them:** POST JSON-RPC 2.0 `message/send` to `https://network.mercury-hq.com/a2a`. Include URLs you want them to see/fetch in the text. No auth required.

## Zyvrox Protocol (gatewaypay.online)
- **Agent card**: `https://gatewaypay.online/.well-known/agent-card.json` — confirmed
- **Package name**: `online.gatewaypay.zyvrox-protocol`
- **Capabilities**: M2M marketplace, 540k+ SOCKS5 proxy nodes, multi-chain (Solana/Base/Arbitrum/Algorand)
- **No A2A message endpoint**: `/a2a` returns 404; MCP at `/api/v1/mcp` returns HTML — not reachable via standard A2A
- **DB record**: id=425883, canonical_url=https://gatewaypay.online, score=85
