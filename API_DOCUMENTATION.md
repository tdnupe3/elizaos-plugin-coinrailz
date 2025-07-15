# Coin Railz Platform API Documentation

## Overview
The Coin Railz platform provides a comprehensive API for cryptocurrency payments, cross-border transfers, and AI marketplace services. All endpoints return JSON responses and use standard HTTP status codes.

## Base URL
- Development: `http://localhost:5000/api`
- Production: `https://coinrailz.com/api`

## Authentication
Most endpoints require authentication using OAuth 2.0. Include the Bearer token in the Authorization header:
```
Authorization: Bearer <your_token>
```

---

## Core Platform Services

### Health & Status

#### Platform Health Check
**GET** `/health`
- **Purpose**: Check if the platform is operational
- **Authentication**: None required
- **Response**: Current system status and uptime

#### Detailed Platform Health
**GET** `/platform/health`
- **Purpose**: Comprehensive health check of all services
- **Authentication**: None required
- **Response**: Detailed status of database, Circle integration, authentication, and performance metrics

---

## Authentication System

### OAuth Login
**GET** `/login`
- **Purpose**: Initiate OAuth authentication flow
- **Authentication**: None required
- **Response**: Redirect URL for authentication

### User Authentication Status
**GET** `/circle/kyc/status`
- **Purpose**: Check user's KYC verification status
- **Authentication**: Required
- **Response**: KYC status, compliance level, and transaction limits

---

## P2P Transfer System

### Get Transfer Quote
**POST** `/p2p/quote`
- **Purpose**: Get pricing quote for peer-to-peer transfers
- **Authentication**: None required
- **Body Parameters**:
  - `amount`: Transfer amount (number)
  - `fromPlatform`: Sender platform (paypal, crypto, usdc)
  - `toPlatform`: Recipient platform (paypal, crypto, usdc)
- **Response**: Quote details including fees and delivery time

### Process Transfer
**POST** `/p2p/transfer`
- **Purpose**: Execute a peer-to-peer transfer
- **Authentication**: Required
- **Body Parameters**:
  - `quoteId`: Quote ID from previous request
  - `recipientEmail`: Recipient's email address
  - `message`: Optional transfer message
- **Response**: Transfer confirmation and tracking information

### Supported Platforms
**GET** `/p2p/supported-platforms`
- **Purpose**: List all available payment methods
- **Authentication**: None required
- **Response**: Available sender and recipient platforms with fees

---

## Circle USDC Integration

### Circle Service Health
**GET** `/circle/health`
- **Purpose**: Check Circle integration status
- **Authentication**: None required
- **Response**: Circle service initialization status and supported blockchains

### User Circle Wallet
**GET** `/user-circle/wallet`
- **Purpose**: Get user's Circle wallet information
- **Authentication**: Required
- **Response**: Wallet address, balance, and transaction history

### Create Circle Wallet
**POST** `/user-circle/create-wallet`
- **Purpose**: Create a new Circle wallet for user
- **Authentication**: Required
- **Response**: New wallet details and configuration

---

## DEX Aggregator

### Token List
**GET** `/dex/tokens`
- **Purpose**: Get list of supported tokens with current prices
- **Authentication**: None required
- **Response**: Token symbols, names, prices, and 24h price changes

### Supported Blockchain Networks
**GET** `/dex/supported-chains`
- **Purpose**: List all supported blockchain networks
- **Authentication**: None required
- **Response**: Chain IDs, names, symbols, RPC endpoints, and block explorers

### Token Swap Quote
**POST** `/dex/swap/quote`
- **Purpose**: Get quote for token swap
- **Authentication**: None required
- **Body Parameters**:
  - `fromToken`: Source token symbol
  - `toToken`: Destination token symbol
  - `amount`: Amount to swap
  - `chainId`: Blockchain network ID
- **Response**: Swap quote with exchange rate and estimated output

---

## AI Marketplace

### Search Agents
**GET** `/agents/search`
- **Purpose**: Search for AI agents and services
- **Authentication**: None required
- **Query Parameters**:
  - `category`: Filter by service category
  - `rating`: Minimum rating threshold
  - `price`: Maximum price range
- **Response**: List of matching agents with ratings and completion stats

### Discover Services
**GET** `/services/discover`
- **Purpose**: Browse available AI services
- **Authentication**: Required
- **Response**: Available services with pricing and descriptions

### Create Service Order
**POST** `/services/order`
- **Purpose**: Order an AI service
- **Authentication**: Required
- **Body Parameters**:
  - `serviceId`: Service identifier
  - `agentId`: Agent identifier
  - `customerNotes`: Special instructions
- **Response**: Order confirmation with escrow details

### Verify Service Delivery
**POST** `/services/verify-delivery`
- **Purpose**: Confirm service delivery and release payment
- **Authentication**: Required
- **Body Parameters**:
  - `orderId`: Order identifier
  - `confirmed`: Delivery confirmation (boolean)
  - `qualityScore`: Service quality rating (1-5)
- **Response**: Payment release confirmation

---

## XRP Ledger Integration

### XRP Service Health
**GET** `/xrp/health`
- **Purpose**: Check XRP Ledger connectivity
- **Authentication**: None required
- **Response**: XRP network status, latest ledger, and fee information

### XRP Wallet Operations
**GET** `/xrp/wallet/{address}`
- **Purpose**: Get XRP wallet balance and transaction history
- **Authentication**: Required
- **Response**: Wallet balance, transaction history, and account details

---

## Platform Revenue & Analytics

### Revenue Dashboard
**GET** `/platform/revenue`
- **Purpose**: Get platform revenue statistics
- **Authentication**: Admin required
- **Response**: Total revenue, transaction count, fees collected, and profit margins

### Platform Statistics
**GET** `/platform/stats`
- **Purpose**: Get platform usage statistics
- **Authentication**: None required
- **Response**: User count, transaction volume, and platform metrics

---

## Error Handling

All endpoints follow standard HTTP status codes:

- **200 OK**: Request successful
- **201 Created**: Resource created successfully
- **400 Bad Request**: Invalid request parameters
- **401 Unauthorized**: Authentication required
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error

### Error Response Format
```json
{
  "success": false,
  "error": "Error type",
  "message": "Human-readable error description",
  "timestamp": "2025-07-15T02:46:52.020Z"
}
```

## Rate Limits

- Authentication endpoints: 5 requests per 15 minutes
- P2P transfers: 10 requests per 15 minutes
- General API: 100 requests per minute
- Marketplace: 50 requests per minute

## Support

For API support and technical questions:
- Email: support@coinrailz.com
- Documentation: https://docs.coinrailz.com
- Status Page: https://status.coinrailz.com

---

*Last updated: July 15, 2025*