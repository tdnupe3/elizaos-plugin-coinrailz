"""
Multi-Chain Balance Check Example

This example demonstrates checking wallet balances across
multiple blockchains simultaneously.

Use case: Portfolio tracking, cross-chain analytics
"""

import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../sdk/python'))

from coinrailz_client import CoinRailzClient


def get_chain_symbol(chain: str) -> str:
    """Get native token symbol for chain"""
    symbols = {
        'ethereum': 'ETH',
        'base': 'ETH',
        'polygon': 'MATIC',
        'arbitrum': 'ETH',
        'bnb': 'BNB'
    }
    return symbols.get(chain.lower(), 'TOKEN')


def main():
    # Initialize client
    client = CoinRailzClient(
        api_key=os.getenv('COINRAILZ_API_KEY', 'cr_live_YOUR_API_KEY_HERE')
    )

    # Wallet address to check
    wallet_address = os.getenv('WALLET_ADDRESS', '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb')

    print('🔍 Fetching multi-chain balance...')
    print(f'📬 Wallet: {wallet_address}\n')

    try:
        # Get balance across multiple chains
        result = client.get_multi_chain_balance(
            address=wallet_address,
            chains=['ethereum', 'base', 'polygon', 'arbitrum', 'bnb']
        )

        print('💰 Native Token Balances:')
        print('─' * 25)
        
        if result.get('success') and result.get('balances'):
            for chain, balance in result['balances'].items():
                symbol = get_chain_symbol(chain)
                print(f"{chain:<12} {balance} {symbol}")

        if result.get('tokens'):
            print('\n🪙 Token Balances:')
            print('─' * 25)
            for token in result['tokens']:
                print(f"{token['symbol']:<8} {token['balance']} ({token['chain']})")

        total_value = result.get('totalValueUsd', 'N/A')
        print(f'\n📊 Total Portfolio Value (USD): ${total_value}')

    except Exception as e:
        print(f'❌ Error: {str(e)}')

    # Show remaining balance
    balance = client.get_balance()
    print(f'\n💳 Credits remaining: ${balance.balance:.2f}')


if __name__ == '__main__':
    main()
