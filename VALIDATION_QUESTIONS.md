# STRIPE & BRIDGE VALIDATION QUESTIONS
## Critical Assumptions to Verify Before Building

**Purpose:** Validate technical assumptions identified by architect review  
**Timeline:** Complete this week before any development begins

---

## 📧 STRIPE ACP (AGENTIC COMMERCE PROTOCOL) - Email to acp@stripe.com

### Subject Line:
```
Technical Requirements for ACP Merchant Integration - Coin Railz
```

### Email Body:
```
Hello Stripe ACP Team,

We're Coin Railz, an existing Stripe customer (Account ID: [INSERT YOUR STRIPE ACCOUNT ID]) 
currently operating payment infrastructure for fintech applications. We're interested in 
becoming an ACP-compliant merchant to enable AI agent payments.

Before applying for merchant onboarding, we need to validate several technical requirements 
to ensure our current infrastructure is compatible:

CRITICAL TECHNICAL QUESTIONS:

1. API Version Requirements
   Q: What is the minimum Stripe API version required for ACP integration?
   - We're currently on Stripe SDK v18.5.0
   - Do we need to upgrade to API version 2025-09-30 or later?
   - What specific features require the newer API version?

2. SharedPaymentToken Integration
   Q: What are the exact requirements for handling SharedPaymentTokens?
   - Do we need OAuth-based agent identity verification?
   - What authentication flow is required between our backend and AI agents?
   - Are there SDK methods for validating SharedPaymentTokens, or do we call REST API directly?
   - Sample code or documentation link?

3. ACP Endpoint Specification
   Q: Can you confirm the 4 required REST endpoints match the GitHub spec?
   - POST /checkout/create
   - PUT /checkout/:id/update
   - POST /checkout/:id/complete  
   - POST /checkout/:id/cancel
   - Are there any additional endpoints or webhook handlers required?

4. Testing & Certification
   Q: What is the process for ACP certification?
   - Is there a sandbox/test environment we can use?
   - Do you provide test AI agent credentials for integration testing?
   - What is the approval timeline for production access?

5. ChatGPT Instant Checkout
   Q: If we become ACP-compliant, what is the process for ChatGPT merchant listing?
   - Is this a separate application from general ACP onboarding?
   - What are the requirements for ChatGPT Instant Checkout specifically?

6. Technical Documentation
   Q: Where can we access the complete technical documentation?
   - ACP implementation guide
   - SharedPaymentToken API reference
   - Sample implementations or SDKs
   - OpenAPI specification beyond GitHub repo

ABOUT OUR INFRASTRUCTURE:
- Current Stripe integration: PaymentIntents, Checkout Sessions, Webhooks
- Multi-chain payment support: Base, Ethereum, Polygon, BNB Chain
- Circle USDC integration: 10 live production wallets
- Enterprise KYC/AML compliance systems

We're prepared to implement ACP if our assumptions are correct, but want to validate 
technical requirements before committing engineering resources.

Could we schedule a 30-minute technical consultation to discuss these requirements?

Thank you,
[Your Name]
Coin Railz - CTO/Technical Lead
[Your Email]
[Your Phone]
```

---

## 📧 STRIPE BRIDGE - Open Issuance Application

### Contact Method:
Visit: https://www.bridge.xyz/product/issuance  
Click: "Chat with our team" button

