// ISO 20022 Message Standards for Financial Transactions
// Implements pain.001, pain.002, camt.053, camt.054 message formats

import { z } from "zod";

// ISO 20022 Party Identification
export const partyIdentificationSchema = z.object({
  name: z.string().max(140),
  postalAddress: z.object({
    streetName: z.string().optional(),
    buildingNumber: z.string().optional(),
    postCode: z.string().optional(),
    townName: z.string().optional(),
    country: z.string().length(2), // ISO 3166-1 alpha-2
  }).optional(),
  identification: z.object({
    organisationId: z.string().optional(),
    privateId: z.string().optional(),
  }).optional(),
});

// ISO 20022 Account Identification
export const accountIdentificationSchema = z.object({
  iban: z.string().optional(),
  other: z.object({
    identification: z.string(),
    schemeName: z.string(),
  }).optional(),
});

// ISO 20022 Amount with Currency
export const amountSchema = z.object({
  amount: z.string().regex(/^\d+\.\d{2}$/), // Must be decimal with 2 places
  currency: z.string().length(3), // ISO 4217 currency code
});

// pain.001 - Customer Credit Transfer Initiation
export const pain001Schema = z.object({
  groupHeader: z.object({
    messageId: z.string().max(35),
    creationDateTime: z.string().datetime(),
    numberOfTransactions: z.string(),
    controlSum: z.string().optional(),
    initiatingParty: partyIdentificationSchema,
  }),
  paymentInformation: z.array(z.object({
    paymentId: z.string().max(35),
    paymentMethod: z.enum(["TRF", "CHK"]), // Transfer or Cheque
    requestedExecutionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    debtor: partyIdentificationSchema,
    debtorAccount: accountIdentificationSchema,
    debtorAgent: z.object({
      financialInstitutionId: z.object({
        bic: z.string().optional(),
        clearingSystemMemberId: z.string().optional(),
      }),
    }),
    creditTransferTransactionInformation: z.array(z.object({
      paymentId: z.object({
        instructionId: z.string().max(35),
        endToEndId: z.string().max(35),
      }),
      amount: amountSchema,
      creditor: partyIdentificationSchema,
      creditorAccount: accountIdentificationSchema,
      creditorAgent: z.object({
        financialInstitutionId: z.object({
          bic: z.string().optional(),
          clearingSystemMemberId: z.string().optional(),
        }),
      }),
      purpose: z.object({
        code: z.string().optional(),
        proprietary: z.string().optional(),
      }).optional(),
      remittanceInformation: z.object({
        unstructured: z.string().max(140).optional(),
        structured: z.object({
          creditorReferenceInformation: z.object({
            type: z.string().optional(),
            reference: z.string().optional(),
          }).optional(),
        }).optional(),
      }).optional(),
    })),
  })),
});

// pain.002 - Payment Status Report
export const pain002Schema = z.object({
  groupHeader: z.object({
    messageId: z.string().max(35),
    creationDateTime: z.string().datetime(),
    initiatingParty: partyIdentificationSchema,
  }),
  originalGroupInformationAndStatus: z.object({
    originalMessageId: z.string().max(35),
    originalMessageNameId: z.string(),
    groupStatus: z.enum(["ACCP", "ACSC", "ACSP", "ACTC", "ACWC", "ACWP", "PART", "PDNG", "RCVD", "RJCT"]),
    statusReasonInformation: z.array(z.object({
      originator: partyIdentificationSchema.optional(),
      reason: z.object({
        code: z.string(),
        additionalInformation: z.string().max(105).optional(),
      }),
    })).optional(),
  }),
  transactionInformationAndStatus: z.array(z.object({
    statusId: z.string().max(35).optional(),
    originalInstructionId: z.string().max(35).optional(),
    originalEndToEndId: z.string().max(35).optional(),
    transactionStatus: z.enum(["ACCP", "ACSC", "ACSP", "ACTC", "ACWC", "ACWP", "CANC", "PART", "PDNG", "RCVD", "RJCT"]),
    statusReasonInformation: z.array(z.object({
      originator: partyIdentificationSchema.optional(),
      reason: z.object({
        code: z.string(),
        additionalInformation: z.string().max(105).optional(),
      }),
    })).optional(),
  })),
});

