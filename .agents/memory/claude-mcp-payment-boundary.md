---
name: Claude MCP payment boundary
description: Durable compatibility constraint for Coin Railz claims about Claude and x402 payments.
---

Do not present generic remote MCP support as proof that Claude clients can automatically settle Coin Railz x402 challenges. The documented Claude MCP connector supports remote tool calls and OAuth Bearer authentication; an unauthenticated Coin Railz paid tool returns an x402 HTTP 402 that requires signing and retry behavior outside that documented Claude flow.

**Why:** The public Claude MCP connector documentation reviewed on 2026-08-25 did not document x402 payment signing, settlement, or automatic 402 retry. Coin Railz's dedicated audit found basic discovery working but no live authorized Claude payment test.

**How to apply:** Use factual, conditional interoperability language. Before claiming paid Claude support, prove the specific client/version can use the chosen prepaid/OAuth-compatible credential path or an explicitly authorized payment proxy, and verify that no credential or signed proof is retained in telemetry.