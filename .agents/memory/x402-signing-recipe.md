---
name: x402 v2 EIP-3009 signing recipe
description: Correct X-PAYMENT header format, signing steps, and execution_guide implementation for x402 v2
---

## The Rule

X-PAYMENT is NOT a raw on-chain tx hash. It is:
`base64(JSON.stringify({x402Version:2, scheme:'exact', network:'eip155:8453', payload:{authorization:{from,to,value,validAfter,validBefore,nonce}, signature}}))`

Signing is off-chain EIP-712 — no gas, no on-chain tx before the facilitator settles.

**Why:** The old guide said `<tx_hash_or_eip3009_payload>` which was actively misleading agents into sending raw tx hashes and failing. This was identified as the primary reason 402-reading agents did not convert to payments.

## How to Apply

In `buildExecutionGuide()` (`server/middleware/paymentOrchestrator.ts` ~line 2654):
- `signingNote`: explains the correct header format and what it is NOT
- `steps`: 5 concrete steps with real amount values, base64 envelope format spelled out
- `pythonExample`: complete eth_account EIP-712 flow (pip install requests eth-account), `Account.sign_typed_data(wallet.key, domain, types, auth)`, then base64 encode the envelope
- `typescriptExample`: `wrapFetchWithPayment(fetch, walletClient)` from x402-fetch + viem (SDK handles all signing automatically)
- `curlNote`: honest note that curl cannot sign EIP-712 inline; compute header with Python first

## EIP-712 Domain for Base USDC
```
{name:'USD Coin', version:'2', chainId:8453, verifyingContract:'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'}
```
Type: `TransferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce)`

## Python Signing (canonical)
```python
sig = Account.sign_typed_data(wallet.key, domain_data, message_types, message_data)
# domain_data = dict (without EIP712Domain key)
# message_types = {'TransferWithAuthorization': [{name,type},...]} (no EIP712Domain)
# message_data = auth dict
# sig.signature.hex() gives the 0x... signature string
```

## BizDev Context
Python is the primary guide language (python-httpx/0.28.1 was the 30+ hour active evaluator). TypeScript (x402-fetch SDK) is the recommended automated path. Browser wallets need different treatment (eth_signTypedData_v4, user approval required) — offer API key / credits as the non-wallet alternative.
