# Solana Payment Processor - Technical Plan

## Executive Summary

**Objective:** Build a standalone Solana payment processor that enables receiving and verifying SOL/SPL token payments, completely isolated from the existing x402 EVM stack.

**Key Value Proposition:**
- Unlocks Solana-native AI agent market (Truth Terminal, pump.fun traders, Jito MEV bots)
- "Payment processing as a service" for Solana ecosystem
- Positions Coin Railz as multi-chain AI agent payment infrastructure

**Estimated Effort:** 5-6 engineering days
**Risk to Existing x402:** ZERO (completely isolated architecture)

---

## 1. Architecture Overview

### 1.1 System Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         COIN RAILZ PLATFORM                              │
├─────────────────────────────────┬───────────────────────────────────────┤
│     EXISTING: x402 (Base/EVM)   │     NEW: Solana Payment Processor     │
│     /x402/*                     │     /solana-pay/*                     │
│     ────────────────────        │     ──────────────────────────        │
│     hybridPaymentMiddleware.ts  │     solanaPaymentMiddleware.ts        │
│     CDP Facilitator             │     Helius Webhooks                   │
│     Base USDC/USDT              │     SOL + SPL USDC                    │
│     x402_payment_intents table  │     solana_payment_intents table      │
│     PRODUCTION ✅                │     TO BE BUILT                       │
└─────────────────────────────────┴───────────────────────────────────────┘
```

### 1.2 Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      SOLANA PAYMENT PROCESSOR                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐  │
│  │   API Layer      │    │  Webhook Handler │    │  Verification    │  │
│  │   /solana-pay/*  │    │  /solana-pay/    │    │  Worker          │  │
│  │                  │    │  webhook         │    │                  │  │
│  │  • POST /intents │    │                  │    │  • Confirm tx    │  │
│  │  • GET /intents  │    │  • Helius events │    │  • Match memo    │  │
│  │  • GET /pricing  │    │  • Signature val │    │  • Update status │  │
│  └────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘  │
│           │                       │                       │             │
│           └───────────────────────┼───────────────────────┘             │
│                                   ▼                                      │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                    SOLANA PAYMENT INTENTS TABLE                   │   │
│  │  (Completely separate from x402_payment_intents)                  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                   │                                      │
│  ┌────────────────────────────────┼────────────────────────────────┐    │
│  │                                ▼                                 │    │
│  │  ┌─────────────┐  ┌─────────────────────┐  ┌─────────────────┐  │    │
│  │  │ Fee Engine  │  │ Settlement Service  │  │ Analytics/Logs  │  │    │
│  │  │             │  │                     │  │                 │  │    │
│  │  │ • 0.5% fee  │  │ • Mark paid         │  │ • Revenue track │  │    │
│  │  │ • Min 0.01  │  │ • Trigger callback  │  │ • Usage metrics │  │    │
│  │  └─────────────┘  └─────────────────────┘  └─────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Database Schema

### 2.1 New Table: `solana_payment_intents`

```typescript
// shared/schema.ts - ADD THIS (do not modify x402_payment_intents)

export const solanaPaymentIntents = pgTable(
  "solana_payment_intents",
  {
    id: varchar("id").primaryKey(), // UUID format: sol_intent_xxxx
    
    // Payment details
    amount: numeric("amount", { precision: 18, scale: 9 }).notNull(), // SOL has 9 decimals
    tokenMint: varchar("token_mint").notNull(), // USDC: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v, SOL: native
    tokenSymbol: varchar("token_symbol").notNull(), // USDC, SOL
    amountUsd: numeric("amount_usd", { precision: 10, scale: 2 }), // USD equivalent at creation
    
    // Unique identifier for matching
    memoTag: varchar("memo_tag").notNull().unique(), // UUID memo for tx matching
    
    // Recipient (platform vault)
    recipientAddress: varchar("recipient_address").notNull(), // Platform Solana wallet
    recipientAta: varchar("recipient_ata"), // Associated Token Account for SPL tokens
    
    // Customer info
    customerWallet: varchar("customer_wallet"), // Optional: expected sender for extra validation
    customerId: varchar("customer_id"), // Optional: internal customer ID
    
    // Service being paid for
    serviceName: varchar("service_name").notNull(),
    serviceSlug: varchar("service_slug"),
    
    // Status tracking
    status: varchar("status").notNull().default("pending"), // pending, confirming, succeeded, failed, expired
    
    // Transaction details (populated after payment detected)
    txSignature: varchar("tx_signature"), // Solana transaction signature
    confirmedSlot: bigint("confirmed_slot", { mode: "number" }),
    confirmationStatus: varchar("confirmation_status"), // processed, confirmed, finalized
    
    // Fees
    platformFee: numeric("platform_fee", { precision: 18, scale: 9 }), // Our fee portion
    platformFeeUsd: numeric("platform_fee_usd", { precision: 10, scale: 2 }),
    
    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(), // Intent expiration (15 min default)
    paidAt: timestamp("paid_at"), // When payment detected
    settledAt: timestamp("settled_at"), // When fully confirmed
    
    // Metadata
    metadata: jsonb("metadata"), // Additional context
    webhookPayload: jsonb("webhook_payload"), // Raw Helius webhook for audit
    
    // Error tracking
    lastError: text("last_error"),
    retryCount: integer("retry_count").default(0),
  },
  (table) => [
    uniqueIndex("IDX_solana_intents_memo").on(table.memoTag),
    index("IDX_solana_intents_status").on(table.status),
    index("IDX_solana_intents_customer").on(table.customerWallet),
    index("IDX_solana_intents_expires").on(table.expiresAt),
    index("IDX_solana_intents_service").on(table.serviceName),
    index("IDX_solana_intents_tx").on(table.txSignature),
  ],
);
```

### 2.2 New Table: `solana_fee_tiers`

```typescript
export const solanaFeeTiers = pgTable(
  "solana_fee_tiers",
  {
    id: serial("id").primaryKey(),
    name: varchar("name").notNull(), // standard, premium, enterprise
    percentageFee: numeric("percentage_fee", { precision: 5, scale: 4 }).notNull(), // 0.0050 = 0.5%
    minimumFeeSol: numeric("minimum_fee_sol", { precision: 18, scale: 9 }).notNull(), // 0.01 SOL
    minimumFeeUsdc: numeric("minimum_fee_usdc", { precision: 10, scale: 6 }).notNull(), // 0.25 USDC
    description: text("description"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at").defaultNow(),
  }
);
```

### 2.3 New Table: `solana_processed_signatures`

```typescript
// Replay attack prevention (equivalent to usedTransactionHashes for EVM)
export const solanaProcessedSignatures = pgTable(
  "solana_processed_signatures",
  {
    id: serial("id").primaryKey(),
    txSignature: varchar("tx_signature").notNull().unique(), // Solana signature (88 chars base58)
    intentId: varchar("intent_id").references(() => solanaPaymentIntents.id),
    processedAt: timestamp("processed_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("IDX_solana_sig_unique").on(table.txSignature),
  ],
);
```

---

## 3. API Endpoints

### 3.1 Endpoint Design

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| POST | `/solana-pay/intents` | Create payment intent | API Key |
| GET | `/solana-pay/intents/:id` | Get intent status | API Key |
| POST | `/solana-pay/webhook` | Helius webhook receiver | Webhook signature |
| GET | `/solana-pay/pricing` | Get fee tiers | Public |
| GET | `/solana-pay/tokens` | Supported tokens | Public |

### 3.2 Create Intent (POST /solana-pay/intents)

**Request:**
```json
{
  "amount": "5.00",
  "tokenSymbol": "USDC",
  "serviceName": "ai-sentiment-analysis",
  "customerWallet": "rgPyefcNqJCsJj1wrWhdQqHVphVWFXLqU5wtiFStBEN",
  "metadata": {
    "orderId": "ORD-12345",
    "description": "Premium AI sentiment analysis"
  }
}
```

**Response:**
```json
{
  "intentId": "sol_intent_a1b2c3d4e5f6",
  "status": "pending",
  "payment": {
    "amount": "5.00",
    "tokenSymbol": "USDC",
    "tokenMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "recipientAddress": "Hgby7VEo6vaPayM1G7kkjTqMAo4aCARoXA3ftWKz1m4k",
    "memoTag": "CRPAY-a1b2c3d4"
  },
  "fees": {
    "platformFee": "0.025",
    "platformFeeUsd": "0.025",
    "totalAmount": "5.025"
  },
  "expiresAt": "2025-12-22T15:30:00Z",
  "instructions": {
    "wallet": "Send 5.025 USDC to Hgby7VEo6vaPayM1G7kkjTqMAo4aCARoXA3ftWKz1m4k with memo: CRPAY-a1b2c3d4",
    "explorerLink": "https://solscan.io/account/Hgby7VEo6vaPayM1G7kkjTqMAo4aCARoXA3ftWKz1m4k"
  }
}
```

### 3.3 Webhook Handler (POST /solana-pay/webhook)

**Helius Enhanced Webhook Payload:**
```json
[
  {
    "type": "TRANSFER",
    "signature": "5wJ8yz...",
    "timestamp": 1703253000,
    "tokenTransfers": [
      {
        "mint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        "fromUserAccount": "rgPyefcNqJCsJj1wrWhdQqHVphVWFXLqU5wtiFStBEN",
        "toUserAccount": "Hgby7VEo6vaPayM1G7kkjTqMAo4aCARoXA3ftWKz1m4k",
        "tokenAmount": 5.025
      }
    ],
    "accountData": [...],
    "instructions": [...]
  }
]
```

---

## 4. Helius Integration

### 4.1 Webhook Configuration

```typescript
// server/services/heliusWebhookService.ts

import Helius from 'helius-sdk';

const helius = new Helius(process.env.HELIUS_API_KEY!);

// Create webhook to monitor platform vault
async function setupWebhook() {
  const webhook = await helius.webhooks.createWebhook({
    webhookURL: `${process.env.APP_URL}/solana-pay/webhook`,
    transactionTypes: ['TRANSFER', 'TOKEN_MINT'],
    accountAddresses: [
      process.env.SOLANA_PLATFORM_WALLET!, // Platform vault
    ],
    webhookType: 'enhanced', // Parsed transaction data
  });
  
  console.log(`Helius webhook created: ${webhook.webhookID}`);
  return webhook;
}
```

### 4.2 Webhook Signature Verification

```typescript
// Verify Helius webhook authenticity
function verifyHeliusSignature(payload: string, signature: string): boolean {
  const hmac = crypto.createHmac('sha256', process.env.HELIUS_WEBHOOK_SECRET!);
  hmac.update(payload);
  const expectedSignature = hmac.digest('base64');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

### 4.3 Payment Verification Logic

```typescript
// server/services/solanaPaymentVerifier.ts

async function verifyPayment(
  webhookPayload: HeliusEnhancedPayload,
  intent: SolanaPaymentIntent
): Promise<VerificationResult> {
  
  // 1. Check token transfer exists
  const transfer = webhookPayload.tokenTransfers?.find(
    t => t.toUserAccount === intent.recipientAddress
  );
  
  if (!transfer) {
    return { valid: false, reason: 'No transfer to recipient' };
  }
  
  // 2. Verify token mint
  if (transfer.mint !== getTokenMint(intent.tokenSymbol)) {
    return { valid: false, reason: 'Wrong token' };
  }
  
  // 3. Verify amount (including platform fee)
  const requiredAmount = parseFloat(intent.amount) + parseFloat(intent.platformFee);
  if (transfer.tokenAmount < requiredAmount) {
    return { valid: false, reason: 'Insufficient amount' };
  }
  
  // 4. Verify memo (if included in instructions)
  const memoInstruction = webhookPayload.instructions?.find(
    i => i.programId === 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'
  );
  
  if (memoInstruction) {
    const memoData = Buffer.from(memoInstruction.data, 'base64').toString();
    if (!memoData.includes(intent.memoTag)) {
      return { valid: false, reason: 'Memo mismatch' };
    }
  }
  
  // 5. Check transaction finality via RPC
  const connection = new Connection(process.env.SOLANA_RPC_URL!);
  const status = await connection.getSignatureStatus(webhookPayload.signature);
  
  if (status.value?.confirmationStatus !== 'finalized') {
    return { valid: false, reason: 'Not finalized' };
  }
  
  // 6. Check for replay attack
  const existingSig = await db.query.solanaProcessedSignatures.findFirst({
    where: eq(solanaProcessedSignatures.txSignature, webhookPayload.signature)
  });
  
  if (existingSig) {
    return { valid: false, reason: 'Replay attack: signature already used' };
  }
  
  return {
    valid: true,
    txSignature: webhookPayload.signature,
    confirmedSlot: status.value?.slot,
  };
}
```

---

## 5. Monetization Strategy

### 5.1 Fee Structure

| Tier | Percentage Fee | Minimum Fee (SOL) | Minimum Fee (USDC) | Target |
|------|----------------|-------------------|--------------------|---------| 
| **Standard** | 0.5% | 0.001 SOL (~$0.15) | $0.25 | General use |
| **Premium** | 0.3% | 0.0005 SOL (~$0.08) | $0.15 | High volume |
| **Enterprise** | 0.1% | Custom | Custom | Partners |

### 5.2 Comparison to x402 Pricing

| Aspect | x402 (EVM) | Solana Pay | Notes |
|--------|------------|------------|-------|
| Per-call price | $0.25-$0.50 | $0.25-$0.50 | Similar service pricing |
| Network fees | ~$0.02 (Base) | ~$0.0002 (Solana) | 100x cheaper on Solana |
| Platform fee | Built into price | 0.5% + minimum | Explicit processing fee |
| Settlement time | ~2 seconds | ~400ms | Faster on Solana |

### 5.3 Revenue Projections

| Volume Level | Monthly Transactions | Avg Fee | Monthly Revenue |
|--------------|---------------------|---------|-----------------|
| Early stage | 1,000 | $0.25 | $250 |
| Growth | 10,000 | $0.25 | $2,500 |
| Scale | 100,000 | $0.20 | $20,000 |

### 5.4 Subscription Bundles (Future)

| Bundle | Monthly Price | Included Intents | Per-Intent After |
|--------|---------------|------------------|------------------|
| Starter | $49/mo | 200 intents | $0.30 |
| Pro | $199/mo | 1,000 intents | $0.20 |
| Enterprise | $999/mo | 10,000 intents | $0.10 |

---

## 6. Implementation Phases

### Phase 1: Core Infrastructure (2-3 days)
- [ ] Database schema migration (solana_payment_intents, etc.)
- [ ] Storage interface methods
- [ ] Basic API endpoints (create intent, get intent)
- [ ] Helius webhook setup and signature verification
- [ ] Intent matching and status updates

### Phase 2: Payment Verification (1-2 days)
- [ ] SPL token transfer detection
- [ ] Memo parsing and matching
- [ ] Transaction finality confirmation
- [ ] Replay attack prevention
- [ ] Error handling and retry logic

### Phase 3: Monetization (1 day)
- [ ] Fee calculation engine
- [ ] Fee tier management
- [ ] Revenue tracking and analytics
- [ ] Integration with existing dashboard

### Phase 4: Testing & Hardening (1 day)
- [ ] Devnet end-to-end testing
- [ ] Mainnet integration testing
- [ ] Load testing for high-frequency payments
- [ ] Documentation and API reference

---

## 7. Difficulty Assessment

### 7.1 Complexity Breakdown

| Component | Difficulty | Reason |
|-----------|------------|--------|
| Database schema | Low | Similar pattern to x402_payment_intents |
| API endpoints | Low | Standard REST patterns |
| Helius webhook | Medium | New integration, signature verification |
| Payment verification | Medium | SPL token handling, memo parsing |
| Fee engine | Low | Simple percentage + minimum logic |
| Replay prevention | Low | Same pattern as EVM |
| Testing | Medium | Requires devnet/mainnet verification |

### 7.2 Risk Factors

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Helius webhook reliability | Low | High | Fallback polling mechanism |
| Memo collision | Low | Medium | UUID-based memos |
| Solana congestion | Medium | Low | Retry logic, priority fees |
| Webhook replay attacks | Low | High | Signature verification, idempotency |

### 7.3 Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| SOLANA_PRIVATE_KEY | ✅ Configured | Platform vault key |
| HELIUS_API_KEY | ✅ Configured | Helius access |
| HELIUS_WEBHOOK_SECRET | ⚠️ Needed | New secret required |
| @solana/web3.js | ✅ Installed | Solana SDK |
| @solana/spl-token | ⚠️ May need | SPL token handling |

---

## 8. Token Support

### 8.1 Supported Tokens (Launch)

| Token | Mint Address | Decimals |
|-------|--------------|----------|
| USDC | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | 6 |
| SOL | Native | 9 |

### 8.2 Future Tokens (Post-Launch)

| Token | Mint Address | Notes |
|-------|--------------|-------|
| USDT | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB` | High demand |
| BONK | `DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263` | Meme token |
| JUP | `JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN` | Jupiter token |

---

## 9. Files to Create

| File | Purpose |
|------|---------|
| `server/routes/solanaPayRoutes.ts` | API endpoints |
| `server/services/solanaPaymentService.ts` | Intent management |
| `server/services/solanaPaymentVerifier.ts` | Payment verification |
| `server/services/heliusWebhookService.ts` | Webhook handling |
| `server/middleware/solanaPaymentMiddleware.ts` | Request validation |
| `shared/schema.ts` (additions) | New tables |
| `docs/api/solana-pay-api.md` | API documentation |

---

## 10. Environment Variables

### Required (New)

```bash
# Helius webhook secret for signature verification
HELIUS_WEBHOOK_SECRET=whsec_xxxxxxxxxxxx

# Solana RPC URL (can use Helius RPC)
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_HELIUS_API_KEY
```

### Already Configured

```bash
SOLANA_PRIVATE_KEY=✅
HELIUS_API_KEY=✅
```

---

## 11. Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| Intent creation latency | < 100ms | API response time |
| Payment detection | < 5 seconds | Webhook to status update |
| Verification accuracy | 100% | No false positives/negatives |
| Uptime | 99.9% | Webhook availability |
| Replay prevention | 100% | No duplicate payments processed |

---

## 12. Go/No-Go Checklist

Before building:
- [x] Architecture validated by architect
- [x] User approved isolated approach
- [x] Helius API key available
- [x] Solana wallet key available
- [ ] HELIUS_WEBHOOK_SECRET obtained
- [ ] Devnet testing environment ready

---

## Appendix A: Solana Token Addresses

```typescript
const SOLANA_TOKENS = {
  USDC: {
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    decimals: 6,
    name: 'USD Coin',
  },
  USDT: {
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    decimals: 6,
    name: 'Tether USD',
  },
  SOL: {
    mint: 'native',
    decimals: 9,
    name: 'Solana',
  },
};
```

## Appendix B: Platform Wallet

```
Solana Vault: Hgby7VEo6vaPayM1G7kkjTqMAo4aCARoXA3ftWKz1m4k
```
