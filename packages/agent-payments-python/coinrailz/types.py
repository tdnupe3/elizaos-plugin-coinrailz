"""
coinrailz - Type Definitions
AI Agent Payment Processing SDK
"""

from typing import Optional, Dict, Any, List, Literal
from pydantic import BaseModel, Field


class CoinRailzConfig(BaseModel):
    """Configuration for CoinRailz client."""
    api_key: str = Field(..., description="API key from https://coinrailz.com/api-keys")
    base_url: str = Field(default="https://coinrailz.com", description="Base URL for API requests")
    timeout: int = Field(default=30, description="Request timeout in seconds")
    enable_intelligence: bool = Field(default=False, description="Enable x402 intelligence services")


class SendPaymentParams(BaseModel):
    """Parameters for sending a payment."""
    to: str = Field(..., pattern=r"^0x[a-fA-F0-9]{40}$", description="Recipient Ethereum address")
    amount: float = Field(..., gt=0, description="Amount in USDC")
    currency: Literal["USDC"] = Field(default="USDC", description="Currency (USDC only)")
    memo: Optional[str] = Field(default=None, max_length=256, description="Payment memo")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Custom metadata")


class FeeBreakdown(BaseModel):
    """Fee breakdown details."""
    percentage_fee: float = Field(alias="percentageFee")
    fixed_fee: float = Field(alias="fixedFee")
    total_fee: float = Field(alias="totalFee")
    rate: str

    class Config:
        populate_by_name = True


class SendPaymentResult(BaseModel):
    """Result from sending a payment."""
    success: bool
    transaction_id: str = Field(alias="transactionId")
    status: Literal["pending", "confirmed", "failed"]
    amount: float
    fee: float
    net_amount: float = Field(alias="netAmount")
    currency: str
    to: str
    memo: Optional[str]
    fee_breakdown: FeeBreakdown = Field(alias="feeBreakdown")
    timestamp: str
    network: str

    class Config:
        populate_by_name = True


class CreateInvoiceParams(BaseModel):
    """Parameters for creating an invoice."""
    amount: float = Field(..., gt=0, description="Invoice amount in USDC")
    currency: Literal["USDC"] = Field(default="USDC", description="Currency (USDC only)")
    description: Optional[str] = Field(default=None, max_length=500, description="Invoice description")
    expires_in: int = Field(default=15, ge=1, le=60, alias="expiresIn", description="Expiry in minutes")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Custom metadata")

    class Config:
        populate_by_name = True


class PaymentInstructions(BaseModel):
    """Payment instructions for invoice."""
    step1: str
    step2: str
    step3: str
    network: str
    token: str


class InvoiceResult(BaseModel):
    """Result from creating an invoice."""
    success: bool
    invoice_id: str = Field(alias="invoiceId")
    payment_address: str = Field(alias="paymentAddress")
    amount: float
    currency: str
    description: Optional[str]
    status: Literal["pending", "paid", "expired"]
    expires_at: str = Field(alias="expiresAt")
    created_at: str = Field(alias="createdAt")
    network: str
    payment_instructions: PaymentInstructions = Field(alias="paymentInstructions")

    class Config:
        populate_by_name = True


class ReportParams(BaseModel):
    """Parameters for getting reports."""
    period: Literal["daily", "weekly", "monthly"] = Field(default="weekly")
    format: Literal["json", "markdown"] = Field(default="json")


class TransactionRecord(BaseModel):
    """Individual transaction record."""
    id: str
    type: Literal["send", "receive", "invoice"]
    amount: float
    fee: float
    status: str
    timestamp: str


class ReportSummary(BaseModel):
    """Report summary statistics."""
    total_transactions: int = Field(alias="totalTransactions")
    successful_transactions: int = Field(alias="successfulTransactions")
    failed_transactions: int = Field(alias="failedTransactions")
    total_volume_usd: float = Field(alias="totalVolumeUSD")
    fees_collected: float = Field(alias="feesCollected")
    success_rate: float = Field(alias="successRate")

    class Config:
        populate_by_name = True


class ReportPeriod(BaseModel):
    """Report period details."""
    type: str
    start: str
    end: str


class ReportResult(BaseModel):
    """Result from getting reports."""
    success: bool
    agent_id: str = Field(alias="agentId")
    period: ReportPeriod
    summary: ReportSummary
    transactions: List[TransactionRecord]
    generated_at: str = Field(alias="generatedAt")
    sdk_version: str = Field(alias="sdkVersion")

    class Config:
        populate_by_name = True


class Balances(BaseModel):
    """Wallet balances."""
    USDC: float
    ETH: float


class BalanceResult(BaseModel):
    """Result from getting balance."""
    success: bool
    address: Optional[str]
    network: str
    balances: Balances
    last_updated: str = Field(alias="lastUpdated")
    message: Optional[str] = None

    class Config:
        populate_by_name = True


class WalletResult(BaseModel):
    """Result from creating wallet."""
    success: bool
    wallet_id: str = Field(alias="walletId")
    address: Optional[str]
    network: str
    status: Literal["creating", "active", "failed"]
    created_at: str = Field(alias="createdAt")

    class Config:
        populate_by_name = True


class Features(BaseModel):
    """SDK features availability."""
    payments: bool
    invoices: bool
    reports: bool
    wallet_creation: bool = Field(alias="walletCreation")
    intelligence: bool

    class Config:
        populate_by_name = True


class Pricing(BaseModel):
    """SDK pricing info."""
    processing_fee: str = Field(alias="processingFee")
    intelligence_bundle: str = Field(alias="intelligenceBundle")

    class Config:
        populate_by_name = True


class StatusResult(BaseModel):
    """Result from status check."""
    success: bool
    service: str
    version: str
    status: Literal["operational", "degraded", "down"]
    features: Features
    pricing: Pricing
    network: str
    currency: str
    timestamp: str


class IntelligenceServiceResult(BaseModel):
    """Result from intelligence service call."""
    success: bool
    service: str
    result: Any
    timestamp: str


class ApiError(BaseModel):
    """API error response."""
    success: Literal[False]
    error: str
    message: str
