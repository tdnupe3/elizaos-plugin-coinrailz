// PNC Bank Treasury Management API Integration
// ISO 20022 compliant banking services via Pinacle

import { ISO20022Utils, type Pain001, type Pain002 } from "@shared/iso20022";
import { storage } from "../storage";

interface PNCBankConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  certificatePath: string;
  privateKeyPath: string;
}

interface ZelleTransferRequest {
  fromAccountId: string;
  toEmail: string;
  toPhoneNumber?: string;
  amount: number;
  currency: string;
  memo?: string;
  requestId: string;
}

interface ACHTransferRequest {
  fromAccountId: string;
  toAccountNumber: string;
  toRoutingNumber: string;
  amount: number;
  currency: string;
  memo?: string;
  requestId: string;
  effectiveDate?: string;
}

export class PNCBankService {
  private config: PNCBankConfig;

  constructor() {
    this.config = {
      baseUrl: process.env.PNC_API_BASE_URL || 'https://api.pnc.com',
      clientId: process.env.PNC_CLIENT_ID || '',
      clientSecret: process.env.PNC_CLIENT_SECRET || '',
      certificatePath: process.env.PNC_CERT_PATH || '',
      privateKeyPath: process.env.PNC_PRIVATE_KEY_PATH || '',
    };
  }

  async authenticateAPI(): Promise<string> {
    if (!this.config.clientId || !this.config.clientSecret) {
      throw new Error('PNC Bank API credentials not configured. Please provide PNC_CLIENT_ID and PNC_CLIENT_SECRET environment variables.');
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString('base64')}`,
        },
        body: 'grant_type=client_credentials&scope=treasury_management',
      });

      if (!response.ok) {
        throw new Error(`PNC authentication failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.access_token;
    } catch (error) {
      console.error('PNC Bank authentication error:', error);
      throw error;
    }
  }

  async initiateZelleTransfer(request: ZelleTransferRequest): Promise<Pain002> {
    const token = await this.authenticateAPI();
    const messageId = ISO20022Utils.generateMessageId();

    // Create ISO 20022 pain.001 message
    const pain001Message: Pain001 = {
      groupHeader: {
        messageId,
        creationDateTime: ISO20022Utils.formatDateTime(new Date()),
        numberOfTransactions: "1",
        initiatingParty: {
          name: "Coin Railz LLC",
        },
      },
      paymentInformation: [{
        paymentId: request.requestId,
        paymentMethod: "TRF",
        requestedExecutionDate: ISO20022Utils.formatDate(new Date()),
        debtor: {
          name: "Coin Railz LLC",
        },
        debtorAccount: {
          other: {
            identification: request.fromAccountId,
            schemeName: "PNC_ACCOUNT",
          },
        },
        debtorAgent: {
          financialInstitutionId: {
            clearingSystemMemberId: "043000096", // PNC Bank routing number
          },
        },
        creditTransferTransactionInformation: [{
          paymentId: {
            instructionId: request.requestId,
            endToEndId: `ZELLE-${request.requestId}`,
          },
          amount: {
            amount: ISO20022Utils.formatAmount(request.amount),
            currency: request.currency,
          },
          creditor: {
            name: request.toEmail,
          },
          creditorAccount: {
            other: {
              identification: request.toEmail,
              schemeName: "ZELLE_EMAIL",
            },
          },
          creditorAgent: {
            financialInstitutionId: {
              clearingSystemMemberId: "ZELLE_NETWORK",
            },
          },
          purpose: {
            proprietary: "ZELLE_P2P",
          },
          remittanceInformation: {
            unstructured: request.memo,
          },
        }],
      }],
    };

    try {
      const response = await fetch(`${this.config.baseUrl}/v1/payments/zelle`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Request-ID': request.requestId,
          'X-ISO20022-Message-Type': 'pain.001.001.03',
        },
        body: JSON.stringify({
          pain001: pain001Message,
          zelleSpecific: {
            recipientEmail: request.toEmail,
            recipientPhone: request.toPhoneNumber,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Zelle transfer failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Log API interaction for compliance
      await storage.createAPILog({
        apiProvider: 'PNC_ZELLE',
        endpoint: '/v1/payments/zelle',
        requestId: request.requestId,
        requestData: pain001Message,
        responseData: result,
        statusCode: response.status,
        iso20022MessageType: 'pain.001.001.03',
      });

      return result.pain002 as Pain002;
    } catch (error) {
      console.error('Zelle transfer error:', error);
      throw error;
    }
  }

  async validateZelleRecipient(email: string, phoneNumber?: string): Promise<boolean> {
    const token = await this.authenticateAPI();

    try {
      const response = await fetch(`${this.config.baseUrl}/v1/zelle/validate-recipient`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          phoneNumber,
        }),
      });

      if (!response.ok) {
        return false;
      }

      const result = await response.json();
      return result.isValid === true;
    } catch (error) {
      console.error('Zelle recipient validation error:', error);
      return false;
    }
  }
}

export const pncBankService = new PNCBankService();