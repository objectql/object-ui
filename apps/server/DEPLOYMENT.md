# Deploying ObjectUI Server to Vercel

This guide demonstrates how to deploy the ObjectUI production server to Vercel using Hono.

## Prerequisites

1. A Vercel account
2. Vercel CLI installed (optional): `npm i -g vercel`

## Environment Variables

Set the following environment variables in your Vercel project:

### Required

- **`AUTH_SECRET`**: A secure random string (minimum 32 characters) for authentication
  - Generate with: `openssl rand -base64 32`
  - Example: `AUTH_SECRET=abc123def456...` (min 32 chars)

### Optional

- **`NEXT_PUBLIC_BASE_URL`**: Your application's base URL (auto-detected from `VERCEL_URL` if not set)
  - Example: `NEXT_PUBLIC_BASE_URL=https://objectui.example.com`

## Deployment Steps

### Option 1: Using Vercel Dashboard (Recommended)

1. **Import Repository**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import your fork of `objectstack-ai/objectui`

2. **Configure Project**
   - Framework Preset: **Other** (vercel.json handles configuration)
   - Root Directory: `apps/server`
   - Build Command: (leave default - uses vercel.json)
   - Output Directory: (leave default - uses vercel.json)

3. **Set Environment Variables**
   - Go to Project Settings → Environment Variables
   - Add `AUTH_SECRET` with a secure 32+ character string
   - Optionally add `NEXT_PUBLIC_BASE_URL` for custom domains

4. **Deploy**
   - Click "Deploy"
   - Wait for build to complete (~3-5 minutes)

### Option 2: Using Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Navigate to Server Directory**
   ```bash
   cd apps/server
   ```

3. **Login to Vercel**
   ```bash
   vercel login
   ```

4. **Deploy**
   ```bash
   # Preview deployment
   vercel

   # Production deployment
   vercel --prod
   ```

5. **Set Environment Variables**
   ```bash
   vercel env add AUTH_SECRET production
   # Enter your secret when prompted (min 32 chars)

   # Optional: set base URL for custom domain
   vercel env add NEXT_PUBLIC_BASE_URL production
   ```

6. **Redeploy with Environment Variables**
   ```bash
   vercel --prod
   ```

## Build Configuration

The build is configured in `vercel.json`:

- **Install Command**: `cd ../.. && pnpm install --frozen-lockfile`
  - Installs monorepo dependencies from root
- **Build Command**: `bash scripts/build-vercel.sh`
  - Builds Console in server mode
  - Bundles API serverless function
  - Copies Console assets to public/
- **Framework**: `null` (custom serverless function)
- **Build Environment Variables**:
  - `VITE_RUNTIME_MODE=server`: Console connects to API
  - `VITE_SERVER_URL=""`: Same-origin API requests
  - `VITE_USE_MOCK_SERVER=false`: Disable MSW

## How It Works

### 1. Build Process (`scripts/build-vercel.sh`)

1. **Build Console**:
   - Runs `pnpm --filter @object-ui/console run build`
   - Console is built with `VITE_RUNTIME_MODE=server` (set in vercel.json)
   - Produces static assets in `apps/console/dist/`

2. **Bundle API**:
   - Runs `node scripts/bundle-api.mjs`
   - Uses esbuild to bundle `server/index.ts` → `api/_handler.js`
   - All dependencies are inlined (self-contained bundle)

3. **Copy Assets**:
   - Copies `apps/console/dist/*` to `apps/server/public/`
   - Console UI is served as static files

### 2. API Handler (`api/[[...route]].js`)

- Committed catch-all route handler
- Delegates to bundled handler (`api/_handler.js`)
- Vercel detects this file pre-build and creates a serverless function

### 3. Server Entrypoint (`server/index.ts`)

- Boots ObjectStack kernel with all plugins
- Creates Hono app using `@objectstack/hono` adapter
- Uses `@hono/node-server`'s `getRequestListener()` for Vercel compatibility
- Handles initialization once on cold start, reuses kernel for subsequent requests

### 4. Console UI (Frontend SPA)

- Built with Vite in server mode (not MSW mode)
- Served as static files from `public/` directory
- All API requests go to `/api/v1/*` endpoints
- SPA fallback via Vercel rewrite rules

## Deployment Architecture

```
Vercel Deployment
├── Serverless Function (Node.js)
│   ├── api/[[...route]].js → api/_handler.js
│   ├── ObjectStack Kernel (runtime)
│   ├── Hono HTTP Server
│   └── API Routes (/api/v1/*)
│
└── Static Files (CDN)
    ├── public/index.html
    ├── public/assets/*
    └── SPA Routing (fallback to index.html)
```

### Request Flow

1. **Browser → `/` or `/apps/*`**
   - Vercel CDN serves static files
   - SPA router handles client-side navigation

2. **Browser → `/api/v1/*`**
   - Routed to serverless function
   - Kernel processes request via Hono
   - Returns JSON response

## Testing Locally