### Message to Bridge Team:
```
Hello Bridge Team,

We're exploring Open Issuance for launching a stablecoin (RAILZ) to power payments in 
the AI agent economy. Before proceeding, we need to validate technical and regulatory 
assumptions.

CRITICAL VALIDATION QUESTIONS:

1. SDK & API Availability
   Q: Is there a public SDK for Open Issuance integration?
   - We assumed `@bridge/sdk` npm package exists - can you confirm?
   - If no SDK, what is the REST API documentation link?
   - Are there code examples or sample implementations available?

2. Stablecoin Creation Process
   Q: What is the actual timeline and process for creating a stablecoin?
   - Marketing says "days not months" - what does this mean practically?
   - What approvals/reviews are required before issuance?
   - Can we get sandbox/testnet access before production?

3. Reserve Management Integration
   Q: How does integration with reserve partners (BlackRock/Fidelity) work?
   - Do you facilitate the partnership, or do we contract directly?
   - What are the minimum reserve requirements to launch?
   - Timeline for reserve partner onboarding?

4. Regulatory & Compliance
   Q: What regulatory requirements must we satisfy?
   - Do we need e-money licensing or MSB/MTL registration?
   - Does Bridge handle compliance, or do we need our own legal structure?
   - What is the trust structure for holding reserves?
   - Are there specific states/jurisdictions where we cannot operate?

5. Multi-Chain Deployment
   Q: How does multi-chain stablecoin deployment work?
   - Can we deploy on Base, Ethereum, and Polygon simultaneously?
   - Do you handle smart contract deployment and auditing?
   - What is the governance model for deployed contracts?
   - Cross-chain bridge infrastructure - is this provided by Bridge?

6. Costs & Economics
   Q: What are the actual costs for Open Issuance?
   - Initial setup fees?
   - Monthly platform fees?
   - Per-transaction costs?
   - Reserve management fees (beyond asset manager fees)?

7. Integration Support
   Q: What technical support is available during integration?
   - Do you provide integration engineering support?
   - Are there reference implementations we can study?
   - What is the typical integration timeline (weeks/months)?

ABOUT OUR USE CASE:
- Target: Payment infrastructure for AI agent protocols
- Expected volume: $5M-$50M year 1 transaction volume
- Multi-chain from launch: Base (primary), Ethereum, Polygon
- Integration timeline: 3-6 months (realistic estimate)
- Existing infrastructure: Circle USDC integration, enterprise KYC/AML

WHAT WE NEED:
1. Technical documentation (APIs, SDKs, integration guides)
2. Regulatory requirements checklist
3. Realistic timeline for issuance (from application to launch)
4. Sandbox/testnet access for development
5. Understanding of total cost structure

Can we schedule a technical consultation to discuss feasibility?

Thank you,
[Your Name]
Coin Railz
[Your Email]
```

---

## 🔍 INTERNAL VALIDATION TASKS

### Task 1: Verify Current Stripe Integration
```bash
# Check Stripe SDK version
npm list stripe

# Check if we can upgrade
npm outdated stripe

# Review what API version we're using
grep -r "apiVersion" server/
```

**Questions to Answer:**
- What Stripe API version are we currently using?
- Can we upgrade to 2025-09-30 or later?
- Will upgrade break existing payment flows?

### Task 2: Test SharedPaymentToken Availability
```typescript
// In server/routes.ts or test file, try:
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-09-30' // Try latest version
});

// Check if SharedPaymentToken is available
console.log('SharedPaymentToken methods:', stripe.sharedPayment);
```

**Questions to Answer:**
- Is `stripe.sharedPayment` available in our current SDK?
- If not, what version do we need?
- What methods are available on the SharedPaymentToken API?

### Task 3: Review ACP GitHub Specification
**Action:** Study https://github.com/agentic-commerce-protocol/agentic-commerce-protocol

**Focus on:**
- `spec/openapi/openapi.agentic_checkout.yaml` - Exact endpoint specs
- `spec/openapi/openapi.delegate_payment.yaml` - Payment delegation spec
- `examples/examples.*.json` - Sample request/response payloads

**Questions to Answer:**
- Do the 4 endpoints match our assumptions?
- What additional fields/headers are required?
- Are there webhook specifications we missed?

### Task 4: Check Bridge SDK Existence
```bash
# Try to find Bridge SDK
npm search @bridge/sdk
npm search bridge sdk stablecoin

# Check Bridge documentation
# Visit: https://docs.bridge.xyz (if exists)
# Visit: https://www.bridge.xyz/developers (if exists)
```

