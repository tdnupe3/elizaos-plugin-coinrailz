# Coin Railz Production Setup Guide

## Required API Credentials and Environment Variables

### PNC Bank Treasury Management (Primary Banking Partner)
```bash
# PNC Bank via Pinacle Treasury Management
PNC_API_BASE_URL=https://api.pnc.com
PNC_CLIENT_ID=your_pnc_client_id
PNC_CLIENT_SECRET=your_pnc_client_secret
PNC_CERT_PATH=/path/to/pnc/certificate.pem
PNC_PRIVATE_KEY_PATH=/path/to/pnc/private_key.pem
PNC_ACCOUNT_ID=your_primary_account_id
```

### CoinFlip White Label (Crypto On/Off Ramp Partner)
```bash
# CoinFlip API credentials (currently in onboarding)
COINFLIP_API_BASE_URL=https://api.coinflip.tech
COINFLIP_API_KEY=your_coinflip_api_key
COINFLIP_API_SECRET=your_coinflip_api_secret
COINFLIP_WHITELABEL_ID=your_whitelabel_partner_id
```

### DEX Aggregator Services
```bash
# 1inch Protocol (Primary DEX aggregator)
ONEINCH_API_BASE_URL=https://api.1inch.dev
ONEINCH_API_KEY=your_1inch_api_key

# 0x Protocol (Backup DEX aggregator)
ZEROX_API_BASE_URL=https://api.0x.org
ZEROX_API_KEY=your_0x_api_key
```

### Price Feed APIs
```bash
# CoinGecko API
COINGECKO_API_KEY=your_coingecko_api_key

# CoinMarketCap API (backup)
COINMARKETCAP_API_KEY=your_coinmarketcap_api_key
```

### Payment Platform APIs
```bash
# PayPal/Braintree (for Venmo integration)
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_ENVIRONMENT=sandbox # or live

# Square API (for Cash App - limited availability)
SQUARE_APPLICATION_ID=your_square_app_id
SQUARE_ACCESS_TOKEN=your_square_access_token
SQUARE_ENVIRONMENT=sandbox # or production
```

### KYC/AML Compliance Services
```bash
# Jumio Identity Verification
JUMIO_API_TOKEN=your_jumio_api_token
JUMIO_API_SECRET=your_jumio_api_secret
JUMIO_BASE_URL=https://netverify.com

# OFAC Sanctions Screening
OFAC_API_KEY=your_ofac_screening_api_key

# Chainalysis (Crypto compliance)
CHAINALYSIS_API_KEY=your_chainalysis_api_key
```

### Notification Services
```bash
# Twilio SMS
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

# SendGrid Email
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM_EMAIL=noreply@coinrailz.com
```

### Monitoring and Analytics
```bash
# Datadog APM
DATADOG_API_KEY=your_datadog_api_key
DATADOG_APP_KEY=your_datadog_app_key

# Sentry Error Tracking
SENTRY_DSN=your_sentry_dsn
```

## Compliance and Security Requirements

### ISO 20022 Implementation
- All financial messages must use ISO 20022 MX format
- pain.001 for payment initiation
- pain.002 for payment status reports
- camt.053 for account statements
- camt.054 for debit/credit notifications

### Required Certifications
1. **PCI DSS Level 1** - Payment card industry compliance
2. **SOC 2 Type II** - Security and availability controls
3. **ISO 27001** - Information security management
4. **FinCEN MSB Registration** - Money services business registration
5. **State Money Transmitter Licenses** - Required in applicable states

### AML/KYC Requirements
- Enhanced Due Diligence (EDD) for crypto transactions
- FATF Travel Rule compliance for transfers >$1000
- Sanctions screening (OFAC, EU, UN lists)
- PEPs (Politically Exposed Persons) screening
- Suspicious Activity Report (SAR) generation

### Banking Compliance
- Bank Secrecy Act (BSA) compliance
- Currency Transaction Reports (CTR) for transactions ≥$10,000
- FFIEC guidelines adherence
- Real-time fraud monitoring

## API Integration Status

### Immediate Implementation (Phase 1)
✅ **PNC Bank Zelle** - Primary P2P payment rail
✅ **CoinFlip API** - Crypto on/off ramp (in onboarding)
✅ **1inch DEX** - Crypto-to-crypto swaps
✅ **ISO 20022** - Compliance messaging framework

### Secondary Integration (Phase 2)
🔄 **PayPal/Venmo** - Additional P2P option
🔄 **Square/Cash App** - Business API access required
🔄 **Jumio KYC** - Identity verification
🔄 **Chainalysis** - Crypto compliance monitoring

### Future Enhancements (Phase 3)
📋 **Apple Pay** - In-app payment integration
📋 **Google Pay** - Cross-platform payments
📋 **Plaid** - Bank account linking
📋 **Dwolla** - ACH processing alternative

## Security Implementation

### Data Encryption
- AES-256 encryption for PII/PHI data
- TLS 1.3 for all API communications
- Hardware Security Modules (HSM) for key management
- Zero-knowledge architecture where possible

### Access Controls
- Multi-factor authentication (MFA) required
- Role-based access control (RBAC)
- Principle of least privilege
- Regular access reviews and deprovisioning

### Monitoring and Alerting
- Real-time transaction monitoring
- Anomaly detection algorithms
- 24/7 SOC monitoring
- Automated incident response

## Cost Estimates (Monthly)

### Development Environment
- Basic APIs and testing: $500-1,000
- KYC verification (limited): $200-500
- Compliance tools: $300-600

### Production Environment (1,000 active users)
- PNC Bank fees: $1,000-2,000
- CoinFlip processing: 1.5-2.5% of volume
- DEX aggregator: $500-1,500
- KYC/AML services: $1-3 per verification
- Compliance monitoring: $2,000-5,000
- Insurance and bonding: $1,000-3,000

**Total estimated monthly costs: $8,000-15,000**

## Regulatory Considerations

### Federal Requirements
- FinCEN MSB registration and reporting
- CFTC compliance for derivative products
- SEC compliance for securities (if applicable)
- IRS Form 8300 for large cash transactions

### State Requirements
- Money transmitter licenses (state-by-state)
- Consumer protection compliance
- Escheatment requirements for dormant accounts

### International Considerations
- FATF compliance for cross-border transactions
- Local regulations in served jurisdictions
- Data residency requirements (GDPR, etc.)

## Next Steps for Production Deployment

1. **Complete CoinFlip onboarding** - Finalize white label agreement
2. **Obtain PNC API credentials** - Through Pinacle treasury management
3. **Set up compliance infrastructure** - KYC/AML systems
4. **Security audit and penetration testing**
5. **Regulatory filing and licensing**
6. **Insurance and bonding procurement**
7. **Production deployment and monitoring setup**