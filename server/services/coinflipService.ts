// CoinFlip White Label API Integration
// ISO 20022 compliant crypto on/off ramp services

import { TravelRule, ISO20022Utils } from "@shared/iso20022";
import { storage } from "../storage";

interface CoinFlipConfig {
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
  whitelabelId: string;
}

interface OnRampRequest {
  userId: string;
  fiatAmount: number;
  fiatCurrency: string;
  cryptoAsset: string;
  bankAccountId?: string;
  debitCardId?: string;
  requestId: string;
}

interface OffRampRequest {
  userId: string;
  cryptoAmount: number;
  cryptoAsset: string;
  fiatCurrency: string;
  bankAccountId: string;
  requestId: string;
}

interface KYCVerificationRequest {
  userId: string;
  personalInfo: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    ssn: string;
    phoneNumber: string;
  };
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  documents: {
    frontId: string; // Base64 encoded image
    backId?: string;
    selfie: string;
  };
}

export class CoinFlipService {
  private config: CoinFlipConfig;

  constructor() {
    this.config = {
      baseUrl: process.env.COINFLIP_API_BASE_URL || 'https://api.coinflip.tech',
      apiKey: process.env.COINFLIP_API_KEY || '',
      apiSecret: process.env.COINFLIP_API_SECRET || '',
      whitelabelId: process.env.COINFLIP_WHITELABEL_ID || '',
    };
  }

