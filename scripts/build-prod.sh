#!/bin/sh
set -e

echo "🔨 Building frontend..."
npx vite build

echo "🔨 Building server (heavy bundle)..."
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

echo "🔨 Building production entry (lightweight bootstrap)..."
npx esbuild server/prodEntry.ts --platform=node --packages=external --external:./index.js --bundle --format=esm --outdir=dist

echo "✅ Production build complete"
ls -lh dist/prodEntry.js dist/index.js
