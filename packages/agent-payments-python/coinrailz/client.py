"""
coinrailz - Client
AI Agent Payment Processing SDK

Non-custodial USDC payments for AI agents with bundled intelligence services.
Processing fee: 1.5% + $0.01 per transaction
"""

from typing import Optional, Dict, Any, Union
import httpx
from .types import (
    CoinRailzConfig,
    SendPaymentParams,
    SendPaymentResult,
    CreateInvoiceParams,
    InvoiceResult,
    ReportParams,
    ReportResult,
    BalanceResult,
    WalletResult,
    StatusResult,
    IntelligenceServiceResult,
    ApiError
)

SDK_VERSION = "1.0.1"


class CoinRailz:
    """
    CoinRailz AI Agent Payment Processing SDK Client.

    Non-custodial USDC payments for AI agents with bundled intelligence services.
    Processing fee: 1.5% + $0.01 per transaction

    Example:
        client = CoinRailz(api_key="cr_live_...")

        # Send payment
        result = client.send(to="0x...", amount=100)

        # Create invoice
        invoice = client.create_invoice(amount=50, description="Service fee")
    """

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://coinrailz.com",
        timeout: int = 30,
        enable_intelligence: bool = False
    ):
        """
        Initialize the CoinRailz client.

        Args:
            api_key: API key from https://coinrailz.com/api-keys
            base_url: Base URL for API requests (default: https://coinrailz.com)
            timeout: Request timeout in seconds (default: 30)
            enable_intelligence: Enable x402 intelligence services (default: False)
        """
        if not api_key:
            raise ValueError("API key is required. Get one at https://coinrailz.com/api-keys")

        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._timeout = timeout
        self._enable_intelligence = enable_intelligence
        self._client = httpx.Client(timeout=timeout)

    def _request(
        self,
        method: str,
        path: str,
        json: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None
    ) -> Union[Dict[str, Any], ApiError]:
        """Make an authenticated request to the API."""
        url = f"{self._base_url}/api/sdk{path}"
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
            "X-SDK-Version": SDK_VERSION
        }

        try:
            response = self._client.request(
                method=method,
                url=url,
                headers=headers,
                json=json,
                params=params
            )
            data = response.json()

            if not response.is_success:
                return ApiError(
                    success=False,
                    error=data.get("error", "UNKNOWN_ERROR"),
                    message=data.get("message", f"HTTP {response.status_code}")
                )

            return data

        except httpx.TimeoutException:
            return ApiError(
                success=False,
                error="TIMEOUT",
                message=f"Request timed out after {self._timeout}s"
            )
        except httpx.RequestError as e:
            return ApiError(
                success=False,
                error="NETWORK_ERROR",
                message=str(e)
            )

    def send(
        self,
        to: str,
        amount: float,
        currency: str = "USDC",
        memo: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Union[SendPaymentResult, ApiError]:
        """
        Send USDC payment to an address.
        Fee: 1.5% + $0.01

        Args:
            to: Recipient Ethereum address (0x...)
            amount: Amount in USDC
            currency: Currency (USDC only, default)
            memo: Optional payment memo
            metadata: Optional custom metadata

        Returns:
            SendPaymentResult on success, ApiError on failure
        """
        payload = {
            "to": to,
            "amount": amount,
            "currency": currency,
        }
        if memo:
            payload["memo"] = memo
        if metadata:
            payload["metadata"] = metadata

        result = self._request("POST", "/payments/send", json=payload)
        if isinstance(result, ApiError):
            return result
        return SendPaymentResult(**result)

    def create_invoice(
        self,
        amount: float,
        currency: str = "USDC",
        description: Optional[str] = None,
        expires_in: int = 15,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Union[InvoiceResult, ApiError]:
        """
        Create a payment invoice for receiving funds.

        Args:
            amount: Invoice amount in USDC
            currency: Currency (USDC only, default)
            description: Optional invoice description
            expires_in: Expiry in minutes (default: 15)
            metadata: Optional custom metadata

        Returns:
            InvoiceResult on success, ApiError on failure
        """
        payload = {
            "amount": amount,
            "currency": currency,
            "expiresIn": expires_in,
        }
        if description:
            payload["description"] = description
        if metadata:
            payload["metadata"] = metadata

        result = self._request("POST", "/payments/invoice", json=payload)
        if isinstance(result, ApiError):
            return result
        return InvoiceResult(**result)

    def get_reports(
        self,
        period: str = "weekly",
        format: str = "json"
    ) -> Union[ReportResult, ApiError]:
        """
        Get activity reports.

        Args:
            period: Report period ('daily', 'weekly', 'monthly')
            format: Output format ('json', 'markdown')

        Returns:
            ReportResult on success, ApiError on failure
        """
        params = {"period": period, "format": format}
        result = self._request("GET", "/payments/reports", params=params)
        if isinstance(result, ApiError):
            return result
        return ReportResult(**result)

    def get_balance(self) -> Union[BalanceResult, ApiError]:
        """
        Get wallet balance.

        Returns:
            BalanceResult on success, ApiError on failure
        """
        result = self._request("GET", "/balance")
        if isinstance(result, ApiError):
            return result
        return BalanceResult(**result)

    def create_wallet(self) -> Union[WalletResult, ApiError]:
        """
        Create a new CDP wallet.

        Returns:
            WalletResult on success, ApiError on failure
        """
        result = self._request("POST", "/wallet")
        if isinstance(result, ApiError):
            return result
        return WalletResult(**result)

    def status(self) -> Union[StatusResult, ApiError]:
        """
        Check SDK service status (no auth required).

        Returns:
            StatusResult on success, ApiError on failure
        """
        url = f"{self._base_url}/api/sdk/status"
        try:
            response = self._client.get(
                url,
                headers={"Content-Type": "application/json", "X-SDK-Version": SDK_VERSION}
            )
            data = response.json()
            return StatusResult(**data)
        except Exception as e:
            return ApiError(
                success=False,
                error="NETWORK_ERROR",
                message=str(e)
            )

    def intelligence(
        self,
        service: str,
        params: Optional[Dict[str, Any]] = None
    ) -> Union[IntelligenceServiceResult, ApiError]:
        """
        Call an intelligence service (x402 microservice).
        Requires enable_intelligence=True or +0.35% bundle subscription.

        Args:
            service: Service name (e.g., 'wallet-risk', 'trade-signals')
            params: Service-specific parameters

        Returns:
            IntelligenceServiceResult on success, ApiError on failure
        """
        if not self._enable_intelligence:
            return ApiError(
                success=False,
                error="INTELLIGENCE_NOT_ENABLED",
                message="Enable intelligence bundle with enable_intelligence=True or subscribe at $79/mo"
            )

        result = self._request("POST", f"/intelligence/{service}", json=params)
        if isinstance(result, ApiError):
            return result
        return IntelligenceServiceResult(**result)

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
