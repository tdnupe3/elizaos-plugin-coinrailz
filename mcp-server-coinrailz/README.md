# Coin Railz MCP Server

A Model Context Protocol (MCP) server that exposes Coin Railz x402 micropayment services to Claude and other LLMs.

## What is MCP?

MCP (Model Context Protocol) is Anthropic's open standard for connecting AI models to external tools and data sources. This server lets Claude access blockchain data, trading signals, and crypto analytics through Coin Railz.

## Features

- **12 Crypto Tools for Claude**: Gas prices, token metadata, wallet balances, trading signals, and more
- **First-Call Free**: `gas-price-oracle` and `token-metadata` are FREE for first-time users
- **API Key Authentication**: Simple prepaid credits system - no blockchain knowledge required
- **x402 Protocol Support**: Native USDC payments on Base chain for crypto-native agents

## Installation

### Option 1: Using uv (Recommended)

```bash
# Install uv if you haven't
curl -LsSf https://astral.sh/uv/install.sh | sh

# Clone and setup
git clone https://github.com/coinrailz/mcp-server-coinrailz.git
cd mcp-server-coinrailz
uv sync
```

### Option 2: Using pip

```bash
pip install mcp httpx
git clone https://github.com/coinrailz/mcp-server-coinrailz.git
```

## Configuration

### Claude Desktop

Add to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "coinrailz": {
      "command": "uv",
      "args": [
        "--directory",
        "/path/to/mcp-server-coinrailz",
        "run",
        "server.py"
      ],
      "env": {
        "COINRAILZ_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

Or using Python directly:

```json
{
  "mcpServers": {
    "coinrailz": {
      "command": "python",
      "args": ["/path/to/mcp-server-coinrailz/server.py"],
      "env": {
        "COINRAILZ_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Claude Code CLI

```bash
claude mcp add coinrailz --scope user -- python /path/to/mcp-server-coinrailz/server.py
```

## Getting an API Key

1. Visit https://coinrailz.com/credits
2. Purchase credits with Stripe (credit card) or USDC
3. Generate an API key
4. Set the `COINRAILZ_API_KEY` environment variable

**Free Trial**: The `gas-price-oracle` and `token-metadata` services are FREE for your first call - no API key needed!

## Available Tools

| Tool | Description | Price |
|------|-------------|-------|
| `get_gas_prices` | Real-time gas prices across 6 chains | $0.10 (FREE first call) |
| `get_token_metadata` | Token name, symbol, decimals, supply | $0.10 (FREE first call) |
| `get_wallet_balance` | Multi-chain wallet balances | $0.50 |
| `get_wallet_risk_score` | Wallet security analysis | $0.50 |
| `get_trade_signals` | AI trading recommendations | $0.75 |
| `get_token_price` | Real-time DEX prices | $0.15 |
| `scan_smart_contract` | Contract security audit | $2.00 |
| `get_trending_tokens` | Trending tokens by volume | $0.50 |
| `get_token_sentiment` | Social sentiment analysis | $0.25 |
| `get_dex_liquidity` | DEX liquidity depth | $0.20 |
| `ping_coinrailz` | Test connectivity | $0.25 |
| `get_prediction_market_odds` | Polymarket odds | $0.50 |

## Example Usage in Claude

After configuring the MCP server, you can ask Claude:

- "What are the current gas prices on Ethereum and Base?"
- "Get the wallet balance for 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
- "Analyze the risk score for this wallet address"
- "What are the trending tokens on Base right now?"
- "Get trading signals for ETH on Ethereum"

## Pricing

Credits are deducted per service call:
- Most services: $0.10 - $0.75
- Premium services (contract audit): $2.00 - $5.00

Purchase credits at https://coinrailz.com/credits

## Support

- Documentation: https://coinrailz.com/developers
- Issues: https://github.com/coinrailz/mcp-server-coinrailz/issues
- Email: support@coinrailz.com

## License

MIT License - see LICENSE file
