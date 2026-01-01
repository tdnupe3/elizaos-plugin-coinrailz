# Coin Railz Agent Payments - Docker

Docker-deployable REST API for AI Agent Payment Processing. Non-custodial USDC payments with bundled intelligence services.

## Quick Start

### Using Docker Hub

```bash
# Pull and run
docker run -p 3000:3000 \
  -e COINRAILZ_API_KEY=cr_live_... \
  coinrailz/agent-payments
```

### Using Docker Compose

```yaml
version: '3.8'
services:
  payments:
    image: coinrailz/agent-payments:latest
    ports:
      - "3000:3000"
    environment:
      - COINRAILZ_API_KEY=${COINRAILZ_API_KEY}
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/health"]
      interval: 30s
      timeout: 3s
      retries: 3
```

### Build from Source

```bash
# Clone and build
git clone https://github.com/coinrailz/agent-payments-docker.git
cd agent-payments-docker
docker build -t coinrailz/agent-payments .

# Run
docker run -p 3000:3000 -e COINRAILZ_API_KEY=cr_live_... coinrailz/agent-payments
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `COINRAILZ_API_KEY` | Yes | - | Your API key from coinrailz.com |
| `COINRAILZ_BASE_URL` | No | https://coinrailz.com | API base URL |
| `PORT` | No | 3000 | Server port |

## API Endpoints

### Health Check
```bash
curl http://localhost:3000/health
```

### Service Status
```bash
curl http://localhost:3000/status
```

### Send Payment
```bash
curl -X POST http://localhost:3000/payments/send \
  -H "Content-Type: application/json" \
  -d '{"to": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", "amount": 100}'
```

### Create Invoice
```bash
curl -X POST http://localhost:3000/payments/invoice \
  -H "Content-Type: application/json" \
  -d '{"amount": 50, "description": "AI service fee"}'
```

### Get Reports
```bash
curl "http://localhost:3000/payments/reports?period=weekly"
```

### Get Balance
```bash
curl http://localhost:3000/balance
```

### Create Wallet
```bash
curl -X POST http://localhost:3000/wallet
```

### Intelligence Service
```bash
curl -X POST http://localhost:3000/intelligence/wallet-risk \
  -H "Content-Type: application/json" \
  -d '{"address": "0x..."}'
```

## Integration Examples

### With AI Agent Framework

```python
import requests

PAYMENTS_URL = "http://localhost:3000"

class PaymentAgent:
    def send_payment(self, to: str, amount: float):
        response = requests.post(
            f"{PAYMENTS_URL}/payments/send",
            json={"to": to, "amount": amount}
        )
        return response.json()
    
    def check_balance(self):
        return requests.get(f"{PAYMENTS_URL}/balance").json()
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: coinrailz-payments
spec:
  replicas: 2
  selector:
    matchLabels:
      app: coinrailz-payments
  template:
    metadata:
      labels:
        app: coinrailz-payments
    spec:
      containers:
      - name: payments
        image: coinrailz/agent-payments:latest
        ports:
        - containerPort: 3000
        env:
        - name: COINRAILZ_API_KEY
          valueFrom:
            secretKeyRef:
              name: coinrailz-secrets
              key: api-key
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 3
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: coinrailz-payments
spec:
  ports:
  - port: 80
    targetPort: 3000
  selector:
    app: coinrailz-payments
```

## Pricing

| Tier | Volume | Processing Fee |
|------|--------|----------------|
| Starter | $0-$10K/mo | 1.5% + $0.01 |
| Growth | $10K-$100K/mo | 1.25% + $0.01 |
| Platform | $100K+/mo | 0.9% + $0.01 |

**Intelligence Bundle**: +0.35% per transaction OR $79/month flat

## Security

- Container runs as non-root user
- API key required for all payment operations
- Health check endpoint is unauthenticated
- All traffic to Coin Railz API uses HTTPS

## Transaction Limits

- **Minimum transaction**: $0.05 USDC
- **Maximum transaction**: $100,000 USDC (contact sales for higher limits)

## Refunds & Disputes

Due to the non-custodial nature of blockchain transactions:

- **Refunds are not supported** - All blockchain transactions are final and irreversible
- **Disputes**: For transaction issues, contact support@coinrailz.com with your transaction ID

## Legal

This container provides non-custodial payment routing. Coin Railz does not hold, custody, or control user funds at any time.

See [Terms of Service](https://coinrailz.com/docs/payments/terms-of-service) for full legal terms.

## Support

- Documentation: https://coinrailz.com/docs/sdk
- Discord: https://discord.gg/coinrailz
- Email: support@coinrailz.com

## License

MIT License
