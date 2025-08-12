/**
 * Blockchain Balance Checker
 * Checks USDC balance directly on blockchain
 */

export class BlockchainChecker {
  /**
   * Check USDC balance on Ethereum
   */
  async checkEthereumUSDC(address: string) {
    try {
      // USDC contract on Ethereum: 0xA0b86a33E6441dd7e100a9EC0B1EC3e75aDa65da
      const response = await fetch(
        `https://api.etherscan.io/api?module=account&action=tokenbalance&contractaddress=0xA0b86a33E6441dd7e100a9EC0B1EC3e75aDa65da&address=${address}&tag=latest`
      );
      
      const data = await response.json();
      
      if (data.status === '1' && data.result) {
        // USDC has 6 decimals, so divide by 1000000
        const balance = parseInt(data.result) / 1000000;
        return { balance, raw: data, chain: 'ethereum' };
      }
      
      return { balance: 0, error: data.message || 'No balance found', chain: 'ethereum' };
    } catch (error: any) {
      return { balance: 0, error: error.message, chain: 'ethereum' };
    }
  }

  /**
   * Check USDC balance on Polygon
   */
  async checkPolygonUSDC(address: string) {
    try {
      // USDC contract on Polygon: 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174
      const response = await fetch(
        `https://api.polygonscan.com/api?module=account&action=tokenbalance&contractaddress=0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174&address=${address}&tag=latest`
      );
      
      const data = await response.json();
      
      if (data.status === '1' && data.result) {
        // USDC has 6 decimals on Polygon too
        const balance = parseInt(data.result) / 1000000;
        return { balance, raw: data, chain: 'polygon' };
      }
      
      return { balance: 0, error: data.message || 'No balance found', chain: 'polygon' };
    } catch (error: any) {
      return { balance: 0, error: error.message, chain: 'polygon' };
    }
  }

  /**
   * Check all chains for USDC balance
   */
  async checkAllChainsUSDC(address: string) {
    console.log(`🔍 Checking USDC balance across all chains for address: ${address}`);
    
    const [ethereum, polygon] = await Promise.all([
      this.checkEthereumUSDC(address),
      this.checkPolygonUSDC(address)
    ]);

    const totalBalance = ethereum.balance + polygon.balance;
    
    return {
      address,
      totalUSDC: totalBalance,
      ethereum,
      polygon,
      hasBalance: totalBalance > 0,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Locate missing $50 USDC specifically
   */
  async locateFiftyUSDC(address: string) {
    const results = await this.checkAllChainsUSDC(address);
    
    const hasFiftyOrMore = results.totalUSDC >= 50;
    const exactlyFifty = Math.abs(results.totalUSDC - 50) < 0.01; // Within 1 cent
    
    return {
      ...results,
      foundFiftyUSDC: hasFiftyOrMore,
      exactlyFiftyUSDC: exactlyFifty,
      analysis: {
        total: results.totalUSDC,
        difference: results.totalUSDC - 50,
        recommendation: hasFiftyOrMore 
          ? 'USDC found on blockchain - sync to platform database'
          : 'USDC not found on blockchain - investigate deposit transaction'
      }
    };
  }
}

export const blockchainChecker = new BlockchainChecker();