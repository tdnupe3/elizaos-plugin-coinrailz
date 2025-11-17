"""
AI-Powered Trade Signals Example

This example shows how to get AI-powered trading signals
with confidence scores for any cryptocurrency.

Use case: Automated trading, signal generation
"""

import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../sdk/python'))

from coinrailz_client import CoinRailzClient


def get_signal_emoji(signal: str) -> str:
    """Get emoji for trading signal"""
    emojis = {
        'BUY': '🟢',
        'SELL': '🔴',
        'HOLD': '🟡',
        'STRONG_BUY': '🟢🟢',
        'STRONG_SELL': '🔴🔴'
    }
    return emojis.get(signal, '⚪')


def main():
    # Initialize client
    client = CoinRailzClient(
        api_key=os.getenv('COINRAILZ_API_KEY', 'cr_live_YOUR_API_KEY_HERE')
    )

    # Tokens to analyze
    tokens = ['ETH', 'BTC', 'SOL', 'ARB']
    timeframe = '4h'
    risk_level = 'medium'

    print('🤖 Getting AI-powered trade signals...\n')
    print(f'Timeframe: {timeframe}')
    print(f'Risk Level: {risk_level}\n')
    print('═' * 60)

    for token in tokens:
        try:
            # Get trade signal (costs $1.00 in credits)
            signal = client.get_trade_signals(token, timeframe, risk_level)

            if signal.get('success'):
                print(f"\n{token} Trade Signal:")
                print('─' * 60)
                print(f"Signal: {get_signal_emoji(signal['signal'])} {signal['signal']}")
                print(f"Confidence: {signal['confidence'] * 100:.1f}%")
                print(f"Entry Price: ${signal['entry']:,.0f}")
                print(f"Target Price: ${signal['target']:,.0f}")
                print(f"Stop Loss: ${signal['stopLoss']:,.0f}")
                print(f"Expected Gain: {signal['expectedGainPercent']:.2f}%")
                print(f"Risk/Reward: {signal['riskRewardRatio']:.2f}")
                
                # Additional analysis
                if signal.get('technicalIndicators'):
                    print('\n📊 Technical Indicators:')
                    for key, value in signal['technicalIndicators'].items():
                        print(f"  • {key}: {value}")

        except Exception as e:
            print(f"❌ Error getting signal for {token}: {str(e)}")

    print('\n' + '═' * 60)

    # Check balance
    balance = client.get_balance()
    print(f'\n💳 Credits remaining: ${balance.balance:.2f}')

    # Show transaction history
    transactions = client.get_transactions(5)
    print(f'\n📜 Recent Transactions ({len(transactions)}):')
    for tx in transactions:
        sign = '+' if tx.type == 'credit' else '-'
        print(f"  {sign}${tx.amount:.2f} - {tx.description}")


if __name__ == '__main__':
    main()
