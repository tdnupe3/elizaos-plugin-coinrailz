#!/usr/bin/env python3
"""
A2A Agent Discovery Tool
Uses python-a2a SDK to discover agents via DiscoveryClient and AgentRegistry
Also includes domain probing for .well-known/agent-card.json
"""

import asyncio
import httpx
import json
import os
from datetime import datetime
from typing import List, Dict, Any, Optional

try:
    from python_a2a import A2AClient
    from python_a2a.discovery import DiscoveryClient, AgentRegistry
    HAS_A2A_SDK = True
except ImportError:
    HAS_A2A_SDK = False
    print("Warning: python-a2a SDK not fully available, using HTTP-only discovery")

KNOWN_REGISTRIES = [
    "https://registry.a2aprotocol.ai",
    "https://a2a-registry.truefoundry.com",
    "https://registry.artinet.io",
]

KNOWN_AGENT_DOMAINS = [
    "api.snack.money",
    "x402.arvos.xyz",
    "api.barvis.io",
    "api.jiren.ai",
    "api.dexter.cash",
    "api.canza.app",
    "x402-secure-api.t54.ai",
    "x402.lucyos.ai",
    "ainalyst-api.xyz",
    "pay.lnpay.ai",
    "mesh.heurist.xyz",
    "acp-x402.virtuals.io",
    "wurkapi.fun",
    "agents.memeputer.com",
    "firecrawl.dev",
    "otaku.so",
    "www.reap.deals",
    "www.qrbase.xyz",
]

SUBDOMAIN_PATTERNS = [
    "agent",
    "ai",
    "api",
    "a2a",
    "x402",
    "bot",
    "agents",
    "mcp",
]

TOP_DOMAINS_TO_PROBE = [
    "openai.com",
    "anthropic.com",
    "cohere.com",
    "google.com",
    "microsoft.com",
    "aws.amazon.com",
    "huggingface.co",
    "langchain.com",
    "llamaindex.ai",
    "crewai.com",
    "autogen.ai",
]

async def fetch_agent_card(client: httpx.AsyncClient, domain: str) -> Optional[Dict[str, Any]]:
    """Fetch agent card from a domain's .well-known path"""
    urls_to_try = [
        f"https://{domain}/.well-known/agent-card.json",
        f"https://{domain}/.well-known/agent.json",
        f"https://www.{domain}/.well-known/agent-card.json",
    ]
    
    for url in urls_to_try:
        try:
            response = await client.get(url, timeout=10.0, follow_redirects=True)
            if response.status_code == 200:
                try:
                    data = response.json()
                    print(f"✅ Found agent card at {url}")
                    return {"url": url, "domain": domain, "card": data}
                except json.JSONDecodeError:
                    pass
        except Exception as e:
            pass
    return None

async def probe_for_402(client: httpx.AsyncClient, domain: str) -> Optional[Dict[str, Any]]:
    """Probe a domain for x402 payment endpoints"""
    endpoints_to_try = [
        f"https://{domain}/",
        f"https://{domain}/api",
        f"https://{domain}/ping",
        f"https://{domain}/x402",
    ]
    
    for url in endpoints_to_try:
        try:
            response = await client.post(url, timeout=10.0, follow_redirects=True)
            if response.status_code == 402:
                try:
                    data = response.json()
                    if "x402Version" in data or "accepts" in data:
                        print(f"💰 Found x402 endpoint at {url}")
                        return {"url": url, "domain": domain, "x402_data": data}
                except json.JSONDecodeError:
                    pass
        except Exception as e:
            pass
    return None

async def query_registry(client: httpx.AsyncClient, registry_url: str) -> List[Dict[str, Any]]:
    """Query an A2A registry for agents"""
    agents = []
    try:
        response = await client.get(f"{registry_url}/agents", timeout=15.0)
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                agents = data
            elif isinstance(data, dict) and "agents" in data:
                agents = data["agents"]
            print(f"📋 Found {len(agents)} agents in registry {registry_url}")
    except Exception as e:
        print(f"⚠️ Could not query registry {registry_url}: {e}")
    return agents

