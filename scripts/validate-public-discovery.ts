import fs from 'node:fs';
import path from 'node:path';
import {
  assertPublicDiscoveryConsistency,
  buildCanonicalPaymentManifest,
  getCanonicalPayableNetworks,
  PUBLIC_DISCOVERY_VERSIONS,
} from '../server/config/publicDiscoveryConfig';

const root = process.cwd();
const publicSurfaceFiles = [
  'server/routes/wellKnownRoutes.ts',
  'server/routes/mcpServiceDiscovery.ts',
  'server/routes/solanaPayRoutes.ts',
  'server/services/payments/solanaPay/solanaPaymentService.ts',
  'server/services/payments/solanaPay/paymentPoller.ts',
  'server/routes/x402MicroserviceRoutesV2.ts',
  'server/routes/a2aCoinRailzRoutes.ts',
  'server/routes/ap2MerchantRoutes.ts',
  'server/routes/a2aProviderRoutes.ts',
  'server/routes/mcpPaymentsKit.ts',
  'server/services/serviceCatalogService.ts',
  'server/middleware/paymentOrchestrator.ts',
  'server/middleware/x402ResponseEnricher.ts',
  'server/index.ts',
];

assertPublicDiscoveryConsistency();

const manifest = buildCanonicalPaymentManifest('https://coinrailz.com');
const payableNetworks = getCanonicalPayableNetworks();
const errors: string[] = [];

