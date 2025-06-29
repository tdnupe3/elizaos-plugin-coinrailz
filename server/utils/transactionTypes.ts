/**
 * Transaction Type Classification
 * Determines KYC requirements based on transaction type
 */

export enum TransactionType {
  // Crypto-only transactions (NO KYC required)
  CRYPTO_TO_CRYPTO = 'crypto_to_crypto',
  CRYPTO_WALLET_TRANSFER = 'crypto_wallet_transfer',
  DEX_SWAP = 'dex_swap',
  CRYPTO_STAKING = 'crypto_staking',
  NFT_PURCHASE = 'nft_purchase',
  
  // Fiat transactions requiring KYC
  FIAT_P2P = 'fiat_p2p',
  BANK_DEPOSIT = 'bank_deposit',
  BANK_WITHDRAWAL = 'bank_withdrawal',
  WIRE_TRANSFER = 'wire_transfer',
  ACH_TRANSFER = 'ach_transfer',
  
  // Standard retail transactions (no KYC)
  CARD_PURCHASE = 'card_purchase',
  
  // Commission and platform (special rules)
  REFERRAL_COMMISSION = 'referral_commission',
  AGENT_COMMISSION = 'agent_commission',
  PLATFORM_FEE = 'platform_fee'
}

export interface TransactionClassification {
  type: TransactionType;
  requiresKYC: boolean;
  requiresComplianceLevel?: 'basic' | 'enhanced' | 'institutional';
  maxAmountWithoutKYC?: number;
  description: string;
}

/**
 * Classifies transaction types and their KYC requirements
 */
export class TransactionClassifier {
  
  private static classifications: Record<TransactionType, TransactionClassification> = {
    // Crypto-only transactions (NO KYC)
    [TransactionType.CRYPTO_TO_CRYPTO]: {
      type: TransactionType.CRYPTO_TO_CRYPTO,
      requiresKYC: false,
      description: 'Cryptocurrency to cryptocurrency exchange',
    },
    
    [TransactionType.CRYPTO_WALLET_TRANSFER]: {
      type: TransactionType.CRYPTO_WALLET_TRANSFER,
      requiresKYC: false,
      description: 'Transfer between crypto wallets',
    },
    
    [TransactionType.DEX_SWAP]: {
      type: TransactionType.DEX_SWAP,
      requiresKYC: false,
      description: 'Decentralized exchange swap',
    },
    
    [TransactionType.CRYPTO_STAKING]: {
      type: TransactionType.CRYPTO_STAKING,
      requiresKYC: false,
      description: 'Cryptocurrency staking',
    },
    
    [TransactionType.NFT_PURCHASE]: {
      type: TransactionType.NFT_PURCHASE,
      requiresKYC: false,
      description: 'NFT marketplace transaction',
    },
    
    // Fiat-involved transactions (KYC required)
    [TransactionType.FIAT_P2P]: {
      type: TransactionType.FIAT_P2P,
      requiresKYC: true,
      requiresComplianceLevel: 'basic',
      description: 'Fiat peer-to-peer transfer',
    },
    
    [TransactionType.BANK_DEPOSIT]: {
      type: TransactionType.BANK_DEPOSIT,
      requiresKYC: true,
      requiresComplianceLevel: 'basic',
      description: 'Bank account deposit',
    },
    
    [TransactionType.BANK_WITHDRAWAL]: {
      type: TransactionType.BANK_WITHDRAWAL,
      requiresKYC: true,
      requiresComplianceLevel: 'basic',
      description: 'Bank account withdrawal',
    },
    
    [TransactionType.CARD_PURCHASE]: {
      type: TransactionType.CARD_PURCHASE,
      requiresKYC: false,
      description: 'Credit/debit card purchase (standard retail transaction)',
    },
    
    [TransactionType.WIRE_TRANSFER]: {
      type: TransactionType.WIRE_TRANSFER,
      requiresKYC: true,
      requiresComplianceLevel: 'enhanced',
      description: 'Wire transfer',
    },
    
    [TransactionType.ACH_TRANSFER]: {
      type: TransactionType.ACH_TRANSFER,
      requiresKYC: true,
      requiresComplianceLevel: 'basic',
      description: 'ACH bank transfer',
    },
    
    // Commission transactions (special rules)
    [TransactionType.REFERRAL_COMMISSION]: {
      type: TransactionType.REFERRAL_COMMISSION,
      requiresKYC: false, // Can be held in escrow until KYC
      maxAmountWithoutKYC: 1000, // $1000 escrow limit
      description: 'Referral commission payment',
    },
    
    [TransactionType.AGENT_COMMISSION]: {
      type: TransactionType.AGENT_COMMISSION,
      requiresKYC: false, // AI agents use crypto addresses
      description: 'AI agent commission payment',
    },
    
    [TransactionType.PLATFORM_FEE]: {
      type: TransactionType.PLATFORM_FEE,
      requiresKYC: false,
      description: 'Platform service fee',
    }
  };

