// DEX Aggregator Service - 1inch and 0x Protocol Integration
// ISO 20022 compliant crypto-to-crypto swap services

import { storage } from "../storage";
import { ISO20022Utils } from "@shared/iso20022";

interface DexConfig {
  oneInchBaseUrl: string;
  oneInchApiKey: string;
  zeroXBaseUrl: string;
  zeroXApiKey: string;
}

interface SwapQuoteRequest {
  fromToken: string;
  toToken: string;
  amount: string;
  chainId: number;
  slippage: number;
}

interface SwapExecuteRequest extends SwapQuoteRequest {
  userId: string;
  userAddress: string;
  requestId: string;
}

export class DexAggregatorService {
  private config: DexConfig;

  constructor() {
    this.config = {
      oneInchBaseUrl: process.env.ONEINCH_API_BASE_URL || 'https://api.1inch.dev',
      oneInchApiKey: process.env.ONEINCH_API_KEY || '',
      zeroXBaseUrl: process.env.ZEROX_API_BASE_URL || 'https://api.0x.org',
      zeroXApiKey: process.env.ZEROX_API_KEY || '',
    };
  }

  private isSupportedChain(chainId: number): boolean {
    const supportedChains = [
      1,     // Ethereum
      137,   // Polygon
      56,    // BSC
      42161, // Arbitrum
      10,    // Optimism
      8453,  // Base Chain
      369,   // PulseChain
      43114  // Avalanche
    ];
    return supportedChains.includes(chainId);
  }

  async getSwapQuote(request: SwapQuoteRequest): Promise<any> {
    // Validate Base Chain support
    if (!this.isSupportedChain(request.chainId)) {
      throw new Error(`Chain ID ${request.chainId} not supported. Supported chains: Ethereum (1), Polygon (137), BSC (56), Arbitrum (42161), Optimism (10), Base (8453)`);
    }

    if (!this.config.oneInchApiKey) {
      throw new Error('1inch API key not configured. Please provide ONEINCH_API_KEY environment variable.');
    }

    try {
      const params = new URLSearchParams({
        src: request.fromToken,
        dst: request.toToken,
        amount: request.amount,
        includeTokensInfo: 'true',
        includeProtocols: 'true',
        includeGas: 'true',
      });

      const response = await fetch(
        `${this.config.oneInchBaseUrl}/swap/v6.0/${request.chainId}/quote?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.oneInchApiKey}`,
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`1inch quote failed: ${response.statusText}`);
      }

      const quote = await response.json();
      
      // Add Coin Railz fee (0.25%)
      const coinRailzFee = parseFloat(quote.dstAmount) * 0.0025;
      quote.dstAmountAfterFees = (parseFloat(quote.dstAmount) - coinRailzFee).toString();
      quote.coinRailzFee = coinRailzFee.toString();

      return quote;
    } catch (error) {
      console.error('DEX quote error:', error);
      
      // Fallback to 0x Protocol
      return this.getZeroXQuote(request);
    }
  }

  private async getZeroXQuote(request: SwapQuoteRequest): Promise<any> {
    if (!this.config.zeroXApiKey) {
      throw new Error('0x Protocol API key not configured as fallback.');
    }

    try {
      const params = new URLSearchParams({
        sellToken: request.fromToken,
        buyToken: request.toToken,
        sellAmount: request.amount,
        slippagePercentage: (request.slippage / 100).toString(),
      });

      const response = await fetch(
        `${this.config.zeroXBaseUrl}/swap/v1/quote?${params}`,
        {
          headers: {
            '0x-api-key': this.config.zeroXApiKey,
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`0x Protocol quote failed: ${response.statusText}`);
      }

      const quote = await response.json();
      
      // Add Coin Railz fee (0.25%)
      const coinRailzFee = parseFloat(quote.buyAmount) * 0.0025;
      quote.buyAmountAfterFees = (parseFloat(quote.buyAmount) - coinRailzFee).toString();
      quote.coinRailzFee = coinRailzFee.toString();

      return quote;
    } catch (error) {
      console.error('0x Protocol quote error:', error);
      throw error;
    }
  }

  async executeSwap(request: SwapExecuteRequest): Promise<any> {
    const messageId = ISO20022Utils.generateMessageId();

    try {
      const params = new URLSearchParams({
        src: request.fromToken,
        dst: request.toToken,
        amount: request.amount,
        from: request.userAddress,
        slippage: request.slippage.toString(),
        disableEstimate: 'true',
        allowPartialFill: 'false',
      });

      const response = await fetch(
        `${this.config.oneInchBaseUrl}/swap/v6.0/${request.chainId}/swap?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.oneInchApiKey}`,
            'Accept': 'application/json',
            'X-Request-ID': request.requestId,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`1inch swap failed: ${response.statusText}`);
      }

      const swapData = await response.json();

      // Log API interaction for compliance
      await storage.createAPILog({
        userId: request.userId,
        apiProvider: '1INCH_DEX',
        endpoint: '/swap/v6.0/swap',
        requestId: request.requestId,
        requestData: request,
        responseData: swapData,
        statusCode: response.status,
        iso20022MessageType: 'dex.swap.001',
        complianceFlags: {
          swapAmount: request.amount,
          fromToken: request.fromToken,
          toToken: request.toToken,
          userAddress: request.userAddress,
        },
      });

      // Create crypto transaction record
      await storage.createCryptoTransaction({
        userId: request.userId,
        coinSymbol: request.toToken,
        transactionType: 'swap',
        amount: swapData.dstAmount || swapData.buyAmount,
        pricePerCoin: "0", // DEX swap, price varies
        totalValue: "0", // Calculated based on DEX rates
        status: 'pending',
        blockchainHash: swapData.tx?.hash,
        blockchainAddress: request.userAddress,
        networkFee: swapData.tx?.gasPrice,
      });

      return swapData;
    } catch (error) {
      console.error('DEX swap execution error:', error);
      throw error;
    }
  }

  async getSupportedTokens(chainId: number): Promise<any> {
    try {
      const response = await fetch(
        `${this.config.oneInchBaseUrl}/swap/v6.0/${chainId}/tokens`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.oneInchApiKey}`,
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Token list fetch failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('DEX tokens fetch error:', error);
      throw error;
    }
  }

  async getGasPrice(chainId: number): Promise<any> {
    try {
      const response = await fetch(
        `${this.config.oneInchBaseUrl}/gas-price/v1.4/${chainId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.oneInchApiKey}`,
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Gas price fetch failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Gas price fetch error:', error);
      throw error;
    }
  }
}

export const dexAggregatorService = new DexAggregatorService();