async def discover_agents_sdk() -> List[Dict[str, Any]]:
    """Use python-a2a SDK for discovery"""
    discovered = []
    if not HAS_A2A_SDK:
        return discovered
    
    try:
        for registry_url in KNOWN_REGISTRIES:
            try:
                registry = AgentRegistry(registry_url)
                agents = list(registry.get_all_agents())
                for agent in agents:
                    discovered.append({
                        "source": "a2a_sdk",
                        "registry": registry_url,
                        "agent": agent
                    })
                print(f"🔍 SDK discovered {len(agents)} agents from {registry_url}")
            except Exception as e:
                print(f"⚠️ SDK registry error {registry_url}: {e}")
    except Exception as e:
        print(f"⚠️ SDK discovery failed: {e}")
    
    return discovered

async def discover_via_subdomain_probing(client: httpx.AsyncClient) -> List[Dict[str, Any]]:
    """Probe subdomains of major domains for agent cards"""
    discovered = []
    
    for base_domain in TOP_DOMAINS_TO_PROBE:
        for pattern in SUBDOMAIN_PATTERNS:
            subdomain = f"{pattern}.{base_domain}"
            card = await fetch_agent_card(client, subdomain)
            if card:
                discovered.append({
                    "source": "subdomain_probe",
                    "type": "agent_card",
                    **card
                })
            
            x402 = await probe_for_402(client, subdomain)
            if x402:
                discovered.append({
                    "source": "subdomain_probe",
                    "type": "x402_endpoint",
                    **x402
                })
    
    return discovered

async def main():
    print("=" * 60)
    print("A2A Agent Discovery Tool")
    print(f"Started: {datetime.now().isoformat()}")
    print("=" * 60)
    
    all_discovered = []
    
    async with httpx.AsyncClient(
        headers={"User-Agent": "CoinRailz-AgentDiscovery/1.0"},
        verify=True
    ) as client:
        
        print("\n📡 Phase 1: Probing known agent domains...")
        tasks = [fetch_agent_card(client, domain) for domain in KNOWN_AGENT_DOMAINS]
        results = await asyncio.gather(*tasks)
        for result in results:
            if result:
                all_discovered.append({
                    "source": "known_domain",
                    "type": "agent_card",
                    **result
                })
        
        print(f"\n📡 Phase 2: Probing for x402 endpoints...")
        tasks = [probe_for_402(client, domain) for domain in KNOWN_AGENT_DOMAINS]
        results = await asyncio.gather(*tasks)
        for result in results:
            if result:
                all_discovered.append({
                    "source": "known_domain",
                    "type": "x402_endpoint",
                    **result
                })
        
        print(f"\n📡 Phase 3: Querying known registries...")
        for registry in KNOWN_REGISTRIES:
            agents = await query_registry(client, registry)
            for agent in agents:
                all_discovered.append({
                    "source": "registry",
                    "registry": registry,
                    "agent": agent
                })
        
        print(f"\n📡 Phase 4: Using A2A SDK discovery...")
        sdk_agents = await discover_agents_sdk()
        all_discovered.extend(sdk_agents)
        
        print(f"\n📡 Phase 5: Subdomain enumeration...")
        subdomain_agents = await discover_via_subdomain_probing(client)
        all_discovered.extend(subdomain_agents)
    
    print("\n" + "=" * 60)
    print(f"Discovery Complete: {len(all_discovered)} agents/endpoints found")
    print("=" * 60)
    
    output_file = "discovered_agents.json"
    with open(output_file, "w") as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "total_found": len(all_discovered),
            "agents": all_discovered
        }, f, indent=2, default=str)
    
    print(f"\n💾 Results saved to {output_file}")
    
    by_source = {}
    for agent in all_discovered:
        source = agent.get("source", "unknown")
        by_source[source] = by_source.get(source, 0) + 1
    
    print("\n📊 Summary by source:")
    for source, count in by_source.items():
        print(f"  - {source}: {count}")
    
    return all_discovered

if __name__ == "__main__":
    asyncio.run(main())
