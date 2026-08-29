---
name: Trial credit provenance
description: Credit ledger purchase-shaped rows can represent free-trial grants and must be reconciled before counting revenue or conversion.
---

Treat a credit transaction with `payment_method=trial`, a trial reference, or a free-trial description as an acquisition/grant event until it is joined to a successful payment processor settlement, non-test identity, issued credential, and subsequent authenticated usage.

**Why:** A recent production row used `type=purchase` and added $5 credits, but its reference and description identified a free trial; counting it as paid conversion would overstate commercial traction.

**How to apply:** For every assessment, classify credit rows by provenance and payment method before reporting revenue, conversion, or buyer counts. Keep free-trial grants separate from paid credit purchases.