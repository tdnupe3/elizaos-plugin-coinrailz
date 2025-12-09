#!/usr/bin/env python3
"""
Coin Railz MCP Server - Claude/Anthropic Model Context Protocol Integration

This MCP server exposes Coin Railz x402 micropayment services as tools for Claude.
It enables AI agents running in Claude to access blockchain data, trading signals,
and other crypto services through the Coin Railz platform.

Payment Methods:
1. API Key (prepaid credits) - RECOMMENDED: Purchase credits at https://coinrailz.com/credits
2. x402 USDC payments - For blockchain-native agents

Usage:
1. Install: pip install mcp httpx
2. Configure in Claude Desktop config
3. Set COINRAILZ_API_KEY environment variable (or use first-call-free on select services)
"""

import os
import asyncio
import json
from typing import Any, Optional
import httpx

try:
    from mcp.server import Server
    from mcp.server.stdio import stdio_server
    from mcp.types import Tool, TextContent
except ImportError:
    print("MCP SDK not installed. Run: pip install mcp")
    raise

COINRAILZ_BASE_URL = os.getenv("COINRAILZ_BASE_URL", "https://coinrailz.com")
COINRAILZ_API_KEY = os.getenv("COINRAILZ_API_KEY", "")

app = Server("coinrailz")

async def call_coinrailz_service(
    service: str, 
    payload: dict = None,
    method: str = "POST"
) -> dict:
    """Call a Coin Railz x402 service with API key authentication."""
    url = f"{COINRAILZ_BASE_URL}/x402/{service}"
    
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "CoinRailz-MCP-Server/1.0"
    }
    
    if COINRAILZ_API_KEY:
        headers["X-API-KEY"] = COINRAILZ_API_KEY
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        if method == "POST":
            response = await client.post(url, json=payload or {}, headers=headers)
        else:
            response = await client.get(url, headers=headers)
        
        if response.status_code == 402:
            return {
                "error": "Payment required",
                "message": "This service requires payment. Get an API key at https://coinrailz.com/credits or use USDC on Base chain.",
                "alternativePaymentMethods": response.json().get("alternativePaymentMethods", {}),
                "price": response.json().get("accepts", [{}])[0].get("maxAmountRequiredUSD", "Unknown")
            }
        
        response.raise_for_status()
        return response.json()

@app.tool()
async def get_gas_prices(chains: list[str] = None) -> str:
    """
    Get real-time gas prices across multiple blockchain networks.
    
    Args:
        chains: List of chains to query. Options: ethereum, base, polygon, bsc, arbitrum, optimism.
                Defaults to all supported chains.
    
    Returns:
        Gas prices in gwei with USD cost estimates for each chain.
    
    Price: $0.10 (FIRST CALL FREE for new users!)
    """
    payload = {"chains": chains or ["ethereum", "base", "polygon"]}
    result = await call_coinrailz_service("gas-price-oracle", payload)
    return json.dumps(result, indent=2)

@app.tool()
async def get_token_metadata(token_address: str, chain: str = "ethereum") -> str:
    """
    Get metadata for any ERC-20 token including name, symbol, decimals, and total supply.
    
    Args:
        token_address: The token contract address (0x...)
        chain: Blockchain network. Options: ethereum, base, polygon, bsc, arbitrum, optimism
    
    Returns:
        Token metadata including name, symbol, decimals, total supply.
    
    Price: $0.10 (FIRST CALL FREE for new users!)
    """
    payload = {"tokenAddress": token_address, "chain": chain}
    result = await call_coinrailz_service("token-metadata", payload)
    return json.dumps(result, indent=2)

@app.tool()
async def get_wallet_balance(wallet_address: str, chains: list[str] = None, include_tokens: bool = True) -> str:
    """
    Get multi-chain wallet balance across 7+ EVM networks.
    
    Args:
        wallet_address: The wallet address to check (0x...)
        chains: List of chains to query. Defaults to all supported chains.
        include_tokens: Whether to include ERC-20 token balances.
    
    Returns:
        Wallet balances for native tokens and ERC-20 tokens across all specified chains.
    
    Price: $0.50
    """
    payload = {
        "walletAddress": wallet_address,
        "chains": chains or ["ethereum", "base", "polygon", "bsc", "arbitrum", "optimism"],
        "includeTokens": include_tokens
    }
    result = await call_coinrailz_service("multi-chain-balance", payload)
    return json.dumps(result, indent=2)

@app.tool()
async def get_wallet_risk_score(wallet_address: str, chain: str = "ethereum") -> str:
    """
    Get risk analysis and security scoring for any wallet address.
    
    Args:
        wallet_address: The wallet address to analyze (0x...)
        chain: Primary chain for analysis. Options: ethereum, base, polygon
    
    Returns:
        Risk score, transaction patterns, and security recommendations.
    
    Price: $0.50
    """
    payload = {"walletAddress": wallet_address, "chain": chain}
    result = await call_coinrailz_service("wallet-risk", payload)
    return json.dumps(result, indent=2)

