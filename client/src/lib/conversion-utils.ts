// Utility functions for tracking actual conversion completions
import { trackConversion, trackBusinessEvent } from './analytics';

// Track successful user registration completion
export const trackRegistrationSuccess = (userId: string, method: string) => {
  trackConversion('signup', {
    transaction_id: `signup_${userId}_${Date.now()}`,
    user_id: userId,
    service_details: { registration_method: method }
  });
};

// Track successful login completion
export const trackLoginSuccess = (userId: string, method: string) => {
  trackConversion('login', {
    transaction_id: `login_${userId}_${Date.now()}`,
    user_id: userId,
    service_details: { login_method: method }
  });
};

// Track successful payment completion
export const trackPaymentSuccess = (
  transactionId: string,
  amount: number,
  currency: string,
  paymentMethod: string,
  serviceType: string
) => {
  trackConversion('payment', {
    value: amount,
    currency: currency,
    transaction_id: transactionId,
    service_details: {
      payment_method: paymentMethod,
      service_type: serviceType
    }
  });
};

// Track successful P2P transfer completion
export const trackP2PTransferSuccess = (
  transactionId: string,
  amount: number,
  currency: string,
  fromUser: string,
  toUser: string
) => {
  trackConversion('p2p_transfer', {
    value: amount,
    currency: currency,
    transaction_id: transactionId,
    service_details: {
      from_user: fromUser,
      to_user: toUser,
      transfer_type: 'p2p'
    }
  });
};

// Track successful AI agent hiring
export const trackAgentHireSuccess = (
  agentId: string,
  amount: number,
  currency: string,
  serviceCategory: string
) => {
  trackConversion('agent_hire', {
    value: amount,
    currency: currency,
    transaction_id: `agent_${agentId}_${Date.now()}`,
    service_details: {
      agent_id: agentId,
      service_category: serviceCategory
    }
  });
};