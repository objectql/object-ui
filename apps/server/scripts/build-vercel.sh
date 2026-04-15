#!/usr/bin/env bash
set -euo pipefail

# Build script for Vercel deployment of @object-ui/server.
#
# Follows the Vercel deployment pattern:
#   - api/[[...route]].js is committed to the repo (Vercel detects it pre-build)
#   - esbuild bundles server/index.ts → api/_handler.js (self-contained bundle)
#   - The committed .js wrapper re-exports from _handler.js at runtime
#   - Console SPA is built and copied to public/ for serving the UI
#
# Steps:
#   1. Build the project with pnpm (includes console)
#   2. Bundle the API serverless function (→ api/_handler.js)
#   3. Copy console dist files to public/ for UI serving

echo "[build-vercel] Starting server build..."

# 1. Build workspace dependencies and console
# With filtered install, we only have server and console dependencies installed
cd ../..
echo "[build-vercel] Building workspace dependencies for console..."
pnpm --filter '@object-ui/*' --filter '!@object-ui/console' --filter '!@object-ui/server' --filter '!@object-ui/site' run build || true
echo "[build-vercel] Building console..."
pnpm --filter @object-ui/console run build
cd apps/server

# 2. Bundle API serverless function
echo "[build-vercel] Bundling API serverless function..."
node scripts/bundle-api.mjs

# 3. Copy console dist files to public/ for UI serving
echo "[build-vercel] Copying console dist to public/..."
rm -rf public
mkdir -p public
if [ -d "../console/dist" ]; then
  cp -r ../console/dist/* public/
  echo "[build-vercel]   ✓ Copied console dist to public/"
else
  echo "[build-vercel]   ⚠ Console dist not found (skipped)"
fi

echo "[build-vercel] Done. Static files in public/, serverless function in api/[[...route]].js → api/_handler.js"
