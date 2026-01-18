# MCP Registry Submission: Coin Railz

## Submission Target
**Registry URL:** https://registry.modelcontextprotocol.io  
**GitHub Repo:** https://github.com/modelcontextprotocol/registry

---

## Prerequisites

The MCP Registry requires:
1. An **npm package** published (they only host metadata, not artifacts)
2. The package must include `mcpName` in package.json
3. GitHub authentication for publishing

**We already have:** `@coinrailz/agent-payments` on npm

---

## Step 1: Add mcpName to Package

Update the npm package's `package.json`:

```json
{
  "name": "@coinrailz/agent-payments",
  "mcpName": "io.github.coinrailz/payments",
  ...
}
```

The `mcpName` must match the GitHub org pattern: `io.github.{username}/{server-name}`

---

## Step 2: Create server.json

Create a `server.json` file with this content:

```json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  "name": "io.github.coinrailz/payments",
  "description": "Multi-chain AI agent payment infrastructure with 41 paid microservices. Process payments via x402 (USDC), Stripe (fiat), or pre-purchased credits. Supports 7 EVM chains + Solana.",
  "repository": {
    "url": "https://github.com/coinrailz/agent-payments",
    "source": "https://github.com/coinrailz/agent-payments"
  },
  "version_detail": {
    "version": "1.5.0",
    "release_date": "2026-01-18",
    "is_latest": true
  },
  "packages": [
    {
      "registry_name": "npm",
      "name": "@coinrailz/agent-payments",
      "version": "1.5.0",
      "runtime": "node",
      "runtime_arguments": [],
      "package_arguments": ["mcp"],
      "environment_variables": [
        {
          "name": "COINRAILZ_API_KEY",
          "description": "Your Coin Railz API key for authentication",
          "required": false
        }
      ]
    }
  ],
  "tools": [
    {
      "name": "process_payment",
      "description": "Execute multi-chain payments via x402 (USDC), Stripe (fiat), or pre-purchased credits"
    },
    {
      "name": "provision_wallet",
      "description": "Create MPC-secured wallet for AI agents via Coinbase CDP"
    },
    {
      "name": "get_trading_signals",
      "description": "Get AI-powered crypto trading signals with entry/exit points"
    },
    {
      "name": "get_gas_prices",
      "description": "Real-time gas prices for multiple EVM chains"
    },
    {
      "name": "analyze_wallet_risk",
      "description": "AI-powered risk assessment for crypto wallet addresses"
    },
    {
      "name": "get_token_sentiment",
      "description": "Token sentiment analysis from social and on-chain data"
    }
  ],
  "prompts": [],
  "resources": [],
  "remotes": [
    {
      "transport_type": "sse",
      "url": "https://coinrailz.com/mcp/sse"
    }
  ]
}
```

---

## Step 3: Install mcp-publisher CLI

```bash
# macOS/Linux
curl -L "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_$(uname -s | tr '[:upper:]' '[:lower:]')_$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/').tar.gz" | tar xz mcp-publisher && sudo mv mcp-publisher /usr/local/bin/

# Or via Homebrew
brew install mcp-publisher
```

---

## Step 4: Authenticate and Publish

```bash
# Login with GitHub
mcp-publisher login

# Publish the server
mcp-publisher publish
```

---

## Claude Desktop Configuration

Once published, users can add Coin Railz to Claude Desktop:

```json
{
  "mcpServers": {
    "coinrailz-payments": {
      "command": "npx",
      "args": ["@coinrailz/agent-payments", "mcp"],
      "env": {
        "COINRAILZ_API_KEY": "your-api-key"
      }
    }
  }
}
```

---

## Available Tools

| Tool | Description | Pricing |
|------|-------------|---------|
| `process_payment` | Execute multi-chain payments | 1.5% + $0.01 |
| `provision_wallet` | Create MPC wallet for agent | Free |
| `get_trading_signals` | AI trading signals | $0.75 |
| `get_gas_prices` | Multi-chain gas oracle | $0.10 |
| `analyze_wallet_risk` | Wallet risk assessment | $0.50 |
| `get_token_sentiment` | Token sentiment analysis | $0.25 |

---

## Links

- **Website:** https://coinrailz.com
- **NPM:** https://www.npmjs.com/package/@coinrailz/agent-payments
- **PyPI:** https://pypi.org/project/coinrailz/
- **Documentation:** https://coinrailz.com/developers

---

## Notes

- The MCP Registry is in preview (launched Sept 2025)
- API v0.1 is frozen, but breaking changes may still occur
- Check current submission schema at https://github.com/modelcontextprotocol/registry/blob/main/docs
