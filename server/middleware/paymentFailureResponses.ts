import { formatUnits } from 'viem';

export interface BalanceDetails {
  availableBalanceUsdc: string;
  shortfallUsdc: string;
}

export interface FailureTrackingDetails {
  errorMessage: string;
  walletAddress?: string;
  metadata: Record<string, unknown>;
}

function priceToMicroUsdc(priceUsd: number): bigint {
  return BigInt(Math.round(priceUsd * 1_000_000));
}

/**
 * Formats authoritative Base-USDC balance data without converting bigint values
 * through JavaScript numbers.
 */
export function getEvmBalanceDetails(
  priceUsd: number,
  availableBalanceBaseUnits: bigint,
): BalanceDetails {
  const requiredBaseUnits = priceToMicroUsdc(priceUsd);
  const shortfallBaseUnits = requiredBaseUnits > availableBalanceBaseUnits
    ? requiredBaseUnits - availableBalanceBaseUnits
    : BigInt(0);

  return {
    availableBalanceUsdc: formatUnits(availableBalanceBaseUnits, 6),
    shortfallUsdc: formatUnits(shortfallBaseUnits, 6),
  };
}

export function buildEvmInsufficientBalanceFailure(params: {
  serviceName: string;
  priceUsd: number;
  payerWallet: string | null;
  balanceDetails: BalanceDetails | null;
  usdcContract: string;
  paymentRecipient: string;
  publicBaseUrl: string;
  knownAgent: string;
}) {
  const priceStr = params.priceUsd.toFixed(6);
  const retryEndpoint = `${params.publicBaseUrl}/x402/${params.serviceName}`;
  const shortfall = params.balanceDetails?.shortfallUsdc ?? priceStr;

  return {
    tracking: {
      errorMessage: 'Agent wallet has insufficient USDC balance',
      walletAddress: params.payerWallet || undefined,
      metadata: {
        reason: 'insufficient-balance',
        network: 'base-mainnet',
        knownAgent: params.knownAgent,
        requiredAmount: params.priceUsd,
        availableBalance: params.balanceDetails?.availableBalanceUsdc ?? null,
        shortfall: params.balanceDetails?.shortfallUsdc ?? null,
        payerWallet: params.payerWallet,
      },
    } satisfies FailureTrackingDetails,
    body: {
      error: {
        code: 'insufficient_balance',
        message: `Insufficient USDC balance for ${params.serviceName}.`,
        retryable: true,
      },
      funding_required: {
        service: params.serviceName,
        network: 'base-mainnet',
        token: 'USDC',
        token_contract: params.usdcContract,
        payment_recipient: params.paymentRecipient,
        minimum_required_usdc: priceStr,
        ...(params.payerWallet ? { payer_wallet: params.payerWallet } : {}),
        ...(params.balanceDetails ? { available_balance_usdc: params.balanceDetails.availableBalanceUsdc } : {}),
        ...(params.balanceDetails ? { shortfall_usdc: params.balanceDetails.shortfallUsdc } : {}),
        retry: {
          method: 'POST',
          endpoint: retryEndpoint,
          instruction: params.payerWallet
            ? `Fund payer wallet ${params.payerWallet} with at least ${shortfall} USDC on Base mainnet (eip155:8453), then generate a new signed X-PAYMENT header and submit it to this endpoint.`
            : `Fund your agent wallet with at least ${priceStr} USDC on Base mainnet (eip155:8453), then generate a new signed X-PAYMENT header and submit it to this endpoint.`,
        },
      },
      alternative_payment_methods: {
        api_key: {
          recommended: true,
          description: 'Card-based M2M API key — no blockchain or crypto wallet required. Get a cr_live_ key in ~60 seconds.',
          purchase_endpoint: `${params.publicBaseUrl}/api/m2m/credits/purchase`,
          purchase_method: 'POST',
          purchase_body: { paymentMethodId: 'pm_...', amountUsd: 10, idempotencyKey: '<uuid-v4>' },
          idempotency_key_format: 'Any unique string, min 8 chars. UUID v4 recommended. Reuse on retry — safe for duplicate prevention.',
          success_response: { apiKey: 'cr_live_...', creditsAdded: 200, note: 'SAVE apiKey — returned once only' },
          usage: 'X-API-KEY: cr_live_... header or Authorization: Bearer cr_live_... on any /x402/* request instead of X-PAYMENT',
          tiers: [
            { amountUsd: 5, label: 'Intro', calls: '~80-100 service calls', note: 'Try it — no commitment' },
            { amountUsd: 10, label: 'Starter', calls: '~200 service calls' },
            { amountUsd: 25, label: 'Growth', calls: '~500 service calls', recommended: true },
            { amountUsd: 100, label: 'Pro', calls: '~2,000 service calls' },
          ],
          rate_limit: '5 purchases per IP per hour',
          error_codes: {
            400: 'Invalid paymentMethodId or idempotencyKey too short',
            409: 'Already processed — use new idempotencyKey',
            429: 'Rate limit exceeded',
          },
        },
      },
    },
  };
}

