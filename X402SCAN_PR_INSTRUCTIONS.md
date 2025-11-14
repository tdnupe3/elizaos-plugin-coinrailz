# x402scan Facilitator Tracking PR - Step-by-Step Instructions

## What This PR Does
Adds Coin Railz to x402scan's facilitator dashboard so your transaction volume appears in their analytics.

---

## STEP 1: Fork the Repository

1. Go to: https://github.com/Merit-Systems/x402scan
2. Click the **"Fork"** button in the top-right
3. Click **"Create fork"**

You now have your own copy at: `https://github.com/tdnupe3/x402scan`

---

## STEP 2: Add Coin Railz Logo

1. In YOUR fork, navigate to: `facilitators/images/`
2. Click **"Add file"** → **"Upload files"**
3. Upload a Coin Railz logo (PNG format, square, ~200x200px recommended)
   - Filename: `coinrailz.png`
4. Commit message: `Add Coin Railz facilitator logo`
5. Click **"Commit changes"**

**Don't have a logo?** You can skip this step and use a placeholder color for now.

---

## STEP 3: Edit facilitators/config.ts

1. In YOUR fork, navigate to: `facilitators/config.ts`
2. Click the **pencil icon** (Edit this file)
3. Find the `_FACILITATORS` array (around line 50-100)
4. Add this code AFTER the last facilitator entry (before the closing `];`):

```typescript
  {
    id: 'coinrailz',
    name: 'Coin Railz',
    image: '/coinrailz.png', // Or use a color if no logo: color: 'var(--color-green-600)'
    link: 'https://coinrailz.com',
    color: 'var(--color-blue-600)',
    addresses: {
      [Chain.BASE]: [
        {
          address: '0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91',
          token: USDC_BASE_TOKEN,
          syncStartDate: new Date('2025-11-01'), // When your services went live
          enabled: true,
        },
      ],
    },
  },
```

5. Commit message: `Add Coin Railz facilitator tracking`
6. Click **"Commit changes"**

---

## STEP 4: Create Pull Request

1. Go to YOUR fork: `https://github.com/tdnupe3/x402scan`
2. You'll see a banner saying "This branch is 1 commit ahead of Merit-Systems:main"
3. Click **"Contribute"** → **"Open pull request"**
4. **Title**: 
   ```
   Add Coin Railz facilitator tracking
   ```

5. **Description**:
   ```markdown
   ## Summary
   Adds Coin Railz to facilitator tracking dashboard.

   ## Details
   - **Facilitator**: Coin Railz
   - **Platform**: https://coinrailz.com
   - **Network**: Base mainnet
   - **Wallet**: 0xa4bbe37f9a6ae2dc36a607b91eb148c0ae163c91
   - **Services**: 18 x402 micropayment services (already registered on x402scan)
   
   ## Testing
   - Validated wallet address is active on Base mainnet
   - All 18 services registered at x402scan.com/resources
   - Transaction data available for tracking
   
   This PR enables tracking of transaction volume from Coin Railz services on the facilitator dashboard.
   ```

6. Click **"Create pull request"**

---

## DONE! ✅

Your PR is now submitted. What happens next:

1. **Automated checks** will run (validating your config format)
2. **shafu0x or team** will review
3. If approved, they **merge** your PR
4. **Your wallet** appears on x402scan.com dashboard
5. **Transaction volume** from your services gets tracked

---

## Expected Timeline

- **Review**: 1-3 days
- **Merge**: Usually quick if checks pass
- **Live on site**: Within hours after merge

---

## Notes

- This is a **technical contribution**, not promotional
- You're adding data to their tracking system
- shafu0x said "best job application is a PR" - this is it
- Low risk, high visibility with the x402scan team

---

**Any questions before you start?**
