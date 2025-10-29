/**
 * Blockchain Configuration for ERC-8004 Agent Identity System
 * 
 * Deployed on Base Mainnet (not testnet)
 */

export const ERC8004_CONTRACTS = {
  network: 'base',
  chainId: 8453,
  rpcUrl: 'https://mainnet.base.org',
  explorerUrl: 'https://basescan.org',
  contracts: {
    identityRegistry: '0x8AfBd4f43399aeB6e26AD827AeaAADfB10ebb5Aa',
    reputationRegistry: '0x3130232Ef23f7f7Dbc41f2c6A790928bc674Bb24'
  },
  deploymentDate: '2025-10-29'
};

// Contract ABIs (minimal for interaction)
export const IDENTITY_REGISTRY_ABI = [
  "function registerAgent(address agent, string memory name, string memory metadataURI) external returns (uint256)",
  "function revokeAgent(uint256 tokenId) external",
  "function getAgentInfo(uint256 tokenId) external view returns (address, string memory, string memory, bool)",
  "function isRegistered(address agent) external view returns (bool)",
  "function tokenOfAgent(address agent) external view returns (uint256)",
  "function name() external view returns (string memory)",
  "function symbol() external view returns (string memory)"
];

export const REPUTATION_REGISTRY_ABI = [
  "function recordService(address agent, bool success, string memory feedback) external",
  "function getReputation(address agent) external view returns (uint256, uint256, uint256)",
  "function getServiceHistory(address agent) external view returns (uint256)"
];