async function validateRuntimeResponses(baseUrl: string): Promise<void> {
  const getJson = async (pathname: string) => {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}${pathname}`);
    if (!response.ok) {
      errors.push(`${pathname} returned HTTP ${response.status}`);
      return null;
    }
    return response.json() as Promise<any>;
  };
  const getPaymentRequiredJson = async (pathname: string) => {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}${pathname}`);
    if (response.status !== 402) {
      errors.push(`${pathname} returned HTTP ${response.status} instead of 402`);
      return null;
    }
    return response.json() as Promise<any>;
  };
  const postJson = async (pathname: string, body: unknown) => {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}${pathname}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      errors.push(`${pathname} returned HTTP ${response.status}`);
      return null;
    }
    return response.json() as Promise<any>;
  };

  const [
    runtimeManifest,
    paymentMethods,
    solanaManifest,
    solanaPayManifest,
    solanaCatalog,
    solanaTokens,
    solanaStatus,
    solanaServices,
    solanaOpenRpc,
    solanaIntentAction,
    ap2Merchant,
    x402Discovery,
    agentCard,
    paymentChallenge,
    discoveryResources,
    a2aSummary,
    a2aCensus,
    a2aEmptyMessage,
  ] = await Promise.all([
    getJson('/.well-known/payment-manifest.json'),
    getJson('/.well-known/payment-methods.json'),
    getJson('/.well-known/solana.json'),
    getJson('/.well-known/solana-pay.json'),
    getJson('/solana-pay/catalog'),
    getJson('/solana-pay/tokens'),
    getJson('/solana-pay/status'),
    getJson('/solana-pay/services'),
    getJson('/solana-openrpc.json'),
    getJson('/solana-pay/intents'),
    getJson('/ap2/v1/merchant'),
    getJson('/.well-known/x402.json'),
    getJson('/.well-known/agent-card.json'),
    getPaymentRequiredJson('/x402/ping'),
    getJson('/.well-known/x402/discovery/resources'),
    getJson('/a2a/v1'),
    getJson('/a2a/v1/message/send'),
    postJson('/a2a/v1/message/send', {}),
  ]);
  if (!runtimeManifest) return;

  const solana = runtimeManifest.paymentAddresses.solana;
  const assertUsdcOnly = (label: string, tokens: unknown[]) => {
    const symbols = tokens.map((token: any) => typeof token === 'string' ? token : token.symbol);
    if (JSON.stringify(symbols) !== JSON.stringify([solana.token])) {
      errors.push(`${label} advertises ${symbols.join(', ') || 'no tokens'} instead of canonical ${solana.token}`);
    }
  };

  assertUsdcOnly('payment-methods stablecoins', paymentMethods?.crypto?.stablecoins ?? []);
  assertUsdcOnly('payment-methods Solana tokens', paymentMethods?.solana?.tokens ?? []);
  assertUsdcOnly('well-known Solana tokens', solanaManifest?.tokens ?? []);
  assertUsdcOnly('Solana Pay manifest tokens', solanaPayManifest?.payment_config?.accepted_tokens ?? []);
  assertUsdcOnly('Solana catalog tokens', solanaCatalog?.supported_tokens ?? []);
  assertUsdcOnly('Solana tokens endpoint', solanaTokens?.tokens ?? []);
  assertUsdcOnly('Solana status tokens', solanaStatus?.features?.tokens ?? []);
  assertUsdcOnly('Solana services tokens', solanaServices?.paymentInfo?.tokens ?? []);

  const openRpcTokens = solanaOpenRpc?.methods
    ?.find((method: any) => method.name === 'createPaymentIntent')
    ?.params?.find((param: any) => param.name === 'tokenSymbol')?.schema?.enum ?? [];
  assertUsdcOnly('Solana OpenRPC intent schema', openRpcTokens);

  const actionTokens = solanaIntentAction?.links?.actions
    ?.flatMap((action: any) => action.parameters ?? [])
    ?.find((parameter: any) => parameter.name === 'tokenSymbol')?.options
    ?.map((option: any) => option.value) ?? [];
  assertUsdcOnly('Solana Action intent schema', actionTokens);

  const recipients = [
    paymentMethods?.solana?.wallet_address,
    solanaManifest?.wallet?.address,
    solanaPayManifest?.payment_config?.recipient_wallet,
    solanaCatalog?.platform?.wallet,
  ];
  if (recipients.some(recipient => recipient !== solana.wallet)) {
    errors.push('runtime Solana discovery responses disagree with the canonical recipient');
  }

  const canonicalFacilitators = [...new Set(
    payableNetworks.map(network => network.facilitator).filter(Boolean),
  )];
  if (JSON.stringify(ap2Merchant?.facilitators ?? []) !== JSON.stringify(canonicalFacilitators)) {
    errors.push('AP2 merchant facilitators differ from canonical payable-network configuration');
  }
  if (ap2Merchant?.supportedCurrencies?.includes('USDT')) {
    errors.push('AP2 merchant advertises a noncanonical payment asset');
  }
  const baseFacilitator = payableNetworks.find(network => network.id === 'base')?.facilitator;
  const publicBaseFacilitators = [
    runtimeManifest?.paymentAddresses?.base?.facilitator,
    x402Discovery?.facilitatorUrl,
    x402Discovery?.facilitator,
    agentCard?.capabilities?.x402?.facilitatorUrl,
  ];
  if (publicBaseFacilitators.some(facilitator => facilitator !== baseFacilitator)) {
    errors.push('public Base facilitator claims differ from canonical configuration');
  }
  if (paymentMethods?.x402?.facilitator !== baseFacilitator) {
    errors.push('payment-methods x402 facilitator differs from canonical configuration');
  }
  const challengeText = JSON.stringify(paymentChallenge ?? {});
  if (challengeText.includes('USDT')) {
    errors.push('runtime 402 response advertises noncanonical USDT');
  }
  const challengeInstructions = paymentChallenge?.paymentInstructions;
  if (challengeInstructions) {
    const advertisedAssets = Object.values(challengeInstructions.acceptedTokens ?? {})
      .flatMap((tokens: any) => tokens)
      .map((token: any) => token.symbol);
    if (advertisedAssets.some((asset: string) => asset !== 'USDC')) {
      errors.push('runtime 402 payment instructions advertise a noncanonical asset');
    }
  }
  const canonicalChainIds = payableNetworks.map(network => network.id);
  for (const [label, response] of [
    ['A2A summary', a2aSummary],
    ['A2A census', a2aCensus],
    ['A2A empty-message', a2aEmptyMessage],
    ['AP2 merchant', ap2Merchant],
  ] as const) {
    if (JSON.stringify(response?.supportedChains ?? []) !== JSON.stringify(canonicalChainIds)) {
      errors.push(`${label} payable chain list differs from canonical configuration`);
    }
  }
  const basePayment = runtimeManifest.paymentAddresses.base;
  for (const resource of discoveryResources?.resources ?? []) {
    for (const accept of resource.accepts ?? []) {
      if (
        accept.network !== basePayment.caip2
        || accept.payTo !== basePayment.wallet
        || accept.asset !== basePayment.tokenAddress
      ) {
        errors.push(`discovery resource ${resource.id} combines inconsistent payment rail fields`);
        break;
      }
    }
  }
}

if (manifest.manifestVersion !== PUBLIC_DISCOVERY_VERSIONS.manifest) {
  errors.push('payment manifest version is not canonical');
}
if (manifest.totalServices !== manifest.services.length) {
  errors.push('payment manifest service count drifted from its service list');
}
if (manifest.payableNetworks.join('|') !== payableNetworks.map(network => network.caip2).join('|')) {
  errors.push('payment manifest payable network list drifted from canonical configuration');
}