// camt.053 - Bank to Customer Statement
export const camt053Schema = z.object({
  groupHeader: z.object({
    messageId: z.string().max(35),
    creationDateTime: z.string().datetime(),
    messageRecipient: partyIdentificationSchema.optional(),
  }),
  statement: z.array(z.object({
    id: z.string().max(35),
    electronicSequenceNumber: z.string().optional(),
    creationDateTime: z.string().datetime(),
    fromToDate: z.object({
      fromDateTime: z.string().datetime(),
      toDateTime: z.string().datetime(),
    }),
    account: z.object({
      id: accountIdentificationSchema,
      type: z.object({
        code: z.string(),
        proprietary: z.string().optional(),
      }).optional(),
      currency: z.string().length(3),
      name: z.string().max(70).optional(),
      servicer: z.object({
        financialInstitutionId: z.object({
          bic: z.string().optional(),
          clearingSystemMemberId: z.string().optional(),
        }),
      }).optional(),
    }),
    balance: z.array(z.object({
      type: z.object({
        codeOrProprietary: z.enum(["OPBD", "CLBD", "ITBD", "PRCD"]),
        subType: z.string().optional(),
      }),
      amount: amountSchema,
      creditDebitIndicator: z.enum(["CRDT", "DBIT"]),
      date: z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        dateTime: z.string().datetime().optional(),
      }),
    })),
    entry: z.array(z.object({
      amount: amountSchema,
      creditDebitIndicator: z.enum(["CRDT", "DBIT"]),
      status: z.enum(["BOOK", "PDNG", "INFO"]),
      bookingDate: z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        dateTime: z.string().datetime().optional(),
      }),
      valueDate: z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        dateTime: z.string().datetime().optional(),
      }).optional(),
      accountServicerReference: z.string().max(35).optional(),
      bankTransactionCode: z.object({
        domain: z.object({
          code: z.string(),
          family: z.object({
            code: z.string(),
            subFamilyCode: z.string(),
          }),
        }),
        proprietary: z.object({
          code: z.string(),
          issuer: z.string().optional(),
        }).optional(),
      }),
      entryDetails: z.array(z.object({
        transactionDetails: z.object({
          references: z.object({
            messageId: z.string().max(35).optional(),
            accountServicerReference: z.string().max(35).optional(),
            paymentInformationId: z.string().max(35).optional(),
            instructionId: z.string().max(35).optional(),
            endToEndId: z.string().max(35).optional(),
            transactionId: z.string().max(35).optional(),
            mandateId: z.string().max(35).optional(),
            chequeNumber: z.string().max(35).optional(),
          }).optional(),
          amount: amountSchema,
          creditDebitIndicator: z.enum(["CRDT", "DBIT"]),
          amountDetails: z.object({
            instructedAmount: amountSchema.optional(),
            transactionAmount: amountSchema.optional(),
            counterValueAmount: amountSchema.optional(),
            announcedPostingAmount: amountSchema.optional(),
            proprietaryAmount: z.array(z.object({
              type: z.string(),
              amount: amountSchema,
            })).optional(),
          }).optional(),
        }),
      })).optional(),
    })),
  })),
});

