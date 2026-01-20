# Coin Railz IoT Pivot: 60-Day Revenue Plan

> **Status**: Planning Phase  
> **Created**: January 20, 2026  
> **Goal**: First paying IoT customer within 60 days

---

## Executive Summary

After validating that the autonomous AI agent economy lacks real buyers today, we're pivoting to IoT/M2M payments where companies are **already paying** for device data. The platform infrastructure is complete - we need to package it into sellable products and find buyers.

### The Pivot Thesis
- Agent economy = hype (no autonomous purchasing authority exists)
- IoT = real revenue NOW ($1T market, companies already buying device data)
- Our platform is already built for this (device registry, metering, credits, payments)
- Strategy: Find buyer first, source supply, collect revenue

---

## Two Verticals (Running in Parallel)

### Vertical 1: Fleet/Vehicle Telematics (B2B Recurring)
**Why**: Fastest path to paid pilots. Budgets exist, value is obvious, "pay per vehicle/month" is familiar.

**What we're selling**: Usage-based telematics data feeds + billing rails for fleets and fleet data providers.

**Target Customers**:
- Regional logistics fleets (50-500 vehicles)
- Fleet telematics resellers / MSPs
- Compliance / ELD / safety vendors
- Insurance underwriters needing driving behavior data

### Vertical 2: Weather/Environmental Sensor Data (Data Marketplace)
**Why**: DePIN-adjacent, scalable, fewer privacy issues. Sells to agriculture, insurance, energy, logistics.

**What we're selling**: Pay-per-reading / subscription access to hyperlocal weather & environmental feeds.

**Target Customers**:
- Small agtech firms
- Insurance analytics vendors
- Logistics route optimization companies
- Energy load forecasting startups
- Regional smart city vendors

---

## SKU Definitions

### SKU A: Fleet Telematics Billing Layer

| Attribute | Details |
|-----------|---------|
| **Customer** | Fleet operator OR telematics reseller/integrator |
| **Offer** | "We meter and bill usage and optionally resell/route your telemetry to buyers" |
| **Pricing Option 1** | $19-49 per vehicle/month (simple, easiest to buy) |
| **Pricing Option 2** | $0.001-0.01 per event (for high-volume customers) |
| **Pricing Option 3** | Hybrid: $10/vehicle + usage overage |

**Pilot Deliverables**:
- Device registration (vehicles/devices via `/api/iot/register`)
- Event metering (GPS pings, engine data via `/api/iot/meter`)
- Credits top-up (Stripe/PayPal via `/api/iot/topup`)
- Usage dashboards / CSV exports
- Optional: Data product listings for third-party buyers (later)

### SKU B: Hyperlocal Weather Feed

| Attribute | Details |
|-----------|---------|
| **Customer** | Agtech, insurers, logistics operators, energy analytics, smart city vendors |
| **Offer** | "Pay per reading or subscribe to a feed from specific geo points" |
| **Pricing Option 1** | $49-199/month per sensor feed (simple recurring) |
| **Pricing Option 2** | $0.001-0.005 per reading (metered, scales) |
| **Pricing Option 3** | Bundles: "25,000 readings for $100" (aligns with credits packs) |

**Pilot Deliverables**:
- 3-10 sensor feeds (even if partner-owned)
- Product listings in A2D catalog (`/api/iot/products`)
- API key access + unified credits
- Paywall with receipts + ledger proof (`/api/credits/unified/proof`)

---

## 60-Day Execution Timeline

### Phase 1: Productize (Days 1-7)

**Goal**: Make it impossible to misunderstand what we're selling.

#### Engineering Tasks

| Task | Priority | Effort | Owner |
|------|----------|--------|-------|
| Create fleet landing page (`/fleet`) | HIGH | 4h | Frontend |
| Create weather landing page (`/weather`) | HIGH | 4h | Frontend |
| Build `fleet-device-simulator` demo | HIGH | 4h | Backend |
| Build `weather-sensor-simulator` demo | HIGH | 4h | Backend |
| Update API docs with IoT-specific examples | MED | 2h | Backend |
| Add "Credits Ledger Proof" visual page | MED | 2h | Frontend |

#### Landing Page Requirements (Each Vertical)
```
- Who it's for (clear target customer)
- What it does (3-5 bullet points)
- Pricing (simple table)
- How the pilot works (step-by-step)
- API endpoints (developer section)
- "Book Pilot" CTA (Calendly or contact form)
```

#### Demo Simulator Requirements
Each simulator must demonstrate:
1. Device registration (`POST /api/iot/register`)
2. Event metering (`POST /api/iot/meter`)
3. Credits deduction (shows balance change)
4. Product purchase via A2D (`POST /api/iot/data/:productId`)

