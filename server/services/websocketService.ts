import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { env, hasCryptoAPICredentials } from '../environment';

interface PriceUpdate {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  timestamp: number;
}

interface ClientConnection {
  ws: WebSocket;
  userId?: string;
  subscribedSymbols: Set<string>;
}

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<WebSocket, ClientConnection> = new Map();
  private priceUpdateInterval: NodeJS.Timeout | null = null;
  private readonly PRICE_UPDATE_INTERVAL = 5000; // 5 seconds

  initialize(server: Server) {
    this.wss = new WebSocketServer({ 
      server, 
      path: '/ws',
      clientTracking: true 
    });

    this.wss.on('connection', (ws: WebSocket, request) => {
      console.log('WebSocket client connected');
      
      const client: ClientConnection = {
        ws,
        subscribedSymbols: new Set()
      };
      
      this.clients.set(ws, client);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          console.error('Invalid WebSocket message:', error);
          ws.send(JSON.stringify({ error: 'Invalid message format' }));
        }
      });

      ws.on('close', () => {
        console.log('WebSocket client disconnected');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.clients.delete(ws);
      });

      // Send initial connection confirmation
      ws.send(JSON.stringify({ 
        type: 'connection', 
        status: 'connected',
        timestamp: Date.now()
      }));
    });

    // Start price update service
    this.startPriceUpdates();
  }

  private handleMessage(ws: WebSocket, message: any) {
    const client = this.clients.get(ws);
    if (!client) return;

    switch (message.type) {
      case 'subscribe_prices':
        if (Array.isArray(message.symbols)) {
          message.symbols.forEach((symbol: string) => {
            client.subscribedSymbols.add(symbol);
          });
          ws.send(JSON.stringify({
            type: 'subscription_confirmed',
            symbols: Array.from(client.subscribedSymbols)
          }));
        }
        break;

      case 'unsubscribe_prices':
        if (Array.isArray(message.symbols)) {
          message.symbols.forEach((symbol: string) => {
            client.subscribedSymbols.delete(symbol);
          });
        }
        break;

      case 'authenticate':
        client.userId = message.userId;
        break;

      default:
        ws.send(JSON.stringify({ error: 'Unknown message type' }));
    }
  }

  private startPriceUpdates() {
    if (this.priceUpdateInterval) {
      clearInterval(this.priceUpdateInterval);
    }

    this.priceUpdateInterval = setInterval(() => {
      this.broadcastPriceUpdates();
    }, this.PRICE_UPDATE_INTERVAL);
  }

  private async broadcastPriceUpdates() {
    try {
      const priceUpdates = await this.fetchPriceUpdates();
      
      this.clients.forEach((client) => {
        if (client.ws.readyState === WebSocket.OPEN && client.subscribedSymbols.size > 0) {
          const relevantUpdates = priceUpdates.filter(update => 
            client.subscribedSymbols.has(update.symbol)
          );
          
          if (relevantUpdates.length > 0) {
            client.ws.send(JSON.stringify({
              type: 'price_updates',
              data: relevantUpdates,
              timestamp: Date.now()
            }));
          }
        }
      });
    } catch (error) {
      console.error('Error broadcasting price updates:', error);
    }
  }

  private async fetchPriceUpdates(): Promise<PriceUpdate[]> {
    // If we have real API credentials, use them
    if (hasCryptoAPICredentials()) {
      try {
        return await this.fetchRealPriceData();
      } catch (error) {
        console.error('Error fetching real price data:', error);
        // Fallback to simulated data
      }
    }

    // Generate realistic price movements for demo mode
    return this.generateSimulatedPriceUpdates();
  }

  private async fetchRealPriceData(): Promise<PriceUpdate[]> {
    const symbols = ['BTC', 'ETH', 'ADA', 'SOL', 'DOT', 'XRP', 'AVAX', 'MATIC', 'USDC'];
    
    if (env.COINGECKO_API_KEY) {
      return await this.fetchFromCoinGecko(symbols);
    } else if (env.COINMARKETCAP_API_KEY) {
      return await this.fetchFromCoinMarketCap(symbols);
    }
    
    throw new Error('No cryptocurrency API credentials available');
  }

  private async fetchFromCoinGecko(symbols: string[]): Promise<PriceUpdate[]> {
    const coinGeckoIds = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'ADA': 'cardano',
      'SOL': 'solana',
      'DOT': 'polkadot',
      'XRP': 'ripple',
      'AVAX': 'avalanche-2',
      'MATIC': 'matic-network',
      'USDC': 'usd-coin'
    };

    const ids = symbols.map(s => coinGeckoIds[s as keyof typeof coinGeckoIds]).join(',');
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true`;
    
    const headers: Record<string, string> = {};
    if (env.COINGECKO_API_KEY) {
      headers['x-cg-demo-api-key'] = env.COINGECKO_API_KEY;
    }

    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`CoinGecko API error: ${response.status}`);
    
    const data = await response.json();
    
    return symbols.map(symbol => {
      const coinId = coinGeckoIds[symbol as keyof typeof coinGeckoIds];
      const coinData = data[coinId];
      
      return {
        symbol,
        price: coinData?.usd || 0,
        change24h: coinData?.usd_24h_change || 0,
        volume24h: coinData?.usd_24h_vol || 0,
        timestamp: Date.now()
      };
    });
  }

  private async fetchFromCoinMarketCap(symbols: string[]): Promise<PriceUpdate[]> {
    const url = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest';
    const response = await fetch(`${url}?symbol=${symbols.join(',')}`, {
      headers: {
        'X-CMC_PRO_API_KEY': env.COINMARKETCAP_API_KEY!,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) throw new Error(`CoinMarketCap API error: ${response.status}`);
    
    const data = await response.json();
    
    return symbols.map(symbol => {
      const coinData = data.data[symbol];
      const quote = coinData?.quote?.USD;
      
      return {
        symbol,
        price: quote?.price || 0,
        change24h: quote?.percent_change_24h || 0,
        volume24h: quote?.volume_24h || 0,
        timestamp: Date.now()
      };
    });
  }

  private generateSimulatedPriceUpdates(): PriceUpdate[] {
    const basePrices = {
      'BTC': 45000,
      'ETH': 3200,
      'ADA': 0.85,
      'SOL': 180.50,
      'DOT': 25.30,
      'XRP': 0.62,
      'AVAX': 42.80,
      'MATIC': 1.15,
      'USDC': 1.00
    };

    return Object.entries(basePrices).map(([symbol, basePrice]) => {
      // Generate realistic price movement (-2% to +2%)
      const changePercent = (Math.random() - 0.5) * 4;
      const price = basePrice * (1 + changePercent / 100);
      
      // Generate 24h change (-10% to +10%)
      const change24h = (Math.random() - 0.5) * 20;
      
      // Generate volume based on market cap tier
      let volumeMultiplier = 1000000; // Default $1M
      if (['BTC', 'ETH'].includes(symbol)) volumeMultiplier = 50000000; // $50M
      else if (['ADA', 'SOL', 'DOT', 'XRP'].includes(symbol)) volumeMultiplier = 10000000; // $10M
      
      const volume24h = volumeMultiplier * (0.5 + Math.random());
      
      return {
        symbol,
        price: Number(price.toFixed(symbol === 'USDC' ? 4 : 8)),
        change24h: Number(change24h.toFixed(2)),
        volume24h: Number(volume24h.toFixed(0)),
        timestamp: Date.now()
      };
    });
  }

  broadcastToUser(userId: string, message: any) {
    this.clients.forEach((client) => {
      if (client.userId === userId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
      }
    });
  }

  broadcastToAll(message: any) {
    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
      }
    });
  }

  getConnectedClientsCount(): number {
    return Array.from(this.clients.values()).filter(
      client => client.ws.readyState === WebSocket.OPEN
    ).length;
  }

  shutdown() {
    if (this.priceUpdateInterval) {
      clearInterval(this.priceUpdateInterval);
      this.priceUpdateInterval = null;
    }

    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.close();
      }
    });

    this.clients.clear();

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
  }
}

export const websocketService = new WebSocketService();