import type { Plugin } from '@elizaos/core';
import { payForServiceAction } from './actions/payForService';
import { solanaYieldAction } from './actions/solanaYield';
import { baseYieldAction } from './actions/baseYield';
import { serviceRegistryProvider } from './providers/serviceRegistry';

export const coinrailzPlugin: Plugin = {
  name: 'coinrailz',
  description: 'Coin Railz (ElizaOS PR #8382 merged) — Agent Treasury + Payments. Enable Yield-While-Trading on Base (ERC-4626, Aave/Compound/Morpho) + Solana (non-custodial Kamino). Plus 76 x402 pay-per-call services: NASA satellite, Robinhood Chain, B20 compliance, prediction markets, AI inference, IoT/DePIN, and execution. AgentKit & Coinbase Agentic Wallet compatible.',
  actions:    [payForServiceAction, baseYieldAction, solanaYieldAction],
  evaluators: [],
  providers:  [serviceRegistryProvider],
  services:   [],
};

// AgentKit compatibility export — allows coinbase/agentkit consumers to import actions directly
export const agentKitActions = {
  yieldBase:   baseYieldAction,
  yieldSolana: solanaYieldAction,
  payService:  payForServiceAction,
};

export default coinrailzPlugin;

export * from './types';
export { X402Client }      from './utils/x402Client';
export { SolanaYieldClient } from './utils/solanaYieldClient';
export { BaseYieldClient }  from './utils/baseYieldClient';
export type { SolanaYieldOperation } from './actions/solanaYield';
export type { BaseYieldOperation }   from './actions/baseYield';
