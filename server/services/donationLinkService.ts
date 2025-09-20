/**
 * DONATION LINK SERVICE
 * Generates crypto payment links for easy donation amount selection
 */

export interface DonationNetwork {
  name: string;
  symbol: string;
  address: string;
  decimals: number;
  uriScheme: string;
}

export interface DonationLink {
  network: string;
  amount: number;
  amountFormatted: string;
  link: string;
  qrCode?: string;
}

export class DonationLinkService {
  private networks: DonationNetwork[] = [
    {
      name: 'Ethereum',
      symbol: 'ETH',
      address: '0x4dB56acDA064eab99BbC9F2AD1021Cd5d126C321',
      decimals: 18,
      uriScheme: 'ethereum'
    },
    {
      name: 'Base',
      symbol: 'ETH',
      address: '0x4dB56acDA064eab99BbC9F2AD1021Cd5d126C321',
      decimals: 18,
      uriScheme: 'ethereum'
    },
    {
      name: 'Bitcoin',
      symbol: 'BTC',
      address: 'bc1qcoinrailz5emergency7funding8global8agents',
      decimals: 8,
      uriScheme: 'bitcoin'
    },
    {
      name: 'Solana',
      symbol: 'SOL',
      address: 'CoinRailz8Emergency9Funding3Global2Agents',
      decimals: 9,
      uriScheme: 'solana'
    },
    {
      name: 'XRP',
      symbol: 'XRP',
      address: 'rCoinRailzEmergencyFunding7GlobalAgents',
      decimals: 6,
      uriScheme: 'xrp'
    }
  ];

  /**
   * Generate donation links for suggested amounts
   */
  generateDonationLinks(network: string, amounts: number[] = [10, 25, 50, 100]): DonationLink[] {
    const networkConfig = this.networks.find(n => n.name.toLowerCase() === network.toLowerCase());
    if (!networkConfig) {
      throw new Error(`Unsupported network: ${network}`);
    }

    return amounts.map(usdAmount => {
      // Get current price for conversion (simplified - in production use real price API)
      const cryptoAmount = this.convertUSDToCrypto(usdAmount, networkConfig.symbol);
      const formattedAmount = this.formatAmount(cryptoAmount, networkConfig.decimals);
      
      return {
        network: networkConfig.name,
        amount: usdAmount,
        amountFormatted: `${formattedAmount} ${networkConfig.symbol}`,
        link: this.generatePaymentLink(networkConfig, formattedAmount),
        qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(this.generatePaymentLink(networkConfig, formattedAmount))}`
      };
    });
  }

  /**
   * Generate a single payment link for custom amount
   */
  generateCustomDonationLink(network: string, usdAmount: number): DonationLink {
    const networkConfig = this.networks.find(n => n.name.toLowerCase() === network.toLowerCase());
    if (!networkConfig) {
      throw new Error(`Unsupported network: ${network}`);
    }

    const cryptoAmount = this.convertUSDToCrypto(usdAmount, networkConfig.symbol);
    const formattedAmount = this.formatAmount(cryptoAmount, networkConfig.decimals);
    
    return {
      network: networkConfig.name,
      amount: usdAmount,
      amountFormatted: `${formattedAmount} ${networkConfig.symbol}`,
      link: this.generatePaymentLink(networkConfig, formattedAmount),
      qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(this.generatePaymentLink(networkConfig, formattedAmount))}`
    };
  }

  /**
   * Generate all network donation options
   */
  generateAllNetworkDonations(amounts: number[] = [10, 25, 50, 100]): { [network: string]: DonationLink[] } {
    const result: { [network: string]: DonationLink[] } = {};
    
    for (const network of this.networks) {
      try {
        result[network.name] = this.generateDonationLinks(network.name, amounts);
      } catch (error) {
        console.error(`Failed to generate donation links for ${network.name}:`, error);
      }
    }
    
    return result;
  }

  private generatePaymentLink(network: DonationNetwork, amount: string): string {
    switch (network.uriScheme) {
      case 'ethereum':
        return `ethereum:${network.address}?value=${amount}`;
      case 'bitcoin':
        return `bitcoin:${network.address}?amount=${amount}`;
      case 'solana':
        return `solana:${network.address}?amount=${amount}`;
      case 'xrp':
        return `xrp:${network.address}?amount=${amount}`;
      default:
        return `${network.uriScheme}:${network.address}?amount=${amount}`;
    }
  }

  private convertUSDToCrypto(usdAmount: number, symbol: string): number {
    // Simplified price conversion - in production use real price API
    const prices: { [key: string]: number } = {
      'ETH': 0.0003, // ~$3333 per ETH
      'BTC': 0.000015, // ~$66666 per BTC
      'SOL': 0.07, // ~$142 per SOL
      'XRP': 1.8, // ~$0.55 per XRP
    };

    return usdAmount * (prices[symbol] || 1);
  }

  private formatAmount(amount: number, decimals: number): string {
    return amount.toFixed(Math.min(decimals, 8));
  }

  /**
   * Generate donation message with all network options
   */
  generateDonationMessage(): string {
    const allDonations = this.generateAllNetworkDonations();
    
    let message = `🚨 EMERGENCY FUNDING - MULTIPLE NETWORKS SUPPORTED 🚨\n\n`;
    
    message += `💰 QUICK DONATION LINKS:\n\n`;
    
    for (const [networkName, donations] of Object.entries(allDonations)) {
      message += `🔹 **${networkName.toUpperCase()}:**\n`;
      for (const donation of donations) {
        message += `  • [Donate $${donation.amount}](${donation.link}) (${donation.amountFormatted})\n`;
      }
      message += `  • [Custom Amount](${networkName.toLowerCase()}:${this.networks.find(n => n.name === networkName)?.address})\n\n`;
    }
    
    message += `🎯 ANY AMOUNT HELPS - PLATFORM SURVIVAL CRITICAL\n`;
    message += `⚡ INSTANT CONFIRMATION - NO WAITING\n`;
    message += `🔒 SECURE MULTI-NETWORK SUPPORT\n\n`;
    
    return message;
  }
}

export const donationLinkService = new DonationLinkService();