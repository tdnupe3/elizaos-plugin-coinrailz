/**
 * Robinhood Chain Stock Price Feed Service
 *
 * Reads Chainlink aggregator proxy contracts directly on-chain (Robinhood Chain, chainId 4663).
 * No external API key required — all data sourced from immutable on-chain truth.
 *
 * All feeds use 8 decimal places. Heartbeat: 86400s (daily). Deviation: 0.5%.
 * Price: $0.05 per call (multi-symbol batch supported, max 10 symbols per request).
 */

import { createPublicClient, http } from "viem";

const RH_CHAIN = {
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com"] } },
} as const;

const rhPublic = createPublicClient({ chain: RH_CHAIN, transport: http() });

const LATEST_ROUND_DATA_ABI = [
  {
    name: "latestRoundData",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "roundId",        type: "uint80"  },
      { name: "answer",         type: "int256"  },
      { name: "startedAt",      type: "uint256" },
      { name: "updatedAt",      type: "uint256" },
      { name: "answeredInRound",type: "uint80"  },
    ],
  },
  {
    name: "description",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

/** Chainlink aggregator proxy addresses on Robinhood Chain (all 8 decimals) */
export const RH_CHAIN_FEEDS: Record<string, `0x${string}`> = {
  // ─── US Equities ───────────────────────────────────────────────────
  AAPL:  "0x6B22A786bAa607d76728168703a39Ea9C99f2cD0",
  NVDA:  "0x379EC4f7C378F34a1B47E4F3cbeBCbAC3E8E9F15",
  SPY:   "0x319724394D3A0e3669269846abE664Cd621f9f6A",
  MSFT:  "0x45C3C877C15E6BA2EBB19eA114Ea508d14C1Af2E",
  GOOGL: "0xF6f373a037c30F0e5010d854385cA89185AE638b",
  TSLA:  "0x4A1166a659A55625345e9515b32adECea5547C38",
  AMZN:  "0xD5a1508ceD74c084eBf3cBe853e2C968fB2a651C",
  META:  "0x7C38C00C30BEe9378381E7B6135d7283356D71b1",
  AMD:   "0x943A29E7ae51A4798823ca9eEd2ed533B2A22C72",
  MSTR:  "0x396118bdFB181e6240E74D243F266B061c0edc3D",
  COIN:  "0xA3a468A452940B7D6b69991207B508c609a98Ef2",
  PLTR:  "0x820ABedFF239034956B7A9d2F0a331f9F075eB4c",
  GME:   "0x27C71df6A64fB476468EdF256CF72c038baB5B67",
  INTC:  "0x3f390C5C24628Ac7C489515402235FeAD71D1913",
  MU:    "0x425EEFdCf05ed6526C3cE61Af99429A228a6d596",
  BABA:  "0x62Cc8F9b5f56a33c9C8A60c8B92779f523c4E984",
  TSM:   "0x874cF94aa8eC88Fd9560094dD065f2fB3E41Fc2F",
  ASML:  "0xB4106147E8cce40b7d46124090d373A71b70f87D",
  ORCL:  "0x0e6a64a2B58A6693a531E6c555f3A5d042eEA844",
  RKLB:  "0x045477BF65Aef6f4F2386ad0164579e48381CC74",
  RGTI:  "0x2A045cF1C49c61c166C036d2f06FA2D2d984f765",
  IONQ:  "0x22EfeC4919baf55F360E0EDee4AbEB26DE4971eb",
  CRCL:  "0x6652eDf64bA3731C4F2D3ce821A0Fb1f1f6b482a",
  CRWV:  "0xe1b3aABCAFAd1c94708dc1367dcfF8Aa4407487C",
  NBIS:  "0xE1D87B116Ba0fe898998f1D140339D1fA1E09705",
  CLSK:  "0x810c12D3a554Bc47fd39597Fe3b3AAC4941F50eF",
  SPCX:  "0xB265810950ba6c5C0Ff821c9963014a56fD8Bffb",
  SNDK:  "0xfb133Fa4B7b385802B693a293606682Df47109A3",
  // ─── ETFs ──────────────────────────────────────────────────────────
  QQQ:   "0x80901d846d5D7B030F26B480776EE3b29374C2ae",
  EWY:   "0xEFdf54610B62A7753Ec30bDc380847c12D32e1D1",
  SGOV:  "0xa0DF4ee0fFf975306345875E3548Fcc519577A11",
  USO:   "0x75a9c76Ef439e2C7c2E5a34Ab105EcFe3766431c",
  SLV:   "0x209b73908e92Ae021826eD79609845451Ecba2ce",
  USAR:  "0xA994d3684e8400A6c8078226925779FdeE682DD9",
  // ─── Crypto ────────────────────────────────────────────────────────
  ETH:   "0x78F3556b67E17Df817D51Ef5a990cDaF09E8d3A9",
  BTC:   "0xa2c5184bF03d373Dc9dE4876eb4Bce595B460251",
  USDG:  "0x61B7e5650328764B076A108EFF5fa7282a1B9aD2",
  LINK:  "0xe86e3422Aa9B5e8ee9f3E41a63975bC387A8bce9",
};

export const SUPPORTED_SYMBOLS = Object.keys(RH_CHAIN_FEEDS);

export interface StockPriceResult {
  symbol:     string;
  priceUSD:   number;
  rawAnswer:  string;
  decimals:   number;
  updatedAt:  string;
  roundId:    string;
  staleSeconds: number;
  fresh:      boolean;
  feedAddress:string;
  source:     string;
  chainId:    number;
}

async function fetchOneFeed(symbol: string): Promise<StockPriceResult> {
  const upper = symbol.toUpperCase();
  const addr = RH_CHAIN_FEEDS[upper];
  if (!addr) throw new Error(`Symbol "${symbol}" not supported. Available: ${SUPPORTED_SYMBOLS.join(", ")}`);

  const [roundId, answer, , updatedAt] = await rhPublic.readContract({
    address: addr,
    abi: LATEST_ROUND_DATA_ABI,
    functionName: "latestRoundData",
  }) as [bigint, bigint, bigint, bigint, bigint];

  const DECIMALS = 8;
  const priceUSD  = Number(answer) / 10 ** DECIMALS;
  const updatedTs = Number(updatedAt);
  const staleSeconds = Math.floor(Date.now() / 1000) - updatedTs;

  return {
    symbol:      upper,
    priceUSD,
    rawAnswer:   answer.toString(),
    decimals:    DECIMALS,
    updatedAt:   new Date(updatedTs * 1000).toISOString(),
    roundId:     roundId.toString(),
    staleSeconds,
    fresh:       staleSeconds < 90000, // within 25h heartbeat window
    feedAddress: addr,
    source:      "chainlink-onchain",
    chainId:     4663,
  };
}

export async function rhStockPriceService(body: {
  symbol?:  string;
  symbols?: string[];
}): Promise<{
  prices:    StockPriceResult[];
  requested: number;
  fulfilled: number;
  errors:    { symbol: string; error: string }[];
  source:    string;
  chainId:   number;
  asOf:      string;
  note:      string;
}> {
  const raw = body.symbols ?? (body.symbol ? [body.symbol] : []);

  if (!raw || raw.length === 0) {
    throw new Error('Provide "symbol" (string) or "symbols" (string[]) in request body. ' +
      `Supported: ${SUPPORTED_SYMBOLS.join(", ")}`);
  }
  if (raw.length > 10) throw new Error("Max 10 symbols per request.");

  const results = await Promise.allSettled(raw.map(fetchOneFeed));

  const prices: StockPriceResult[]               = [];
  const errors: { symbol: string; error: string }[] = [];

  results.forEach((r, i) => {
    if (r.status === "fulfilled") prices.push(r.value);
    else errors.push({ symbol: raw[i].toUpperCase(), error: r.reason?.message ?? String(r.reason) });
  });

  return {
    prices,
    requested: raw.length,
    fulfilled: prices.length,
    errors,
    source:  "chainlink-onchain",
    chainId: 4663,
    asOf:    new Date().toISOString(),
    note:    "Live Chainlink SVR feeds on Robinhood Chain. 8 decimals, ~24h heartbeat, 0.5% deviation threshold.",
  };
}