export interface SolanaUnderpaymentDetails {
  receivedAmountUsdc: string;
  shortfallUsdc: string;
}

/**
 * Only the verifier's exact "Insufficient amount: received < required" result
 * is eligible for the underpayment response. Arbitrary RPC errors must not
 * become a funding instruction.
 */
export function parseSolanaUnderpayment(error: string | undefined): SolanaUnderpaymentDetails | null {
  const match = error?.match(/insufficient amount:\s*([\d.]+)\s*<\s*([\d.]+)/i);
  if (!match) return null;

  const received = Number(match[1]);
  const required = Number(match[2]);
  if (!Number.isFinite(received) || !Number.isFinite(required) || received < 0 || required < received) {
    return null;
  }

  return {
    receivedAmountUsdc: received.toFixed(6),
    shortfallUsdc: (required - received).toFixed(6),
  };
}

export function buildSolanaUnderpaymentFailure(params: {
  serviceName: string;
  priceUsd: number;
  verifierError: string | undefined;
  payerWallet: string | null;
  network: string;
  tokenMint: string;
  paymentRecipient: string;
  publicBaseUrl: string;
  facilitator?: 'dexter';
}) {
  const underpayment = parseSolanaUnderpayment(params.verifierError);
  if (!underpayment) return null;

  const priceStr = params.priceUsd.toFixed(6);
  const retryEndpoint = `${params.publicBaseUrl}/x402/${params.serviceName}`;

  return {
    tracking: {
      errorMessage: `Solana underpayment: received ${underpayment.receivedAmountUsdc} USDC, required ${priceStr}`,
      walletAddress: params.payerWallet || undefined,
      metadata: {
        reason: 'underpayment',
        network: params.network,
        ...(params.facilitator ? { facilitator: params.facilitator } : {}),
        received: underpayment.receivedAmountUsdc,
        required: priceStr,
        payerWallet: params.payerWallet,
      },
    } satisfies FailureTrackingDetails,
    body: {
      error: {
        code: 'insufficient_payment_amount',
        message: `Payment for ${params.serviceName} was below the required amount.`,
        retryable: true,
      },
      payment_required: {
        service: params.serviceName,
        network: params.network,
        token: 'USDC',
        token_mint: params.tokenMint,
        payment_recipient: params.paymentRecipient,
        minimum_required_usdc: priceStr,
        received_amount_usdc: underpayment.receivedAmountUsdc,
        shortfall_usdc: underpayment.shortfallUsdc,
        ...(params.payerWallet ? { payer_wallet: params.payerWallet } : {}),
        retry: {
          method: 'POST',
          endpoint: retryEndpoint,
          instruction: `Create a new signed X-PAYMENT transaction for at least ${priceStr} USDC to ${params.paymentRecipient} on ${params.network} (mint: ${params.tokenMint}). Fund ${params.payerWallet ?? 'your payer wallet'} first if its available USDC balance is below ${priceStr}.`,
        },
      },
    },
  };
}