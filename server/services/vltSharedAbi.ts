/**
 * vltUSDC Vault — Shared ABI definitions and contract addresses
 *
 * Single canonical source for all vault-related ABIs and addresses.
 * Imported by: vltUsdcVaultService, vltUsdcDepositService, vltUsdcWithdrawService.
 *
 * Vault contract (= vltUSDC ERC-20 share token):
 *   0xee8d4c5c768AadCd3517Aa8C908De300305D0A7f  (Ethereum mainnet, chainId 1)
 *
 * Keep this file in sync with the deployed contract. Any ABI change here is
 * automatically reflected in all three services.
 */

// ---------------------------------------------------------------------------
// Contract addresses (Ethereum mainnet)
// ---------------------------------------------------------------------------
export const VAULT_ADDRESS = '0xee8d4c5c768AadCd3517Aa8C908De300305D0A7f'; // vault IS the vltUSDC ERC-20
export const VLT_TOKEN     = '0x6b785a0322126826d8226d77e173d75DAfb84d11';
export const USDC_ETH      = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
export const ZAP_HELPER    = '0x348A57b1dc6E3dCAa645DE6e4E864924B410525D';

// ---------------------------------------------------------------------------
// Vault ABI — read methods used by the stats service
// ---------------------------------------------------------------------------
export const VAULT_STATS_ABI = [
  'function positionLiquidity() external view returns (uint128)',
  'function totalSupply() external view returns (uint256)',
  'function poolManager() external view returns (address)',
] as const;

// ---------------------------------------------------------------------------
// Vault ABI — deposit methods used by the deposit service
// previewDeposit is included so a single Interface covers both preview + deposit.
// ---------------------------------------------------------------------------
export const VAULT_DEPOSIT_ABI = [
  'function previewDeposit(uint256 vltAmount, uint256 usdcAmount) view returns (uint256 shares)',
  'function deposit(uint256 vltAmount, uint256 usdcAmount, uint256 minShares, uint256 deadline, address recipient) returns (uint256 shares)',
] as const;

// ---------------------------------------------------------------------------
// ERC-20 approve — used by the deposit service for VLT and USDC approvals
// ---------------------------------------------------------------------------
export const ERC20_APPROVE_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
] as const;

// ---------------------------------------------------------------------------
// Vault ABI — withdraw/redeem methods used by the withdraw service
// Includes positionLiquidity + totalSupply for share-fraction estimation.
// Note: redeem has exactly 2 arguments; no slippage params exist on-chain.
// ---------------------------------------------------------------------------
export const VAULT_WITHDRAW_ABI = [
  'function redeem(uint256 shares, address receiver) returns (uint256 vltOut, uint256 usdcOut)',
  'function positionLiquidity() external view returns (uint128)',
  'function totalSupply() external view returns (uint256)',
] as const;
