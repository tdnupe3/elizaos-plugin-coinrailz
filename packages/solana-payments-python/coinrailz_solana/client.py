"""
Coin Railz Solana SDK Client
Solana AI Agent Payment Processing

Non-custodial SOL/USDC payments for AI agents.
Processing fee: 1.5% + $0.01 per transaction
"""

import httpx
from typing import Optional, Dict, Any

from .types import (
    SendPaymentParams,
    SendPaymentResult,
    BalanceResult,
    WalletResult,
    TransactionResult,
    StatusResult,
    Amount,
    Balance,
    WalletInfo,
    Features,
    Pricing,
)

DEFAULT_BASE_URL = "https://coinrailz.com"
DEFAULT_TIMEOUT = 30.0
SDK_VERSION = "1.0.1"


class CoinRailzSolana:
    """Solana AI Agent Payment Processing Client"""

    def __init__(
        self,
        api_key: str,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT,
    ):
        if not api_key:
            raise ValueError(
                "API key is required. Get one at https://coinrailz.com/api-keys"
            )

        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._client = httpx.Client(timeout=timeout)

    def _request(
        self,
        method: str,
        path: str,
        json: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        url = f"{self.base_url}/api/sdk/solana{path}"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "X-SDK-Version": SDK_VERSION,
        }

        response = self._client.request(
            method=method,
            url=url,
            headers=headers,
            json=json,
        )

        return response.json()

    def send(self, params: SendPaymentParams) -> SendPaymentResult:
        """
        Send SOL or USDC payment to a Solana address.
        Fee: 1.5% + $0.01
        """
        data = self._request(
            "POST",
            "/payments/send",
            json={
                "to": params.to,
                "amount": params.amount,
                "currency": params.currency,
                "memo": params.memo,
                "metadata": params.metadata,
            },
        )

        return SendPaymentResult(
            success=data.get("success", False),
            transaction_id=data.get("transactionId", ""),
            status=data.get("status", "pending"),
            signature=data.get("signature"),
            amount=Amount(
                gross=data.get("amount", {}).get("gross", 0),
                fee=data.get("amount", {}).get("fee", 0),
                net=data.get("amount", {}).get("net", 0),
            ),
            currency=data.get("currency", ""),
            recipient=data.get("recipient", ""),
            network=data.get("network", ""),
            explorer_url=data.get("explorerUrl"),
            timestamp=data.get("timestamp", ""),
        )

    def get_balance(self, address: str) -> BalanceResult:
        """Get SOL balance for a Solana address."""
        data = self._request("GET", f"/balance/{address}")

        balance_data = data.get("balance", {})
        return BalanceResult(
            success=data.get("success", False),
            address=data.get("address", ""),
            balance=Balance(
                sol=balance_data.get("sol", 0),
                lamports=balance_data.get("lamports", 0),
            ),
            network=data.get("network", ""),
            timestamp=data.get("timestamp", ""),
        )

    def create_wallet(self) -> WalletResult:
        """Create a new Solana wallet."""
        data = self._request("POST", "/wallet")

        wallet_data = data.get("wallet", {})
        return WalletResult(
            success=data.get("success", False),
            wallet=WalletInfo(
                address=wallet_data.get("address", ""),
                public_key=wallet_data.get("publicKey", ""),
                network=wallet_data.get("network", ""),
                created_at=wallet_data.get("createdAt", ""),
            ),
            message=data.get("message", ""),
            private_key=data.get("privateKey", ""),
        )

    def get_transaction(self, signature: str) -> TransactionResult:
        """Get transaction status by signature."""
        data = self._request("GET", f"/transaction/{signature}")

        return TransactionResult(
            success=data.get("success", False),
            signature=data.get("signature", ""),
            status=data.get("status", "pending"),
            network=data.get("network", ""),
            explorer_url=data.get("explorerUrl", ""),
            timestamp=data.get("timestamp", ""),
        )

    def status(self) -> StatusResult:
        """Check Solana SDK service status."""
        url = f"{self.base_url}/api/sdk/solana/status"
        headers = {
            "Content-Type": "application/json",
            "X-SDK-Version": SDK_VERSION,
        }

        response = self._client.get(url, headers=headers)
        data = response.json()

        features_data = data.get("features", {})
        pricing_data = data.get("pricing", {})

        return StatusResult(
            success=data.get("success", False),
            service=data.get("service", ""),
            version=data.get("version", ""),
            status=data.get("status", "down"),
            features=Features(
                payments=features_data.get("payments", False),
                wallet_creation=features_data.get("walletCreation", False),
                sol_transfers=features_data.get("solTransfers", False),
                usdc_transfers=features_data.get("usdcTransfers", False),
            ),
            pricing=Pricing(
                processing_fee=pricing_data.get("processingFee", ""),
            ),
            network=data.get("network", ""),
            currencies=data.get("currencies", []),
            timestamp=data.get("timestamp", ""),
        )

    @property
    def version(self) -> str:
        """Get SDK version."""
        return SDK_VERSION

    def close(self):
        """Close the HTTP client."""
        self._client.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
