# coinrailz-solana

Solana AI Agent Payment Processing SDK by Coin Railz LLC - Non-custodial SOL/USDC payments for AI agents.

## Installation

```bash
pip install coinrailz-solana
```

## Get Your API Key

**Instant API Key** - Pay $1 (USDC/USDT on Base or Solana) and get your API key immediately. No account required!

1. Visit https://coinrailz.com/api-keys
2. Send $1 to the platform wallet
3. Verify your transaction and receive your key + $5 starter credits

**Key Persistence**: Your API key is permanent and works across ALL Coin Railz services. One key = unlimited access (credits are deducted per use). You can top up credits anytime with the same key.

## Quick Start

```python
from coinrailz_solana import CoinRailzSolana, SendPaymentParams

client = CoinRailzSolana(api_key="your-api-key")

# Send USDC on Solana
result = client.send(SendPaymentParams(
    to="9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
    amount=10.00,
    currency="USDC"
))

print(result)
# SendPaymentResult(
#     success=True,
#     transaction_id='sol_abc123',
#     signature='5abc...',
#     amount=Amount(gross=10.00, fee=0.16, net=9.84),
#     explorer_url='https://solscan.io/tx/5abc...'
# )
```

## Features

- **SOL Transfers** - Native SOL payments
- **USDC Transfers** - SPL Token USDC on Solana
- **Wallet Creation** - Generate new Solana wallets
- **Balance Queries** - Check SOL balances
- **Transaction Status** - Track payment confirmations

## API Reference

### Constructor

```python
client = CoinRailzSolana(
    api_key="your-api-key",      # Required: Your API key
    base_url="https://...",       # Optional: API base URL
    timeout=30.0                  # Optional: Request timeout in seconds
)
```

### Methods

#### send(params)
Send SOL or USDC payment.

```python
from coinrailz_solana import SendPaymentParams

result = client.send(SendPaymentParams(
    to="SolanaAddress...",
    amount=10.00,
    currency="USDC",  # "SOL" or "USDC"
    memo="Payment for service"
))
```

#### get_balance(address)
Get SOL balance for an address.

```python
balance = client.get_balance("SolanaAddress...")
# BalanceResult(balance=Balance(sol=1.5, lamports=1500000000))
```

#### create_wallet()
Create a new Solana wallet.

```python
wallet = client.create_wallet()
# WalletResult(wallet=WalletInfo(address='...'), private_key='...')
```

#### get_transaction(signature)
Get transaction status.

```python
tx = client.get_transaction("5abc...")
# TransactionResult(signature='5abc...', status='confirmed')
```

#### status()
Check service status.

```python
status = client.status()
# StatusResult(status='operational', network='mainnet-beta')
```

## Context Manager

```python
with CoinRailzSolana(api_key="your-api-key") as client:
    result = client.send(SendPaymentParams(to="...", amount=10.00))
```

## Pricing

| Tier | Volume | Processing Fee |
|------|--------|----------------|
| Starter | $0-$10K/mo | 1.5% + $0.01 |
| Growth | $10K-$100K/mo | 1.25% + $0.01 |
| Platform | $100K+/mo | 0.9% + $0.01 |

**Minimum transaction**: $0.05

## Use Cases

- **AI Agent Payments** - Autonomous agent-to-agent payments on Solana
- **ElizaOS Integration** - Payment processing for ElizaOS agents
- **AgentKit** - Coinbase AgentKit payment plugin
- **MCP Tools** - Model Context Protocol payment tools

## Support

- Documentation: https://coinrailz.com/docs/sdk/solana
- Discord: https://discord.gg/coinrailz
- Email: support@coinrailz.com

## License

MIT