// camt.054 - Bank to Customer Debit Credit Notification
export const camt054Schema = z.object({
  groupHeader: z.object({
    messageId: z.string().max(35),
    creationDateTime: z.string().datetime(),
    messageRecipient: partyIdentificationSchema.optional(),
  }),
  notification: z.array(z.object({
    id: z.string().max(35),
    creationDateTime: z.string().datetime(),
    account: z.object({
      id: accountIdentificationSchema,
      type: z.object({
        code: z.string(),
        proprietary: z.string().optional(),
      }).optional(),
      currency: z.string().length(3),
      name: z.string().max(70).optional(),
      servicer: z.object({
        financialInstitutionId: z.object({
          bic: z.string().optional(),
          clearingSystemMemberId: z.string().optional(),
        }),
      }).optional(),
    }),
    entry: z.array(z.object({
      amount: amountSchema,
      creditDebitIndicator: z.enum(["CRDT", "DBIT"]),
      status: z.enum(["BOOK", "PDNG", "INFO"]),
      bookingDate: z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        dateTime: z.string().datetime().optional(),
      }),
      valueDate: z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        dateTime: z.string().datetime().optional(),
      }).optional(),
      accountServicerReference: z.string().max(35).optional(),
    })),
  })),
});

// FATF Travel Rule for Crypto Transactions
export const travelRuleSchema = z.object({
  originator: z.object({
    name: z.string(),
    address: z.object({
      streetAddress: z.string(),
      city: z.string(),
      state: z.string().optional(),
      postalCode: z.string(),
      country: z.string().length(2),
    }),
    accountNumber: z.string(),
    customerIdentification: z.string(),
  }),
  beneficiary: z.object({
    name: z.string(),
    address: z.object({
      streetAddress: z.string(),
      city: z.string(),
      state: z.string().optional(),
      postalCode: z.string(),
      country: z.string().length(2),
    }),
    accountNumber: z.string(),
    customerIdentification: z.string(),
  }),
  transaction: z.object({
    amount: z.number().positive(),
    currency: z.string(),
    cryptoAsset: z.string(),
    blockchainAddress: z.string(),
    transactionHash: z.string().optional(),
    timestamp: z.string().datetime(),
  }),
  complianceData: z.object({
    riskScore: z.number().min(0).max(100),
    sanctionsCheck: z.boolean(),
    pepsCheck: z.boolean(),
    amlFlags: z.array(z.string()),
  }),
});

// Type exports
export type Pain001 = z.infer<typeof pain001Schema>;
export type Pain002 = z.infer<typeof pain002Schema>;
export type Camt053 = z.infer<typeof camt053Schema>;
export type Camt054 = z.infer<typeof camt054Schema>;
export type TravelRule = z.infer<typeof travelRuleSchema>;
export type PartyIdentification = z.infer<typeof partyIdentificationSchema>;
export type AccountIdentification = z.infer<typeof accountIdentificationSchema>;
export type Amount = z.infer<typeof amountSchema>;

// Utility functions for ISO 20022 compliance
export class ISO20022Utils {
  static generateMessageId(): string {
    return `CR${Date.now()}${Math.random().toString(36).substr(2, 5)}`.toUpperCase();
  }

  static formatAmount(amount: number): string {
    return amount.toFixed(2);
  }

  static formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  static formatDateTime(date: Date): string {
    return date.toISOString();
  }

  static validateBIC(bic: string): boolean {
    return /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic);
  }

  static validateIBAN(iban: string): boolean {
    // Basic IBAN validation - implement full mod-97 check for production
    return /^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/.test(iban.replace(/\s/g, ''));
  }

  static getTransactionStatusDescription(code: string): string {
    const statusMap: Record<string, string> = {
      'ACCP': 'Accepted Customer Profile',
      'ACSC': 'Accepted Settlement Completed',
      'ACSP': 'Accepted Settlement In Process',
      'ACTC': 'Accepted Technical Completion',
      'ACWC': 'Accepted With Change',
      'ACWP': 'Accepted Without Posting',
      'RCVD': 'Received',
      'PDNG': 'Pending',
      'RJCT': 'Rejected',
      'CANC': 'Cancelled',
      'PART': 'Partially Accepted',
    };
    return statusMap[code] || 'Unknown Status';
  }
}