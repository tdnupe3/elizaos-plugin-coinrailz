"""
Gas Price Monitor Example

This example demonstrates real-time gas price monitoring
across multiple chains with fast/average/slow recommendations.

Use case: Transaction optimization, cost estimation
"""

import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../sdk/python'))

from coinrailz_client import CoinRailzClient


def estimate_cost(gwei: float, chain: str) -> str:
    """Estimate transaction cost in USD"""
    # Estimate cost for standard ERC20 transfer (~65,000 gas)
    gas_units = 65000
    eth_price = 2850  # Approximate
    bnb_price = 320
    matic_price = 0.85

    if chain in ['ethereum', 'base', 'arbitrum']:
        cost = (gwei * gas_units * eth_price) / 1e9
    elif chain == 'bnb':
        cost = (gwei * gas_units * bnb_price) / 1e9
    elif chain == 'polygon':
        cost = (gwei * gas_units * matic_price) / 1e9
    else:
        cost = 0

    return f"{cost:.2f}"


def get_recommendation(prices: dict) -> str:
    """Get transaction recommendation based on gas prices"""
    avg_gwei = prices['average']
    
    if avg_gwei < 10:
        return '✅ Great time to transact - low fees'
    elif avg_gwei < 30:
        return '👍 Good time to transact - moderate fees'
    elif avg_gwei < 50:
        return '⚠️ Fees are elevated - consider waiting'
    else:
        return '🚨 Very high fees - wait if not urgent'


def main():
    client = CoinRailzClient(
        api_key=os.getenv('COINRAILZ_API_KEY', 'cr_live_YOUR_API_KEY_HERE')
    )

    print('⛽ Real-time Gas Price Monitor\n')
    print('═' * 70)

    # Monitor these chains
    chains = ['ethereum', 'base', 'polygon', 'arbitrum', 'bnb']

    try:
        gas_data = client.get_gas_prices(chains)

        if gas_data.get('success'):
            for chain, prices in gas_data['data'].items():
                print(f"\n{chain.upper()}")
                print('─' * 70)
                print(f"Fast (< 30s):     {prices['fast']} Gwei    (~${estimate_cost(prices['fast'], chain)})")
                print(f"Average (< 2m):   {prices['average']} Gwei    (~${estimate_cost(prices['average'], chain)})")
                print(f"Slow (< 10m):     {prices['slow']} Gwei    (~${estimate_cost(prices['slow'], chain)})")
                
                # Recommendation
                recommendation = get_recommendation(prices)
                print(f"\n💡 Recommendation: {recommendation}")

        print('\n' + '═' * 70)

        # Balance check
        balance = client.get_balance()
        print(f'\n💳 Credits: ${balance.balance:.2f}')

    except Exception as e:
        print(f'❌ Error: {str(e)}')


if __name__ == '__main__':
    main()