@app.tool()
async def get_trade_signals(token: str = None, chain: str = "ethereum") -> str:
    """
    Get AI-powered trading signals and market recommendations.
    
    Args:
        token: Optional token address or symbol to focus on
        chain: Blockchain network. Options: ethereum, base, polygon
    
    Returns:
        Trading signals with entry/exit recommendations and confidence scores.
    
    Price: $0.75
    """
    payload = {"token": token, "chain": chain} if token else {"chain": chain}
    result = await call_coinrailz_service("trade-signals", payload)
    return json.dumps(result, indent=2)

@app.tool()
async def get_token_price(token_address: str, chain: str = "ethereum") -> str:
    """
    Get real-time token price from multiple DEX sources.
    
    Args:
        token_address: The token contract address (0x...)
        chain: Blockchain network. Options: ethereum, base, polygon, bsc
    
    Returns:
        Token price in USD with source information.
    
    Price: $0.15
    """
    payload = {"tokenAddress": token_address, "chain": chain}
    result = await call_coinrailz_service("token-price", payload)
    return json.dumps(result, indent=2)

@app.tool()
async def scan_smart_contract(contract_address: str, chain: str = "ethereum") -> str:
    """
    Perform security analysis on a smart contract.
    
    Args:
        contract_address: The contract address to scan (0x...)
        chain: Blockchain network. Options: ethereum, base, polygon
    
    Returns:
        Security analysis including vulnerabilities, rug pull risk, and audit score.
    
    Price: $2.00
    """
    payload = {"contractAddress": contract_address, "chain": chain}
    result = await call_coinrailz_service("contract-scan", payload)
    return json.dumps(result, indent=2)

@app.tool()
async def get_trending_tokens(chain: str = "ethereum", limit: int = 10) -> str:
    """
    Get trending tokens across DeFi platforms.
    
    Args:
        chain: Blockchain network. Options: ethereum, base, polygon, bsc
        limit: Number of tokens to return (max 50)
    
    Returns:
        List of trending tokens with volume, price change, and social metrics.
    
    Price: $0.50
    """
    payload = {"chain": chain, "limit": min(limit, 50)}
    result = await call_coinrailz_service("trending-tokens", payload)
    return json.dumps(result, indent=2)

@app.tool()
async def get_token_sentiment(token_address: str, chain: str = "ethereum") -> str:
    """
    Get AI-powered social sentiment analysis for a token.
    
    Args:
        token_address: The token contract address (0x...)
        chain: Blockchain network
    
    Returns:
        Sentiment score, social volume, and trending topics related to the token.
    
    Price: $0.25
    """
    payload = {"tokenAddress": token_address, "chain": chain}
    result = await call_coinrailz_service("token-sentiment", payload)
    return json.dumps(result, indent=2)

@app.tool()
async def get_dex_liquidity(token_address: str, chain: str = "ethereum") -> str:
    """
    Get DEX liquidity analysis for a token across major exchanges.
    
    Args:
        token_address: The token contract address (0x...)
        chain: Blockchain network. Options: ethereum, base, polygon, bsc
    
    Returns:
        Liquidity depth, top pools, and slippage estimates.
    
    Price: $0.20
    """
    payload = {"tokenAddress": token_address, "chain": chain}
    result = await call_coinrailz_service("dex-liquidity", payload)
    return json.dumps(result, indent=2)

@app.tool()
async def ping_coinrailz() -> str:
    """
    Test connectivity to Coin Railz x402 payment infrastructure.
    
    Returns:
        Platform status, version, and available services count.
    
    Price: $0.25 (use gas-price-oracle or token-metadata for FREE first call!)
    """
    result = await call_coinrailz_service("ping", {"message": "Hello from Claude MCP"})
    return json.dumps(result, indent=2)

@app.tool()
async def get_prediction_market_odds(event_id: str = None, query: str = None) -> str:
    """
    Get current odds for prediction market events (Polymarket, etc.)
    
    Args:
        event_id: Optional specific event ID
        query: Optional search query for events
    
    Returns:
        Current odds, volume, and market details for prediction events.
    
    Price: $0.50
    """
    payload = {}
    if event_id:
        payload["eventId"] = event_id
    if query:
        payload["query"] = query
    result = await call_coinrailz_service("prediction-market-odds", payload)
    return json.dumps(result, indent=2)

async def main():
    """Run the MCP server."""
    async with stdio_server() as (read_stream, write_stream):
        await app.run(
            read_stream,
            write_stream,
            app.create_initialization_options()
        )

if __name__ == "__main__":
    asyncio.run(main())
