import type { Plugin } from '@elizaos/core';
import { payForServiceAction } from './actions/payForService';
import { solanaYieldAction } from './actions/solanaYield';
import { serviceRegistryProvider } from './providers/serviceRegistry';

export const coinrailzPlugin: Plugin = {
  name: 'coinrailz',
  description: 'Coin Railz — Agent Treasury + Payments. Non-custodial USDC yield on Solana (Kamino) + Base (ERC-4626 via Aave/Compound/Morpho), plus 65 x402 pay-per-call services for data, inference, IoT, and execution.',
  actions:    [payForServiceAction, solanaYieldAction],
  evaluators: [],
  providers:  [serviceRegistryProvider],
  services:   [],
};

export default coinrailzPlugin;

export * from './types';
export { X402Client }     from './utils/x402Client';
export { SolanaYieldClient } from './utils/solanaYieldClient';
export type { SolanaYieldOperation } from './actions/solanaYield';