### Phase 2: Prospect List + Outreach (Days 8-21)

**Goal**: 40 quality touches per week across both verticals.

#### Fleet Telematics Prospects (Target: 10-20)

| Company Type | Example Companies | How to Find |
|--------------|-------------------|-------------|
| Regional logistics fleets | Local trucking, delivery, courier | LinkedIn "fleet manager" + region |
| Telematics resellers | OBD device resellers, GPS tracker vendors | Google "fleet telematics reseller" |
| ELD/Compliance vendors | Small ELD providers | FMCSA approved ELD list |
| Insurance brokers | Commercial auto insurers | LinkedIn "fleet insurance underwriter" |

#### Weather/Environment Prospects (Target: 10-20)

| Company Type | Example Companies | How to Find |
|--------------|-------------------|-------------|
| Agtech analytics | Crop prediction, farm management | CrunchBase "agtech" |
| Insurance analytics | Parametric insurance, crop insurance | LinkedIn "insurance analytics" |
| Logistics optimization | Route planning, last-mile delivery | Product Hunt / CrunchBase |
| Energy forecasting | Demand prediction, renewable scheduling | CrunchBase "energy analytics" |

#### Outreach Templates

**Email Template (Fleet)**:
```
Subject: Usage-based billing for your telematics data

Hi [Name],

I noticed [Company] provides [fleet management/telematics services]. 

We built a platform that lets fleet operators monetize their telemetry data through usage-based billing - charging per vehicle, per event, or hybrid models.

Would a 30-day pilot to test this with a small segment of your fleet be interesting?

[Your name]
```

**Email Template (Weather)**:
```
Subject: Monetize your sensor data through our platform

Hi [Name],

I'm reaching out because [Company] works with [weather/environmental/sensor] data.

We've built a marketplace where device owners can sell sensor feeds on a per-reading or subscription basis to analytics firms, insurers, and agtech companies.

Would you be open to a quick call to explore if there's a fit?

[Your name]
```

#### Discovery Call Questions (10 Key Questions)

1. What data do you currently collect from devices?
2. Are you monetizing that data today? How?
3. Who would pay for access to this data if it were available?
4. What's your current billing model? (one-time, subscription, usage?)
5. What would usage-based billing unlock for you?
6. How many devices/vehicles are we talking about?
7. What's your biggest pain point with current billing/metering?
8. Who else in your industry is doing this well?
9. What would success look like in a 30-day pilot?
10. What would it take to get started this month?

### Phase 3: Close Pilots (Days 22-45)

**Goal**: 2 paid pilots (one per vertical).

#### Pilot Terms

| Term | Details |
|------|---------|
| **Duration** | 30 days |
| **Scope** | Up to 50 devices (fleet) or 10 sensors (weather) |
| **Deliverables** | Full platform access: register, meter, bill, dashboard |
| **Pricing** | $500 pilot fee OR $500 credits top-up |
| **Conversion** | Monthly subscription after proof of value |

#### Success Metrics

| Vertical | Pilot Success = |
|----------|-----------------|
| Fleet | 1 paying customer + 50+ vehicles registered + events flowing |
| Weather | 1 paid integration + 1 paying buyer of the feed |

#### Conversion Definition
A "converted paying customer" is ANY of:
- Signup with payment method on file
- Credits top-up ≥ $250
- Paid endpoint usage in production

### Phase 4: Expand + Systematize (Days 46-60)

**Goal**: Turn pilots into repeatable revenue.

#### Deliverables

| Task | Priority |
|------|----------|
| Write case study for each pilot customer | HIGH |
| Create standard integration checklist | HIGH |
| Launch "Partner Program" (device owners list feeds → we bring buyers) | MED |
| Build conversion tracking dashboard | MED |
| Create sales playbook document | MED |

#### Partner Program Structure
- Device owners: List their data feeds
- Coin Railz: Brings buyers, handles payments
- Revenue split: 85% to device owner, 15% platform fee

---

## Existing Platform Capabilities

### Already Built (No New Backend Needed)

| Capability | Endpoint | Status |
|------------|----------|--------|
| Create IoT account | `POST /api/iot/account` | ✅ Ready |
| Register device | `POST /api/iot/register` | ✅ Ready |
| Meter billable events | `POST /api/iot/meter` | ✅ Ready |
| Credits top-up (Stripe/PayPal) | `POST /api/iot/topup` | ✅ Ready |
| Check balance | `GET /api/iot/balance` | ✅ Ready |
| D2D transfers | `POST /api/iot/transfer` | ✅ Ready |
| Create data product | `POST /api/iot/products` | ✅ Ready |
| Browse catalog | `GET /api/iot/catalog` | ✅ Ready |
| A2D purchase (x402) | `POST /api/iot/data/:productId` | ✅ Ready |
| Unified credits | `/api/credits/unified/*` | ✅ Ready |
| Credits proof/ledger | `GET /api/credits/unified/proof/:ownerType/:ownerId` | ✅ Ready |

