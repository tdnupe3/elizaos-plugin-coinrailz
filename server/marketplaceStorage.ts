/**
 * SHARED MARKETPLACE STORAGE
 * Centralized storage for all marketplace data
 */

// Global storage maps shared across all marketplace routes
export const marketplaceStorage = {
  orders: new Map(),
  escrowAccounts: new Map(),
  payments: new Map(),
  deliveries: new Map(),
  agents: new Map(),
  customers: new Map(),
  messages: new Map(),
  disputes: new Map(),
  payouts: new Map(),
  reviews: new Map()
};

export default marketplaceStorage;