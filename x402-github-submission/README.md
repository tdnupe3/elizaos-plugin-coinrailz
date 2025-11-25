# x402 Ecosystem Submission Guide

## How to Get Coin Railz Listed on x402.org

### Step-by-Step Instructions:

1. **Fork the Repository**
   - Go to: https://github.com/coinbase/x402
   - Click "Fork" button

2. **Clone Your Fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/x402.git
   cd x402
   ```

3. **Create the Project Directory**
   ```bash
   mkdir -p typescript/site/app/ecosystem/partners-data/coinrailz
   ```

4. **Add the Logo**
   - Copy the Coin Railz logo to `typescript/site/public/logos/coinrailz.png`
   - Recommended size: 400x400px PNG with transparent background

5. **Add the Metadata**
   - Copy the `metadata.json` file from this directory to:
   ```
   typescript/site/app/ecosystem/partners-data/coinrailz/metadata.json
   ```

6. **Commit and Push**
   ```bash
   git add .
   git commit -m "Add Coin Railz to x402 ecosystem - 33 crypto analytics services"
   git push origin main
   ```

7. **Create Pull Request**
   - Go to your fork on GitHub
   - Click "Pull Request"
   - Title: "Add Coin Railz - Multi-chain x402 micropayment services"
   - Description:
   ```
   ## Project: Coin Railz

   **Website:** https://coinrailz.com
   **Category:** Services/Endpoints

   ### Description
   Multi-chain x402 micropayment infrastructure with 33 AI-ready API services:
   - Gas price oracle across 7 chains
   - Token analytics and pricing
   - Wallet risk analysis
   - Trading signals
   - Smart contract scanning
   - Whale alerts
   - DEX liquidity monitoring
   - Portfolio optimization
   - Plus 12 vertical expansion services (real estate, banking, trading, market intel)

   ### Payment Details
   - Network: Base (Mainnet)
   - Token: USDC
   - Pricing: $0.50 - $2.00 per request
   - Facilitator: CDP (Coinbase)

   ### Endpoints
   All services available at: https://coinrailz.com/x402/{service-name}

   ### Agent Card
   https://coinrailz.com/.well-known/agent-card.json

   ### Requirements Met
   ✅ Working mainnet integration (7 successful payments)
   ✅ API documentation at /developers
   ✅ 99%+ uptime
   ```

8. **Wait for Review**
   - Coinbase reviews PRs within 5 business days
   - They may co-market your launch!

---

## Alternative: Google Form Submission

If you prefer not to do a GitHub PR, you can also submit via:
https://forms.gle/VZKvX93ifiew1ksW9

---

## Files in This Directory

- `metadata.json` - The project metadata for the x402 ecosystem listing
- `README.md` - This guide
