import {
  PLATFORM_WALLETS,
  USDC_ARBITRUM_ADDRESS,
  USDC_BASE_ADDRESS,
  USDC_ETHEREUM_ADDRESS,
  USDC_SOLANA_MINT,
} from '../utils/facilitatorHelper';
import { getFacilitatorUrl } from '../utils/facilitatorHelper';
import { getCanonicalServiceCount, getCanonicalServices } from '../utils/serviceCount';

export const PUBLIC_DISCOVERY_VERSIONS = {
  manifest: '1.1.0',
  serviceCatalog: '1.1.0',
  x402Label: 'x402-2.12',
  x402Spec: '2.12.0',
  x402Protocol: 2,
} as const;

export const DATA_QUERY_NETWORKS = [
  'eip155:1',
  'eip155:8453',
  'eip155:137',
  'eip155:56',
  'eip155:42161',
  'eip155:10',
  'eip155:4663',
  'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
] as const;

export type PayableNetwork = {
  id: 'ethereum' | 'base' | 'arbitrum' | 'solana';
  name: string;
  caip2: string;
  recipient: string;
  asset: 'USDC';
  assetAddress: string;
  decimals: 6;
  settlementMode: 'x402' | 'out-of-band' | 'solana-x402';
  facilitator?: string;
  chainId?: number;
};

type PaymentAddressManifestEntry = {
  wallet: string;
  caip2: string;
  chainId?: number;
  token: 'USDC';
  tokenAddress?: string;
  tokenMint?: string;
  tokenDecimals: 6;
  settlementMode: PayableNetwork['settlementMode'];
  facilitator?: string;
};

export function getCanonicalPayableNetworks(): PayableNetwork[] {
  return [
    {
      id: 'base',
      name: 'Base',
      caip2: 'eip155:8453',
      chainId: 8453,
      recipient: PLATFORM_WALLETS.base,
      asset: 'USDC',
      assetAddress: USDC_BASE_ADDRESS,
      decimals: 6,
      settlementMode: 'x402',
      facilitator: getFacilitatorUrl(),
    },
    {
      id: 'ethereum',
      name: 'Ethereum',
      caip2: 'eip155:1',
      chainId: 1,
      recipient: PLATFORM_WALLETS.ethereum,
      asset: 'USDC',
      assetAddress: USDC_ETHEREUM_ADDRESS,
      decimals: 6,
      settlementMode: 'out-of-band',
    },
    {
      id: 'arbitrum',
      name: 'Arbitrum One',
      caip2: 'eip155:42161',
      chainId: 42161,
      recipient: PLATFORM_WALLETS.arbitrum,
      asset: 'USDC',
      assetAddress: USDC_ARBITRUM_ADDRESS,
      decimals: 6,
      settlementMode: 'out-of-band',
    },
    {
      id: 'solana',
      name: 'Solana',
      caip2: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
      recipient: PLATFORM_WALLETS.solana,
      asset: 'USDC',
      assetAddress: USDC_SOLANA_MINT,
      decimals: 6,
      settlementMode: 'solana-x402',
      facilitator: 'https://x402.dexter.cash',
    },
  ];
}

export function getCanonicalPaymentRecipients(): Record<PayableNetwork['id'], string> {
  return Object.fromEntries(
    getCanonicalPayableNetworks().map(network => [network.id, network.recipient]),
  ) as Record<PayableNetwork['id'], string>;
}