Before deploying, test locally:

```bash
# Install dependencies
pnpm install

# Build the application
cd apps/server
bash scripts/build-vercel.sh

# Start local server
pnpm dev

# Test endpoints
curl http://localhost:3000/api/v1/discovery
curl http://localhost:3000/api/v1/meta/objects
```

## Accessing the Application

After deployment, your application will be available at:

- **Console UI**: `https://your-app.vercel.app/`
- **API Discovery**: `https://your-app.vercel.app/api/v1/discovery`
- **Metadata API**: `https://your-app.vercel.app/api/v1/meta/objects`
- **Data API**: `https://your-app.vercel.app/api/v1/data/:object`

## Custom Domains

### Add Custom Domain

1. Go to Project Settings → Domains
2. Add your domain (e.g., `objectui.example.com`)
3. Configure DNS as instructed by Vercel
4. Update `NEXT_PUBLIC_BASE_URL` environment variable
5. Redeploy: `vercel --prod`

## Troubleshooting

### Build Fails

**Symptoms**: Build fails with dependency errors

**Solutions**:
- Ensure `pnpm-lock.yaml` is committed
- Check build logs for specific error messages
- Verify all workspace dependencies are available
- Try: `pnpm install --frozen-lockfile` locally first

### Runtime Errors

**Symptoms**: 500 errors, function timeouts

**Solutions**:
- Check function logs in Vercel dashboard
- Verify `AUTH_SECRET` is set correctly
- Ensure `AUTH_SECRET` is at least 32 characters
- Check cold start time (increase `maxDuration` if needed)

### Console Still in MSW Mode

**Symptoms**: Console shows "Using Mock Service Worker" instead of connecting to API

**Solutions**:
- Verify `vercel.json` includes `build.env` with `VITE_RUNTIME_MODE=server`
- Check build logs show "VITE_RUNTIME_MODE=server" during Console build
- Open browser DevTools Console and look for `[Console Config]` log
- Clear Vercel build cache: `vercel --force`

### Authentication Issues

**Symptoms**: Login fails, session not persisted

**Solutions**:
- Verify `AUTH_SECRET` is set and is at least 32 characters
- Check `NEXT_PUBLIC_BASE_URL` matches your actual domain
- Ensure cookies are not blocked by browser
- Check if HTTPS is enabled (required for secure cookies)

### API 404 Errors

**Symptoms**: API requests return 404

**Solutions**:
- Verify `api/[[...route]].js` is committed
- Check `vercel.json` rewrites configuration
- Ensure serverless function deployed correctly
- Test API endpoint directly: `/api/v1/discovery`

### Memory/Timeout Issues

**Symptoms**: Function runs out of memory or times out

**Solutions**:
- Increase `memory` in `vercel.json` (default: 1024MB)
- Increase `maxDuration` in `vercel.json` (default: 60s)
- Check for memory leaks in custom code
- Consider using a database instead of in-memory driver

## Production Considerations

### Database

The server uses an in-memory database by default. For production:

1. **Add a Database Driver**:
   ```bash
   pnpm add @objectstack/driver-turso
   # or @objectstack/driver-postgres, etc.
   ```

2. **Update `objectstack.config.ts`**:
   ```typescript
   import { TursoDriver } from '@objectstack/driver-turso';

   const plugins = [
     // Replace InMemoryDriver
     new DriverPlugin(new TursoDriver({
       url: process.env.TURSO_DATABASE_URL,
       authToken: process.env.TURSO_AUTH_TOKEN,
     }), 'turso'),
     // ... rest
   ];
   ```

3. **Set Environment Variables**:
   ```bash
   vercel env add TURSO_DATABASE_URL production
   vercel env add TURSO_AUTH_TOKEN production
   ```

### Monitoring

- Enable Vercel Analytics for performance monitoring
- Set up log drains for centralized logging
- Monitor function execution time and memory usage
- Set up alerts for errors and timeouts

### Security

- **Always** use a strong `AUTH_SECRET` (32+ random characters)
- Enable HTTPS (automatic on Vercel)
- Set up rate limiting if needed
- Review and audit authentication logic
- Keep dependencies up to date

## Advanced Configuration

### Changing Serverless Function Settings

Edit `vercel.json`:

```json
{
  "functions": {
    "api/**/*.js": {
      "memory": 2048,        // Increase memory
      "maxDuration": 120,    // Increase timeout
      "runtime": "nodejs20.x" // Specify Node.js version
    }
  }
}
```

### Adding Environment-Specific Configs

Use Vercel environment variables with different values for preview/production:

```bash
vercel env add MY_CONFIG production
vercel env add MY_CONFIG preview
```

## References

- [Vercel Hono Documentation](https://vercel.com/docs/frameworks/backend/hono)
- [ObjectUI Documentation](https://www.objectui.org)
- [ObjectStack Framework](https://github.com/objectstack-ai/framework)
- [Vercel Serverless Functions](https://vercel.com/docs/functions/serverless-functions)
