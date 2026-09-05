# Coin Railz: 72-Hour Activity and Robinhood Chain Assessment

**Research date:** September 4, 2026  
**Depth:** Standard  
**Sources consulted:** 15 external sources, production telemetry, current code, architect review, and business-development review

## Executive summary

Coin Railz is not dormant. Production recorded **8,584 x402 interactions over the last 72 hours**, rising from 2,475 in the oldest 24-hour segment to 3,516 in the newest. The newest day reached 122 unique IPs, 34 user agents, and 91 services. This is a meaningful increase in discovery coverage. It is not, however, a conversion event: all 78 successful payment intents in the window were marked as internal canary payments, totaling $3.725. The most recent verified organic payment was a $0.25 `ping` payment on August 31, just outside the window.

The traffic is still dominated by monitors, validators, crawlers, and registry infrastructure. There are nonetheless new distribution signals: x402watch traversed 46 services, a new x402-MPP liveness actor covered 48 services, the published ElizaOS plugin generated a 134-request burst, rokmcp began recurring collection, and new A2A research clients completed matched requests. These signals show expanding machine visibility, not customer adoption.

Robinhood Chain has become a material ecosystem. Robinhood officially launched its public mainnet on July 1, 2026, and the live public RPC returns chain ID 4663.[[1]](https://robinhood.com/us/en/newsroom/robinhood-accelerates-global-expansion-robinhood-chain-mainnet-stock-tokens-agentic-trading) [[2]](https://docs.robinhood.com/chain) DeFiLlama showed approximately $838–841 million of TVL and between $1.35 billion and $1.82 billion of 24-hour DEX volume on September 4; the discrepancy reflects different live views and should be presented as a range, not a single audited number.[[3]](https://api.llama.fi/v2/chains) [[4]](https://defillama.com/chain/robinhood-chain) [[5]](https://defillama.com/dexs/chain/robinhood-chain) Uniswap represented roughly 76% of the lower DEX-volume figure. The chain also has official support from Chainlink, Across, Uniswap, Morpho, Rialto, Lighter, Arcus, Alchemy, BitGo, LayerZero, and others.[[2]](https://docs.robinhood.com/chain)

Coin Railz is **strategically aligned but not yet technically aligned enough to promote its Robinhood Chain suite aggressively**. Its five current service concepts are well chosen: token prices, DEX pools, chain statistics, stock-price feeds, and cross-chain activation. The architect found important implementation gaps: the DEX “chain” views only search DexScreener for `USDC`; the Chainlink reader does not implement Robinhood’s documented oracle-safety requirements; public schemas, prices, and SDK parameters have drifted; and the treasury-funded bridge accepts an external transaction `value` without a strict ETH cap and does not confirm destination delivery. These are fixable, but some are P0 safety and truthfulness issues.

The best opportunity is an **agent-ready Robinhood RWA intelligence and activation layer**: merge Robinhood’s official Stock Token APIs with canonical contract metadata, Chainlink feed state, sequencer uptime, corporate-action multipliers, transfer restrictions, oracle pauses, and verified Uniswap liquidity. That is materially more differentiated than a generic DEX dashboard and directly supports the chain’s RWA and agentic-account strategy.

## 1. Production activity: last 72 hours

### Traffic trend

| Window | Interactions | Payment challenges | MCP events | Landing views | Unique IPs | Services |
|---|---:|---:|---:|---:|---:|---:|
| Most recent 24h | 3,516 | 3,126 | 152 | 54 | 122 | 91 |
| Prior 24h | 2,593 | 2,414 | 95 | 20 | 90 | 83 |
| Oldest 24h | 2,475 | 2,303 | 94 | 15 | 75 | 69 |

Traffic increased by about **42%** from the oldest to newest daily segment. Service coverage expanded from 69 to 91, and unique IPs increased from 75 to 122. The increase is real, but the actor mix shows that it is primarily automated ecosystem activity.

### Payments

Production recorded 78 successful payment intents totaling $3.725. Every one was marked `is_canary=true`; there were no successful non-canary payment intents in the 72-hour window. The last organic payment currently visible in the authoritative ledger was:

- August 31, 2026: `ping`, $0.25, payer `0x6341…f356`.

This means the platform is being exercised continuously, but the latest traffic has not converted into organic revenue.

### Notable actors

| Actor | Activity | Interpretation |
|---|---:|---|
| `python-httpx/0.28.1` | 3,036 interactions, 27 services | Long-running validator; no payment signal |
| `x402-observer` | 2,132 interactions, 48 services | Trust/uptime monitor |
| Blank user agent | 763 interactions, 89 services | Broad infrastructure sweeper |
| `ZeroBot` | 451 interactions, 47 services | Automated ecosystem crawler |
| `x402watch` | 364 interactions, 46 services | New broad x402 monitor/index |
| `x402-mpp-liveness` | 212 interactions, 48 services | New liveness/protocol-compatibility signal |
| `elizaos-plugin-coinrailz/2.4.0` | 134 interactions | Real distribution artifact being exercised, but no payment |
| `rokmcp-collector` | 56 interactions | New recurring MCP indexer |
| `Pennywise-Candidate-Verifier` | 31 interactions from 31 IPs | Distributed candidate verification |

A2A traffic remained small but broadened. Agent-tools.cloud made 22 requests; the A2A registry made three; and both Lumidian research and a new interactive agent-card crawler completed matched requests. This is discovery progress, not yet a sales lead or conversion.

## 2. Robinhood Chain: current state

Robinhood Chain is a live, permissionless EVM-compatible Arbitrum Dedicated Chain using ETH for gas, with first-class ERC-4337 support and an explicit focus on tokenized real-world assets.[[2]](https://docs.robinhood.com/chain) Robinhood Wallet supports it natively, and ordinary EVM wallets can connect using chain ID 4663 and the public RPC.[[6]](https://robinhood.com/us/en/support/articles/robinhood-chain-mainnet)

Robinhood’s official launch states that Stock Tokens can trade around the clock, be used as collateral, and enter lending pools, subject to jurisdiction and asset restrictions.[[1]](https://robinhood.com/us/en/newsroom/robinhood-accelerates-global-expansion-robinhood-chain-mainnet-stock-tokens-agentic-trading) Robinhood also announced forthcoming agentic accounts that connect AI models to Robinhood data sources and trading strategies.[[1]](https://robinhood.com/us/en/newsroom/robinhood-accelerates-global-expansion-robinhood-chain-mainnet-stock-tokens-agentic-trading)

### Current metrics

| Metric | September 4 snapshot | Caveat |
|---|---:|---|
| TVL | ~$838m–$841m | DeFiLlama API and page snapshots; live and mutable |
| Alternate TVL | ~$541m | Dune-embedded view uses a different snapshot/method |
| DEX volume, 24h | ~$1.35bn–$1.82bn | Different DeFiLlama views disagreed intraday |
| DEX volume, 30d | ~$19.75bn | Live DeFiLlama DEX ranking |
| Uniswap 24h volume | ~$1.03bn | Approximately 76% of the $1.35bn view |
| Stablecoin market cap | ~$922m | Supply/capitalization, not AMM liquidity |
| USDG share | 64.72%, approximately $596m | Calculated from displayed stablecoin total |
| Bridged TVL | ~$3.04bn | Includes native, canonical, and third-party categories |
| RWA active market cap | ~$215m | Not executable pool liquidity |
| Weekly transactions | ~94.2m | Dune; not equivalent to unique humans |
| Weekly active addresses | ~7.2m | Dune; may include automation and incentives |

Sources: DeFiLlama chain and DEX views[[4]](https://defillama.com/chain/robinhood-chain) [[5]](https://defillama.com/dexs/chain/robinhood-chain), Dune’s Robinhood Chain dashboard[[7]](https://dune.com/blockchains/robinhood), and the live DeFiLlama chain API.[[3]](https://api.llama.fi/v2/chains)

The scale is significant, but it is concentrated. Uniswap is the dominant venue, creating execution depth but also venue concentration risk. Uniswap officially supports v2, v3, v4, UniswapX, Stock Tokens, its API, and agent-oriented integration tooling on Robinhood Chain.[[8]](https://blog.uniswap.org/robinhood-chain-is-live) Canonical Robinhood Chain deployment addresses are now published, which gives Coin Railz a reliable replacement for query-limited DexScreener discovery.[[9]](https://developers.uniswap.org/docs/protocols/v3/deployments/v3-robinhood-chain-deployments)

Across supports routes from multiple chains in which USDC arrives as USDG, as well as ETH bridging and reverse USDG-to-USDC paths; its two-second fill statement is a vendor claim and should be measured independently.[[10]](https://across.to/blog/bridge-to-robinhood-chain-with-across) Robinhood also documents the canonical Arbitrum bridge, LayerZero/Stargate, Chainlink CCIP, Relay, Across, LiFi, and 0x.[[11]](https://docs.robinhood.com/chain/bridging)

Chainlink Data Feeds launched on mainnet on July 1.[[12]](https://dev.chain.link/changelog/data-feeds-expands-to-robinhood-chain-mainnet) Robinhood’s integration guidance explicitly requires consumers to handle dynamic decimals, stale rounds, non-positive answers, sequencer downtime, corporate-action multipliers, and `oraclePaused()` states.[[13]](https://docs.robinhood.com/chain/oracles-and-price-feeds)

## 3. Coin Railz alignment

### What Coin Railz got right

Coin Railz entered the ecosystem with the correct primitives:

1. Robinhood Chain token and pool discovery.
2. Chain status and RPC-derived information.
3. Batched Chainlink stock/ETF/crypto feed reads.
4. Base-to-Robinhood Chain funding through Across.
5. x402 packaging that makes the services callable by autonomous agents.

This maps well to Robinhood’s developer, RWA, ERC-4337, bridge, oracle, and agentic-account direction. The strategy should be retained.

### Where the implementation is misaligned

#### P0: bridge safety and delivery semantics

The bridge bounds USDC approval and validates several decoded `depositV3` fields, which is good. However, it forwards `txData.value` from an external API without requiring zero or enforcing a strict ETH cap. A malformed or compromised response could therefore spend Base ETH even though token approval is capped. It confirms the Base deposit but not the Robinhood Chain fill, and it does not persist a recoverable destination-delivery state.

The current product also delivers USDG but not ETH gas. A newly activated wallet can receive value yet remain unable to transact. It should not be described as complete wallet bootstrap until destination gas is addressed.

#### P0: public contract drift

The architect found inconsistencies between charged prices, `llms.txt`, OpenAPI, service catalog descriptions, and SDK parameters. One documented SDK parameter does not match the route’s required token-address field; the bridge documentation describes variable funding while the implementation sends a fixed 0.50 amount. These discrepancies can cause agents to fail before payment or misunderstand what they bought.

#### P1: DEX coverage is not chain-wide

The “top pools” and “chain stats” implementations query DexScreener using `q=USDC`, then aggregate only the returned Robinhood Chain subset. That is not a complete pool, volume, liquidity, or top-token index. It misses non-USDC and many RWA pools, precisely where recent activity has expanded. The output needs explicit coverage metadata until it uses canonical factory/event indexing or a verified indexer.

#### P1: oracle safety is incomplete

The current stock-price service hardcodes eight decimals and a common heartbeat. It does not validate positive answers, `answeredInRound`, per-feed decimals, per-feed heartbeat, sequencer uptime, Robinhood corporate-action multipliers, or `oraclePaused()`. Robinhood’s official documentation specifically calls for those checks.[[13]](https://docs.robinhood.com/chain/oracles-and-price-feeds)

Robinhood’s official Stock Token APIs expose asset metadata, contract addresses, current and pending multipliers, underlying market capabilities, bid/ask prices, and corporate actions.[[14]](https://docs.robinhood.com/chain/stock-token-apis) These APIs are the missing complement to Coin Railz’s on-chain feed reader.

## 4. Best opportunities

### 1. Robinhood RWA intelligence and safety API

Build a canonical asset registry that merges Robinhood `/assets`, `/prices`, and `/corporate-actions` with on-chain token contracts, Chainlink feed state, `uiMultiplier`, sequencer uptime, `oraclePaused()`, transfer restrictions, and jurisdiction metadata. Return provenance and timestamps for every field.

This is the strongest differentiated product because it solves a genuine RWA integration problem rather than reproducing generic token prices. Robinhood’s Stock Token documentation emphasizes corporate-action and jurisdiction behavior that ordinary crypto data APIs do not handle.[[15]](https://docs.robinhood.com/chain/stock-tokens)

### 2. Canonical pool intelligence and agent preflight

Index verified Uniswap factory events and published deployment addresses, then add:

- canonical pool/address verification;
- liquidity and volume with coverage disclosure;
- 1% and 5% price-impact estimates;
- Stock Token and USDG pool classification;
- oracle/market-session divergence;
- pool spoofing and thin-liquidity warnings;
- optional Rialto and other venue comparisons once their APIs and permissions are verified.

### 3. Reliable activation instead of treasury subsidy

Replace the current “pay $0.75 and receive treasury-funded 0.50 USDG” model with user-funded activation primitives:

- bridge quote and transaction construction;
- destination-fill tracking;
- ETH gas delivery or ERC-4337 sponsorship;
- explicit route choice and token representation;
- recoverable status and retry;
- optional sponsored pilot with a hard budget, not default economics.

### 4. Sequencer, oracle, and bridge reliability telemetry

Package sequencer uptime, oracle pause/freshness, bridge quote-to-fill, and RPC health into agent-callable monitoring. This is commercially relevant to Chainlink, Across, Robinhood ecosystem developers, and RWA applications.

## 5. Business-development priorities

| Priority | Target | Offer |
|---|---|---|
| 1 | Robinhood Chain developer ecosystem | Agent-ready RWA safety and activation quickstart; request technical review, not partnership branding |
| 2 | Chainlink ecosystem/data team | Validated feed-observability endpoint with staleness, sequencer, multiplier, and pause handling |
| 3 | Across integrations team | Observable quote-to-fill bridge primitive with bounded transactions and destination confirmation |
| 4 | Uniswap Robinhood deployment team | Canonical agent-safe pool intelligence using verified deployments |
| 5 | Rialto product/liquidity team | Shadow-mode intent preflight and aggregate route-quality telemetry after API terms are verified |

Do not lead with a generic DEX dashboard, retail stock-token trading, brokerage, custody, investment recommendations, treasury-subsidized bridging, or leveraged lending against stock-token collateral. Those areas are either weakly differentiated or create unnecessary financial/regulatory exposure.

## 6. Ranked action plan

### Fix now

1. Disable or harden `rh-bridge-usdc`: require zero or tightly capped transaction value, validate all quote/calldata fields, serialize treasury reservations, and track destination fill/recovery.
2. Correct Robinhood service prices, request schemas, SDK/plugin types, OpenAPI, `llms.txt`, service catalog, and payment-chain versus data-chain declarations from one canonical definition.
3. Implement Robinhood’s official oracle checks before marketing `rh-stock-price` as production-grade.

### Build next

4. Replace USDC-query DexScreener aggregation with canonical Uniswap indexing and explicit coverage/completeness fields.
5. Build the Stock Token metadata/corporate-action/oracle safety service.
6. Add destination ETH gas or ERC-4337 sponsorship to any activation flow.
7. Add a reconciled internal dashboard for DeFiLlama, explorer, Uniswap, bridge, and oracle-health metrics.

### Pursue commercially after technical proof

8. Robinhood developer ecosystem technical review.
9. Chainlink feed-semantics validation.
10. Across route and fill-status validation.
11. Uniswap deployment/indexing validation.
12. Two-builder paid beta before broader partnership claims.

## Limitations

Live TVL, DEX volume, transaction, and active-address figures are mutable and differed across providers during the same research session. They should be treated as dated ranges. Address and transaction counts do not establish unique human adoption. Across fill-time claims are vendor statements until independently measured. Coin Railz production telemetry can identify payment and user-agent behavior but cannot always identify the organization behind generic or missing user agents.

## Sources

1. [Robinhood Chain mainnet launch](https://robinhood.com/us/en/newsroom/robinhood-accelerates-global-expansion-robinhood-chain-mainnet-stock-tokens-agentic-trading) — July 1, 2026, Tier 1
2. [About Robinhood Chain](https://docs.robinhood.com/chain) — accessed September 4, 2026, Tier 1
3. [DeFiLlama chain API](https://api.llama.fi/v2/chains) — accessed September 4, 2026, Tier 2
4. [DeFiLlama Robinhood Chain](https://defillama.com/chain/robinhood-chain) — accessed September 4, 2026, Tier 2
5. [DeFiLlama Robinhood Chain DEXs](https://defillama.com/dexs/chain/robinhood-chain) — accessed September 4, 2026, Tier 2
6. [Robinhood Chain support and network details](https://robinhood.com/us/en/support/articles/robinhood-chain-mainnet) — accessed September 4, 2026, Tier 1
7. [Dune Robinhood Chain dashboard](https://dune.com/blockchains/robinhood) — accessed September 4, 2026, Tier 2
8. [Uniswap is live on Robinhood Chain](https://blog.uniswap.org/robinhood-chain-is-live) — July 1, 2026, Tier 1
9. [Uniswap Robinhood Chain deployments](https://developers.uniswap.org/docs/protocols/v3/deployments/v3-robinhood-chain-deployments) — accessed September 4, 2026, Tier 1
10. [Across bridge to Robinhood Chain](https://across.to/blog/bridge-to-robinhood-chain-with-across) — accessed September 4, 2026, Tier 1/vendor
11. [Robinhood Chain bridging documentation](https://docs.robinhood.com/chain/bridging) — accessed September 4, 2026, Tier 1
12. [Chainlink Data Feeds expansion](https://dev.chain.link/changelog/data-feeds-expands-to-robinhood-chain-mainnet) — July 1, 2026, Tier 1
13. [Robinhood Chain oracles and price feeds](https://docs.robinhood.com/chain/oracles-and-price-feeds) — accessed September 4, 2026, Tier 1
14. [Robinhood Stock Token APIs](https://docs.robinhood.com/chain/stock-token-apis) — accessed September 4, 2026, Tier 1
15. [Robinhood Stock Tokens](https://docs.robinhood.com/chain/stock-tokens) — accessed September 4, 2026, Tier 1# Coin Railz: 72-Hour Activity and Robinhood Chain Assessment

**Research date:** September 4, 2026  
**Depth:** Standard  
**Sources consulted:** 15 external sources, production telemetry, current code, architect review, and business-development review

## Executive summary

Coin Railz is not dormant. Production recorded **8,584 x402 interactions over the last 72 hours**, rising from 2,475 in the oldest 24-hour segment to 3,516 in the newest. The newest day reached 122 unique IPs, 34 user agents, and 91 services. This is a meaningful increase in discovery coverage. It is not, however, a conversion event: all 78 successful payment intents in the window were marked as internal canary payments, totaling $3.725. The most recent verified organic payment was a $0.25 `ping` payment on August 31, just outside the window.

The traffic is still dominated by monitors, validators, crawlers, and registry infrastructure. There are nonetheless new distribution signals: x402watch traversed 46 services, a new x402-MPP liveness actor covered 48 services, the published ElizaOS plugin generated a 134-request burst, rokmcp began recurring collection, and new A2A research clients completed matched requests. These signals show expanding machine visibility, not customer adoption.

Robinhood Chain has become a material ecosystem. Robinhood officially launched its public mainnet on July 1, 2026, and the live public RPC returns chain ID 4663.[[1]](https://robinhood.com/us/en/newsroom/robinhood-accelerates-global-expansion-robinhood-chain-mainnet-stock-tokens-agentic-trading) [[2]](https://docs.robinhood.com/chain) DeFiLlama showed approximately $838–841 million of TVL and between $1.35 billion and $1.82 billion of 24-hour DEX volume on September 4; the discrepancy reflects different live views and should be presented as a range, not a single audited number.[[3]](https://api.llama.fi/v2/chains) [[4]](https://defillama.com/chain/robinhood-chain) [[5]](https://defillama.com/dexs/chain/robinhood-chain) Uniswap represented roughly 76% of the lower DEX-volume figure. The chain also has official support from Chainlink, Across, Uniswap, Morpho, Rialto, Lighter, Arcus, Alchemy, BitGo, LayerZero, and others.[[2]](https://docs.robinhood.com/chain)

Coin Railz is **strategically aligned but not yet technically aligned enough to promote its Robinhood Chain suite aggressively**. Its five current service concepts are well chosen: token prices, DEX pools, chain statistics, stock-price feeds, and cross-chain activation. The architect found important implementation gaps: the DEX “chain” views only search DexScreener for `USDC`; the Chainlink reader does not implement Robinhood’s documented oracle-safety requirements; public schemas, prices, and SDK parameters have drifted; and the treasury-funded bridge accepts an external transaction `value` without a strict ETH cap and does not confirm destination delivery. These are fixable, but some are P0 safety and truthfulness issues.

The best opportunity is an **agent-ready Robinhood RWA intelligence and activation layer**: merge Robinhood’s official Stock Token APIs with canonical contract metadata, Chainlink feed state, sequencer uptime, corporate-action multipliers, transfer restrictions, oracle pauses, and verified Uniswap liquidity. That is materially more differentiated than a generic DEX dashboard and directly supports the chain’s RWA and agentic-account strategy.

## 1. Production activity: last 72 hours

### Traffic trend

| Window | Interactions | Payment challenges | MCP events | Landing views | Unique IPs | Services |
|---|---:|---:|---:|---:|---:|---:|
| Most recent 24h | 3,516 | 3,126 | 152 | 54 | 122 | 91 |
| Prior 24h | 2,593 | 2,414 | 95 | 20 | 90 | 83 |
| Oldest 24h | 2,475 | 2,303 | 94 | 15 | 75 | 69 |

Traffic increased by about **42%** from the oldest to newest daily segment. Service coverage expanded from 69 to 91, and unique IPs increased from 75 to 122. The increase is real, but the actor mix shows that it is primarily automated ecosystem activity.

### Payments

Production recorded 78 successful payment intents totaling $3.725. Every one was marked `is_canary=true`; there were no successful non-canary payment intents in the 72-hour window. The last organic payment currently visible in the authoritative ledger was:

- August 31, 2026: `ping`, $0.25, payer `0x6341…f356`.

This means the platform is being exercised continuously, but the latest traffic has not converted into organic revenue.

### Notable actors

| Actor | Activity | Interpretation |
|---|---:|---|
| `python-httpx/0.28.1` | 3,036 interactions, 27 services | Long-running validator; no payment signal |
| `x402-observer` | 2,132 interactions, 48 services | Trust/uptime monitor |
| Blank user agent | 763 interactions, 89 services | Broad infrastructure sweeper |
| `ZeroBot` | 451 interactions, 47 services | Automated ecosystem crawler |
| `x402watch` | 364 interactions, 46 services | New broad x402 monitor/index |
| `x402-mpp-liveness` | 212 interactions, 48 services | New liveness/protocol-compatibility signal |
| `elizaos-plugin-coinrailz/2.4.0` | 134 interactions | Real distribution artifact being exercised, but no payment |
| `rokmcp-collector` | 56 interactions | New recurring MCP indexer |
| `Pennywise-Candidate-Verifier` | 31 interactions from 31 IPs | Distributed candidate verification |

A2A traffic remained small but broadened. Agent-tools.cloud made 22 requests; the A2A registry made three; and both Lumidian research and a new interactive agent-card crawler completed matched requests. This is discovery progress, not yet a sales lead or conversion.

## 2. Robinhood Chain: current state

Robinhood Chain is a live, permissionless EVM-compatible Arbitrum Dedicated Chain using ETH for gas, with first-class ERC-4337 support and an explicit focus on tokenized real-world assets.[[2]](https://docs.robinhood.com/chain) Robinhood Wallet supports it natively, and ordinary EVM wallets can connect using chain ID 4663 and the public RPC.[[6]](https://robinhood.com/us/en/support/articles/robinhood-chain-mainnet)

Robinhood’s official launch states that Stock Tokens can trade around the clock, be used as collateral, and enter lending pools, subject to jurisdiction and asset restrictions.[[1]](https://robinhood.com/us/en/newsroom/robinhood-accelerates-global-expansion-robinhood-chain-mainnet-stock-tokens-agentic-trading) Robinhood also announced forthcoming agentic accounts that connect AI models to Robinhood data sources and trading strategies.[[1]](https://robinhood.com/us/en/newsroom/robinhood-accelerates-global-expansion-robinhood-chain-mainnet-stock-tokens-agentic-trading)

### Current metrics

| Metric | September 4 snapshot | Caveat |
|---|---:|---|
| TVL | ~$838m–$841m | DeFiLlama API and page snapshots; live and mutable |
| Alternate TVL | ~$541m | Dune-embedded view uses a different snapshot/method |
| DEX volume, 24h | ~$1.35bn–$1.82bn | Different DeFiLlama views disagreed intraday |
| DEX volume, 30d | ~$19.75bn | Live DeFiLlama DEX ranking |
| Uniswap 24h volume | ~$1.03bn | Approximately 76% of the $1.35bn view |
| Stablecoin market cap | ~$922m | Supply/capitalization, not AMM liquidity |
| USDG share | 64.72%, approximately $596m | Calculated from displayed stablecoin total |
| Bridged TVL | ~$3.04bn | Includes native, canonical, and third-party categories |
| RWA active market cap | ~$215m | Not executable pool liquidity |
| Weekly transactions | ~94.2m | Dune; not equivalent to unique humans |
| Weekly active addresses | ~7.2m | Dune; may include automation and incentives |

Sources: DeFiLlama chain and DEX views[[4]](https://defillama.com/chain/robinhood-chain) [[5]](https://defillama.com/dexs/chain/robinhood-chain), Dune’s Robinhood Chain dashboard[[7]](https://dune.com/blockchains/robinhood), and the live DeFiLlama chain API.[[3]](https://api.llama.fi/v2/chains)

The scale is significant, but it is concentrated. Uniswap is the dominant venue, creating execution depth but also venue concentration risk. Uniswap officially supports v2, v3, v4, UniswapX, Stock Tokens, its API, and agent-oriented integration tooling on Robinhood Chain.[[8]](https://blog.uniswap.org/robinhood-chain-is-live) Canonical Robinhood Chain deployment addresses are now published, which gives Coin Railz a reliable replacement for query-limited DexScreener discovery.[[9]](https://developers.uniswap.org/docs/protocols/v3/deployments/v3-robinhood-chain-deployments)

Across supports routes from multiple chains in which USDC arrives as USDG, as well as ETH bridging and reverse USDG-to-USDC paths; its two-second fill statement is a vendor claim and should be measured independently.[[10]](https://across.to/blog/bridge-to-robinhood-chain-with-across) Robinhood also documents the canonical Arbitrum bridge, LayerZero/Stargate, Chainlink CCIP, Relay, Across, LiFi, and 0x.[[11]](https://docs.robinhood.com/chain/bridging)

Chainlink Data Feeds launched on mainnet on July 1.[[12]](https://dev.chain.link/changelog/data-feeds-expands-to-robinhood-chain-mainnet) Robinhood’s integration guidance explicitly requires consumers to handle dynamic decimals, stale rounds, non-positive answers, sequencer downtime, corporate-action multipliers, and `oraclePaused()` states.[[13]](https://docs.robinhood.com/chain/oracles-and-price-feeds)

## 3. Coin Railz alignment

### What Coin Railz got right

Coin Railz entered the ecosystem with the correct primitives:

1. Robinhood Chain token and pool discovery.
2. Chain status and RPC-derived information.
3. Batched Chainlink stock/ETF/crypto feed reads.
4. Base-to-Robinhood Chain funding through Across.
5. x402 packaging that makes the services callable by autonomous agents.

This maps well to Robinhood’s developer, RWA, ERC-4337, bridge, oracle, and agentic-account direction. The strategy should be retained.

### Where the implementation is misaligned

#### P0: bridge safety and delivery semantics

The bridge bounds USDC approval and validates several decoded `depositV3` fields, which is good. However, it forwards `txData.value` from an external API without requiring zero or enforcing a strict ETH cap. A malformed or compromised response could therefore spend Base ETH even though token approval is capped. It confirms the Base deposit but not the Robinhood Chain fill, and it does not persist a recoverable destination-delivery state.

The current product also delivers USDG but not ETH gas. A newly activated wallet can receive value yet remain unable to transact. It should not be described as complete wallet bootstrap until destination gas is addressed.

#### P0: public contract drift

The architect found inconsistencies between charged prices, `llms.txt`, OpenAPI, service catalog descriptions, and SDK parameters. One documented SDK parameter does not match the route’s required token-address field; the bridge documentation describes variable funding while the implementation sends a fixed 0.50 amount. These discrepancies can cause agents to fail before payment or misunderstand what they bought.

#### P1: DEX coverage is not chain-wide

The “top pools” and “chain stats” implementations query DexScreener using `q=USDC`, then aggregate only the returned Robinhood Chain subset. That is not a complete pool, volume, liquidity, or top-token index. It misses non-USDC and many RWA pools, precisely where recent activity has expanded. The output needs explicit coverage metadata until it uses canonical factory/event indexing or a verified indexer.

#### P1: oracle safety is incomplete

The current stock-price service hardcodes eight decimals and a common heartbeat. It does not validate positive answers, `answeredInRound`, per-feed decimals, per-feed heartbeat, sequencer uptime, Robinhood corporate-action multipliers, or `oraclePaused()`. Robinhood’s official documentation specifically calls for those checks.[[13]](https://docs.robinhood.com/chain/oracles-and-price-feeds)

Robinhood’s official Stock Token APIs expose asset metadata, contract addresses, current and pending multipliers, underlying market capabilities, bid/ask prices, and corporate actions.[[14]](https://docs.robinhood.com/chain/stock-token-apis) These APIs are the missing complement to Coin Railz’s on-chain feed reader.

## 4. Best opportunities

### 1. Robinhood RWA intelligence and safety API

Build a canonical asset registry that merges Robinhood `/assets`, `/prices`, and `/corporate-actions` with on-chain token contracts, Chainlink feed state, `uiMultiplier`, sequencer uptime, `oraclePaused()`, transfer restrictions, and jurisdiction metadata. Return provenance and timestamps for every field.

This is the strongest differentiated product because it solves a genuine RWA integration problem rather than reproducing generic token prices. Robinhood’s Stock Token documentation emphasizes corporate-action and jurisdiction behavior that ordinary crypto data APIs do not handle.[[15]](https://docs.robinhood.com/chain/stock-tokens)

### 2. Canonical pool intelligence and agent preflight

Index verified Uniswap factory events and published deployment addresses, then add:

- canonical pool/address verification;
- liquidity and volume with coverage disclosure;
- 1% and 5% price-impact estimates;
- Stock Token and USDG pool classification;
- oracle/market-session divergence;
- pool spoofing and thin-liquidity warnings;
- optional Rialto and other venue comparisons once their APIs and permissions are verified.

### 3. Reliable activation instead of treasury subsidy

Replace the current “pay $0.75 and receive treasury-funded 0.50 USDG” model with user-funded activation primitives:

- bridge quote and transaction construction;
- destination-fill tracking;
- ETH gas delivery or ERC-4337 sponsorship;
- explicit route choice and token representation;
- recoverable status and retry;
- optional sponsored pilot with a hard budget, not default economics.

### 4. Sequencer, oracle, and bridge reliability telemetry

Package sequencer uptime, oracle pause/freshness, bridge quote-to-fill, and RPC health into agent-callable monitoring. This is commercially relevant to Chainlink, Across, Robinhood ecosystem developers, and RWA applications.

## 5. Business-development priorities

| Priority | Target | Offer |
|---|---|---|
| 1 | Robinhood Chain developer ecosystem | Agent-ready RWA safety and activation quickstart; request technical review, not partnership branding |
| 2 | Chainlink ecosystem/data team | Validated feed-observability endpoint with staleness, sequencer, multiplier, and pause handling |
| 3 | Across integrations team | Observable quote-to-fill bridge primitive with bounded transactions and destination confirmation |
| 4 | Uniswap Robinhood deployment team | Canonical agent-safe pool intelligence using verified deployments |
| 5 | Rialto product/liquidity team | Shadow-mode intent preflight and aggregate route-quality telemetry after API terms are verified |

Do not lead with a generic DEX dashboard, retail stock-token trading, brokerage, custody, investment recommendations, treasury-subsidized bridging, or leveraged lending against stock-token collateral. Those areas are either weakly differentiated or create unnecessary financial/regulatory exposure.

## 6. Ranked action plan

### Fix now

1. Disable or harden `rh-bridge-usdc`: require zero or tightly capped transaction value, validate all quote/calldata fields, serialize treasury reservations, and track destination fill/recovery.
2. Correct Robinhood service prices, request schemas, SDK/plugin types, OpenAPI, `llms.txt`, service catalog, and payment-chain versus data-chain declarations from one canonical definition.
3. Implement Robinhood’s official oracle checks before marketing `rh-stock-price` as production-grade.

### Build next

4. Replace USDC-query DexScreener aggregation with canonical Uniswap indexing and explicit coverage/completeness fields.
5. Build the Stock Token metadata/corporate-action/oracle safety service.
6. Add destination ETH gas or ERC-4337 sponsorship to any activation flow.
7. Add a reconciled internal dashboard for DeFiLlama, explorer, Uniswap, bridge, and oracle-health metrics.

### Pursue commercially after technical proof

8. Robinhood developer ecosystem technical review.
9. Chainlink feed-semantics validation.
10. Across route and fill-status validation.
11. Uniswap deployment/indexing validation.
12. Two-builder paid beta before broader partnership claims.

## Limitations

Live TVL, DEX volume, transaction, and active-address figures are mutable and differed across providers during the same research session. They should be treated as dated ranges. Address and transaction counts do not establish unique human adoption. Across fill-time claims are vendor statements until independently measured. Coin Railz production telemetry can identify payment and user-agent behavior but cannot always identify the organization behind generic or missing user agents.

## Sources

1. [Robinhood Chain mainnet launch](https://robinhood.com/us/en/newsroom/robinhood-accelerates-global-expansion-robinhood-chain-mainnet-stock-tokens-agentic-trading) — July 1, 2026, Tier 1
2. [About Robinhood Chain](https://docs.robinhood.com/chain) — accessed September 4, 2026, Tier 1
3. [DeFiLlama chain API](https://api.llama.fi/v2/chains) — accessed September 4, 2026, Tier 2
4. [DeFiLlama Robinhood Chain](https://defillama.com/chain/robinhood-chain) — accessed September 4, 2026, Tier 2
5. [DeFiLlama Robinhood Chain DEXs](https://defillama.com/dexs/chain/robinhood-chain) — accessed September 4, 2026, Tier 2
6. [Robinhood Chain support and network details](https://robinhood.com/us/en/support/articles/robinhood-chain-mainnet) — accessed September 4, 2026, Tier 1
7. [Dune Robinhood Chain dashboard](https://dune.com/blockchains/robinhood) — accessed September 4, 2026, Tier 2
8. [Uniswap is live on Robinhood Chain](https://blog.uniswap.org/robinhood-chain-is-live) — July 1, 2026, Tier 1
9. [Uniswap Robinhood Chain deployments](https://developers.uniswap.org/docs/protocols/v3/deployments/v3-robinhood-chain-deployments) — accessed September 4, 2026, Tier 1
10. [Across bridge to Robinhood Chain](https://across.to/blog/bridge-to-robinhood-chain-with-across) — accessed September 4, 2026, Tier 1/vendor
11. [Robinhood Chain bridging documentation](https://docs.robinhood.com/chain/bridging) — accessed September 4, 2026, Tier 1
12. [Chainlink Data Feeds expansion](https://dev.chain.link/changelog/data-feeds-expands-to-robinhood-chain-mainnet) — July 1, 2026, Tier 1
13. [Robinhood Chain oracles and price feeds](https://docs.robinhood.com/chain/oracles-and-price-feeds) — accessed September 4, 2026, Tier 1
14. [Robinhood Stock Token APIs](https://docs.robinhood.com/chain/stock-token-apis) — accessed September 4, 2026, Tier 1
15. [Robinhood Stock Tokens](https://docs.robinhood.com/chain/stock-tokens) — accessed September 4, 2026, Tier 1# Coin Railz: 72-Hour Activity and Robinhood Chain Assessment

**Research date:** September 4, 2026  
**Depth:** Standard  
**Sources consulted:** 15 external sources, production telemetry, current code, architect review, and business-development review

## Executive summary

Coin Railz is not dormant. Production recorded **8,584 x402 interactions over the last 72 hours**, rising from 2,475 in the oldest 24-hour segment to 3,516 in the newest. The newest day reached 122 unique IPs, 34 user agents, and 91 services. This is a meaningful increase in discovery coverage. It is not, however, a conversion event: all 78 successful payment intents in the window were marked as internal canary payments, totaling $3.725. The most recent verified organic payment was a $0.25 `ping` payment on August 31, just outside the window.

The traffic is still dominated by monitors, validators, crawlers, and registry infrastructure. There are nonetheless new distribution signals: x402watch traversed 46 services, a new x402-MPP liveness actor covered 48 services, the published ElizaOS plugin generated a 134-request burst, rokmcp began recurring collection, and new A2A research clients completed matched requests. These signals show expanding machine visibility, not customer adoption.

Robinhood Chain has become a material ecosystem. Robinhood officially launched its public mainnet on July 1, 2026, and the live public RPC returns chain ID 4663.[[1]](https://robinhood.com/us/en/newsroom/robinhood-accelerates-global-expansion-robinhood-chain-mainnet-stock-tokens-agentic-trading) [[2]](https://docs.robinhood.com/chain) DeFiLlama showed approximately $838–841 million of TVL and between $1.35 billion and $1.82 billion of 24-hour DEX volume on September 4; the discrepancy reflects different live views and should be presented as a range, not a single audited number.[[3]](https://api.llama.fi/v2/chains) [[4]](https://defillama.com/chain/robinhood-chain) [[5]](https://defillama.com/dexs/chain/robinhood-chain) Uniswap represented roughly 76% of the lower DEX-volume figure. The chain also has official support from Chainlink, Across, Uniswap, Morpho, Rialto, Lighter, Arcus, Alchemy, BitGo, LayerZero, and others.[[2]](https://docs.robinhood.com/chain)

Coin Railz is **strategically aligned but not yet technically aligned enough to promote its Robinhood Chain suite aggressively**. Its five current service concepts are well chosen: token prices, DEX pools, chain statistics, stock-price feeds, and cross-chain activation. The architect found important implementation gaps: the DEX “chain” views only search DexScreener for `USDC`; the Chainlink reader does not implement Robinhood’s documented oracle-safety requirements; public schemas, prices, and SDK parameters have drifted; and the treasury-funded bridge accepts an external transaction `value` without a strict ETH cap and does not confirm destination delivery. These are fixable, but some are P0 safety and truthfulness issues.

The best opportunity is an **agent-ready Robinhood RWA intelligence and activation layer**: merge Robinhood’s official Stock Token APIs with canonical contract metadata, Chainlink feed state, sequencer uptime, corporate-action multipliers, transfer restrictions, oracle pauses, and verified Uniswap liquidity. That is materially more differentiated than a generic DEX dashboard and directly supports the chain’s RWA and agentic-account strategy.

## 1. Production activity: last 72 hours

### Traffic trend

| Window | Interactions | Payment challenges | MCP events | Landing views | Unique IPs | Services |
|---|---:|---:|---:|---:|---:|---:|
| Most recent 24h | 3,516 | 3,126 | 152 | 54 | 122 | 91 |
| Prior 24h | 2,593 | 2,414 | 95 | 20 | 90 | 83 |
| Oldest 24h | 2,475 | 2,303 | 94 | 15 | 75 | 69 |

Traffic increased by about **42%** from the oldest to newest daily segment. Service coverage expanded from 69 to 91, and unique IPs increased from 75 to 122. The increase is real, but the actor mix shows that it is primarily automated ecosystem activity.

### Payments

Production recorded 78 successful payment intents totaling $3.725. Every one was marked `is_canary=true`; there were no successful non-canary payment intents in the 72-hour window. The last organic payment currently visible in the authoritative ledger was:

- August 31, 2026: `ping`, $0.25, payer `0x6341…f356`.

This means the platform is being exercised continuously, but the latest traffic has not converted into organic revenue.

### Notable actors

| Actor | Activity | Interpretation |
|---|---:|---|
| `python-httpx/0.28.1` | 3,036 interactions, 27 services | Long-running validator; no payment signal |
| `x402-observer` | 2,132 interactions, 48 services | Trust/uptime monitor |
| Blank user agent | 763 interactions, 89 services | Broad infrastructure sweeper |
| `ZeroBot` | 451 interactions, 47 services | Automated ecosystem crawler |
| `x402watch` | 364 interactions, 46 services | New broad x402 monitor/index |
| `x402-mpp-liveness` | 212 interactions, 48 services | New liveness/protocol-compatibility signal |
| `elizaos-plugin-coinrailz/2.4.0` | 134 interactions | Real distribution artifact being exercised, but no payment |
| `rokmcp-collector` | 56 interactions | New recurring MCP indexer |
| `Pennywise-Candidate-Verifier` | 31 interactions from 31 IPs | Distributed candidate verification |

A2A traffic remained small but broadened. Agent-tools.cloud made 22 requests; the A2A registry made three; and both Lumidian research and a new interactive agent-card crawler completed matched requests. This is discovery progress, not yet a sales lead or conversion.

## 2. Robinhood Chain: current state

Robinhood Chain is a live, permissionless EVM-compatible Arbitrum Dedicated Chain using ETH for gas, with first-class ERC-4337 support and an explicit focus on tokenized real-world assets.[[2]](https://docs.robinhood.com/chain) Robinhood Wallet supports it natively, and ordinary EVM wallets can connect using chain ID 4663 and the public RPC.[[6]](https://robinhood.com/us/en/support/articles/robinhood-chain-mainnet)

Robinhood’s official launch states that Stock Tokens can trade around the clock, be used as collateral, and enter lending pools, subject to jurisdiction and asset restrictions.[[1]](https://robinhood.com/us/en/newsroom/robinhood-accelerates-global-expansion-robinhood-chain-mainnet-stock-tokens-agentic-trading) Robinhood also announced forthcoming agentic accounts that connect AI models to Robinhood data sources and trading strategies.[[1]](https://robinhood.com/us/en/newsroom/robinhood-accelerates-global-expansion-robinhood-chain-mainnet-stock-tokens-agentic-trading)

### Current metrics

| Metric | September 4 snapshot | Caveat |
|---|---:|---|
| TVL | ~$838m–$841m | DeFiLlama API and page snapshots; live and mutable |
| Alternate TVL | ~$541m | Dune-embedded view uses a different snapshot/method |
| DEX volume, 24h | ~$1.35bn–$1.82bn | Different DeFiLlama views disagreed intraday |
| DEX volume, 30d | ~$19.75bn | Live DeFiLlama DEX ranking |
| Uniswap 24h volume | ~$1.03bn | Approximately 76% of the $1.35bn view |
| Stablecoin market cap | ~$922m | Supply/capitalization, not AMM liquidity |
| USDG share | 64.72%, approximately $596m | Calculated from displayed stablecoin total |
| Bridged TVL | ~$3.04bn | Includes native, canonical, and third-party categories |
| RWA active market cap | ~$215m | Not executable pool liquidity |
| Weekly transactions | ~94.2m | Dune; not equivalent to unique humans |
| Weekly active addresses | ~7.2m | Dune; may include automation and incentives |

Sources: DeFiLlama chain and DEX views[[4]](https://defillama.com/chain/robinhood-chain) [[5]](https://defillama.com/dexs/chain/robinhood-chain), Dune’s Robinhood Chain dashboard[[7]](https://dune.com/blockchains/robinhood), and the live DeFiLlama chain API.[[3]](https://api.llama.fi/v2/chains)

The scale is significant, but it is concentrated. Uniswap is the dominant venue, creating execution depth but also venue concentration risk. Uniswap officially supports v2, v3, v4, UniswapX, Stock Tokens, its API, and agent-oriented integration tooling on Robinhood Chain.[[8]](https://blog.uniswap.org/robinhood-chain-is-live) Canonical Robinhood Chain deployment addresses are now published, which gives Coin Railz a reliable replacement for query-limited DexScreener discovery.[[9]](https://developers.uniswap.org/docs/protocols/v3/deployments/v3-robinhood-chain-deployments)

Across supports routes from multiple chains in which USDC arrives as USDG, as well as ETH bridging and reverse USDG-to-USDC paths; its two-second fill statement is a vendor claim and should be measured independently.[[10]](https://across.to/blog/bridge-to-robinhood-chain-with-across) Robinhood also documents the canonical Arbitrum bridge, LayerZero/Stargate, Chainlink CCIP, Relay, Across, LiFi, and 0x.[[11]](https://docs.robinhood.com/chain/bridging)

Chainlink Data Feeds launched on mainnet on July 1.[[12]](https://dev.chain.link/changelog/data-feeds-expands-to-robinhood-chain-mainnet) Robinhood’s integration guidance explicitly requires consumers to handle dynamic decimals, stale rounds, non-positive answers, sequencer downtime, corporate-action multipliers, and `oraclePaused()` states.[[13]](https://docs.robinhood.com/chain/oracles-and-price-feeds)

## 3. Coin Railz alignment

### What Coin Railz got right

Coin Railz entered the ecosystem with the correct primitives:

1. Robinhood Chain token and pool discovery.
2. Chain status and RPC-derived information.
3. Batched Chainlink stock/ETF/crypto feed reads.
4. Base-to-Robinhood Chain funding through Across.
5. x402 packaging that makes the services callable by autonomous agents.

This maps well to Robinhood’s developer, RWA, ERC-4337, bridge, oracle, and agentic-account direction. The strategy should be retained.

### Where the implementation is misaligned

#### P0: bridge safety and delivery semantics

The bridge bounds USDC approval and validates several decoded `depositV3` fields, which is good. However, it forwards `txData.value` from an external API without requiring zero or enforcing a strict ETH cap. A malformed or compromised response could therefore spend Base ETH even though token approval is capped. It confirms the Base deposit but not the Robinhood Chain fill, and it does not persist a recoverable destination-delivery state.

The current product also delivers USDG but not ETH gas. A newly activated wallet can receive value yet remain unable to transact. It should not be described as complete wallet bootstrap until destination gas is addressed.

#### P0: public contract drift

The architect found inconsistencies between charged prices, `llms.txt`, OpenAPI, service catalog descriptions, and SDK parameters. One documented SDK parameter does not match the route’s required token-address field; the bridge documentation describes variable funding while the implementation sends a fixed 0.50 amount. These discrepancies can cause agents to fail before payment or misunderstand what they bought.

#### P1: DEX coverage is not chain-wide

The “top pools” and “chain stats” implementations query DexScreener using `q=USDC`, then aggregate only the returned Robinhood Chain subset. That is not a complete pool, volume, liquidity, or top-token index. It misses non-USDC and many RWA pools, precisely where recent activity has expanded. The output needs explicit coverage metadata until it uses canonical factory/event indexing or a verified indexer.

#### P1: oracle safety is incomplete

The current stock-price service hardcodes eight decimals and a common heartbeat. It does not validate positive answers, `answeredInRound`, per-feed decimals, per-feed heartbeat, sequencer uptime, Robinhood corporate-action multipliers, or `oraclePaused()`. Robinhood’s official documentation specifically calls for those checks.[[13]](https://docs.robinhood.com/chain/oracles-and-price-feeds)

Robinhood’s official Stock Token APIs expose asset metadata, contract addresses, current and pending multipliers, underlying market capabilities, bid/ask prices, and corporate actions.[[14]](https://docs.robinhood.com/chain/stock-token-apis) These APIs are the missing complement to Coin Railz’s on-chain feed reader.

## 4. Best opportunities

### 1. Robinhood RWA intelligence and safety API

Build a canonical asset registry that merges Robinhood `/assets`, `/prices`, and `/corporate-actions` with on-chain token contracts, Chainlink feed state, `uiMultiplier`, sequencer uptime, `oraclePaused()`, transfer restrictions, and jurisdiction metadata. Return provenance and timestamps for every field.

This is the strongest differentiated product because it solves a genuine RWA integration problem rather than reproducing generic token prices. Robinhood’s Stock Token documentation emphasizes corporate-action and jurisdiction behavior that ordinary crypto data APIs do not handle.[[15]](https://docs.robinhood.com/chain/stock-tokens)

### 2. Canonical pool intelligence and agent preflight

Index verified Uniswap factory events and published deployment addresses, then add:

- canonical pool/address verification;
- liquidity and volume with coverage disclosure;
- 1% and 5% price-impact estimates;
- Stock Token and USDG pool classification;
- oracle/market-session divergence;
- pool spoofing and thin-liquidity warnings;
- optional Rialto and other venue comparisons once their APIs and permissions are verified.

### 3. Reliable activation instead of treasury subsidy

Replace the current “pay $0.75 and receive treasury-funded 0.50 USDG” model with user-funded activation primitives:

- bridge quote and transaction construction;
- destination-fill tracking;
- ETH gas delivery or ERC-4337 sponsorship;
- explicit route choice and token representation;
- recoverable status and retry;
- optional sponsored pilot with a hard budget, not default economics.

### 4. Sequencer, oracle, and bridge reliability telemetry

Package sequencer uptime, oracle pause/freshness, bridge quote-to-fill, and RPC health into agent-callable monitoring. This is commercially relevant to Chainlink, Across, Robinhood ecosystem developers, and RWA applications.

## 5. Business-development priorities

| Priority | Target | Offer |
|---|---|---|
| 1 | Robinhood Chain developer ecosystem | Agent-ready RWA safety and activation quickstart; request technical review, not partnership branding |
| 2 | Chainlink ecosystem/data team | Validated feed-observability endpoint with staleness, sequencer, multiplier, and pause handling |
| 3 | Across integrations team | Observable quote-to-fill bridge primitive with bounded transactions and destination confirmation |
| 4 | Uniswap Robinhood deployment team | Canonical agent-safe pool intelligence using verified deployments |
| 5 | Rialto product/liquidity team | Shadow-mode intent preflight and aggregate route-quality telemetry after API terms are verified |

Do not lead with a generic DEX dashboard, retail stock-token trading, brokerage, custody, investment recommendations, treasury-subsidized bridging, or leveraged lending against stock-token collateral. Those areas are either weakly differentiated or create unnecessary financial/regulatory exposure.

## 6. Ranked action plan

### Fix now

1. Disable or harden `rh-bridge-usdc`: require zero or tightly capped transaction value, validate all quote/calldata fields, serialize treasury reservations, and track destination fill/recovery.
2. Correct Robinhood service prices, request schemas, SDK/plugin types, OpenAPI, `llms.txt`, service catalog, and payment-chain versus data-chain declarations from one canonical definition.
3. Implement Robinhood’s official oracle checks before marketing `rh-stock-price` as production-grade.

### Build next

4. Replace USDC-query DexScreener aggregation with canonical Uniswap indexing and explicit coverage/completeness fields.
5. Build the Stock Token metadata/corporate-action/oracle safety service.
6. Add destination ETH gas or ERC-4337 sponsorship to any activation flow.
7. Add a reconciled internal dashboard for DeFiLlama, explorer, Uniswap, bridge, and oracle-health metrics.

### Pursue commercially after technical proof

8. Robinhood developer ecosystem technical review.
9. Chainlink feed-semantics validation.
10. Across route and fill-status validation.
11. Uniswap deployment/indexing validation.
12. Two-builder paid beta before broader partnership claims.

## Limitations

Live TVL, DEX volume, transaction, and active-address figures are mutable and differed across providers during the same research session. They should be treated as dated ranges. Address and transaction counts do not establish unique human adoption. Across fill-time claims are vendor statements until independently measured. Coin Railz production telemetry can identify payment and user-agent behavior but cannot always identify the organization behind generic or missing user agents.

## Sources

1. [Robinhood Chain mainnet launch](https://robinhood.com/us/en/newsroom/robinhood-accelerates-global-expansion-robinhood-chain-mainnet-stock-tokens-agentic-trading) — July 1, 2026, Tier 1
2. [About Robinhood Chain](https://docs.robinhood.com/chain) — accessed September 4, 2026, Tier 1
3. [DeFiLlama chain API](https://api.llama.fi/v2/chains) — accessed September 4, 2026, Tier 2
4. [DeFiLlama Robinhood Chain](https://defillama.com/chain/robinhood-chain) — accessed September 4, 2026, Tier 2
5. [DeFiLlama Robinhood Chain DEXs](https://defillama.com/dexs/chain/robinhood-chain) — accessed September 4, 2026, Tier 2
6. [Robinhood Chain support and network details](https://robinhood.com/us/en/support/articles/robinhood-chain-mainnet) — accessed September 4, 2026, Tier 1
7. [Dune Robinhood Chain dashboard](https://dune.com/blockchains/robinhood) — accessed September 4, 2026, Tier 2
8. [Uniswap is live on Robinhood Chain](https://blog.uniswap.org/robinhood-chain-is-live) — July 1, 2026, Tier 1
9. [Uniswap Robinhood Chain deployments](https://developers.uniswap.org/docs/protocols/v3/deployments/v3-robinhood-chain-deployments) — accessed September 4, 2026, Tier 1
10. [Across bridge to Robinhood Chain](https://across.to/blog/bridge-to-robinhood-chain-with-across) — accessed September 4, 2026, Tier 1/vendor
11. [Robinhood Chain bridging documentation](https://docs.robinhood.com/chain/bridging) — accessed September 4, 2026, Tier 1
12. [Chainlink Data Feeds expansion](https://dev.chain.link/changelog/data-feeds-expands-to-robinhood-chain-mainnet) — July 1, 2026, Tier 1
13. [Robinhood Chain oracles and price feeds](https://docs.robinhood.com/chain/oracles-and-price-feeds) — accessed September 4, 2026, Tier 1
14. [Robinhood Stock Token APIs](https://docs.robinhood.com/chain/stock-token-apis) — accessed September 4, 2026, Tier 1
15. [Robinhood Stock Tokens](https://docs.robinhood.com/chain/stock-tokens) — accessed September 4, 2026, Tier 1# Coin Railz: 72-Hour Activity and Robinhood Chain Assessment

**Research date:** September 4, 2026  
**Depth:** Standard  
**Sources consulted:** 15 external sources, production telemetry, current code, architect review, and business-development review

## Executive summary

Coin Railz is not dormant. Production recorded **8,584 x402 interactions over the last 72 hours**, rising from 2,475 in the oldest 24-hour segment to 3,516 in the newest. The newest day reached 122 unique IPs, 34 user agents, and 91 services. This is a meaningful increase in discovery coverage. It is not, however, a conversion event: all 78 successful payment intents in the window were marked as internal canary payments, totaling $3.725. The most recent verified organic payment was a $0.25 `ping` payment on August 31, just outside the window.

The traffic is still dominated by monitors, validators, crawlers, and registry infrastructure. There are nonetheless new distribution signals: x402watch traversed 46 services, a new x402-MPP liveness actor covered 48 services, the published ElizaOS plugin generated a 134-request burst, rokmcp began recurring collection, and new A2A research clients completed matched requests. These signals show expanding machine visibility, not customer adoption.

Robinhood Chain has become a material ecosystem. Robinhood officially launched its public mainnet on July 1, 2026, and the live public RPC returns chain ID 4663.[[1]](https://robinhood.com/us/en/newsroom/robinhood-accelerates-global-expansion-robinhood-chain-mainnet-stock-tokens-agentic-trading) [[2]](https://docs.robinhood.com/chain) DeFiLlama showed approximately $838–841 million of TVL and between $1.35 billion and $1.82 billion of 24-hour DEX volume on September 4; the discrepancy reflects different live views and should be presented as a range, not a single audited number.[[3]](https://api.llama.fi/v2/chains) [[4]](https://defillama.com/chain/robinhood-chain) [[5]](https://defillama.com/dexs/chain/robinhood-chain) Uniswap represented roughly 76% of the lower DEX-volume figure. The chain also has official support from Chainlink, Across, Uniswap, Morpho, Rialto, Lighter, Arcus, Alchemy, BitGo, LayerZero, and others.[[2]](https://docs.robinhood.com/chain)

Coin Railz is **strategically aligned but not yet technically aligned enough to promote its Robinhood Chain suite aggressively**. Its five current service concepts are well chosen: token prices, DEX pools, chain statistics, stock-price feeds, and cross-chain activation. The architect found important implementation gaps: the DEX “chain” views only search DexScreener for `USDC`; the Chainlink reader does not implement Robinhood’s documented oracle-safety requirements; public schemas, prices, and SDK parameters have drifted; and the treasury-funded bridge accepts an external transaction `value` without a strict ETH cap and does not confirm destination delivery. These are fixable, but some are P0 safety and truthfulness issues.

The best opportunity is an **agent-ready Robinhood RWA intelligence and activation layer**: merge Robinhood’s official Stock Token APIs with canonical contract metadata, Chainlink feed state, sequencer uptime, corporate-action multipliers, transfer restrictions, oracle pauses, and verified Uniswap liquidity. That is materially more differentiated than a generic DEX dashboard and directly supports the chain’s RWA and agentic-account strategy.

## 1. Production activity: last 72 hours

### Traffic trend

| Window | Interactions | Payment challenges | MCP events | Landing views | Unique IPs | Services |
|---|---:|---:|---:|---:|---:|---:|
| Most recent 24h | 3,516 | 3,126 | 152 | 54 | 122 | 91 |
| Prior 24h | 2,593 | 2,414 | 95 | 20 | 90 | 83 |
| Oldest 24h | 2,475 | 2,303 | 94 | 15 | 75 | 69 |

Traffic increased by about **42%** from the oldest to newest daily segment. Service coverage expanded from 69 to 91, and unique IPs increased from 75 to 122. The increase is real, but the actor mix shows that it is primarily automated ecosystem activity.

### Payments

Production recorded 78 successful payment intents totaling $3.725. Every one was marked `is_canary=true`; there were no successful non-canary payment intents in the 72-hour window. The last organic payment currently visible in the authoritative ledger was:

- August 31, 2026: `ping`, $0.25, payer `0x6341…f356`.

This means the platform is being exercised continuously, but the latest traffic has not converted into organic revenue.

### Notable actors

| Actor | Activity | Interpretation |
|---|---:|---|
| `python-httpx/0.28.1` | 3,036 interactions, 27 services | Long-running validator; no payment signal |
| `x402-observer` | 2,132 interactions, 48 services | Trust/uptime monitor |
| Blank user agent | 763 interactions, 89 services | Broad infrastructure sweeper |
| `ZeroBot` | 451 interactions, 47 services | Automated ecosystem crawler |
| `x402watch` | 364 interactions, 46 services | New broad x402 monitor/index |
| `x402-mpp-liveness` | 212 interactions, 48 services | New liveness/protocol-compatibility signal |
| `elizaos-plugin-coinrailz/2.4.0` | 134 interactions | Real distribution artifact being exercised, but no payment |
| `rokmcp-collector` | 56 interactions | New recurring MCP indexer |
| `Pennywise-Candidate-Verifier` | 31 interactions from 31 IPs | Distributed candidate verification |

A2A traffic remained small but broadened. Agent-tools.cloud made 22 requests; the A2A registry made three; and both Lumidian research and a new interactive agent-card crawler completed matched requests. This is discovery progress, not yet a sales lead or conversion.

## 2. Robinhood Chain: current state

Robinhood Chain is a live, permissionless EVM-compatible Arbitrum Dedicated Chain using ETH for gas, with first-class ERC-4337 support and an explicit focus on tokenized real-world assets.[[2]](https://docs.robinhood.com/chain) Robinhood Wallet supports it natively, and ordinary EVM wallets can connect using chain ID 4663 and the public RPC.[[6]](https://robinhood.com/us/en/support/articles/robinhood-chain-mainnet)

Robinhood’s official launch states that Stock Tokens can trade around the clock, be used as collateral, and enter lending pools, subject to jurisdiction and asset restrictions.[[1]](https://robinhood.com/us/en/newsroom/robinhood-accelerates-global-expansion-robinhood-chain-mainnet-stock-tokens-agentic-trading) Robinhood also announced forthcoming agentic accounts that connect AI models to Robinhood data sources and trading strategies.[[1]](https://robinhood.com/us/en/newsroom/robinhood-accelerates-global-expansion-robinhood-chain-mainnet-stock-tokens-agentic-trading)

### Current metrics

| Metric | September 4 snapshot | Caveat |
|---|---:|---|
| TVL | ~$838m–$841m | DeFiLlama API and page snapshots; live and mutable |
| Alternate TVL | ~$541m | Dune-embedded view uses a different snapshot/method |
| DEX volume, 24h | ~$1.35bn–$1.82bn | Different DeFiLlama views disagreed intraday |
| DEX volume, 30d | ~$19.75bn | Live DeFiLlama DEX ranking |
| Uniswap 24h volume | ~$1.03bn | Approximately 76% of the $1.35bn view |
| Stablecoin market cap | ~$922m | Supply/capitalization, not AMM liquidity |
| USDG share | 64.72%, approximately $596m | Calculated from displayed stablecoin total |
| Bridged TVL | ~$3.04bn | Includes native, canonical, and third-party categories |
| RWA active market cap | ~$215m | Not executable pool liquidity |
| Weekly transactions | ~94.2m | Dune; not equivalent to unique humans |
| Weekly active addresses | ~7.2m | Dune; may include automation and incentives |

Sources: DeFiLlama chain and DEX views[[4]](https://defillama.com/chain/robinhood-chain) [[5]](https://defillama.com/dexs/chain/robinhood-chain), Dune’s Robinhood Chain dashboard[[7]](https://dune.com/blockchains/robinhood), and the live DeFiLlama chain API.[[3]](https://api.llama.fi/v2/chains)

The scale is significant, but it is concentrated. Uniswap is the dominant venue, creating execution depth but also venue concentration risk. Uniswap officially supports v2, v3, v4, UniswapX, Stock Tokens, its API, and agent-oriented integration tooling on Robinhood Chain.[[8]](https://blog.uniswap.org/robinhood-chain-is-live) Canonical Robinhood Chain deployment addresses are now published, which gives Coin Railz a reliable replacement for query-limited DexScreener discovery.[[9]](https://developers.uniswap.org/docs/protocols/v3/deployments/v3-robinhood-chain-deployments)

Across supports routes from multiple chains in which USDC arrives as USDG, as well as ETH bridging and reverse USDG-to-USDC paths; its two-second fill statement is a vendor claim and should be measured independently.[[10]](https://across.to/blog/bridge-to-robinhood-chain-with-across) Robinhood also documents the canonical Arbitrum bridge, LayerZero/Stargate, Chainlink CCIP, Relay, Across, LiFi, and 0x.[[11]](https://docs.robinhood.com/chain/bridging)

Chainlink Data Feeds launched on mainnet on July 1.[[12]](https://dev.chain.link/changelog/data-feeds-expands-to-robinhood-chain-mainnet) Robinhood’s integration guidance explicitly requires consumers to handle dynamic decimals, stale rounds, non-positive answers, sequencer downtime, corporate-action multipliers, and `oraclePaused()` states.[[13]](https://docs.robinhood.com/chain/oracles-and-price-feeds)

## 3. Coin Railz alignment

### What Coin Railz got right

Coin Railz entered the ecosystem with the correct primitives:

1. Robinhood Chain token and pool discovery.
2. Chain status and RPC-derived information.
3. Batched Chainlink stock/ETF/crypto feed reads.
4. Base-to-Robinhood Chain funding through Across.
5. x402 packaging that makes the services callable by autonomous agents.

This maps well to Robinhood’s developer, RWA, ERC-4337, bridge, oracle, and agentic-account direction. The strategy should be retained.

### Where the implementation is misaligned

#### P0: bridge safety and delivery semantics

The bridge bounds USDC approval and validates several decoded `depositV3` fields, which is good. However, it forwards `txData.value` from an external API without requiring zero or enforcing a strict ETH cap. A malformed or compromised response could therefore spend Base ETH even though token approval is capped. It confirms the Base deposit but not the Robinhood Chain fill, and it does not persist a recoverable destination-delivery state.

The current product also delivers USDG but not ETH gas. A newly activated wallet can receive value yet remain unable to transact. It should not be described as complete wallet bootstrap until destination gas is addressed.

#### P0: public contract drift

The architect found inconsistencies between charged prices, `llms.txt`, OpenAPI, service catalog descriptions, and SDK parameters. One documented SDK parameter does not match the route’s required token-address field; the bridge documentation describes variable funding while the implementation sends a fixed 0.50 amount. These discrepancies can cause agents to fail before payment or misunderstand what they bought.

#### P1: DEX coverage is not chain-wide

The “top pools” and “chain stats” implementations query DexScreener using `q=USDC`, then aggregate only the returned Robinhood Chain subset. That is not a complete pool, volume, liquidity, or top-token index. It misses non-USDC and many RWA pools, precisely where recent activity has expanded. The output needs explicit coverage metadata until it uses canonical factory/event indexing or a verified indexer.

#### P1: oracle safety is incomplete

The current stock-price service hardcodes eight decimals and a common heartbeat. It does not validate positive answers, `answeredInRound`, per-feed decimals, per-feed heartbeat, sequencer uptime, Robinhood corporate-action multipliers, or `oraclePaused()`. Robinhood’s official documentation specifically calls for those checks.[[13]](https://docs.robinhood.com/chain/oracles-and-price-feeds)

Robinhood’s official Stock Token APIs expose asset metadata, contract addresses, current and pending multipliers, underlying market capabilities, bid/ask prices, and corporate actions.[[14]](https://docs.robinhood.com/chain/stock-token-apis) These APIs are the missing complement to Coin Railz’s on-chain feed reader.

## 4. Best opportunities

### 1. Robinhood RWA intelligence and safety API

Build a canonical asset registry that merges Robinhood `/assets`, `/prices`, and `/corporate-actions` with on-chain token contracts, Chainlink feed state, `uiMultiplier`, sequencer uptime, `oraclePaused()`, transfer restrictions, and jurisdiction metadata. Return provenance and timestamps for every field.

This is the strongest differentiated product because it solves a genuine RWA integration problem rather than reproducing generic token prices. Robinhood’s Stock Token documentation emphasizes corporate-action and jurisdiction behavior that ordinary crypto data APIs do not handle.[[15]](https://docs.robinhood.com/chain/stock-tokens)

### 2. Canonical pool intelligence and agent preflight

Index verified Uniswap factory events and published deployment addresses, then add:

- canonical pool/address verification;
- liquidity and volume with coverage disclosure;
- 1% and 5% price-impact estimates;
- Stock Token and USDG pool classification;
- oracle/market-session divergence;
- pool spoofing and thin-liquidity warnings;
- optional Rialto and other venue comparisons once their APIs and permissions are verified.

### 3. Reliable activation instead of treasury subsidy

Replace the current “pay $0.75 and receive treasury-funded 0.50 USDG” model with user-funded activation primitives:

- bridge quote and transaction construction;
- destination-fill tracking;
- ETH gas delivery or ERC-4337 sponsorship;
- explicit route choice and token representation;
- recoverable status and retry;
- optional sponsored pilot with a hard budget, not default economics.

### 4. Sequencer, oracle, and bridge reliability telemetry

Package sequencer uptime, oracle pause/freshness, bridge quote-to-fill, and RPC health into agent-callable monitoring. This is commercially relevant to Chainlink, Across, Robinhood ecosystem developers, and RWA applications.

## 5. Business-development priorities

| Priority | Target | Offer |
|---|---|---|
| 1 | Robinhood Chain developer ecosystem | Agent-ready RWA safety and activation quickstart; request technical review, not partnership branding |
| 2 | Chainlink ecosystem/data team | Validated feed-observability endpoint with staleness, sequencer, multiplier, and pause handling |
| 3 | Across integrations team | Observable quote-to-fill bridge primitive with bounded transactions and destination confirmation |
| 4 | Uniswap Robinhood deployment team | Canonical agent-safe pool intelligence using verified deployments |
| 5 | Rialto product/liquidity team | Shadow-mode intent preflight and aggregate route-quality telemetry after API terms are verified |

Do not lead with a generic DEX dashboard, retail stock-token trading, brokerage, custody, investment recommendations, treasury-subsidized bridging, or leveraged lending against stock-token collateral. Those areas are either weakly differentiated or create unnecessary financial/regulatory exposure.

## 6. Ranked action plan

### Fix now

1. Disable or harden `rh-bridge-usdc`: require zero or tightly capped transaction value, validate all quote/calldata fields, serialize treasury reservations, and track destination fill/recovery.
2. Correct Robinhood service prices, request schemas, SDK/plugin types, OpenAPI, `llms.txt`, service catalog, and payment-chain versus data-chain declarations from one canonical definition.
3. Implement Robinhood’s official oracle checks before marketing `rh-stock-price` as production-grade.

### Build next

4. Replace USDC-query DexScreener aggregation with canonical Uniswap indexing and explicit coverage/completeness fields.
5. Build the Stock Token metadata/corporate-action/oracle safety service.
6. Add destination ETH gas or ERC-4337 sponsorship to any activation flow.
7. Add a reconciled internal dashboard for DeFiLlama, explorer, Uniswap, bridge, and oracle-health metrics.

### Pursue commercially after technical proof

8. Robinhood developer ecosystem technical review.
9. Chainlink feed-semantics validation.
10. Across route and fill-status validation.
11. Uniswap deployment/indexing validation.
12. Two-builder paid beta before broader partnership claims.

## Limitations

Live TVL, DEX volume, transaction, and active-address figures are mutable and differed across providers during the same research session. They should be treated as dated ranges. Address and transaction counts do not establish unique human adoption. Across fill-time claims are vendor statements until independently measured. Coin Railz production telemetry can identify payment and user-agent behavior but cannot always identify the organization behind generic or missing user agents.

## Sources

1. [Robinhood Chain mainnet launch](https://robinhood.com/us/en/newsroom/robinhood-accelerates-global-expansion-robinhood-chain-mainnet-stock-tokens-agentic-trading) — July 1, 2026, Tier 1
2. [About Robinhood Chain](https://docs.robinhood.com/chain) — accessed September 4, 2026, Tier 1
3. [DeFiLlama chain API](https://api.llama.fi/v2/chains) — accessed September 4, 2026, Tier 2
4. [DeFiLlama Robinhood Chain](https://defillama.com/chain/robinhood-chain) — accessed September 4, 2026, Tier 2
5. [DeFiLlama Robinhood Chain DEXs](https://defillama.com/dexs/chain/robinhood-chain) — accessed September 4, 2026, Tier 2
6. [Robinhood Chain support and network details](https://robinhood.com/us/en/support/articles/robinhood-chain-mainnet) — accessed September 4, 2026, Tier 1
7. [Dune Robinhood Chain dashboard](https://dune.com/blockchains/robinhood) — accessed September 4, 2026, Tier 2
8. [Uniswap is live on Robinhood Chain](https://blog.uniswap.org/robinhood-chain-is-live) — July 1, 2026, Tier 1
9. [Uniswap Robinhood Chain deployments](https://developers.uniswap.org/docs/protocols/v3/deployments/v3-robinhood-chain-deployments) — accessed September 4, 2026, Tier 1
10. [Across bridge to Robinhood Chain](https://across.to/blog/bridge-to-robinhood-chain-with-across) — accessed September 4, 2026, Tier 1/vendor
11. [Robinhood Chain bridging documentation](https://docs.robinhood.com/chain/bridging) — accessed September 4, 2026, Tier 1
12. [Chainlink Data Feeds expansion](https://dev.chain.link/changelog/data-feeds-expands-to-robinhood-chain-mainnet) — July 1, 2026, Tier 1
13. [Robinhood Chain oracles and price feeds](https://docs.robinhood.com/chain/oracles-and-price-feeds) — accessed September 4, 2026, Tier 1
14. [Robinhood Stock Token APIs](https://docs.robinhood.com/chain/stock-token-apis) — accessed September 4, 2026, Tier 1
15. [Robinhood Stock Tokens](https://docs.robinhood.com/chain/stock-tokens) — accessed September 4, 2026, Tier 1# Coin Railz: 72-Hour Activity and Robinhood Chain Assessment

**Research date:** September 4, 2026  
**Depth:** Standard  
**Sources consulted:** 15 external sources, production telemetry, current code, architect review, and business-development review

## Executive summary

Coin Railz is not dormant. Production recorded **8,584 x402 interactions over the last 72 hours**, rising from 2,475 in the oldest 24-hour segment to 3,516 in the newest. The newest day reached 122 unique IPs, 34 user agents, and 91 services. This is a meaningful increase in discovery coverage. It is not, however, a conversion event: all 78 successful payment intents in the window were marked as internal canary payments, totaling $3.725. The most recent verified organic payment was a $0.25 `ping` payment on August 31, just outside the window.

The traffic is still dominated by monitors, validators, crawlers, and registry infrastructure. There are nonetheless new distribution signals: x402watch traversed 46 services, a new x402-MPP liveness actor covered 48 services, the published ElizaOS plugin generated a 134-request burst, rokmcp began recurring collection, and new A2A research clients completed matched requests. These signals show expanding machine visibility, not customer adoption.

Robinhood Chain has become a material ecosystem. Robinhood officially launched its public mainnet on July 1, 2026, and the live public RPC returns chain ID 4663.[[1]](https://robinhood.com/us/en/newsroom/robinhood-accelerates-global-expansion-robinhood-chain-mainnet-stock-tokens-agentic-trading) [[2]](https://docs.robinhood.com/chain) DeFiLlama showed approximately $838–841 million of TVL and between $1.35 billion and $1.82 billion of 24-hour DEX volume on September 4; the discrepancy reflects different live views and should be presented as a range, not a single audited number.[[3]](https://api.llama.fi/v2/chains) [[4]](https://defillama.com/chain/robinhood-chain) [[5]](https://defillama.com/dexs/chain/robinhood-chain) Uniswap represented roughly 76% of the lower DEX-volume figure. The chain also has official support from Chainlink, Across, Uniswap, Morpho, Rialto, Lighter, Arcus, Alchemy, BitGo, LayerZero, and others.[[2]](https://docs.robinhood.com/chain)

Coin Railz is **strategically aligned but not yet technically aligned enough to promote its Robinhood Chain suite aggressively**. Its five current service concepts are well chosen: token prices, DEX pools, chain statistics, stock-price feeds, and cross-chain activation. The architect found important implementation gaps: the DEX “chain” views only search DexScreener for `USDC`; the Chainlink reader does not implement Robinhood’s documented oracle-safety requirements; public schemas, prices, and SDK parameters have drifted; and the treasury-funded bridge accepts an external transaction `value` without a strict ETH cap and does not confirm destination delivery. These are fixable, but some are P0 safety and truthfulness issues.

The best opportunity is an **agent-ready Robinhood RWA intelligence and activation layer**: merge Robinhood’s official Stock Token APIs with canonical contract metadata, Chainlink feed state, sequencer uptime, corporate-action multipliers, transfer restrictions, oracle pauses, and verified Uniswap liquidity. That is materially more differentiated than a generic DEX dashboard and directly supports the chain’s RWA and agentic-account strategy.

## 1. Production activity: last 72 hours

### Traffic trend

| Window | Interactions | Payment challenges | MCP events | Landing views | Unique IPs | Services |
|---|---:|---:|---:|---:|---:|---:|
| Most recent 24h | 3,516 | 3,126 | 152 | 54 | 122 | 91 |
| Prior 24h | 2,593 | 2,414 | 95 | 20 | 90 | 83 |
| Oldest 24h | 2,475 | 2,303 | 94 | 15 | 75 | 69 |

Traffic increased by about **42%** from the oldest to newest daily segment. Service coverage expanded from 69 to 91, and unique IPs increased from 75 to 122. The increase is real, but the actor mix shows that it is primarily automated ecosystem activity.

### Payments

Production recorded 78 successful payment intents totaling $3.725. Every one was marked `is_canary=true`; there were no successful non-canary payment intents in the 72-hour window. The last organic payment currently visible in the authoritative ledger was:

- August 31, 2026: `ping`, $0.25, payer `0x6341…f356`.

This means the platform is being exercised continuously, but the latest traffic has not converted into organic revenue.

### Notable actors

| Actor | Activity | Interpretation |
|---|---:|---|
| `python-httpx/0.28.1` | 3,036 interactions, 27 services | Long-running validator; no payment signal |
| `x402-observer` | 2,132 interactions, 48 services | Trust/uptime monitor |
| Blank user agent | 763 interactions, 89 services | Broad infrastructure sweeper |
| `ZeroBot` | 451 interactions, 47 services | Automated ecosystem crawler |
| `x402watch` | 364 interactions, 46 services | New broad x402 monitor/index |
| `x402-mpp-liveness` | 212 interactions, 48 services | New liveness/protocol-compatibility signal |
| `elizaos-plugin-coinrailz/2.4.0` | 134 interactions | Real distribution artifact being exercised, but no payment |
| `rokmcp-collector` | 56 interactions | New recurring MCP indexer |
| `Pennywise-Candidate-Verifier` | 31 interactions from 31 IPs | Distributed candidate verification |

A2A traffic remained small but broadened. Agent-tools.cloud made 22 requests; the A2A registry made three; and both Lumidian research and a new interactive agent-card crawler completed matched requests. This is discovery progress, not yet a sales lead or conversion.

## 2. Robinhood Chain: current state

Robinhood Chain is a live, permissionless EVM-compatible Arbitrum Dedicated Chain using ETH for gas, with first-class ERC-4337 support and an explicit focus on tokenized real-world assets.[[2]](https://docs.robinhood.com/chain) Robinhood Wallet supports it natively, and ordinary EVM wallets can connect using chain ID 4663 and the public RPC.[[6]](https://robinhood.com/us/en/support/articles/robinhood-chain-mainnet)

Robinhood’s official launch states that Stock Tokens can trade around the clock, be used as collateral, and enter lending pools, subject to jurisdiction and asset restrictions.[[1]](https://robinhood.com/us/en/newsroom/robinhood-accelerates-global-expansion-robinhood-chain-mainnet-stock-tokens-agentic-trading) Robinhood also announced forthcoming agentic accounts that connect AI models to Robinhood data sources and trading strategies.[[1]](https://robinhood.com/us/en/newsroom/robinhood-accelerates-global-expansion-robinhood-chain-mainnet-stock-tokens-agentic-trading)

### Current metrics

| Metric | September 4 snapshot | Caveat |
|---|---:|---|
| TVL | ~$838m–$841m | DeFiLlama API and page snapshots; live and mutable |
| Alternate TVL | ~$541m | Dune-embedded view uses a different snapshot/method |
| DEX volume, 24h | ~$1.35bn–$1.82bn | Different DeFiLlama views disagreed intraday |
| DEX volume, 30d | ~$19.75bn | Live DeFiLlama DEX ranking |
| Uniswap 24h volume | ~$1.03bn | Approximately 76% of the $1.35bn view |
| Stablecoin market cap | ~$922m | Supply/capitalization, not AMM liquidity |
| USDG share | 64.72%, approximately $596m | Calculated from displayed stablecoin total |
| Bridged TVL | ~$3.04bn | Includes native, canonical, and third-party categories |
| RWA active market cap | ~$215m | Not executable pool liquidity |
| Weekly transactions | ~94.2m | Dune; not equivalent to unique humans |
| Weekly active addresses | ~7.2m | Dune; may include automation and incentives |

Sources: DeFiLlama chain and DEX views[[4]](https://defillama.com/chain/robinhood-chain) [[5]](https://defillama.com/dexs/chain/robinhood-chain), Dune’s Robinhood Chain dashboard[[7]](https://dune.com/blockchains/robinhood), and the live DeFiLlama chain API.[[3]](https://api.llama.fi/v2/chains)

The scale is significant, but it is concentrated. Uniswap is the dominant venue, creating execution depth but also venue concentration risk. Uniswap officially supports v2, v3, v4, UniswapX, Stock Tokens, its API, and agent-oriented integration tooling on Robinhood Chain.[[8]](https://blog.uniswap.org/robinhood-chain-is-live) Canonical Robinhood Chain deployment addresses are now published, which gives Coin Railz a reliable replacement for query-limited DexScreener discovery.[[9]](https://developers.uniswap.org/docs/protocols/v3/deployments/v3-robinhood-chain-deployments)

Across supports routes from multiple chains in which USDC arrives as USDG, as well as ETH bridging and reverse USDG-to-USDC paths; its two-second fill statement is a vendor claim and should be measured independently.[[10]](https://across.to/blog/bridge-to-robinhood-chain-with-across) Robinhood also documents the canonical Arbitrum bridge, LayerZero/Stargate, Chainlink CCIP, Relay, Across, LiFi, and 0x.[[11]](https://docs.robinhood.com/chain/bridging)

Chainlink Data Feeds launched on mainnet on July 1.[[12]](https://dev.chain.link/changelog/data-feeds-expands-to-robinhood-chain-mainnet) Robinhood’s integration guidance explicitly requires consumers to handle dynamic decimals, stale rounds, non-positive answers, sequencer downtime, corporate-action multipliers, and `oraclePaused()` states.[[13]](https://docs.robinhood.com/chain/oracles-and-price-feeds)

## 3. Coin Railz alignment

### What Coin Railz got right

Coin Railz entered the ecosystem with the correct primitives:

1. Robinhood Chain token and pool discovery.
2. Chain status and RPC-derived information.
3. Batched Chainlink stock/ETF/crypto feed reads.
4. Base-to-Robinhood Chain funding through Across.
5. x402 packaging that makes the services callable by autonomous agents.

This maps well to Robinhood’s developer, RWA, ERC-4337, bridge, oracle, and agentic-account direction. The strategy should be retained.

### Where the implementation is misaligned

#### P0: bridge safety and delivery semantics

The bridge bounds USDC approval and validates several decoded `depositV3` fields, which is good. However, it forwards `txData.value` from an external API without requiring zero or enforcing a strict ETH cap. A malformed or compromised response could therefore spend Base ETH even though token approval is capped. It confirms the Base deposit but not the Robinhood Chain fill, and it does not persist a recoverable destination-delivery state.

The current product also delivers USDG but not ETH gas. A newly activated wallet can receive value yet remain unable to transact. It should not be described as complete wallet bootstrap until destination gas is addressed.

#### P0: public contract drift

The architect found inconsistencies between charged prices, `llms.txt`, OpenAPI, service catalog descriptions, and SDK parameters. One documented SDK parameter does not match the route’s required token-address field; the bridge documentation describes variable funding while the implementation sends a fixed 0.50 amount. These discrepancies can cause agents to fail before payment or misunderstand what they bought.

#### P1: DEX coverage is not chain-wide

The “top pools” and “chain stats” implementations query DexScreener using `q=USDC`, then aggregate only the returned Robinhood Chain subset. That is not a complete pool, volume, liquidity, or top-token index. It misses non-USDC and many RWA pools, precisely where recent activity has expanded. The output needs explicit coverage metadata until it uses canonical factory/event indexing or a verified indexer.

#### P1: oracle safety is incomplete

The current stock-price service hardcodes eight decimals and a common heartbeat. It does not validate positive answers, `answeredInRound`, per-feed decimals, per-feed heartbeat, sequencer uptime, Robinhood corporate-action multipliers, or `oraclePaused()`. Robinhood’s official documentation specifically calls for those checks.[[13]](https://docs.robinhood.com/chain/oracles-and-price-feeds)

Robinhood’s official Stock Token APIs expose asset metadata, contract addresses, current and pending multipliers, underlying market capabilities, bid/ask prices, and corporate actions.[[14]](https://docs.robinhood.com/chain/stock-token-apis) These APIs are the missing complement to Coin Railz’s on-chain feed reader.

## 4. Best opportunities

### 1. Robinhood RWA intelligence and safety API

Build a canonical asset registry that merges Robinhood `/assets`, `/prices`, and `/corporate-actions` with on-chain token contracts, Chainlink feed state, `uiMultiplier`, sequencer uptime, `oraclePaused()`, transfer restrictions, and jurisdiction metadata. Return provenance and timestamps for every field.

This is the strongest differentiated product because it solves a genuine RWA integration problem rather than reproducing generic token prices. Robinhood’s Stock Token documentation emphasizes corporate-action and jurisdiction behavior that ordinary crypto data APIs do not handle.[[15]](https://docs.robinhood.com/chain/stock-tokens)

### 2. Canonical pool intelligence and agent preflight

Index verified Uniswap factory events and published deployment addresses, then add:

- canonical pool/address verification;
- liquidity and volume with coverage disclosure;
- 1% and 5% price-impact estimates;
- Stock Token and USDG pool classification;
- oracle/market-session divergence;
- pool spoofing and thin-liquidity warnings;
- optional Rialto and other venue comparisons once their APIs and permissions are verified.

### 3. Reliable activation instead of treasury subsidy

Replace the current “pay $0.75 and receive treasury-funded 0.50 USDG” model with user-funded activation primitives:

- bridge quote and transaction construction;
- destination-fill tracking;
- ETH gas delivery or ERC-4337 sponsorship;
- explicit route choice and token representation;
- recoverable status and retry;
- optional sponsored pilot with a hard budget, not default economics.

### 4. Sequencer, oracle, and bridge reliability telemetry

Package sequencer uptime, oracle pause/freshness, bridge quote-to-fill, and RPC health into agent-callable monitoring. This is commercially relevant to Chainlink, Across, Robinhood ecosystem developers, and RWA applications.

## 5. Business-development priorities

| Priority | Target | Offer |
|---|---|---|
| 1 | Robinhood Chain developer ecosystem | Agent-ready RWA safety and activation quickstart; request technical review, not partnership branding |
| 2 | Chainlink ecosystem/data team | Validated feed-observability endpoint with staleness, sequencer, multiplier, and pause handling |
| 3 | Across integrations team | Observable quote-to-fill bridge primitive with bounded transactions and destination confirmation |
| 4 | Uniswap Robinhood deployment team | Canonical agent-safe pool intelligence using verified deployments |
| 5 | Rialto product/liquidity team | Shadow-mode intent preflight and aggregate route-quality telemetry after API terms are verified |

Do not lead with a generic DEX dashboard, retail stock-token trading, brokerage, custody, investment recommendations, treasury-subsidized bridging, or leveraged lending against stock-token collateral. Those areas are either weakly differentiated or create unnecessary financial/regulatory exposure.

## 6. Ranked action plan

### Fix now

1. Disable or harden `rh-bridge-usdc`: require zero or tightly capped transaction value, validate all quote/calldata fields, serialize treasury reservations, and track destination fill/recovery.
2. Correct Robinhood service prices, request schemas, SDK/plugin types, OpenAPI, `llms.txt`, service catalog, and payment-chain versus data-chain declarations from one canonical definition.
3. Implement Robinhood’s official oracle checks before marketing `rh-stock-price` as production-grade.

### Build next

4. Replace USDC-query DexScreener aggregation with canonical Uniswap indexing and explicit coverage/completeness fields.
5. Build the Stock Token metadata/corporate-action/oracle safety service.
6. Add destination ETH gas or ERC-4337 sponsorship to any activation flow.
7. Add a reconciled internal dashboard for DeFiLlama, explorer, Uniswap, bridge, and oracle-health metrics.

### Pursue commercially after technical proof

8. Robinhood developer ecosystem technical review.
9. Chainlink feed-semantics validation.
10. Across route and fill-status validation.
11. Uniswap deployment/indexing validation.
12. Two-builder paid beta before broader partnership claims.

## Limitations

Live TVL, DEX volume, transaction, and active-address figures are mutable and differed across providers during the same research session. They should be treated as dated ranges. Address and transaction counts do not establish unique human adoption. Across fill-time claims are vendor statements until independently measured. Coin Railz production telemetry can identify payment and user-agent behavior but cannot always identify the organization behind generic or missing user agents.

## Sources

1. [Robinhood Chain mainnet launch](https://robinhood.com/us/en/newsroom/robinhood-accelerates-global-expansion-robinhood-chain-mainnet-stock-tokens-agentic-trading) — July 1, 2026, Tier 1
2. [About Robinhood Chain](https://docs.robinhood.com/chain) — accessed September 4, 2026, Tier 1
3. [DeFiLlama chain API](https://api.llama.fi/v2/chains) — accessed September 4, 2026, Tier 2
4. [DeFiLlama Robinhood Chain](https://defillama.com/chain/robinhood-chain) — accessed September 4, 2026, Tier 2
5. [DeFiLlama Robinhood Chain DEXs](https://defillama.com/dexs/chain/robinhood-chain) — accessed September 4, 2026, Tier 2
6. [Robinhood Chain support and network details](https://robinhood.com/us/en/support/articles/robinhood-chain-mainnet) — accessed September 4, 2026, Tier 1
7. [Dune Robinhood Chain dashboard](https://dune.com/blockchains/robinhood) — accessed September 4, 2026, Tier 2
8. [Uniswap is live on Robinhood Chain](https://blog.uniswap.org/robinhood-chain-is-live) — July 1, 2026, Tier 1
9. [Uniswap Robinhood Chain deployments](https://developers.uniswap.org/docs/protocols/v3/deployments/v3-robinhood-chain-deployments) — accessed September 4, 2026, Tier 1
10. [Across bridge to Robinhood Chain](https://across.to/blog/bridge-to-robinhood-chain-with-across) — accessed September 4, 2026, Tier 1/vendor
11. [Robinhood Chain bridging documentation](https://docs.robinhood.com/chain/bridging) — accessed September 4, 2026, Tier 1
12. [Chainlink Data Feeds expansion](https://dev.chain.link/changelog/data-feeds-expands-to-robinhood-chain-mainnet) — July 1, 2026, Tier 1
13. [Robinhood Chain oracles and price feeds](https://docs.robinhood.com/chain/oracles-and-price-feeds) — accessed September 4, 2026, Tier 1
14. [Robinhood Stock Token APIs](https://docs.robinhood.com/chain/stock-token-apis) — accessed September 4, 2026, Tier 1
15. [Robinhood Stock Tokens](https://docs.robinhood.com/chain/stock-tokens) — accessed September 4, 2026, Tier 1# Coin Railz: 72-Hour Activity and Robinhood Chain Assessment

**Research date:** September 4, 2026  
**Depth:** Standard  
**Sources consulted:** 15 external sources, production telemetry, current code, architect review, and business-development review

## Executive summary

Coin Railz is not dormant. Production recorded **8,584 x402 interactions over the last 72 hours**, rising from 2,475 in the oldest 24-hour segment to 3,516 in the newest. The newest day reached 122 unique IPs, 34 user agents, and 91 services. This is a meaningful increase in discovery coverage. It is not, however, a conversion event: all 78 successful payment intents in the window were marked as internal canary payments, totaling $3.725. The most recent verified organic payment was a $0.25 `ping` payment on August 31, just outside the window.

The traffic is still dominated by monitors, validators, crawlers, and registry infrastructure. There are nonetheless new distribution signals: x402watch traversed 46 services, a new x402-MPP liveness actor covered 48 services, the published ElizaOS plugin generated a 134-request burst, rokmcp began recurring collection, and new A2A research clients completed matched requests. These signals show expanding machine visibility, not customer adoption.

Robinhood Chain has become a material ecosystem. Robinhood officially launched its public mainnet on July 1, 2026, and the live public RPC returns chain ID 4663.[[1]](https://robinhood.com/us/en/newsroom/robinhood-accelerates-global-expansion-robinhood-chain-mainnet-stock-tokens-agentic-trading) [[2]](https://docs.robinhood.com/chain) DeFiLlama showed approximately $838–841 million of TVL and between $1.35 billion and $1.82 billion of 24-hour DEX volume on September 4; the discrepancy reflects different live views and should be presented as a range, not a single audited number.[[3]](https://api.llama.fi/v2/chains) [[4]](https://defillama.com/chain/robinhood-chain) [[5]](https://defillama.com/dexs/chain/robinhood-chain) Uniswap represented roughly 76% of the lower DEX-volume figure. The chain also has official support from Chainlink, Across, Uniswap, Morpho, Rialto, Lighter, Arcus, Alchemy, BitGo, LayerZero, and others.[[2]](https://docs.robinhood.com/chain)

Coin Railz is **strategically aligned but not yet technically aligned enough to promote its Robinhood Chain suite aggressively**. Its five current service concepts are well chosen: token prices, DEX pools, chain statistics, stock-price feeds, and cross-chain activation. The architect found important implementation gaps: the DEX “chain” views only search DexScreener for `USDC`; the Chainlink reader does not implement Robinhood’s documented oracle-safety requirements; public schemas, prices, and SDK parameters have drifted; and the treasury-funded bridge accepts an external transaction `value` without a strict ETH cap and does not confirm destination delivery. These are fixable, but some are P0 safety and truthfulness issues.

The best opportunity is an **agent-ready Robinhood RWA intelligence and activation layer**: merge Robinhood’s official Stock Token APIs with canonical contract metadata, Chainlink feed state, sequencer uptime, corporate-action multipliers, transfer restrictions, oracle pauses, and verified Uniswap liquidity. That is materially more differentiated than a generic DEX dashboard and directly supports the chain’s RWA and agentic-account strategy.

## 1. Production activity: last 72 hours

### Traffic trend

| Window | Interactions | Payment challenges | MCP events | Landing views | Unique IPs | Services |
|---|---:|---:|---:|---:|---:|---:|
| Most recent 24h | 3,516 | 3,126 | 152 | 54 | 122 | 91 |
| Prior 24h | 2,593 | 2,414 | 95 | 20 | 90 | 83 |
| Oldest 24h | 2,475 | 2,303 | 94 | 15 | 75 | 69 |

Traffic increased by about **42%** from the oldest to newest daily segment. Service coverage expanded from 69 to 91, and unique IPs increased from 75 to 122. The increase is real, but the actor mix shows that it is primarily automated ecosystem activity.

### Payments

Production recorded 78 successful payment intents totaling $3.725. Every one was marked `is_canary=true`; there were no successful non-canary payment intents in the 72-hour window. The last organic payment currently visible in the authoritative ledger was:

- August 31, 2026: `ping`, $0.25, payer `0x6341…f356`.

This means the platform is being exercised continuously, but the latest traffic has not converted into organic revenue.

### Notable actors

| Actor | Activity | Interpretation |
|---|---:|---|
| `python-httpx/0.28.1` | 3,036 interactions, 27 services | Long-running validator; no payment signal |
| `x402-observer` | 2,132 interactions, 48 services | Trust/uptime monitor |
| Blank user agent | 763 interactions, 89 services | Broad infrastructure sweeper |
| `ZeroBot` | 451 interactions, 47 services | Automated ecosystem crawler |
| `x402watch` | 364 interactions, 46 services | New broad x402 monitor/index |
| `x402-mpp-liveness` | 212 interactions, 48 services | New liveness/protocol-compatibility signal |
| `elizaos-plugin-coinrailz/2.4.0` | 134 interactions | Real distribution artifact being exercised, but no payment |
| `rokmcp-collector` | 56 interactions | New recurring MCP indexer |
| `Pennywise-Candidate-Verifier` | 31 interactions from 31 IPs | Distributed candidate verification |

A2A traffic remained small but broadened. Agent-tools.cloud made 22 requests; the A2A registry made three; and both Lumidian research and a new interactive agent-card crawler completed matched requests. This is discovery progress, not yet a sales lead or conversion.

## 2. Robinhood Chain: current state

Robinhood Chain is a live, permissionless EVM-compatible Arbitrum Dedicated Chain using ETH for gas, with first-class ERC-4337 support and an explicit focus on tokenized real-world assets.[[2]](https://docs.robinhood.com/chain) Robinhood Wallet supports it natively, and ordinary EVM wallets can connect using chain ID 4663 and the public RPC.[[6]](https://robinhood.com/us/en/support/articles/robinhood-chain-mainnet)

Robinhood’s official launch states that Stock Tokens can trade around the clock, be used as collateral, and enter lending pools, subject to jurisdiction and asset restrictions.[[1]](https://robinhood.com/us/en/newsroom/robinhood-accelerates-global-expansion-robinhood-chain-mainnet-stock-tokens-agentic-trading) Robinhood also announced forthcoming agentic accounts that connect AI models to Robinhood data sources and trading strategies.[[1]](https://robinhood.com/us/en/newsroom/robinhood-accelerates-global-expansion-robinhood-chain-mainnet-stock-tokens-agentic-trading)

### Current metrics

| Metric | September 4 snapshot | Caveat |
|---|---:|---|
| TVL | ~$838m–$841m | DeFiLlama API and page snapshots; live and mutable |
| Alternate TVL | ~$541m | Dune-embedded view uses a different snapshot/method |
| DEX volume, 24h | ~$1.35bn–$1.82bn | Different DeFiLlama views disagreed intraday |
| DEX volume, 30d | ~$19.75bn | Live DeFiLlama DEX ranking |
| Uniswap 24h volume | ~$1.03bn | Approximately 76% of the $1.35bn view |
| Stablecoin market cap | ~$922m | Supply/capitalization, not AMM liquidity |
| USDG share | 64.72%, approximately $596m | Calculated from displayed stablecoin total |
| Bridged TVL | ~$3.04bn | Includes native, canonical, and third-party categories |
| RWA active market cap | ~$215m | Not executable pool liquidity |
| Weekly transactions | ~94.2m | Dune; not equivalent to unique humans |
| Weekly active addresses | ~7.2m | Dune; may include automation and incentives |

Sources: DeFiLlama chain and DEX views[[4]](https://defillama.com/chain/robinhood-chain) [[5]](https://defillama.com/dexs/chain/robinhood-chain), Dune’s Robinhood Chain dashboard[[7]](https://dune.com/blockchains/robinhood), and the live DeFiLlama chain API.[[3]](https://api.llama.fi/v2/chains)

The scale is significant, but it is concentrated. Uniswap is the dominant venue, creating execution depth but also venue concentration risk. Uniswap officially supports v2, v3, v4, UniswapX, Stock Tokens, its API, and agent-oriented integration tooling on Robinhood Chain.[[8]](https://blog.uniswap.org/robinhood-chain-is-live) Canonical Robinhood Chain deployment addresses are now published, which gives Coin Railz a reliable replacement for query-limited DexScreener discovery.[[9]](https://developers.uniswap.org/docs/protocols/v3/deployments/v3-robinhood-chain-deployments)

Across supports routes from multiple chains in which USDC arrives as USDG, as well as ETH bridging and reverse USDG-to-USDC paths; its two-second fill statement is a vendor claim and should be measured independently.[[10]](https://across.to/blog/bridge-to-robinhood-chain-with-across) Robinhood also documents the canonical Arbitrum bridge, LayerZero/Stargate, Chainlink CCIP, Relay, Across, LiFi, and 0x.[[11]](https://docs.robinhood.com/chain/bridging)

Chainlink Data Feeds launched on mainnet on July 1.[[12]](https://dev.chain.link/changelog/data-feeds-expands-to-robinhood-chain-mainnet) Robinhood’s integration guidance explicitly requires consumers to handle dynamic decimals, stale rounds, non-positive answers, sequencer downtime, corporate-action multipliers, and `oraclePaused()` states.[[13]](https://docs.robinhood.com/chain/oracles-and-price-feeds)

## 3. Coin Railz alignment

### What Coin Railz got right

Coin Railz entered the ecosystem with the correct primitives:

1. Robinhood Chain token and pool discovery.
2. Chain status and RPC-derived information.
3. Batched Chainlink stock/ETF/crypto feed reads.
4. Base-to-Robinhood Chain funding through Across.
5. x402 packaging that makes the services callable by autonomous agents.

This maps well to Robinhood’s developer, RWA, ERC-4337, bridge, oracle, and agentic-account direction. The strategy should be retained.

### Where the implementation is misaligned

#### P0: bridge safety and delivery semantics

The bridge bounds USDC approval and validates several decoded `depositV3` fields, which is good. However, it forwards `txData.value` from an external API without requiring zero or enforcing a strict ETH cap. A malformed or compromised response could therefore spend Base ETH even though token approval is capped. It confirms the Base deposit but not the Robinhood Chain fill, and it does not persist a recoverable destination-delivery state.

The current product also delivers USDG but not ETH gas. A newly activated wallet can receive value yet remain unable to transact. It should not be described as complete wallet bootstrap until destination gas is addressed.

#### P0: public contract drift

The architect found inconsistencies between charged prices, `llms.txt`, OpenAPI, service catalog descriptions, and SDK parameters. One documented SDK parameter does not match the route’s required token-address field; the bridge documentation describes variable funding while the implementation sends a fixed 0.50 amount. These discrepancies can cause agents to fail before payment or misunderstand what they bought.

#### P1: DEX coverage is not chain-wide

The “top pools” and “chain stats” implementations query DexScreener using `q=USDC`, then aggregate only the returned Robinhood Chain subset. That is not a complete pool, volume, liquidity, or top-token index. It misses non-USDC and many RWA pools, precisely where recent activity has expanded. The output needs explicit coverage metadata until it uses canonical factory/event indexing or a verified indexer.

#### P1: oracle safety is incomplete

The current stock-price service hardcodes eight decimals and a common heartbeat. It does not validate positive answers, `answeredInRound`, per-feed decimals, per-feed heartbeat, sequencer uptime, Robinhood corporate-action multipliers, or `oraclePaused()`. Robinhood’s official documentation specifically calls for those checks.[[13]](https://docs.robinhood.com/chain/oracles-and-price-feeds)

Robinhood’s official Stock Token APIs expose asset metadata, contract addresses, current and pending multipliers, underlying market capabilities, bid/ask prices, and corporate actions.[[14]](https://docs.robinhood.com/chain/stock-token-apis) These APIs are the missing complement to Coin Railz’s on-chain feed reader.

## 4. Best opportunities

### 1. Robinhood RWA intelligence and safety API

Build a canonical asset registry that merges Robinhood `/assets`, `/prices`, and `/corporate-actions` with on-chain token contracts, Chainlink feed state, `uiMultiplier`, sequencer uptime, `oraclePaused()`, transfer restrictions, and jurisdiction metadata. Return provenance and timestamps for every field.

This is the strongest differentiated product because it solves a genuine RWA integration problem rather than reproducing generic token prices. Robinhood’s Stock Token documentation emphasizes corporate-action and jurisdiction behavior that ordinary crypto data APIs do not handle.[[15]](https://docs.robinhood.com/chain/stock-tokens)

### 2. Canonical pool intelligence and agent preflight

Index verified Uniswap factory events and published deployment addresses, then add:

- canonical pool/address verification;
- liquidity and volume with coverage disclosure;
- 1% and 5% price-impact estimates;
- Stock Token and USDG pool classification;
- oracle/market-session divergence;
- pool spoofing and thin-liquidity warnings;
- optional Rialto and other venue comparisons once their APIs and permissions are verified.

### 3. Reliable activation instead of treasury subsidy

Replace the current “pay $0.75 and receive treasury-funded 0.50 USDG” model with user-funded activation primitives:

- bridge quote and transaction construction;
- destination-fill tracking;
- ETH gas delivery or ERC-4337 sponsorship;
- explicit route choice and token representation;
- recoverable status and retry;
- optional sponsored pilot with a hard budget, not default economics.

### 4. Sequencer, oracle, and bridge reliability telemetry

Package sequencer uptime, oracle pause/freshness, bridge quote-to-fill, and RPC health into agent-callable monitoring. This is commercially relevant to Chainlink, Across, Robinhood ecosystem developers, and RWA applications.

## 5. Business-development priorities

| Priority | Target | Offer |
|---|---|---|
| 1 | Robinhood Chain developer ecosystem | Agent-ready RWA safety and activation quickstart; request technical review, not partnership branding |
| 2 | Chainlink ecosystem/data team | Validated feed-observability endpoint with staleness, sequencer, multiplier, and pause handling |
| 3 | Across integrations team | Observable quote-to-fill bridge primitive with bounded transactions and destination confirmation |
| 4 | Uniswap Robinhood deployment team | Canonical agent-safe pool intelligence using verified deployments |
| 5 | Rialto product/liquidity team | Shadow-mode intent preflight and aggregate route-quality telemetry after API terms are verified |

Do not lead with a generic DEX dashboard, retail stock-token trading, brokerage, custody, investment recommendations, treasury-subsidized bridging, or leveraged lending against stock-token collateral. Those areas are either weakly differentiated or create unnecessary financial/regulatory exposure.

## 6. Ranked action plan

### Fix now

1. Disable or harden `rh-bridge-usdc`: require zero or tightly capped transaction value, validate all quote/calldata fields, serialize treasury reservations, and track destination fill/recovery.
2. Correct Robinhood service prices, request schemas, SDK/plugin types, OpenAPI, `llms.txt`, service catalog, and payment-chain versus data-chain declarations from one canonical definition.
3. Implement Robinhood’s official oracle checks before marketing `rh-stock-price` as production-grade.

### Build next

4. Replace USDC-query DexScreener aggregation with canonical Uniswap indexing and explicit coverage/completeness fields.
5. Build the Stock Token metadata/corporate-action/oracle safety service.
6. Add destination ETH gas or ERC-4337 sponsorship to any activation flow.
7. Add a reconciled internal dashboard for DeFiLlama, explorer, Uniswap, bridge, and oracle-health metrics.

### Pursue commercially after technical proof

8. Robinhood developer ecosystem technical review.
9. Chainlink feed-semantics validation.
10. Across route and fill-status validation.
11. Uniswap deployment/indexing validation.
12. Two-builder paid beta before broader partnership claims.

## Limitations

Live TVL, DEX volume, transaction, and active-address figures are mutable and differed across providers during the same research session. They should be treated as dated ranges. Address and transaction counts do not establish unique human adoption. Across fill-time claims are vendor statements until independently measured. Coin Railz production telemetry can identify payment and user-agent behavior but cannot always identify the organization behind generic or missing user agents.

## Sources

1. [Robinhood Chain mainnet launch](https://robinhood.com/us/en/newsroom/robinhood-accelerates-global-expansion-robinhood-chain-mainnet-stock-tokens-agentic-trading) — July 1, 2026, Tier 1
2. [About Robinhood Chain](https://docs.robinhood.com/chain) — accessed September 4, 2026, Tier 1
3. [DeFiLlama chain API](https://api.llama.fi/v2/chains) — accessed September 4, 2026, Tier 2
4. [DeFiLlama Robinhood Chain](https://defillama.com/chain/robinhood-chain) — accessed September 4, 2026, Tier 2
5. [DeFiLlama Robinhood Chain DEXs](https://defillama.com/dexs/chain/robinhood-chain) — accessed September 4, 2026, Tier 2
6. [Robinhood Chain support and network details](https://robinhood.com/us/en/support/articles/robinhood-chain-mainnet) — accessed September 4, 2026, Tier 1
7. [Dune Robinhood Chain dashboard](https://dune.com/blockchains/robinhood) — accessed September 4, 2026, Tier 2
8. [Uniswap is live on Robinhood Chain](https://blog.uniswap.org/robinhood-chain-is-live) — July 1, 2026, Tier 1
9. [Uniswap Robinhood Chain deployments](https://developers.uniswap.org/docs/protocols/v3/deployments/v3-robinhood-chain-deployments) — accessed September 4, 2026, Tier 1
10. [Across bridge to Robinhood Chain](https://across.to/blog/bridge-to-robinhood-chain-with-across) — accessed September 4, 2026, Tier 1/vendor
11. [Robinhood Chain bridging documentation](https://docs.robinhood.com/chain/bridging) — accessed September 4, 2026, Tier 1
12. [Chainlink Data Feeds expansion](https://dev.chain.link/changelog/data-feeds-expands-to-robinhood-chain-mainnet) — July 1, 2026, Tier 1
13. [Robinhood Chain oracles and price feeds](https://docs.robinhood.com/chain/oracles-and-price-feeds) — accessed September 4, 2026, Tier 1
14. [Robinhood Stock Token APIs](https://docs.robinhood.com/chain/stock-token-apis) — accessed September 4, 2026, Tier 1
15. [Robinhood Stock Tokens](https://docs.robinhood.com/chain/stock-tokens) — accessed September 4, 2026, Tier 1# Coin Railz: 72-Hour Activity and Robinhood Chain Assessment

**Research date:** September 4, 2026  
**Depth:** Standard  
**Sources consulted:** 15 external sources, production telemetry, current code, architect review, and business-development review

## Executive summary

Coin Railz is not dormant. Production recorded **8,584 x402 interactions over the last 72 hours**, rising from 2,475 in the oldest 24-hour segment to 3,516 in the newest. The newest day reached 122 unique IPs, 34 user agents, and 91 services. This is a meaningful increase in discovery coverage. It is not, however, a conversion event: all 78 successful payment intents in the window were marked as internal canary payments, totaling $3.725. The most recent verified organic payment was a $0.25 `ping` payment on August 31, just outside the window.

The traffic is still dominated by monitors, validators, crawlers, and registry infrastructure. There are nonetheless new distribution signals: x402watch traversed 46 services, a new x402-MPP liveness actor covered 48 services, the published ElizaOS plugin generated a 134-request burst, rokmcp began recurring collection, and new A2A research clients completed matched requests. These signals show expanding machine visibility, not customer adoption.

Robinhood Chain has become a material ecosystem. Robinhood officially launched its public mainnet on July 1, 2026, and the live public RPC returns chain ID 4663.[[1]](https://robinhood.com/us/en/newsroom/robinhood-accelerates-global-expansion-robinhood-chain-mainnet-stock-tokens-agentic-trading) [[2]](https://docs.robinhood.com/chain) DeFiLlama showed approximately $838–841 million of TVL and between $1.35 billion and $1.82 billion of 24-hour DEX volume on September 4; the discrepancy reflects different live views and should be presented as a range, not a single audited number.[[3]](https://api.llama.fi/v2/chains) [[4]](https://defillama.com/chain/robinhood-chain) [[5]](https://defillama.com/dexs/chain/robinhood-chain) Uniswap represented roughly 76% of the lower DEX-volume figure. The chain also has official support from Chainlink, Across, Uniswap, Morpho, Rialto, Lighter, Arcus, Alchemy, BitGo, LayerZero, and others.[[2]](https://docs.robinhood.com/chain)

Coin Railz is **strategically aligned but not yet technically aligned enough to promote its Robinhood Chain suite aggressively**. Its five current service concepts are well chosen: token prices, DEX pools, chain statistics, stock-price feeds, and cross-chain activation. The architect found important implementation gaps: the DEX “chain” views only search DexScreener for `USDC`; the Chainlink reader does not implement Robinhood’s documented oracle-safety requirements; public schemas, prices, and SDK parameters have drifted; and the treasury-funded bridge accepts an external transaction `value` without a strict ETH cap and does not confirm destination delivery. These are fixable, but some are P0 safety and truthfulness issues.

The best opportunity is an **agent-ready Robinhood RWA intelligence and activation layer**: merge Robinhood’s official Stock Token APIs with canonical contract metadata, Chainlink feed state, sequencer uptime, corporate-action multipliers, transfer restrictions, oracle pauses, and verified Uniswap liquidity. That is materially more differentiated than a generic DEX dashboard and directly supports the chain’s RWA and agentic-account strategy.

## 1. Production activity: last 72 hours

### Traffic trend

| Window | Interactions | Payment challenges | MCP events | Landing views | Unique IPs | Services |
|---|---:|---:|---:|---:|---:|---:|
| Most recent 24h | 3,516 | 3,126 | 152 | 54 | 122 | 91 |
| Prior 24h | 2,593 | 2,414 | 95 | 20 | 90 | 83 |
| Oldest 24h | 2,475 | 2,303 | 94 | 15 | 75 | 69 |

Traffic increased by about **42%** from the oldest to newest daily segment. Service coverage expanded from 69 to 91, and unique IPs increased from 75 to 122. The increase is real, but the actor mix shows that it is primarily automated ecosystem activity.

### Payments

Production recorded 78 successful payment intents totaling $3.725. Every one was marked `is_canary=true`; there were no successful non-canary payment intents in the 72-hour window. The last organic payment currently visible in the authoritative ledger was:

- August 31, 2026: `ping`, $0.25, payer `0x6341…f356`.

This means the platform is being exercised continuously, but the latest traffic has not converted into organic revenue.

### Notable actors

| Actor | Activity | Interpretation |
|---|---:|---|
| `python-httpx/0.28.1` | 3,036 interactions, 27 services | Long-running validator; no payment signal |
| `x402-observer` | 2,132 interactions, 48 services | Trust/uptime monitor |
| Blank user agent | 763 interactions, 89 services | Broad infrastructure sweeper |
| `ZeroBot` | 451 interactions, 47 services | Automated ecosystem crawler |
| `x402watch` | 364 interactions, 46 services | New broad x402 monitor/index |
| `x402-mpp-liveness` | 212 interactions, 48 services | New liveness/protocol-compatibility signal |
| `elizaos-plugin-coinrailz/2.4.0` | 134 interactions | Real distribution artifact being exercised, but no payment |
| `rokmcp-collector` | 56 interactions | New recurring MCP indexer |
| `Pennywise-Candidate-Verifier` | 31 interactions from 31 IPs | Distributed candidate verification |

A2A traffic remained small but broadened. Agent-tools.cloud made 22 requests; the A2A registry made three; and both Lumidian research and a new interactive agent-card crawler completed matched requests. This is discovery progress, not yet a sales lead or conversion.

## 2. Robinhood Chain: current state

Robinhood Chain is a live, permissionless EVM-compatible Arbitrum Dedicated Chain using ETH for gas, with first-class ERC-4337 support and an explicit focus on tokenized real-world assets.[[2]](https://docs.robinhood.com/chain) Robinhood Wallet supports it natively, and ordinary EVM wallets can connect using chain ID 4663 and the public RPC.[[6]](https://robinhood.com/us/en/support/articles/robinhood-chain-mainnet)

Robinhood’s official launch states that Stock Tokens can trade around the clock, be used as collateral, and enter lending pools, subject to jurisdiction and asset restrictions.[[1]](https://robinhood.com/us/en/newsroom/robinhood-accelerates-global-expansion-robinhood-chain-mainnet-stock-tokens-agentic-trading) Robinhood also announced forthcoming agentic accounts that connect AI models to Robinhood data sources and trading strategies.[[1]](https://robinhood.com/us/en/newsroom/robinhood-accelerates-global-expansion-robinhood-chain-mainnet-stock-tokens-agentic-trading)

### Current metrics

| Metric | September 4 snapshot | Caveat |
|---|---:|---|
| TVL | ~$838m–$841m | DeFiLlama API and page snapshots; live and mutable |
| Alternate TVL | ~$541m | Dune-embedded view uses a different snapshot/method |
| DEX volume, 24h | ~$1.35bn–$1.82bn | Different DeFiLlama views disagreed intraday |
| DEX volume, 30d | ~$19.75bn | Live DeFiLlama DEX ranking |
| Uniswap 24h volume | ~$1.03bn | Approximately 76% of the $1.35bn view |
| Stablecoin market cap | ~$922m | Supply/capitalization, not AMM liquidity |
| USDG share | 64.72%, approximately $596m | Calculated from displayed stablecoin total |
| Bridged TVL | ~$3.04bn | Includes native, canonical, and third-party categories |
| RWA active market cap | ~$215m | Not executable pool liquidity |
| Weekly transactions | ~94.2m | Dune; not equivalent to unique humans |
| Weekly active addresses | ~7.2m | Dune; may include automation and incentives |

Sources: DeFiLlama chain and DEX views[[4]](https://defillama.com/chain/robinhood-chain) [[5]](https://defillama.com/dexs/chain/robinhood-chain), Dune’s Robinhood Chain dashboard[[7]](https://dune.com/blockchains/robinhood), and the live DeFiLlama chain API.[[3]](https://api.llama.fi/v2/chains)

The scale is significant, but it is concentrated. Uniswap is the dominant venue, creating execution depth but also venue concentration risk. Uniswap officially supports v2, v3, v4, UniswapX, Stock Tokens, its API, and agent-oriented integration tooling on Robinhood Chain.[[8]](https://blog.uniswap.org/robinhood-chain-is-live) Canonical Robinhood Chain deployment addresses are now published, which gives Coin Railz a reliable replacement for query-limited DexScreener discovery.[[9]](https://developers.uniswap.org/docs/protocols/v3/deployments/v3-robinhood-chain-deployments)

Across supports routes from multiple chains in which USDC arrives as USDG, as well as ETH bridging and reverse USDG-to-USDC paths; its two-second fill statement is a vendor claim and should be measured independently.[[10]](https://across.to/blog/bridge-to-robinhood-chain-with-across) Robinhood also documents the canonical Arbitrum bridge, LayerZero/Stargate, Chainlink CCIP, Relay, Across, LiFi, and 0x.[[11]](https://docs.robinhood.com/chain/bridging)

Chainlink Data Feeds launched on mainnet on July 1.[[12]](https://dev.chain.link/changelog/data-feeds-expands-to-robinhood-chain-mainnet) Robinhood’s integration guidance explicitly requires consumers to handle dynamic decimals, stale rounds, non-positive answers, sequencer downtime, corporate-action multipliers, and `oraclePaused()` states.[[13]](https://docs.robinhood.com/chain/oracles-and-price-feeds)

## 3. Coin Railz alignment

### What Coin Railz got right

Coin Railz entered the ecosystem with the correct primitives:

1. Robinhood Chain token and pool discovery.
2. Chain status and RPC-derived information.
3. Batched Chainlink stock/ETF/crypto feed reads.
4. Base-to-Robinhood Chain funding through Across.
5. x402 packaging that makes the services callable by autonomous agents.

This maps well to Robinhood’s developer, RWA, ERC-4337, bridge, oracle, and agentic-account direction. The strategy should be retained.

### Where the implementation is misaligned

#### P0: bridge safety and delivery semantics

The bridge bounds USDC approval and validates several decoded `depositV3` fields, which is good. However, it forwards `txData.value` from an external API without requiring zero or enforcing a strict ETH cap. A malformed or compromised response could therefore spend Base ETH even though token approval is capped. It confirms the Base deposit but not the Robinhood Chain fill, and it does not persist a recoverable destination-delivery state.

The current product also delivers USDG but not ETH gas. A newly activated wallet can receive value yet remain unable to transact. It should not be described as complete wallet bootstrap until destination gas is addressed.

#### P0: public contract drift

The architect found inconsistencies between charged prices, `llms.txt`, OpenAPI, service catalog descriptions, and SDK parameters. One documented SDK parameter does not match the route’s required token-address field; the bridge documentation describes variable funding while the implementation sends a fixed 0.50 amount. These discrepancies can cause agents to fail before payment or misunderstand what they bought.

#### P1: DEX coverage is not chain-wide

The “top pools” and “chain stats” implementations query DexScreener using `q=USDC`, then aggregate only the returned Robinhood Chain subset. That is not a complete pool, volume, liquidity, or top-token index. It misses non-USDC and many RWA pools, precisely where recent activity has expanded. The output needs explicit coverage metadata until it uses canonical factory/event indexing or a verified indexer.

#### P1: oracle safety is incomplete

The current stock-price service hardcodes eight decimals and a common heartbeat. It does not validate positive answers, `answeredInRound`, per-feed decimals, per-feed heartbeat, sequencer uptime, Robinhood corporate-action multipliers, or `oraclePaused()`. Robinhood’s official documentation specifically calls for those checks.[[13]](https://docs.robinhood.com/chain/oracles-and-price-feeds)

Robinhood’s official Stock Token APIs expose asset metadata, contract addresses, current and pending multipliers, underlying market capabilities, bid/ask prices, and corporate actions.[[14]](https://docs.robinhood.com/chain/stock-token-apis) These APIs are the missing complement to Coin Railz’s on-chain feed reader.

## 4. Best opportunities

### 1. Robinhood RWA intelligence and safety API

Build a canonical asset registry that merges Robinhood `/assets`, `/prices`, and `/corporate-actions` with on-chain token contracts, Chainlink feed state, `uiMultiplier`, sequencer uptime, `oraclePaused()`, transfer restrictions, and jurisdiction metadata. Return provenance and timestamps for every field.

This is the strongest differentiated product because it solves a genuine RWA integration problem rather than reproducing generic token prices. Robinhood’s Stock Token documentation emphasizes corporate-action and jurisdiction behavior that ordinary crypto data APIs do not handle.[[15]](https://docs.robinhood.com/chain/stock-tokens)

### 2. Canonical pool intelligence and agent preflight

Index verified Uniswap factory events and published deployment addresses, then add:

- canonical pool/address verification;
- liquidity and volume with coverage disclosure;
- 1% and 5% price-impact estimates;
- Stock Token and USDG pool classification;
- oracle/market-session divergence;
- pool spoofing and thin-liquidity warnings;
- optional Rialto and other venue comparisons once their APIs and permissions are verified.

### 3. Reliable activation instead of treasury subsidy

Replace the current “pay $0.75 and receive treasury-funded 0.50 USDG” model with user-funded activation primitives:

- bridge quote and transaction construction;
- destination-fill tracking;
- ETH gas delivery or ERC-4337 sponsorship;
- explicit route choice and token representation;
- recoverable status and retry;
- optional sponsored pilot with a hard budget, not default economics.

### 4. Sequencer, oracle, and bridge reliability telemetry

Package sequencer uptime, oracle pause/freshness, bridge quote-to-fill, and RPC health into agent-callable monitoring. This is commercially relevant to Chainlink, Across, Robinhood ecosystem developers, and RWA applications.

## 5. Business-development priorities

| Priority | Target | Offer |
|---|---|---|
| 1 | Robinhood Chain developer ecosystem | Agent-ready RWA safety and activation quickstart; request technical review, not partnership branding |
| 2 | Chainlink ecosystem/data team | Validated feed-observability endpoint with staleness, sequencer, multiplier, and pause handling |
| 3 | Across integrations team | Observable quote-to-fill bridge primitive with bounded transactions and destination confirmation |
| 4 | Uniswap Robinhood deployment team | Canonical agent-safe pool intelligence using verified deployments |
| 5 | Rialto product/liquidity team | Shadow-mode intent preflight and aggregate route-quality telemetry after API terms are verified |

Do not lead with a generic DEX dashboard, retail stock-token trading, brokerage, custody, investment recommendations, treasury-subsidized bridging, or leveraged lending against stock-token collateral. Those areas are either weakly differentiated or create unnecessary financial/regulatory exposure.

## 6. Ranked action plan

### Fix now

1. Disable or harden `rh-bridge-usdc`: require zero or tightly capped transaction value, validate all quote/calldata fields, serialize treasury reservations, and track destination fill/recovery.
2. Correct Robinhood service prices, request schemas, SDK/plugin types, OpenAPI, `llms.txt`, service catalog, and payment-chain versus data-chain declarations from one canonical definition.
3. Implement Robinhood’s official oracle checks before marketing `rh-stock-price` as production-grade.

### Build next

4. Replace USDC-query DexScreener aggregation with canonical Uniswap indexing and explicit coverage/completeness fields.
5. Build the Stock Token metadata/corporate-action/oracle safety service.
6. Add destination ETH gas or ERC-4337 sponsorship to any activation flow.
7. Add a reconciled internal dashboard for DeFiLlama, explorer, Uniswap, bridge, and oracle-health metrics.

### Pursue commercially after technical proof

8. Robinhood developer ecosystem technical review.
9. Chainlink feed-semantics validation.
10. Across route and fill-status validation.
11. Uniswap deployment/indexing validation.
12. Two-builder paid beta before broader partnership claims.

## Limitations

Live TVL, DEX volume, transaction, and active-address figures are mutable and differed across providers during the same research session. They should be treated as dated ranges. Address and transaction counts do not establish unique human adoption. Across fill-time claims are vendor statements until independently measured. Coin Railz production telemetry can identify payment and user-agent behavior but cannot always identify the organization behind generic or missing user agents.

## Sources

1. [Robinhood Chain mainnet launch](https://robinhood.com/us/en/newsroom/robinhood-accelerates-global-expansion-robinhood-chain-mainnet-stock-tokens-agentic-trading) — July 1, 2026, Tier 1
2. [About Robinhood Chain](https://docs.robinhood.com/chain) — accessed September 4, 2026, Tier 1
3. [DeFiLlama chain API](https://api.llama.fi/v2/chains) — accessed September 4, 2026, Tier 2
4. [DeFiLlama Robinhood Chain](https://defillama.com/chain/robinhood-chain) — accessed September 4, 2026, Tier 2
5. [DeFiLlama Robinhood Chain DEXs](https://defillama.com/dexs/chain/robinhood-chain) — accessed September 4, 2026, Tier 2
6. [Robinhood Chain support and network details](https://robinhood.com/us/en/support/articles/robinhood-chain-mainnet) — accessed September 4, 2026, Tier 1
7. [Dune Robinhood Chain dashboard](https://dune.com/blockchains/robinhood) — accessed September 4, 2026, Tier 2
8. [Uniswap is live on Robinhood Chain](https://blog.uniswap.org/robinhood-chain-is-live) — July 1, 2026, Tier 1
9. [Uniswap Robinhood Chain deployments](https://developers.uniswap.org/docs/protocols/v3/deployments/v3-robinhood-chain-deployments) — accessed September 4, 2026, Tier 1
10. [Across bridge to Robinhood Chain](https://across.to/blog/bridge-to-robinhood-chain-with-across) — accessed September 4, 2026, Tier 1/vendor
11. [Robinhood Chain bridging documentation](https://docs.robinhood.com/chain/bridging) — accessed September 4, 2026, Tier 1
12. [Chainlink Data Feeds expansion](https://dev.chain.link/changelog/data-feeds-expands-to-robinhood-chain-mainnet) — July 1, 2026, Tier 1
13. [Robinhood Chain oracles and price feeds](https://docs.robinhood.com/chain/oracles-and-price-feeds) — accessed September 4, 2026, Tier 1
14. [Robinhood Stock Token APIs](https://docs.robinhood.com/chain/stock-token-apis) — accessed September 4, 2026, Tier 1
15. [Robinhood Stock Tokens](https://docs.robinhood.com/chain/stock-tokens) — accessed September 4, 2026, Tier 1# Coin Railz: 72-Hour Activity and Robinhood Chain Assessment

**Research date:** September 4, 2026  
**Depth:** Standard  
**Sources consulted:** 15 external sources, production telemetry, current code, architect review, and business-development review

## Executive summary

Coin Railz is not dormant. Production recorded **8,584 x402 interactions over the last 72 hours**, rising from 2,475 in the oldest 24-hour segment to 3,516 in the newest. The newest day reached 122 unique IPs, 34 user agents, and 91 services. This is a meaningful increase in discovery coverage. It is not, however, a conversion event: all 78 successful payment intents in the window were marked as internal canary payments, totaling $3.725. The most recent verified organic payment was a $0.25 `ping` payment on August 31, just outside the window.

The traffic is still dominated by monitors, validators, crawlers, and registry infrastructure. There are nonetheless new distribution signals: x402watch traversed 46 services, a new x402-MPP liveness actor covered 48 services, the published ElizaOS plugin generated a 134-request burst, rokmcp began recurring collection, and new A2A research clients completed matched requests. These signals show expanding machine visibility, not customer adoption.

Robinhood Chain has become a material ecosystem. Robinhood officially launched its public mainnet on July 1, 2026, and the live public RPC returns chain ID 4663.[[1]](https://robinhood.com/us/en/newsroom/robinhood-accelerates-global-expansion-robinhood-chain-mainnet-stock-tokens-agentic-trading) [[2]](https://docs.robinhood.com/chain) DeFiLlama showed approximately $838–841 million of TVL and between $1.35 billion and $1.82 billion of 24-hour DEX volume on September 4; the discrepancy reflects different live views and should be presented as a range, not a single audited number.[[3]](https://api.llama.fi/v2/chains) [[4]](https://defillama.com/chain/robinhood-chain) [[5]](https://defillama.com/dexs/chain/robinhood-chain) Uniswap represented roughly 76% of the lower DEX-volume figure. The chain also has official support from Chainlink, Across, Uniswap, Morpho, Rialto, Lighter, Arcus, Alchemy, BitGo, LayerZero, and others.[[2]](https://docs.robinhood.com/chain)

Coin Railz is **strategically aligned but not yet technically aligned enough to promote its Robinhood Chain suite aggressively**. Its five current service concepts are well chosen: token prices, DEX pools, chain statistics, stock-price feeds, and cross-chain activation. The architect found important implementation gaps: the DEX “chain” views only search DexScreener for `USDC`; the Chainlink reader does not implement Robinhood’s documented oracle-safety requirements; public schemas, prices, and SDK parameters have drifted; and the treasury-funded bridge accepts an external transaction `value` without a strict ETH cap and does not confirm destination delivery. These are fixable, but some are P0 safety and truthfulness issues.

The best opportunity is an **agent-ready Robinhood RWA intelligence and activation layer**: merge Robinhood’s official Stock Token APIs with canonical contract metadata, Chainlink feed state, sequencer uptime, corporate-action multipliers, transfer restrictions, oracle pauses, and verified Uniswap liquidity. That is materially more differentiated than a generic DEX dashboard and directly supports the chain’s RWA and agentic-account strategy.

## 1. Production activity: last 72 hours

### Traffic trend

| Window | Interactions | Payment challenges | MCP events | Landing views | Unique IPs | Services |
|---|---:|---:|---:|---:|---:|---:|
| Most recent 24h | 3,516 | 3,126 | 152 | 54 | 122 | 91 |
| Prior 24h | 2,593 | 2,414 | 95 | 20 | 90 | 83 |
| Oldest 24h | 2,475 | 2,303 | 94 | 15 | 75 | 69 |

Traffic increased by about **42%** from the oldest to newest daily segment. Service coverage expanded from 69 to 91, and unique IPs increased from 75 to 122. The increase is real, but the actor mix shows that it is primarily automated ecosystem activity.

### Payments

Production recorded 78 successful payment intents totaling $3.725. Every one was marked `is_canary=true`; there were no successful non-canary payment intents in the 72-hour window. The last organic payment currently visible in the authoritative ledger was:

- August 31, 2026: `ping`, $0.25, payer `0x6341…f356`.

This means the platform is being exercised continuously, but the latest traffic has not converted into organic revenue.

### Notable actors

| Actor | Activity | Interpretation |
|---|---:|---|
| `python-httpx/0.28.1` | 3,036 interactions, 27 services | Long-running validator; no payment signal |
| `x402-observer` | 2,132 interactions, 48 services | Trust/uptime monitor |
| Blank user agent | 763 interactions, 89 services | Broad infrastructure sweeper |
| `ZeroBot` | 451 interactions, 47 services | Automated ecosystem crawler |
| `x402watch` | 364 interactions, 46 services | New broad x402 monitor/index |
| `x402-mpp-liveness` | 212 interactions, 48 services | New liveness/protocol-compatibility signal |
| `elizaos-plugin-coinrailz/2.4.0` | 134 interactions | Real distribution artifact being exercised, but no payment |
| `rokmcp-collector` | 56 interactions | New recurring MCP indexer |
| `Pennywise-Candidate-Verifier` | 31 interactions from 31 IPs | Distributed candidate verification |

A2A traffic remained small but broadened. Agent-tools.cloud made 22 requests; the A2A registry made three; and both Lumidian research and a new interactive agent-card crawler completed matched requests. This is discovery progress, not yet a sales lead or conversion.

## 2. Robinhood Chain: current state

Robinhood Chain is a live, permissionless EVM-compatible Arbitrum Dedicated Chain using ETH for gas, with first-class ERC-4337 support and an explicit focus on tokenized real-world assets.[[2]](https://docs.robinhood.com/chain) Robinhood Wallet supports it natively, and ordinary EVM wallets can connect using chain ID 4663 and the public RPC.[[6]](https://robinhood.com/us/en/support/articles/robinhood-chain-mainnet)

Robinhood’s official launch states that Stock Tokens can trade around the clock, be used as collateral, and enter lending pools, subject to jurisdiction and asset restrictions.[[1]](https://robinhood.com/us/en/newsroom/robinhood-accelerates-global-expansion-robinhood-chain-mainnet-stock-tokens-agentic-trading) Robinhood also announced forthcoming agentic accounts that connect AI models to Robinhood data sources and trading strategies.[[1]](https://robinhood.com/us/en/newsroom/robinhood-accelerates-global-expansion-robinhood-chain-mainnet-stock-tokens-agentic-trading)

### Current metrics

| Metric | September 4 snapshot | Caveat |
|---|---:|---|
| TVL | ~$838m–$841m | DeFiLlama API and page snapshots; live and mutable |
| Alternate TVL | ~$541m | Dune-embedded view uses a different snapshot/method |
| DEX volume, 24h | ~$1.35bn–$1.82bn | Different DeFiLlama views disagreed intraday |
| DEX volume, 30d | ~$19.75bn | Live DeFiLlama DEX ranking |
| Uniswap 24h volume | ~$1.03bn | Approximately 76% of the $1.35bn view |
| Stablecoin market cap | ~$922m | Supply/capitalization, not AMM liquidity |
| USDG share | 64.72%, approximately $596m | Calculated from displayed stablecoin total |
| Bridged TVL | ~$3.04bn | Includes native, canonical, and third-party categories |
| RWA active market cap | ~$215m | Not executable pool liquidity |
| Weekly transactions | ~94.2m | Dune; not equivalent to unique humans |
| Weekly active addresses | ~7.2m | Dune; may include automation and incentives |

Sources: DeFiLlama chain and DEX views[[4]](https://defillama.com/chain/robinhood-chain) [[5]](https://defillama.com/dexs/chain/robinhood-chain), Dune’s Robinhood Chain dashboard[[7]](https://dune.com/blockchains/robinhood), and the live DeFiLlama chain API.[[3]](https://api.llama.fi/v2/chains)

The scale is significant, but it is concentrated. Uniswap is the dominant venue, creating execution depth but also venue concentration risk. Uniswap officially supports v2, v3, v4, UniswapX, Stock Tokens, its API, and agent-oriented integration tooling on Robinhood Chain.[[8]](https://blog.uniswap.org/robinhood-chain-is-live) Canonical Robinhood Chain deployment addresses are now published, which gives Coin Railz a reliable replacement for query-limited DexScreener discovery.[[9]](https://developers.uniswap.org/docs/protocols/v3/deployments/v3-robinhood-chain-deployments)

Across supports routes from multiple chains in which USDC arrives as USDG, as well as ETH bridging and reverse USDG-to-USDC paths; its two-second fill statement is a vendor claim and should be measured independently.[[10]](https://across.to/blog/bridge-to-robinhood-chain-with-across) Robinhood also documents the canonical Arbitrum bridge, LayerZero/Stargate, Chainlink CCIP, Relay, Across, LiFi, and 0x.[[11]](https://docs.robinhood.com/chain/bridging)

Chainlink Data Feeds launched on mainnet on July 1.[[12]](https://dev.chain.link/changelog/data-feeds-expands-to-robinhood-chain-mainnet) Robinhood’s integration guidance explicitly requires consumers to handle dynamic decimals, stale rounds, non-positive answers, sequencer downtime, corporate-action multipliers, and `oraclePaused()` states.[[13]](https://docs.robinhood.com/chain/oracles-and-price-feeds)

## 3. Coin Railz alignment

### What Coin Railz got right

Coin Railz entered the ecosystem with the correct primitives:

1. Robinhood Chain token and pool discovery.
2. Chain status and RPC-derived information.
3. Batched Chainlink stock/ETF/crypto feed reads.
4. Base-to-Robinhood Chain funding through Across.
5. x402 packaging that makes the services callable by autonomous agents.

This maps well to Robinhood’s developer, RWA, ERC-4337, bridge, oracle, and agentic-account direction. The strategy should be retained.

### Where the implementation is misaligned

#### P0: bridge safety and delivery semantics

The bridge bounds USDC approval and validates several decoded `depositV3` fields, which is good. However, it forwards `txData.value` from an external API without requiring zero or enforcing a strict ETH cap. A malformed or compromised response could therefore spend Base ETH even though token approval is capped. It confirms the Base deposit but not the Robinhood Chain fill, and it does not persist a recoverable destination-delivery state.

The current product also delivers USDG but not ETH gas. A newly activated wallet can receive value yet remain unable to transact. It should not be described as complete wallet bootstrap until destination gas is addressed.

#### P0: public contract drift

The architect found inconsistencies between charged prices, `llms.txt`, OpenAPI, service catalog descriptions, and SDK parameters. One documented SDK parameter does not match the route’s required token-address field; the bridge documentation describes variable funding while the implementation sends a fixed 0.50 amount. These discrepancies can cause agents to fail before payment or misunderstand what they bought.

#### P1: DEX coverage is not chain-wide

The “top pools” and “chain stats” implementations query DexScreener using `q=USDC`, then aggregate only the returned Robinhood Chain subset. That is not a complete pool, volume, liquidity, or top-token index. It misses non-USDC and many RWA pools, precisely where recent activity has expanded. The output needs explicit coverage metadata until it uses canonical factory/event indexing or a verified indexer.

#### P1: oracle safety is incomplete

The current stock-price service hardcodes eight decimals and a common heartbeat. It does not validate positive answers, `answeredInRound`, per-feed decimals, per-feed heartbeat, sequencer uptime, Robinhood corporate-action multipliers, or `oraclePaused()`. Robinhood’s official documentation specifically calls for those checks.[[13]](https://docs.robinhood.com/chain/oracles-and-price-feeds)

Robinhood’s official Stock Token APIs expose asset metadata, contract addresses, current and pending multipliers, underlying market capabilities, bid/ask prices, and corporate actions.[[14]](https://docs.robinhood.com/chain/stock-token-apis) These APIs are the missing complement to Coin Railz’s on-chain feed reader.

## 4. Best opportunities

### 1. Robinhood RWA intelligence and safety API

Build a canonical asset registry that merges Robinhood `/assets`, `/prices`, and `/corporate-actions` with on-chain token contracts, Chainlink feed state, `uiMultiplier`, sequencer uptime, `oraclePaused()`, transfer restrictions, and jurisdiction metadata. Return provenance and timestamps for every field.

This is the strongest differentiated product because it solves a genuine RWA integration problem rather than reproducing generic token prices. Robinhood’s Stock Token documentation emphasizes corporate-action and jurisdiction behavior that ordinary crypto data APIs do not handle.[[15]](https://docs.robinhood.com/chain/stock-tokens)

### 2. Canonical pool intelligence and agent preflight

Index verified Uniswap factory events and published deployment addresses, then add:

- canonical pool/address verification;
- liquidity and volume with coverage disclosure;
- 1% and 5% price-impact estimates;
- Stock Token and USDG pool classification;
- oracle/market-session divergence;
- pool spoofing and thin-liquidity warnings;
- optional Rialto and other venue comparisons once their APIs and permissions are verified.

### 3. Reliable activation instead of treasury subsidy

Replace the current “pay $0.75 and receive treasury-funded 0.50 USDG” model with user-funded activation primitives:

- bridge quote and transaction construction;
- destination-fill tracking;
- ETH gas delivery or ERC-4337 sponsorship;
- explicit route choice and token representation;
- recoverable status and retry;
- optional sponsored pilot with a hard budget, not default economics.

### 4. Sequencer, oracle, and bridge reliability telemetry

Package sequencer uptime, oracle pause/freshness, bridge quote-to-fill, and RPC health into agent-callable monitoring. This is commercially relevant to Chainlink, Across, Robinhood ecosystem developers, and RWA applications.

## 5. Business-development priorities

| Priority | Target | Offer |
|---|---|---|
| 1 | Robinhood Chain developer ecosystem | Agent-ready RWA safety and activation quickstart; request technical review, not partnership branding |
| 2 | Chainlink ecosystem/data team | Validated feed-observability endpoint with staleness, sequencer, multiplier, and pause handling |
| 3 | Across integrations team | Observable quote-to-fill bridge primitive with bounded transactions and destination confirmation |
| 4 | Uniswap Robinhood deployment team | Canonical agent-safe pool intelligence using verified deployments |
| 5 | Rialto product/liquidity team | Shadow-mode intent preflight and aggregate route-quality telemetry after API terms are verified |

Do not lead with a generic DEX dashboard, retail stock-token trading, brokerage, custody, investment recommendations, treasury-subsidized bridging, or leveraged lending against stock-token collateral. Those areas are either weakly differentiated or create unnecessary financial/regulatory exposure.

## 6. Ranked action plan

### Fix now

1. Disable or harden `rh-bridge-usdc`: require zero or tightly capped transaction value, validate all quote/calldata fields, serialize treasury reservations, and track destination fill/recovery.
2. Correct Robinhood service prices, request schemas, SDK/plugin types, OpenAPI, `llms.txt`, service catalog, and payment-chain versus data-chain declarations from one canonical definition.
3. Implement Robinhood’s official oracle checks before marketing `rh-stock-price` as production-grade.

### Build next

4. Replace USDC-query DexScreener aggregation with canonical Uniswap indexing and explicit coverage/completeness fields.
5. Build the Stock Token metadata/corporate-action/oracle safety service.
6. Add destination ETH gas or ERC-4337 sponsorship to any activation flow.
7. Add a reconciled internal dashboard for DeFiLlama, explorer, Uniswap, bridge, and oracle-health metrics.

### Pursue commercially after technical proof

8. Robinhood developer ecosystem technical review.
9. Chainlink feed-semantics validation.
10. Across route and fill-status validation.
11. Uniswap deployment/indexing validation.
12. Two-builder paid beta before broader partnership claims.

## Limitations

Live TVL, DEX volume, transaction, and active-address figures are mutable and differed across providers during the same research session. They should be treated as dated ranges. Address and transaction counts do not establish unique human adoption. Across fill-time claims are vendor statements until independently measured. Coin Railz production telemetry can identify payment and user-agent behavior but cannot always identify the organization behind generic or missing user agents.

## Sources

1. [Robinhood Chain mainnet launch](https://robinhood.com/us/en/newsroom/robinhood-accelerates-global-expansion-robinhood-chain-mainnet-stock-tokens-agentic-trading) — July 1, 2026, Tier 1
2. [About Robinhood Chain](https://docs.robinhood.com/chain) — accessed September 4, 2026, Tier 1
3. [DeFiLlama chain API](https://api.llama.fi/v2/chains) — accessed September 4, 2026, Tier 2
4. [DeFiLlama Robinhood Chain](https://defillama.com/chain/robinhood-chain) — accessed September 4, 2026, Tier 2
5. [DeFiLlama Robinhood Chain DEXs](https://defillama.com/dexs/chain/robinhood-chain) — accessed September 4, 2026, Tier 2
6. [Robinhood Chain support and network details](https://robinhood.com/us/en/support/articles/robinhood-chain-mainnet) — accessed September 4, 2026, Tier 1
7. [Dune Robinhood Chain dashboard](https://dune.com/blockchains/robinhood) — accessed September 4, 2026, Tier 2
8. [Uniswap is live on Robinhood Chain](https://blog.uniswap.org/robinhood-chain-is-live) — July 1, 2026, Tier 1
9. [Uniswap Robinhood Chain deployments](https://developers.uniswap.org/docs/protocols/v3/deployments/v3-robinhood-chain-deployments) — accessed September 4, 2026, Tier 1
10. [Across bridge to Robinhood Chain](https://across.to/blog/bridge-to-robinhood-chain-with-across) — accessed September 4, 2026, Tier 1/vendor
11. [Robinhood Chain bridging documentation](https://docs.robinhood.com/chain/bridging) — accessed September 4, 2026, Tier 1
12. [Chainlink Data Feeds expansion](https://dev.chain.link/changelog/data-feeds-expands-to-robinhood-chain-mainnet) — July 1, 2026, Tier 1
13. [Robinhood Chain oracles and price feeds](https://docs.robinhood.com/chain/oracles-and-price-feeds) — accessed September 4, 2026, Tier 1
14. [Robinhood Stock Token APIs](https://docs.robinhood.com/chain/stock-token-apis) — accessed September 4, 2026, Tier 1
15. [Robinhood Stock Tokens](https://docs.robinhood.com/chain/stock-tokens) — accessed September 4, 2026, Tier 1