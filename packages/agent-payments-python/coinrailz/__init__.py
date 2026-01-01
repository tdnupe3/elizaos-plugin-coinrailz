"""
coinrailz - AI Agent Payment Processing SDK

Non-custodial USDC payments for AI agents with bundled intelligence services.
Processing fee: 1.5% + $0.01 per transaction

Example:
    from coinrailz import CoinRailz

    client = CoinRailz(api_key="cr_live_...")

    # Send payment
    result = client.send(
        to="0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
        amount=100
    )

    # Create invoice
    invoice = client.create_invoice(
        amount=50,
        description="AI service fee"
    )
"""

from .client import CoinRailz
from .types import (
    CoinRailzConfig,
    SendPaymentParams,
    SendPaymentResult,
    CreateInvoiceParams,
    InvoiceResult,
    ReportParams,
    ReportResult,
    TransactionRecord,
    BalanceResult,
    WalletResult,
    StatusResult,
    IntelligenceServiceResult,
    ApiError
)

__version__ = "1.0.0"
__all__ = [
    "CoinRailz",
    "CoinRailzConfig",
    "SendPaymentParams",
    "SendPaymentResult",
    "CreateInvoiceParams",
    "InvoiceResult",
    "ReportParams",
    "ReportResult",
    "TransactionRecord",
    "BalanceResult",
    "WalletResult",
    "StatusResult",
    "IntelligenceServiceResult",
    "ApiError",
    "__version__"
]