  private async authenticateAPI(): Promise<string> {
    if (!this.config.apiKey || !this.config.apiSecret) {
      throw new Error('CoinFlip API credentials not configured. Please provide COINFLIP_API_KEY and COINFLIP_API_SECRET environment variables.');
    }

    try {
      const timestamp = Date.now().toString();
      const signature = this.generateSignature(timestamp);

      const response = await fetch(`${this.config.baseUrl}/v1/auth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey,
          'X-Timestamp': timestamp,
          'X-Signature': signature,
        },
        body: JSON.stringify({
          whitelabelId: this.config.whitelabelId,
        }),
      });

      if (!response.ok) {
        throw new Error(`CoinFlip authentication failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.accessToken;
    } catch (error) {
      console.error('CoinFlip authentication error:', error);
      throw error;
    }
  }

  private generateSignature(timestamp: string): string {
    // Implementation would use HMAC-SHA256 with API secret
    // This is a placeholder - actual implementation needs crypto library
    const crypto = require('crypto');
    const message = `${timestamp}${this.config.apiKey}`;
    return crypto.createHmac('sha256', this.config.apiSecret).update(message).digest('hex');
  }

  async initiateOnRamp(request: OnRampRequest): Promise<any> {
    const token = await this.authenticateAPI();
    const messageId = ISO20022Utils.generateMessageId();

    // Check user KYC status first
    const user = await storage.getUser(request.userId);
    if (!user || user.kycStatus !== 'verified') {
      throw new Error('User KYC verification required for crypto on-ramp');
    }

    // Create compliance record for FATF Travel Rule (if amount > $1000)
    if (request.fiatAmount > 1000) {
      const travelRuleData: TravelRule = {
        originator: {
          name: `${user.firstName} ${user.lastName}`,
          address: user.address as any,
          accountNumber: user.id,
          customerIdentification: user.id,
        },
        beneficiary: {
          name: "CoinFlip Exchange",
          address: {
            streetAddress: "1234 Exchange St",
            city: "Chicago",
            state: "IL",
            postalCode: "60601",
            country: "US",
          },
          accountNumber: "COINFLIP_POOL",
          customerIdentification: "COINFLIP_ENTITY",
        },
        transaction: {
          amount: request.fiatAmount,
          currency: request.fiatCurrency,
          cryptoAsset: request.cryptoAsset,
          blockchainAddress: "", // Will be populated after transaction
          timestamp: ISO20022Utils.formatDateTime(new Date()),
        },
        complianceData: {
          riskScore: user.riskScore || 0,
          sanctionsCheck: user.sanctionsCheck || false,
          pepsCheck: user.pepsCheck || false,
          amlFlags: [],
        },
      };

      await storage.createComplianceReport({
        userId: request.userId,
        reportType: 'TRAVEL_RULE',
        riskScore: user.riskScore || 0,
        flaggedReasons: travelRuleData.complianceData.amlFlags,
        iso20022MessageId: messageId,
      });
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/v1/onramp/initiate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Request-ID': request.requestId,
          'X-ISO20022-Message-ID': messageId,
        },
        body: JSON.stringify({
          whitelabelId: this.config.whitelabelId,
          customerId: request.userId,
          fiatAmount: request.fiatAmount,
          fiatCurrency: request.fiatCurrency,
          cryptoAsset: request.cryptoAsset,
          paymentMethod: request.bankAccountId ? 'bank_transfer' : 'debit_card',
          paymentMethodId: request.bankAccountId || request.debitCardId,
          compliance: {
            kycVerified: true,
            riskScore: user.riskScore,
            iso20022MessageId: messageId,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`On-ramp initiation failed: ${response.statusText}`);
      }

      const result = await response.json();

      await storage.createAPILog({
        userId: request.userId,
        apiProvider: 'COINFLIP_ONRAMP',
        endpoint: '/v1/onramp/initiate',
        requestId: request.requestId,
        requestData: request,
        responseData: result,
        statusCode: response.status,
        iso20022MessageType: 'coinflip.onramp.001',
      });

      return result;
    } catch (error) {
      console.error('CoinFlip on-ramp error:', error);
      throw error;
    }
  }

  async initiateOffRamp(request: OffRampRequest): Promise<any> {
    const token = await this.authenticateAPI();
    const messageId = ISO20022Utils.generateMessageId();

    const user = await storage.getUser(request.userId);
    if (!user || user.kycStatus !== 'verified') {
      throw new Error('User KYC verification required for crypto off-ramp');
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/v1/offramp/initiate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Request-ID': request.requestId,
          'X-ISO20022-Message-ID': messageId,
        },
        body: JSON.stringify({
          whitelabelId: this.config.whitelabelId,
          customerId: request.userId,
          cryptoAmount: request.cryptoAmount,
          cryptoAsset: request.cryptoAsset,
          fiatCurrency: request.fiatCurrency,
          bankAccountId: request.bankAccountId,
          compliance: {
            kycVerified: true,
            riskScore: user.riskScore,
            iso20022MessageId: messageId,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Off-ramp initiation failed: ${response.statusText}`);
      }

      const result = await response.json();

      await storage.createAPILog({
        userId: request.userId,
        apiProvider: 'COINFLIP_OFFRAMP',
        endpoint: '/v1/offramp/initiate',
        requestId: request.requestId,
        requestData: request,
        responseData: result,
        statusCode: response.status,
        iso20022MessageType: 'coinflip.offramp.001',
      });

      return result;
    } catch (error) {
      console.error('CoinFlip off-ramp error:', error);
      throw error;
    }
  }

  async initateKYCVerification(request: KYCVerificationRequest): Promise<any> {
    const token = await this.authenticateAPI();

    try {
      const response = await fetch(`${this.config.baseUrl}/v1/kyc/verify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          whitelabelId: this.config.whitelabelId,
          customerId: request.userId,
          personalInfo: request.personalInfo,
          address: request.address,
          documents: request.documents,
          verificationLevel: 'enhanced', // For crypto compliance
        }),
      });

      if (!response.ok) {
        throw new Error(`KYC verification failed: ${response.statusText}`);
      }

      const result = await response.json();

      // Create KYC verification record
      await storage.createKYCVerification({
        userId: request.userId,
        verificationType: 'enhanced_crypto',
        provider: 'CoinFlip',
        verificationId: result.verificationId,
        status: result.status,
        documentType: 'government_id',
        verificationData: result,
      });

      return result;
    } catch (error) {
      console.error('CoinFlip KYC verification error:', error);
      throw error;
    }
  }

  async getCryptoPricing(cryptoAsset: string, fiatCurrency: string = 'USD'): Promise<{ buy: number; sell: number }> {
    const token = await this.authenticateAPI();

    try {
      const response = await fetch(`${this.config.baseUrl}/v1/pricing/${cryptoAsset}/${fiatCurrency}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Pricing fetch failed: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        buy: result.buyPrice,
        sell: result.sellPrice,
      };
    } catch (error) {
      console.error('CoinFlip pricing error:', error);
      throw error;
    }
  }
}

export const coinflipService = new CoinFlipService();