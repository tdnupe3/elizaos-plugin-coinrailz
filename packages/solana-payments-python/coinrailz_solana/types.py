"""Type definitions for Coin Railz Solana SDK"""

from dataclasses import dataclass
from typing import Optional, Dict, Any, Literal


@dataclass
class SendPaymentParams:
    to: str
    amount: float
    currency: Literal["SOL", "USDC"] = "USDC"
    memo: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class Amount:
    gross: float
    fee: float
    net: float


@dataclass
class SendPaymentResult:
    success: bool
    transaction_id: str
    status: Literal["pending", "processing", "confirmed", "failed"]
    signature: Optional[str]
    amount: Amount
    currency: str
    recipient: str
    network: str
    explorer_url: Optional[str]
    timestamp: str


@dataclass
class Balance:
    sol: float
    lamports: int


@dataclass
class BalanceResult:
    success: bool
    address: str
    balance: Balance
    network: str
    timestamp: str


@dataclass
class WalletInfo:
    address: str
    public_key: str
    network: str
    created_at: str


@dataclass
class WalletResult:
    success: bool
    wallet: WalletInfo
    message: str
    private_key: str


@dataclass
class TransactionResult:
    success: bool
    signature: str
    status: Literal["pending", "confirmed", "failed"]
    network: str
    explorer_url: str
    timestamp: str


@dataclass
class Features:
    payments: bool
    wallet_creation: bool
    sol_transfers: bool
    usdc_transfers: bool


@dataclass
class Pricing:
    processing_fee: str


@dataclass
class StatusResult:
    success: bool
    service: str
    version: str
    status: Literal["operational", "degraded", "down"]
    features: Features
    pricing: Pricing
    network: str
    currencies: list
    timestamp: str