const solanaRecipients = new Set(
  payableNetworks
    .filter(network => network.id === 'solana')
    .map(network => network.recipient),
);
if (solanaRecipients.size !== 1) {
  errors.push(`expected one active Solana recipient, found ${solanaRecipients.size}`);
}

for (const relativePath of publicSurfaceFiles) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  if (
    relativePath !== 'server/routes/x402MicroserviceRoutesV2.ts'
    && source.includes('process.env.SOLANA_PUBLIC_KEY')
  ) {
    errors.push(`${relativePath} resolves SOLANA_PUBLIC_KEY outside canonical configuration`);
  }
  if (
    source.includes('Hgby7VEo6vaPayM1G7kkjTqMAo4aCARoXA3ftWKz1m4k')
    || source.includes('BmUPzSupHJu2kW4cL27dF7Vc2JaZTwXKzFsRuagPDtL8')
  ) {
    errors.push(`${relativePath} hardcodes a Solana payment recipient outside canonical configuration`);
  }
  if (
    /(?:payTo|platformWallet|recipient|PLATFORM_WALLET)\s*[:=]\s*(?:process\.env[^\n]*\|\|\s*)?['"]0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91['"]/i.test(source)
  ) {
    errors.push(`${relativePath} hardcodes the default EVM recipient outside canonical configuration`);
  }
}

const wellKnownSource = fs.readFileSync(path.join(root, 'server/routes/wellKnownRoutes.ts'), 'utf8');
for (const route of ['/.well-known/payment-manifest', '/.well-known/payment-manifest.json']) {
  const registration = `router.get('${route}', sendCanonicalPaymentManifest)`;
  if (!wellKnownSource.includes(registration)) {
    errors.push(`${route} does not use the canonical payment manifest handler`);
  }
}
const paymentMethodsSection = wellKnownSource.slice(
  wellKnownSource.indexOf("router.get('/.well-known/payment-methods.json'"),
  wellKnownSource.indexOf("router.get('/.well-known/agent-payment-config.json'"),
);
if (
  !paymentMethodsSection.includes('stablecoins: [...new Set(payableNetworks.map')
  || /stablecoins:\s*\[[^\]]*(?:USDT|DAI)/.test(paymentMethodsSection)
) {
  errors.push('payment-methods stablecoin claims are not generated from canonical payable networks');
}

