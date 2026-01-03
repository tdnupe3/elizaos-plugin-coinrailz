# Coin Railz Solana SDK Examples

Working examples showing how to integrate Coin Railz payments into your AI agent applications.

## Prerequisites

1. Get your API key at [coinrailz.com/api-keys](https://coinrailz.com/api-keys)
2. Set the environment variable:
   ```bash
   export COINRAILZ_API_KEY=your-api-key-here
   ```

## Running Examples

Install dependencies and run:

```bash
npm install
npx ts-node examples/<example-name>.ts
```

## Examples

### [basic-payment.ts](./basic-payment.ts)
Simple payment flow - check status, send USDC payment, view result.

```bash
npx ts-node examples/basic-payment.ts
```

### [wallet-management.ts](./wallet-management.ts)
Create new Solana wallets and check balances.

```bash
npx ts-node examples/wallet-management.ts
```

### [ai-agent-integration.ts](./ai-agent-integration.ts)
Complete AI agent payment handler class with:
- Wallet setup
- Payment processing
- Balance checking
- Transaction tracking

```bash
npx ts-node examples/ai-agent-integration.ts
```

### [elizaos-plugin.ts](./elizaos-plugin.ts)
ElizaOS (ai16z) action plugin showing:
- SEND_PAYMENT action
- CHECK_BALANCE action  
- CREATE_WALLET action

Use with [ElizaOS](https://github.com/ai16z/eliza) agents.

### [mcp-tool.ts](./mcp-tool.ts)
MCP (Model Context Protocol) tools for Claude and GPT:
- Tool definitions matching MCP spec
- OpenAI function calling format
- Handler implementations

```bash
npx ts-node examples/mcp-tool.ts
```

### [dialect-blinks.ts](./dialect-blinks.ts)
Dialect Blinks / Solana Actions integration:
- actions.json configuration
- GET/POST endpoint handlers
- Shareable Blink URL generation
- Express.js route setup

```bash
npx ts-node examples/dialect-blinks.ts
```

## Need Help?

- **Documentation**: [coinrailz.com/docs/sdk/solana](https://coinrailz.com/docs/sdk/solana)
- **Discord**: [discord.gg/coinrailz](https://discord.gg/coinrailz)
- **Email**: support@coinrailz.com
