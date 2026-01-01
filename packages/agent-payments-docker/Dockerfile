# Coin Railz Agent Payments - Docker Container
# Non-custodial USDC payments for AI agents with bundled intelligence services

FROM node:20-alpine AS builder

WORKDIR /app

# Copy SDK source
COPY package*.json ./
COPY tsconfig.json ./
COPY src/ ./src/

# Install ALL dependencies (including devDependencies for TypeScript build)
RUN npm install && npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

# Security: Run as non-root user
RUN addgroup -g 1001 coinrailz && \
    adduser -u 1001 -G coinrailz -s /bin/sh -D coinrailz

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV COINRAILZ_API_KEY=""
ENV COINRAILZ_BASE_URL="https://coinrailz.com"

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Switch to non-root user
USER coinrailz

EXPOSE 3000

CMD ["node", "dist/server.js"]