**Questions to Answer:**
- Does `@bridge/sdk` actually exist?
- If not, is there a different package name?
- Is there REST API documentation we can use instead?

---

## 📋 VALIDATION CHECKLIST

### Before Proceeding to Development:

**ACP Validation:**
- [ ] ✅ Confirmed minimum Stripe API version required
- [ ] ✅ Verified SharedPaymentToken is available in our SDK (or upgrade path)
- [ ] ✅ Confirmed 4 ACP endpoints specification is correct
- [ ] ✅ Received sample code or documentation from Stripe
- [ ] ✅ Understand authentication flow for AI agents
- [ ] ✅ Know testing/certification process

**Bridge Validation:**
- [ ] ✅ Confirmed SDK or API availability
- [ ] ✅ Understand actual timeline (not marketing claims)
- [ ] ✅ Know regulatory requirements (licensing, compliance)
- [ ] ✅ Confirmed reserve partner integration process
- [ ] ✅ Understand multi-chain deployment process
- [ ] ✅ Know total cost structure

**Regulatory Validation:**
- [ ] ✅ Identified required licenses (e-money, MSB, MTL)
- [ ] ✅ Understand trust structure requirements
- [ ] ✅ Know which states/jurisdictions we can operate
- [ ] ✅ Have contact with fintech legal counsel

**Timeline Validation:**
- [ ] ✅ Know actual approval timelines (not assumptions)
- [ ] ✅ Understand dependencies and sequencing
- [ ] ✅ Have realistic 6-12 month plan (not 16 weeks)

---

## 🎯 SUCCESS CRITERIA FOR VALIDATION PHASE

**We can proceed to development when:**

1. **Technical Feasibility Confirmed:**
   - We have actual SDK/API access (not assumptions)
   - We know exact integration requirements
   - We have sample code or documentation
   - We can test in sandbox environment

2. **Regulatory Path Clear:**
   - We know what licenses we need
   - We have legal counsel engaged
   - We understand compliance timeline (3-6 months realistic)
   - We know operational requirements

3. **Partnership Potential Validated:**
   - Stripe confirms we can become ACP merchant
   - Bridge confirms we can issue stablecoin
   - We have realistic timeline expectations
   - We understand cost structure

4. **Internal Readiness:**
   - Engineering team understands technical requirements
   - We have budget for compliance/legal ($50K-$100K realistic)
   - We have operational plan (24/7 monitoring, incident response)
   - Leadership aligned on 6-12 month timeline

---

## ⚠️ RED FLAGS THAT MEAN "DON'T PROCEED"

**Stop if we discover:**
- Bridge SDK doesn't exist or API not publicly available
- Stripe ACP requires months of merchant vetting we can't pass
- Regulatory requirements need $500K+ and 12+ months
- Reserve partners require $10M+ minimum to work with us
- Our current infrastructure incompatible (major rewrite needed)

**In that case, pivot to:**
- Use Stripe's standard payment infrastructure (skip ACP initially)
- Partner with existing stablecoin (USDC, USDT) instead of creating RAILZ
- Build payment SDK for AI agents using current capabilities
- Prove value first, add complexity later

---

## 📅 THIS WEEK'S TIMELINE

**Tuesday (Today):**
- [ ] Send email to acp@stripe.com
- [ ] Submit Bridge contact form
- [ ] Run internal Stripe validation tests

**Wednesday:**
- [ ] Review ACP GitHub repo in detail
- [ ] Test Stripe SDK upgrade path
- [ ] Research fintech legal counsel

**Thursday:**
- [ ] Follow up with Stripe if no response
- [ ] Follow up with Bridge if no response
- [ ] Compile validation findings

**Friday:**
- [ ] Create validated roadmap based on actual responses
- [ ] Present findings to stakeholders
- [ ] Decide go/no-go on ACP + Bridge path

---

**Bottom line: No code written until we have actual documentation, not assumptions.**