### Minimal New Engineering

| Task | Effort | Priority |
|------|--------|----------|
| Fleet landing page | 4h | Week 1 |
| Weather landing page | 4h | Week 1 |
| Fleet device simulator | 4h | Week 1 |
| Weather sensor simulator | 4h | Week 1 |
| Usage dashboard (basic) | 6h | Week 2 |
| API docs update | 2h | Week 1 |

**Total new engineering**: ~24 hours (can be completed in Week 1)

---

## Pricing Strategy

### Fleet Telematics (Lead with Simple)

| Tier | Price | Best For |
|------|-------|----------|
| Starter | $19/vehicle/month | Small fleets (<50 vehicles) |
| Growth | $29/vehicle/month | Mid-size fleets (50-200) |
| Enterprise | $0.005/event | High-volume (200+ vehicles) |

### Weather Data (Lead with Subscription)

| Tier | Price | Best For |
|------|-------|----------|
| Single Feed | $99/month | One sensor location |
| Regional | $299/month | 5 sensor locations |
| Metered | $0.002/reading | High-volume analytics |
| Bundle | $100/25,000 readings | Burst usage |

---

## Risk Mitigation

### Risk: No Device Owners Sign Up
**Mitigation**: Partner with existing telematics/weather providers who have devices but no billing infrastructure. We become their backend.

### Risk: No Data Buyers Found  
**Mitigation**: Find buyer FIRST, then source supply. Don't build marketplace hoping buyers appear.

### Risk: Pricing Rejected
**Mitigation**: Start with pilots at $500 (low risk for customer). Learn what pricing works, then standardize.

### Risk: Technical Integration Friction
**Mitigation**: Provide demo simulators that work in 5 minutes. Reduce time-to-value.

---

## Week-by-Week Checklist

### Week 1 (Days 1-7)
- [ ] Create `/fleet` landing page
- [ ] Create `/weather` landing page  
- [ ] Build fleet-device-simulator
- [ ] Build weather-sensor-simulator
- [ ] Update API docs with IoT examples
- [ ] Set up Calendly for "Book Pilot" CTAs

### Week 2 (Days 8-14)
- [ ] Identify 10 fleet prospects
- [ ] Identify 10 weather prospects
- [ ] Send first 20 outreach emails
- [ ] Follow up on any responses
- [ ] Refine messaging based on feedback

### Week 3 (Days 15-21)
- [ ] Continue outreach (40 touches total)
- [ ] Book discovery calls
- [ ] Prepare pilot proposal document
- [ ] Identify potential device partners

### Week 4 (Days 22-28)
- [ ] Convert discovery calls to pilot agreements
- [ ] Onboard first pilot customer (fleet or weather)
- [ ] Provide integration support
- [ ] Track metering events

### Week 5 (Days 29-35)
- [ ] Monitor pilot progress
- [ ] Gather feedback
- [ ] Onboard second pilot customer
- [ ] Begin case study documentation

### Week 6 (Days 36-42)
- [ ] Complete pilot milestones
- [ ] Collect testimonials
- [ ] Draft case studies
- [ ] Prepare conversion offer

### Week 7 (Days 43-49)
- [ ] Convert pilots to monthly subscriptions
- [ ] Launch partner program page
- [ ] Create sales playbook
- [ ] Begin next batch of outreach

### Week 8 (Days 50-60)
- [ ] Analyze conversion metrics
- [ ] Refine pricing based on learnings
- [ ] Scale outreach
- [ ] Plan Phase 2 expansion

---

## Success Definition

### Minimum Viable Success (60 Days)
- 2 paid pilots ($500+ each)
- 100+ devices registered across pilots
- Proven billing flow (credits purchased, events metered)
- 1 case study published

### Stretch Goals
- 5 paid pilots
- Monthly recurring revenue started
- Partner program with 3+ device providers

---

## Appendix: Research Sources

- ChatGPT Deep Research: IoT Monetization (January 2026)
- Market sizing: $1T IoT monetization market (2024), 46% CAGR
- Real examples: Helium, Vodafone Pairpoint, Siemens/GE predictive maintenance
- Validation: Fleet telematics, agriculture sensors, smart city data all have existing buyers

