---
title: Deployment
description: "Deploy ObjectUI applications to Docker, Vercel, Railway, Netlify, and other platforms with production-ready configurations."
---

# Deployment

ObjectUI apps are standard Vite + React applications, so they can be deployed anywhere that serves static files or runs Node.js containers. This guide provides copy-paste-ready configurations for the most popular platforms.

## Prerequisites

- A production build: `pnpm build` (runs `turbo run build` across all packages)
- The build output lives in `apps/console/dist/` (or your app's `dist/` folder)
- Environment variables configured for your target environment

## Docker

Create a multi-stage `Dockerfile` at the project root:

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/ packages/
COPY apps/ apps/
RUN pnpm install --frozen-lockfile
RUN pnpm build

# Stage 2: Serve
FROM nginx:alpine AS runner
COPY --from=builder /app/apps/console/dist /usr/share/nginx/html
COPY <<'EOF' /etc/nginx/conf.d/default.conf
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
}
EOF

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

Build and run:

```bash
docker build -t objectui-app .
docker run -p 3000:80 objectui-app
```

## Vercel

Create `vercel.json` in the project root:

```json
{
  "buildCommand": "pnpm build",
  "outputDirectory": "apps/console/dist",
  "installCommand": "pnpm install --frozen-lockfile",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

Deploy with the Vercel CLI:

```bash
npx vercel --prod
```

> **Note:** Set the **Root Directory** to the repository root so the monorepo workspace resolves correctly.

## Railway

Create `railway.json` in the project root:

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "corepack enable && pnpm install --frozen-lockfile && pnpm build"
  },
  "deploy": {
    "startCommand": "npx serve apps/console/dist -s -l tcp://0.0.0.0:$PORT",
    "healthcheckPath": "/",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

Push to your linked Railway project:

```bash
railway up
```

## Netlify

Create `netlify.toml` in the project root:

```toml
[build]
  command = "pnpm install --frozen-lockfile && pnpm build"
  publish = "apps/console/dist"

[build.environment]
  NODE_VERSION = "20"
  PNPM_VERSION = "9"

# SPA fallback — redirect all routes to index.html
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/assets/*"
  [headers.values]
    Cache-Control = "public, max-age=31536000, immutable"
```

Deploy with the Netlify CLI:

```bash
npx netlify deploy --prod
```

## Environment Variables

ObjectUI uses Vite's `import.meta.env` for build-time configuration. Prefix all custom variables with `VITE_`.

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_USE_MOCK_SERVER` | `"true"` | Enable MSW mock server for local development. Set to `"false"` for production builds that hit a real API. |
| `VITE_API_URL` | — | Base URL for the ObjectStack API (e.g. `https://api.example.com`). |
| `NODE_ENV` | `"development"` | Set automatically to `"production"` by `vite build`. |

Create a `.env.production` file for production defaults:

```bash
VITE_USE_MOCK_SERVER=false
VITE_API_URL=https://api.example.com
```

For platform-specific configuration, set environment variables in each platform's dashboard or CLI:

```bash
# Vercel
vercel env add VITE_API_URL production

# Railway
railway variables set VITE_API_URL=https://api.example.com

# Netlify
netlify env:set VITE_API_URL https://api.example.com
```

> **Tip:** The console app ships with MSW enabled by default. Always set `VITE_USE_MOCK_SERVER=false` in production to disable the mock service worker.

## Build Optimization

### Gzip and Brotli Compression

Add the `vite-plugin-compression` plugin for pre-compressed assets:

```bash
pnpm add -D vite-plugin-compression
```

```ts
// vite.config.ts
import compression from 'vite-plugin-compression';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    compression({ algorithm: 'gzip' }),       // .gz files
    compression({ algorithm: 'brotliCompress', ext: '.br' }),  // .br files
  ],
});
```

### Code Splitting

Vite splits chunks automatically. For ObjectUI plugins, use dynamic imports to keep the initial bundle small:

```tsx
import { createLazyPlugin } from '@object-ui/react';

const ObjectGrid = createLazyPlugin(
  () => import('@object-ui/plugin-grid'),
  { fallback: <div>Loading grid...</div> }
);
```

### Bundle Analysis

Visualize your bundle to find optimization opportunities:

```bash
pnpm add -D rollup-plugin-visualizer
```

```ts
// vite.config.ts
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    visualizer({ open: true, gzipSize: true }),
  ],
});
```

### Production Build Command

Build without the mock server and verify the output:

```bash
VITE_USE_MOCK_SERVER=false pnpm build
```

This is equivalent to the `build:server` script defined in the console app.

## Health Checks

For containerized deployments, add a lightweight health check endpoint. Create `public/health.json` in your app:

```json
{ "status": "ok" }
```

This file is copied to the build output as-is by Vite. Point your health check to `/health.json`:

```dockerfile
# Docker HEALTHCHECK
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:80/health.json || exit 1
```

```json
// railway.json (excerpt)
{
  "deploy": {
    "healthcheckPath": "/health.json"
  }
}
```

For platforms that expect an HTTP 200 on `/`, the SPA `index.html` fallback already handles this.

## Next Steps

- [CI/CD Pipeline](/docs/guide/ci-cd-pipeline) — Understand the automated build and release workflows
- [Architecture Overview](/docs/guide/architecture) — How ObjectUI packages fit together
- [Quick Start](/docs/guide/quick-start) — Set up a new ObjectUI project from scratch
- [Theming](/docs/guide/theming) — Customize the look-and-feel before deploying