export function buildCanonicalPaymentManifest(baseUrl: string) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  const payableNetworks = getCanonicalPayableNetworks();
  const paymentAddresses = Object.fromEntries(
    payableNetworks.map(network => [
      network.id,
      {
        wallet: network.recipient,
        caip2: network.caip2,
        ...(network.chainId ? { chainId: network.chainId } : {}),
        token: network.asset,
        ...(network.id === 'solana'
          ? { tokenMint: network.assetAddress }
          : { tokenAddress: network.assetAddress }),
        tokenDecimals: network.decimals,
        settlementMode: network.settlementMode,
        ...(network.facilitator ? { facilitator: network.facilitator } : {}),
      },
    ]),
  ) as Record<PayableNetwork['id'], PaymentAddressManifestEntry>;
  const services = [...getCanonicalServices()]
    .sort((a, b) => a.priceUsd - b.priceUsd)
    .map(service => ({
      id: service.id,
      name: service.name,
      description: service.description,
      endpoint: `${normalizedBaseUrl}${service.endpoint}`,
      method: service.method || 'POST',
      priceUSDC: service.priceUsd,
      priceMicro: Math.round(service.priceUsd * 1_000_000),
      category: service.category || 'general',
    }));

  return {
    x402Version: PUBLIC_DISCOVERY_VERSIONS.x402Protocol,
    manifestVersion: PUBLIC_DISCOVERY_VERSIONS.manifest,
    generated: new Date().toISOString(),
    platformUrl: normalizedBaseUrl,
    totalServices: getCanonicalServiceCount(),
    payableNetworks: payableNetworks.map(network => network.caip2),
    dataQueryNetworks: [...DATA_QUERY_NETWORKS],
    paymentAddresses,
    challengeFormat: {
      overview: 'Use only a network and recipient listed in paymentAddresses. Data-query network support does not imply payment acceptance.',
      evmX402: {
        network: 'eip155:8453',
        recipient: paymentAddresses.base.wallet,
        asset: paymentAddresses.base.tokenAddress,
        instruction: 'Sign the HTTP 402 challenge with an x402-compatible client and retry with its X-PAYMENT payload.',
      },
      evmOutOfBand: {
        networks: ['eip155:1', 'eip155:42161'],
        instruction: 'Send exact USDC to the matching paymentAddresses recipient, then retry with the transaction hash and explicit network.',
      },
      solanaTransaction: {
        network: paymentAddresses.solana.caip2,
        recipient: paymentAddresses.solana.wallet,
        asset: paymentAddresses.solana.tokenMint,
        instruction: 'Use the Solana payment challenge or intent flow and retry with the signed payment payload.',
        facilitator: paymentAddresses.solana.facilitator,
      },
      apiKey: {
        description: 'Card-based API key — no crypto wallet needed. Works on all services.',
        getFreeTrialKey: `GET ${normalizedBaseUrl}/api/m2m/credits/trial`,
        purchaseKey: `POST ${normalizedBaseUrl}/api/m2m/credits/purchase`,
        usage: 'X-API-KEY: cr_live_...',
      },
    },
    services,
  };
}

export function assertPublicDiscoveryConsistency(): void {
  const payableNetworks = getCanonicalPayableNetworks();
  const ids = new Set<string>();
  const caip2Ids = new Set<string>();
  const errors: string[] = [];

  for (const network of payableNetworks) {
    if (ids.has(network.id)) errors.push(`duplicate payable network id: ${network.id}`);
    if (caip2Ids.has(network.caip2)) errors.push(`duplicate payable CAIP-2 id: ${network.caip2}`);
    ids.add(network.id);
    caip2Ids.add(network.caip2);
    if (!network.recipient) errors.push(`missing recipient for ${network.id}`);
    if (!network.assetAddress) errors.push(`missing USDC asset address for ${network.id}`);
    if (!DATA_QUERY_NETWORKS.includes(network.caip2 as typeof DATA_QUERY_NETWORKS[number])) {
      errors.push(`payable network ${network.caip2} is absent from data-query networks`);
    }
    if (network.id !== 'solana' && !/^0x[a-fA-F0-9]{40}$/.test(network.recipient)) {
      errors.push(`recipient for ${network.id} is not a valid EVM address`);
    }
  }

  const solana = payableNetworks.filter(network => network.id === 'solana');
  if (solana.length !== 1) errors.push(`expected exactly one active Solana recipient, found ${solana.length}`);
  if (solana[0] && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(solana[0].recipient)) {
    errors.push('active Solana recipient is not a valid base58 public key');
  }

  const manifest = buildCanonicalPaymentManifest('https://coinrailz.com');
  if (manifest.totalServices !== manifest.services.length) {
    errors.push(`service count mismatch: canonical=${manifest.totalServices}, manifest=${manifest.services.length}`);
  }
  if (Object.keys(manifest.paymentAddresses).length !== payableNetworks.length) {
    errors.push('payment recipient count does not match payable network count');
  }

  if (errors.length > 0) {
    throw new Error(`Public discovery configuration drift:\n- ${errors.join('\n- ')}`);
  }
}