const solanaDiscoverySection = wellKnownSource.slice(
  wellKnownSource.indexOf("router.get('/.well-known/solana.json'"),
  wellKnownSource.indexOf("router.get('/.well-known/helius.json'"),
);
if (/\b(?:USDT|SOL\/USDC|SOL, USDC|symbol:\s*["']SOL["'])\b/.test(solanaDiscoverySection)) {
  errors.push('well-known Solana payment discovery advertises noncanonical assets');
}

const solanaPaySource = fs.readFileSync(path.join(root, 'server/routes/solanaPayRoutes.ts'), 'utf8');
for (const forbiddenSolanaClaim of ["z.enum(['SOL', 'USDC', 'USDT'])", "tokens: ['SOL', 'USDC', 'USDT']", "token: 'SOL'"]) {
  if (solanaPaySource.includes(forbiddenSolanaClaim)) {
    errors.push(`Solana Pay route advertises noncanonical payment assets: ${forbiddenSolanaClaim}`);
  }
}
if (!solanaPaySource.includes('z.literal(SOLANA_PAYMENT_TOKEN)')) {
  errors.push('Solana Pay intent schema is not restricted to the canonical payment asset');
}
const enricherSource = fs.readFileSync(
  path.join(root, 'server/middleware/x402ResponseEnricher.ts'),
  'utf8',
);
const paymentInstructionsSection = enricherSource.slice(
  enricherSource.indexOf('function createPaymentInstructions()'),
  enricherSource.indexOf('export function x402ResponseEnricher'),
);
if (paymentInstructionsSection.includes('USDT')) {
  errors.push('default 402 payment instructions advertise noncanonical USDT');
}
const microserviceSource = fs.readFileSync(
  path.join(root, 'server/routes/x402MicroserviceRoutesV2.ts'),
  'utf8',
);
const instantKeySection = microserviceSource.slice(
  microserviceSource.indexOf('supported_payments:'),
  microserviceSource.indexOf('requestId', microserviceSource.indexOf('supported_payments:')),
);
if (instantKeySection.includes('USDT') || !instantKeySection.includes('getCanonicalPayableNetworks()')) {
  errors.push('instant API key response does not derive USDC-only payment rails canonically');
}
const solanaPaymentServiceSource = fs.readFileSync(
  path.join(root, 'server/services/payments/solanaPay/solanaPaymentService.ts'),
  'utf8',
);
const createIntentSection = solanaPaymentServiceSource.slice(
  solanaPaymentServiceSource.indexOf('async createIntent('),
  solanaPaymentServiceSource.indexOf('async getIntentById('),
);
if (
  !createIntentSection.includes('const recipientAddress = PLATFORM_WALLETS.solana')
  || createIntentSection.includes('solanaWalletManager.getPublicKeyString()')
) {
  errors.push('Solana payment intents do not use the canonical recipient');
}
const paymentPollerSource = fs.readFileSync(
  path.join(root, 'server/services/payments/solanaPay/paymentPoller.ts'),
  'utf8',
);
if (
  !paymentPollerSource.includes('const platformWallet = PLATFORM_WALLETS.solana')
  || paymentPollerSource.includes('solanaWalletManager.getPublicKeyString()')
) {
  errors.push('Solana payment poller does not monitor the canonical recipient');
}

if (!wellKnownSource.includes('payments: {') || !wellKnownSource.includes('payableNetworks: getCanonicalPayableNetworks().map')) {
  errors.push('agent registration payment networks are not generated canonically');
}

const x402RouteSource = fs.readFileSync(path.join(root, 'server/routes/x402MicroserviceRoutesV2.ts'), 'utf8');
const recipesSection = x402RouteSource.slice(
  x402RouteSource.indexOf("router.get('/recipes/:service'"),
  x402RouteSource.indexOf("router.all('*'"),
);
if (/process\.env\.(?:PLATFORM_WALLET_ADDRESS|EVM_WALLET_ADDRESS)/.test(recipesSection)) {
  errors.push('x402 recipes resolve payment recipients outside canonical configuration');
}

const orchestratorSource = fs.readFileSync(path.join(root, 'server/middleware/paymentOrchestrator.ts'), 'utf8');
const acceptsSection = orchestratorSource.slice(
  orchestratorSource.indexOf('const acceptsArray = ['),
  orchestratorSource.indexOf('const serviceExampleBodies'),
);
for (const nonCanonicalOption of ['USDT_BASE', 'USDT_SOLANA', 'USDC_ROBINHOOD']) {
  if (acceptsSection.includes(nonCanonicalOption)) {
    errors.push(`issued 402 accepts includes noncanonical payment option ${nonCanonicalOption}`);
  }
}

const alternativeMethodsSection = orchestratorSource.slice(
  orchestratorSource.indexOf('paymentInstructions: {'),
  orchestratorSource.indexOf('recommendedServices: ['),
);
for (const forbiddenClaim of ['USDC/USDT', 'platformWallets:', 'ROBINHOOD_CHAIN_CCTP_ENABLED']) {
  if (alternativeMethodsSection.includes(forbiddenClaim)) {
    errors.push(`402 alternative payment methods contains noncanonical claim ${forbiddenClaim}`);
  }
}
if (
  !alternativeMethodsSection.includes('paymentRails: canonicalPaymentRails')
  || !alternativeMethodsSection.includes('supportedChains: canonicalPaymentRails.map')
  || !alternativeMethodsSection.includes('supportedTokens: [...new Set(canonicalPaymentRails.map')
) {
  errors.push('402 alternative payment methods are not generated from canonical payment rails');
}

const responseConstructionSection = orchestratorSource.slice(
  orchestratorSource.indexOf('const response: any = {'),
  orchestratorSource.indexOf('// Inject last_error_reason'),
);
if (responseConstructionSection.includes('USDT')) {
  errors.push('issued 402 response construction advertises a noncanonical USDT payment option');
}
for (const legacyPaymentMessage of ['Send USDC/USDT', 'sent USDC or USDT']) {
  if (orchestratorSource.includes(legacyPaymentMessage)) {
    errors.push(`payment verification response advertises noncanonical assets: ${legacyPaymentMessage}`);
  }
}

if (process.env.PUBLIC_DISCOVERY_VALIDATE_URL) {
  await validateRuntimeResponses(process.env.PUBLIC_DISCOVERY_VALIDATE_URL);
}

if (errors.length > 0) {
  console.error('Public discovery validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `Public discovery validation passed: ${manifest.totalServices} services, `
  + `${payableNetworks.length} payable networks, one canonical Solana recipient.`,
);