  /**
   * Get classification for transaction type
   */
  static classify(transactionType: TransactionType): TransactionClassification {
    return this.classifications[transactionType];
  }

  /**
   * Check if transaction requires KYC based on type and amount
   */
  static requiresKYC(
    transactionType: TransactionType, 
    amount: number,
    userKYCStatus: string = 'basic'
  ): boolean {
    const classification = this.classify(transactionType);
    
    // If transaction type always requires KYC
    if (classification.requiresKYC) {
      return true;
    }
    
    // Check escrow limits for commission transactions
    if (classification.maxAmountWithoutKYC && amount > classification.maxAmountWithoutKYC) {
      return true;
    }
    
    return false;
  }

  /**
   * Get required compliance level for transaction
   */
  static getRequiredComplianceLevel(
    transactionType: TransactionType,
    amount: number
  ): 'basic' | 'enhanced' | 'institutional' | null {
    const classification = this.classify(transactionType);
    
    if (!classification.requiresKYC) {
      return null;
    }
    
    // Amount-based compliance levels
    if (amount > 100000) return 'institutional';  // $100K+
    if (amount > 25000) return 'enhanced';        // $25K+
    
    return classification.requiresComplianceLevel || 'basic';
  }

  /**
   * Get user-friendly description of KYC requirements
   */
  static getKYCRequirementDescription(transactionType: TransactionType): string {
    const classification = this.classify(transactionType);
    
    if (!classification.requiresKYC) {
      return 'No KYC verification required';
    }
    
    if (classification.requiresComplianceLevel === 'institutional') {
      return 'Institutional KYC verification required';
    }
    
    if (classification.requiresComplianceLevel === 'enhanced') {
      return 'Enhanced KYC verification required';
    }
    
    return 'Basic KYC verification required';
  }

  /**
   * Check if user can perform transaction based on their KYC status
   */
  static canUserPerformTransaction(
    transactionType: TransactionType,
    amount: number,
    userKYCStatus: string,
    userComplianceLevel: string
  ): { allowed: boolean; reason?: string; upgradeRequired?: string } {
    const classification = this.classify(transactionType);
    
    // Allow all crypto-only transactions regardless of KYC
    if (!classification.requiresKYC) {
      return { allowed: true };
    }
    
    // Check if user has verified KYC for fiat transactions
    if (userKYCStatus !== 'verified') {
      return {
        allowed: false,
        reason: 'KYC verification required for fiat transactions',
        upgradeRequired: 'kyc_verification'
      };
    }
    
    // Check compliance level requirements
    const requiredLevel = this.getRequiredComplianceLevel(transactionType, amount);
    const levels = ['basic', 'enhanced', 'institutional'];
    const userLevel = levels.indexOf(userComplianceLevel);
    const requiredLevelIndex = levels.indexOf(requiredLevel || 'basic');
    
    if (userLevel < requiredLevelIndex) {
      return {
        allowed: false,
        reason: `${requiredLevel} compliance level required for this transaction amount`,
        upgradeRequired: 'compliance_upgrade'
      };
    }
    
    return { allowed: true };
  }
}