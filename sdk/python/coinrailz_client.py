"""
Coin Railz Python SDK
Official client library for Coin Railz micropayment services

Package: coinrailz-sdk
Version: 1.0.0
"""

from typing import Dict, List, Optional, Any
import requests
from dataclasses import dataclass


@dataclass
class CreditBalance:
    """Credit balance information"""
    balance: float
    auto_top_up_enabled: bool
    auto_top_up_threshold: float
    preferred_payment_method: str


@dataclass
class Transaction:
    """Transaction record"""
    id: str
    amount: float
    type: str
    payment_method: str
    description: str
    created_at: str
    metadata: Optional[Dict[str, Any]] = None


class CoinRailzError(Exception):
    """Coin Railz API error"""
    def __init__(self, message: str, status_code: Optional[int] = None, code: Optional[str] = None):
        super().__init__(message)
        self.status_code = status_code
        self.code = code


class CoinRailzClient:
    """
    Coin Railz API client
    
    Example:
        client = CoinRailzClient(api_key="cr_live_...")
        balance = client.get_balance()
        print(f"Balance: ${balance.balance}")
    """
    
    def __init__(self, api_key: str, base_url: str = "https://coinrailz.com"):
        """
        Initialize Coin Railz client
        
        Args:
            api_key: Your Coin Railz API key (starts with cr_live_ or cr_test_)
            base_url: API base URL (default: https://coinrailz.com)
        """
        if not api_key:
            raise CoinRailzError("API key is required")
        
        self.api_key = api_key
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        })
    
    def _request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make authenticated request to Coin Railz API"""
        url = f"{self.base_url}{endpoint}"
        response = None
        
        try:
            response = self.session.request(method, url, **kwargs)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as e:
            error_data = {}
            if response is not None:
                try:
                    error_data = response.json()
                except:
                    pass
            
            raise CoinRailzError(
                error_data.get('error', str(e)),
                response.status_code if response else None,
                error_data.get('code')
            )
        except requests.exceptions.RequestException as e:
            raise CoinRailzError(f"Request failed: {str(e)}")
    
    def get_balance(self) -> CreditBalance:
        """
        Get current credit balance
        
        Returns:
            CreditBalance: Current balance and auto-top-up settings
        """
        data = self._request('GET', '/api/credits/balance')
        return CreditBalance(
            balance=data['balance'],
            auto_top_up_enabled=data['autoTopUpEnabled'],
            auto_top_up_threshold=data['autoTopUpThreshold'],
            preferred_payment_method=data['preferredPaymentMethod']
        )
    
    def get_transactions(self, limit: int = 50) -> List[Transaction]:
        """
        Get transaction history
        
        Args:
            limit: Number of transactions to retrieve (default: 50)
            
        Returns:
            List[Transaction]: Transaction history
        """
        data = self._request('GET', f'/api/credits/transactions?limit={limit}')
        return [
            Transaction(
                id=tx['id'],
                amount=tx['amount'],
                type=tx['type'],
                payment_method=tx['paymentMethod'],
                description=tx['description'],
                created_at=tx['createdAt'],
                metadata=tx.get('metadata')
            )
            for tx in data['transactions']
        ]
    
    def call_service(self, service_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Call a micropayment service
        
        Args:
            service_id: Service identifier (e.g., 'wallet-risk')
            payload: Service-specific parameters
            
        Returns:
            Dict: Service response
        """
        return self._request('POST', f'/api/x402/{service_id}', json=payload)
    
    def get_multi_chain_balance(
        self,
        address: str,
        chains: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Get wallet balance across multiple chains
        
        Args:
            address: Wallet address
            chains: List of chains (default: ['ethereum', 'base', 'polygon'])
            
        Returns:
            Dict: Balance information per chain
        """
        if chains is None:
            chains = ['ethereum', 'base', 'polygon']
        
        return self.call_service('multi-chain-balance', {
            'address': address,
            'chains': chains
        })
    
    def get_gas_prices(self, chains: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Get current gas prices
        
        Args:
            chains: List of chains (default: ['ethereum', 'base'])
            
        Returns:
            Dict: Gas prices per chain
        """
        if chains is None:
            chains = ['ethereum', 'base']
        
        return self.call_service('gas-price-oracle', {'chains': chains})
    
    def get_token_price(self, token_address: str, chain: str = 'ethereum') -> Dict[str, Any]:
        """
        Get token price with 24h change
        
        Args:
            token_address: Token contract address
            chain: Blockchain network (default: 'ethereum')
            
        Returns:
            Dict: Price data with 24h change and volume
        """
        return self.call_service('token-price', {
            'tokenAddress': token_address,
            'chain': chain
        })
    
    def get_wallet_risk(self, wallet_address: str, chain: str = 'ethereum') -> Dict[str, Any]:
        """
        Get wallet AML/fraud risk score
        
        Args:
            wallet_address: Wallet address to check
            chain: Blockchain network (default: 'ethereum')
            
        Returns:
            Dict: Risk score and flags
        """
        return self.call_service('wallet-risk', {
            'walletAddress': wallet_address,
            'chain': chain
        })
    
    def scan_contract(self, contract_address: str, chain: str = 'ethereum') -> Dict[str, Any]:
        """
        Security scan for smart contract
        
        Args:
            contract_address: Contract address
            chain: Blockchain network (default: 'ethereum')
            
        Returns:
            Dict: Security analysis results
        """
        return self.call_service('contract-scan', {
            'contractAddress': contract_address,
            'chain': chain
        })
    
    def get_trade_signals(
        self,
        token: str,
        timeframe: str = '1h',
        risk_level: str = 'medium'
    ) -> Dict[str, Any]:
        """
        Get AI-powered trading signals
        
        Args:
            token: Token symbol (e.g., 'ETH')
            timeframe: Chart timeframe (default: '1h')
            risk_level: Risk tolerance (default: 'medium')
            
        Returns:
            Dict: Trading signal with confidence score
        """
        return self.call_service('trade-signals', {
            'token': token,
            'timeframe': timeframe,
            'riskLevel': risk_level
        })
    
    def get_token_sentiment(self, token_symbol: str, chain: str = 'ethereum') -> Dict[str, Any]:
        """
        Get social media sentiment for token
        
        Args:
            token_symbol: Token symbol (e.g., 'ETH')
            chain: Blockchain network (default: 'ethereum')
            
        Returns:
            Dict: Sentiment analysis with score
        """
        return self.call_service('token-sentiment', {
            'tokenSymbol': token_symbol,
            'chain': chain
        })
    
    def get_trending_tokens(self, timeframe: str = '24h', chain: str = 'ethereum') -> Dict[str, Any]:
        """
        Get trending tokens
        
        Args:
            timeframe: Time window (default: '24h')
            chain: Blockchain network (default: 'ethereum')
            
        Returns:
            Dict: List of trending tokens
        """
        return self.call_service('trending-tokens', {
            'timeframe': timeframe,
            'chain': chain
        })
    
    def get_whale_alerts(self, chain: str = 'ethereum', min_value: int = 1000000) -> Dict[str, Any]:
        """
        Get whale wallet transaction alerts
        
        Args:
            chain: Blockchain network (default: 'ethereum')
            min_value: Minimum transaction value in USD (default: 1000000)
            
        Returns:
            Dict: Whale transaction alerts
        """
        return self.call_service('whale-alerts', {
            'chain': chain,
            'minValue': min_value
        })
    
    def get_dex_liquidity(self, token_address: str, chain: str = 'ethereum') -> Dict[str, Any]:
        """
        Get DEX liquidity data
        
        Args:
            token_address: Token contract address
            chain: Blockchain network (default: 'ethereum')
            
        Returns:
            Dict: Liquidity pool information
        """
        return self.call_service('dex-liquidity', {
            'tokenAddress': token_address,
            'chain': chain
        })
    
    def get_nft_floor_price(self, collection_address: str, chain: str = 'ethereum') -> Dict[str, Any]:
        """
        Get NFT collection floor price
        
        Args:
            collection_address: NFT collection contract address
            chain: Blockchain network (default: 'ethereum')
            
        Returns:
            Dict: Floor price and statistics
        """
        return self.call_service('nft-floor-price', {
            'collectionAddress': collection_address,
            'chain': chain
        })
    
    def verify_ens_domain(self, domain: str) -> Dict[str, Any]:
        """
        Verify ENS domain ownership
        
        Args:
            domain: ENS domain (e.g., 'vitalik.eth')
            
        Returns:
            Dict: Domain verification result
        """
        return self.call_service('ens-verification', {'domain': domain})
    
    def get_contract_events(
        self,
        contract_address: str,
        event_name: str,
        from_block: int,
        chain: str = 'ethereum'
    ) -> Dict[str, Any]:
        """
        Get smart contract events
        
        Args:
            contract_address: Contract address
            event_name: Event name to filter
            from_block: Starting block number
            chain: Blockchain network (default: 'ethereum')
            
        Returns:
            Dict: Contract events
        """
        return self.call_service('contract-events', {
            'contractAddress': contract_address,
            'eventName': event_name,
            'fromBlock': from_block,
            'chain': chain
        })


def create_client(api_key: str, base_url: str = "https://coinrailz.com") -> CoinRailzClient:
    """
    Create a Coin Railz client instance
    
    Args:
        api_key: Your Coin Railz API key
        base_url: API base URL (default: https://coinrailz.com)
        
    Returns:
        CoinRailzClient: Configured client instance
    """
    return CoinRailzClient(api_key=api_key, base_url=base_url)
