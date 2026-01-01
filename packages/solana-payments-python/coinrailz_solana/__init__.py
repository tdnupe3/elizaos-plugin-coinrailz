"""
Coin Railz Solana SDK - AI Agent Payment Processing
Non-custodial SOL/USDC payments for AI agents
"""

from .client import CoinRailzSolana
from .types import (
    SendPaymentParams,
    SendPaymentResult,
    BalanceResult,
    WalletResult,
    TransactionResult,
    StatusResult,
)

__version__ = "1.0.0"
__all__ = [
    "CoinRailzSolana",
    "SendPaymentParams",
    "SendPaymentResult",
    "BalanceResult",
    "WalletResult",
    "TransactionResult",
    "StatusResult",
]
