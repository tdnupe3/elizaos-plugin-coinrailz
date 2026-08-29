# Research Notes: Grok Bot Agentic Commerce

**Status:** complete
**Depth:** Quick

## Plan

- **Question:** Can Grok Bot transact autonomously, through which rails, and should Coin Railz invest in a Grok-specific integration?
- **Scope:** Grok Bot product capabilities, shopping and payment evidence, approval and security controls, MCP/x402 compatibility, and Coin Railz production signals.
- **Audience:** Coin Railz founder and technical leadership.
- **Deliverable:** Evidence-ranked decision brief with a go/no-go recommendation and measurable validation signals.

## Focus Areas

| # | Area | Status | Sources |
|---|---|---|---|
| 1 | Official Grok Bot capabilities | done | xAI product and documentation |
| 2 | Shopping and payment behavior | done | xAI, Stripe, user demonstration, media |
| 3 | Approval and security model | done | xAI and Stripe documentation |
| 4 | MCP, x402, and wallet compatibility | done | xAI, Stripe, GitHub |
| 5 | Coin Railz opportunity and telemetry | done | production database and project records |

## Coverage Checklist

- [x] Can Grok Bot browse, use applications, and work in the background?
- [x] Can it complete shopping workflows and reach checkout?
- [x] Can it authorize payment without a person?
- [x] What payment rails are verified, reported, or absent?
- [x] Does it support MCP or x402?
- [x] What safety and credential boundaries apply?
- [x] Has Coin Railz observed Grok-originated traffic or payment?
- [x] Should Coin Railz build a Grok-specific integration now?

## Findings Log

- Grok Bot is a persistent cloud-computer agent that uses browser sessions, command-line tools, files, and connectors.
- Bots on one user account share browser sessions, files, and command-line credentials; they are not security boundaries.
- Official xAI guidance puts purchases, transfers, payment confirmations, passwords, two-factor authentication, and CAPTCHAs behind explicit approval or human takeover.
- A public user walkthrough demonstrates cart building, product selection, CAPTCHA takeover, delivery-slot selection, and a supervised final payment.
- Stripe independently offers Link agent wallets with one-time-use credentials and biometric approval for every purchase.
- One media report claims a direct Grok Bot–Stripe Link integration; no primary xAI or Stripe announcement naming that integration was found.
- Grok Business and Enterprise can add custom MCP servers.
- No official Grok Bot documentation was found for a native crypto wallet, x402 signing/retry, autonomous stablecoin settlement, agent-card payment discovery, or unattended spending.
- An unrelated third-party project named grok-cli implements x402; it is not evidence about xAI Grok Bot.
- Coin Railz production telemetry showed no Grok/xAI/Cursor fingerprint in the last 30 days; MCP client identity is not currently captured.

## Conflicts & Open Questions

- The direct Grok Bot–Stripe Link integration is reported by secondary media but not confirmed by a primary xAI or Stripe source found in this review.
- A Bot can execute the shopping workflow, but payment remains human-approved; this is assisted agentic commerce rather than autonomous economic agency.
- Custom MCP availability is documented for Grok Business/Enterprise, but no end-to-end Coin Railz paid call from Grok Bot has been demonstrated.

## Gaps

- No authorized Grok Bot account was available for a live Coin Railz compatibility test.
- Generic or missing user-agent strings could hide Grok-originated browser traffic.
- Current MCP telemetry does not preserve a reliable client name, so absence of a fingerprint is not proof of absence.