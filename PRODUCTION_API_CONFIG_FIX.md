# PRODUCTION API CONFIGURATION - IMMEDIATE ACTION REQUIRED
## Coin Railz Platform - August 12, 2025

**🚨 CRITICAL: Production APIs need immediate configuration for deployment**

---

## 🔑 PRODUCTION API KEYS REQUIRED

### 1. Circle API (USDC Operations) - CRITICAL
**Current Status:** Using sandbox/demo credentials  
**Required for:** P2P transfers, wallet management, balance tracking  

**Production Keys Needed:**
```bash
CIRCLE_API_KEY=circle_prod_api_key_here
CIRCLE_ENTITY_SECRET=circle_prod_entity_secret_here
```

**Where to get them:**
1. Go to https://console.circle.com/
2. Navigate to API Keys section
3. Generate production API key and entity secret
4. **CRITICAL:** Switch from sandbox to production environment

### 2. Coinbase CDP (Crypto Trading) - CRITICAL  
**Current Status:** Using development credentials  
**Required for:** Multi-chain crypto operations, DeFi wallet management  

**Production Keys Needed:**
```bash
CDP_API_KEY_ID=coinbase_prod_api_key_id_here
CDP_PRIVATE_KEY="coinbase_prod_private_key_here"
```

**Where to get them:**
1. Go to https://portal.cdp.coinbase.com/
2. Create production API key
3. Download private key securely
4. Configure for mainnet operations

### 3. Coinbase OAuth (Authentication) - HIGH
**Current Status:** Missing production OAuth credentials  
**Required for:** Coinbase account linking, wallet integration  

**Production Keys Needed:**
```bash
COINBASE_OAUTH_CLIENT_ID=coinbase_prod_oauth_client_id
COINBASE_OAUTH_CLIENT_SECRET=coinbase_prod_oauth_secret
```

### 4. XRP Network (XRP Operations) - MEDIUM
**Current Status:** Using test network settings  
**Required for:** XRP transfers, XRPL ecosystem  

**Production Configuration:**
```bash
XRP_NETWORK=mainnet
XRPL_SERVER=wss://xrplcluster.com/
```

---

## 🔧 IMMEDIATE CONFIGURATION FIXES

### Fix 1: Circle Production Setup
```typescript
// server/services/circleService.ts
const client = new Client({
  apiKey: process.env.CIRCLE_API_KEY, // Production key
  environment: CircleEnvironment.production, // Switch from sandbox
});
```

### Fix 2: Coinbase CDP Production Setup
```typescript
// server/services/coinbaseCDPService.ts
export const coinbaseCDPService = new CoinbaseService({
  apiKeyId: process.env.CDP_API_KEY_ID,
  privateKey: process.env.CDP_PRIVATE_KEY,
  environment: 'production', // Switch from development
});
```

### Fix 3: Environment Detection
```typescript
// server/config/environment.ts
export const isProduction = process.env.NODE_ENV === 'production';
export const circleEnvironment = isProduction ? 
  CircleEnvironment.production : 
  CircleEnvironment.sandbox;
```

---

## 🏦 PRODUCTION DATABASE CONFIGURATION

### Database Connection String
**Current:** Development/local database  
**Required:** Production PostgreSQL connection  

```bash
DATABASE_URL=postgresql://username:password@production-host:5432/coinrailz_prod
```

### Session Storage
**Current:** Using development session store  
**Required:** Production-ready session configuration  

```typescript
// Secure session configuration for production
const sessionStore = new pgStore({
  conString: process.env.DATABASE_URL,
  createTableIfMissing: false,
  ttl: 7 * 24 * 60 * 60, // 7 days
  tableName: "sessions",
});
```

---

## 🔒 SECURITY CONFIGURATION HARDENING

### 1. Rate Limiting (Production Levels)
```typescript
// Current: Development rate limits
// Required: Production-grade rate limiting

const productionRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Stricter in production
  standardHeaders: true,
  legacyHeaders: false,
});
```

### 2. CORS Configuration
```typescript
// Current: Permissive CORS for development
// Required: Restrictive CORS for production

const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://coinrailz.com', 'https://www.coinrailz.com']
    : ['http://localhost:3000', 'http://localhost:5000'],
  credentials: true,
};
```

### 3. HTTPS Enforcement
```typescript
// Production-only HTTPS enforcement
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (!req.secure && req.get('x-forwarded-proto') !== 'https') {
      return res.redirect(301, `https://${req.get('host')}${req.url}`);
    }
    next();
  });
}
```

---

## 📊 MONITORING & LOGGING SETUP

### 1. Error Tracking
```bash
# Production error tracking
SENTRY_DSN=sentry_production_dsn_here
```

### 2. Financial Transaction Logging
```typescript
// Enhanced logging for production money movements
const financialLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'financial-transactions.log' }),
    new winston.transports.Console()
  ]
});
```

---

## 🚀 DEPLOYMENT CHECKLIST

### Pre-Deployment Requirements:
- [ ] Circle production API keys configured
- [ ] Coinbase CDP production keys configured  
- [ ] Production database connection string set
- [ ] HTTPS/SSL certificate configured
- [ ] Domain configuration (coinrailz.com) verified
- [ ] Rate limiting adjusted for production traffic
- [ ] Error monitoring and logging active
- [ ] Backup and recovery procedures tested

### Post-Deployment Verification:
- [ ] Circle API connectivity verified with production keys
- [ ] Coinbase CDP operations functional
- [ ] Database connections stable under load
- [ ] SSL/HTTPS working correctly
- [ ] Rate limiting functioning as expected
- [ ] Error reporting capturing issues properly
- [ ] Performance metrics within acceptable ranges

---

## ⚡ IMMEDIATE ACTION PLAN

### Phase 1: API Key Configuration (1-2 hours)
1. **Circle Production Setup**
   - Obtain production Circle API key and entity secret
   - Update environment variables
   - Test wallet creation and balance checking

2. **Coinbase CDP Production Setup**  
   - Generate production CDP API credentials
   - Configure for mainnet operations
   - Test crypto operations

### Phase 2: Security Hardening (2-3 hours)
1. **Environment Detection**
   - Implement proper production/development switching
   - Configure production-grade rate limiting
   - Set up HTTPS enforcement

2. **Database Security**
   - Configure production database connection
   - Implement secure session management
   - Test transaction logging

### Phase 3: Monitoring & Testing (1-2 hours)
1. **Error Tracking Setup**
   - Configure Sentry or equivalent
   - Test error reporting pipeline
   - Set up financial transaction alerts

2. **End-to-End Testing**
   - Test real money flows with small amounts
   - Verify fee calculations with production APIs
   - Validate multi-wallet coordination

---

## 🎯 SUCCESS CRITERIA

### ✅ API Configuration Complete
- [ ] All production API keys configured and tested
- [ ] Environment switching working correctly
- [ ] Real API responses validated

### ✅ Security Hardened
- [ ] Production rate limiting active
- [ ] HTTPS enforcement working
- [ ] Database connections secure

### ✅ Monitoring Active  
- [ ] Error tracking operational
- [ ] Financial transaction logging complete
- [ ] Performance monitoring in place

---

**CRITICAL PRIORITY:** The missing $50 USDC issue demonstrates that production API configuration is essential. Without proper Circle API production keys, we cannot verify real balances or recover missing funds.

**IMMEDIATE NEXT STEPS:**
1. Configure Circle production API keys
2. Test balance checking with production credentials
3. Verify if $50 USDC is visible in production Circle API
4. Complete security hardening for deployment

*All production blockers must be resolved before deployment to prevent financial losses and ensure regulatory compliance.*