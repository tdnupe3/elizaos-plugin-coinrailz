"""
Wallet Risk Check Example

This example shows how to check the AML/fraud risk score
for any wallet address using Coin Railz micropayment services.

Use case: KYC/AML compliance, fraud detection
"""

import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../sdk/python'))

from coinrailz_client import CoinRailzClient


def get_risk_analysis(score: int) -> str:
    """Get human-readable risk analysis"""
    if score < 20:
        return '✅ Very low risk - safe to transact'
    elif score < 40:
        return '⚠️ Low risk - proceed with caution'
    elif score < 60:
        return '⚠️ Medium risk - additional verification recommended'
    elif score < 80:
        return '🚨 High risk - avoid transaction'
    else:
        return '🚨 Very high risk - likely fraudulent'


def main():
    # Initialize client with API key
    client = CoinRailzClient(
        api_key=os.getenv('COINRAILZ_API_KEY', 'cr_live_YOUR_API_KEY_HERE')
    )

    # Example wallet addresses to check
    wallets_to_check = [
        '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',  # Coinbase 1
        '0x28C6c06298d514Db089934071355E5743bf21d60',  # Binance 14
        '0xYOUR_WALLET_HERE'
    ]

    print('🔍 Checking wallet risk scores...\n')

    for wallet in wallets_to_check:
        try:
            # Check risk score (costs $0.50 in credits)
            result = client.get_wallet_risk(wallet, 'ethereum')
            
            print(f"Wallet: {wallet}")
            print(f"├─ Risk Score: {result['riskScore']}/100")
            print(f"├─ Risk Level: {result['riskLevel']}")
            flags = ', '.join(result.get('flags', [])) if result.get('flags') else 'None'
            print(f"├─ Flags: {flags}")
            print(f"└─ Analysis: {get_risk_analysis(result['riskScore'])}\n")
            
        except Exception as e:
            print(f"❌ Error checking {wallet}: {str(e)}")

    # Check current balance
    balance = client.get_balance()
    print(f"\n💰 Remaining balance: ${balance.balance:.2f}")


if __name__ == '__main__':
    main()