---

## Appendix B: Competitive Landscape (from ChatGPT Research)

### Direct Competitors

| Company | What They Do | Relevance | Our Angle |
|---------|--------------|-----------|-----------|
| **Otonomo** | Vehicle telematics aggregation (40M+ cars, 4.3B data points/day) | Fleet vertical comp | We offer billing layer, they're aggregator |
| **Wejo** | Connected car data platform | Fleet vertical comp | We're device-agnostic, they're automotive-only |
| **Terbine** | IoT data marketplace (environmental) | Weather vertical comp | We add x402 payments, they're traditional marketplace |
| **DIMO** | Crypto + connected car data rewards | Similar web3 + IoT model | We're B2B focused, they're consumer rewards |
| **DataBroker DAO** | Blockchain-based sensor marketplace | Similar decentralized approach | We have working infrastructure, they pivoted |

### Key Insight: Revenue Split Model
Otonomo pays automakers via revenue-sharing agreements when their data is sold. Our **85/15 split** (85% to device owner, 15% platform fee) directly matches this proven model.

---

## Appendix C: Regulatory Tailwind - EU Data Act

**Effective: September 2025** (already in effect as of January 2026)

> "The new EU Data Act (2024) requires that IoT products sold in Europe must allow users to access the data they generate and share it with third parties of their choice."

### What This Means for Coin Railz
- Device owners in EU can now legally demand their data from manufacturers
- Creates a regulatory push toward platforms that facilitate data sharing
- Our A2D system is positioned to be the neutral billing/payment layer

### Sales Angle
> "The EU Data Act just forced device makers to enable data portability. We're the payment rails that make that data tradeable."

---

## Appendix D: Expanded Buyer Categories

### Tier 1 Buyers (High Urgency, Already Paying)

| Buyer Type | Data They Need | Typical Budget | Your Vertical |
|------------|----------------|----------------|---------------|
| **Insurance underwriters** | Telematics, driving behavior | $10K-100K/year | Fleet |
| **Logistics companies** | GPS, route data, storage temps | $5K-50K/year | Fleet |
| **Parametric insurance** | Weather, environmental sensors | $10K-200K/year | Weather |
| **Agtech analytics** | Soil moisture, crop health, weather | $5K-100K/year | Weather |

### Tier 2 Buyers (Growing Demand)

| Buyer Type | Data They Need | Your Vertical |
|------------|----------------|---------------|
| Energy/Utilities | Smart meter, demand patterns | Weather/Energy |
| Smart city departments | Traffic, air quality | Both |
| Mapping/Navigation | Road conditions, hazards | Fleet |
| Retailers | Foot traffic, cold chain | Both |

### Tier 3 Buyers (Future Expansion)

| Buyer Type | Data They Need | Notes |
|------------|----------------|-------|
| AI/ML companies | Training data | Large datasets |
| Manufacturers | Product usage | Predictive maintenance |
| Advertisers | Behavior patterns | Privacy-sensitive |

---

## Appendix E: Specific Companies to Target

### Fleet/Automotive Prospects

| Company Type | Examples | Approach |
|--------------|----------|----------|
| Regional ELD providers | SmallELD, BigRoad, KeepTruckin resellers | Billing backend offer |
| GPS tracker vendors | Traccar resellers, fleet GPS dealers | Monetization layer |
| Insurance telematics | Progressive Snapshot competitors | Data buyer |
| Delivery fleet operators | Regional courier companies | Device owner |

### Weather/Environmental Prospects

| Company Type | Examples | Approach |
|--------------|----------|----------|
| Weather sensor networks | WeatherFlow competitors | Monetization layer |
| Agtech analytics | Sentera, Prospera, Taranis | Data buyer |
| Parametric insurance | Arbol, Descartes, Nephila | Data buyer |
| Energy forecasting | AutoGrid, GridX, Drift | Data buyer |

---

## Appendix F: Monetization Models We Support

The ChatGPT research identified 3 monetization models. We've built infrastructure for all:

| Model | Description | Our Implementation | Status |
|-------|-------------|-------------------|--------|
| **Direct Data Sales** | Sell data through marketplaces | A2D catalog + x402 payments | ✅ Ready |
| **Analytics Services** | Sell insights, not raw data | Can layer on top | Future |
| **User-Centric Data** | Device owners opt-in for compensation | Device registration + 85/15 split | ✅ Ready |

---

*This plan preserves the platform vision while creating a focused revenue wedge. The agent economy infrastructure we built will be valuable when autonomous agents mature - but for now, IoT devices with human-approved budgets are the path to revenue.*
