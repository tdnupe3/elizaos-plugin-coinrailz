// Import the CommonJS namespace rather than its default export. Bun unwraps
// `exports.default` when a CJS module has `__esModule`, so a default import here
// becomes the plugin object itself and all `cjs.*` named exports are undefined.
// Node exposes the same generated CJS exports on the namespace, making this
// shape portable across both runtimes.
import * as cjs from '../dist/index.js';

export const coinrailzPlugin = cjs.coinrailzPlugin;
export const agentKitActions = cjs.agentKitActions;
export const COIN_RAILZ_SERVICES = cjs.COIN_RAILZ_SERVICES;
export const X402Client = cjs.X402Client;
export const SolanaYieldClient = cjs.SolanaYieldClient;
export const BaseYieldClient = cjs.BaseYieldClient;

export default coinrailzPlugin;