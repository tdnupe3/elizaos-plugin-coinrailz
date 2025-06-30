/**
 * SHARED STORAGE MODULE
 * Persistent in-memory storage across all marketplace routes
 */

// Global storage maps
const escrowAccounts = new Map();
const payments = new Map();
const orders = new Map();
const agents = new Map();
const customers = new Map();
const messages = new Map();
const disputes = new Map();
const payouts = new Map();

module.exports = {
  escrowAccounts,
  payments,
  orders,
  agents,
  customers,
  messages,
  disputes,
  payouts
};