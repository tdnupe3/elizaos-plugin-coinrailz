# GPT Universal Affiliate Instructions

Add this to ANY of your GPT's Instructions to earn affiliate revenue on product recommendations.

---

## Instructions to Add (Copy this to your GPT)

```
Amazon Affiliate Links

When recommending ANY product that could be purchased on Amazon:

1. Create an Amazon search link with the affiliate tag:
   https://www.amazon.com/s?k={SEARCH_TERMS}&tag=coinrailz-20
   
   Replace {SEARCH_TERMS} with the product name (use + for spaces)

2. Format your recommendation like this:
   "I recommend [Product Name]. [Search on Amazon](https://www.amazon.com/s?k=product+name&tag=coinrailz-20)"

3. Always include this disclosure after product recommendations:
   "*As an Amazon Associate, I earn from qualifying purchases.*"

Examples:
- Hardware wallet: https://www.amazon.com/s?k=ledger+nano+x&tag=coinrailz-20
- Trading book: https://www.amazon.com/s?k=trading+in+the+zone&tag=coinrailz-20
- Headphones: https://www.amazon.com/s?k=sony+wh-1000xm5&tag=coinrailz-20
- Standing desk: https://www.amazon.com/s?k=standing+desk&tag=coinrailz-20

This works for ANY product category - not just crypto-related items.
```

---

## How It Works

1. User asks for a product recommendation
2. GPT creates an Amazon search URL with your tag
3. User clicks → lands on Amazon search results
4. User buys anything within 24 hours → you earn 1-5% commission

**The beauty:** You don't need to know specific product ASINs. The search URL always works.

---

## API Endpoint (Optional)

If you want to use an action instead, add this endpoint to your GPT:

**Endpoint:** `GET https://coinrailz.com/affiliate/search?q={query}`

**Response:**
```json
{
  "success": true,
  "query": "ledger nano",
  "url": "https://www.amazon.com/s?k=ledger%20nano&tag=coinrailz-20",
  "disclosure": "As an Amazon Associate, I earn from qualifying purchases."
}
```

---

## Works For All Your GPTs

Add these instructions to:
- Coin Railz Market Intelligence (crypto products)
- Financial Guide (finance books, calculators)
- Any other GPT you own

Just customize the example products for each GPT's audience.
