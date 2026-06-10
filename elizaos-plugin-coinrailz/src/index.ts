import type { Plugin } from '@elizaos/core';
import { payForServiceAction } from './actions/payForService';
import { solanaYieldAction } from './actions/solanaYield';
import { baseYieldAction } from './actions/baseYield';
import { serviceRegistryProvider } from './providers/serviceRegistry';

export const coinrailzPlugin: Plugin = {
  name: 'coinrailz',
  description: 'Coin Railz — Agent Treasury + Payments. USDC yield on Base (ERC-4626 vault, auto-routing Aave/Compound/Morpho) + Solana (non-custodial Kamino portal), plus 65 x402 pay-per-call services for data, inference, IoT, and execution.',
  actions:    [payForServiceAction, baseYieldAction, solanaYieldAction],
  evaluators: [],
  providers:  [serviceRegistryProvider],
  services:   [],
};

export default coinrailzPlugin;

export * from './types';
export { X402Client }      from './utils/x402Client';
export { SolanaYieldClient } from './utils/solanaYieldClient';
export { BaseYieldClient }  from './utils/baseYieldClient';
export type { SolanaYieldOperation } from './actions/solanaYield';
export type { BaseYieldOperation }   from './actions/baseYield';
