# ObjectUI Production Server

This is the production backend server for ObjectUI that serves the Console frontend and provides REST APIs for ObjectStack applications.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/objectstack-ai/objectui/tree/main/apps/server&project-name=objectui-server&repository-name=objectui-server)

## Features

- **Dynamic Schema Loading**: Loads CRM, Todo, and Kitchen Sink apps as plugins
- **Unified Metadata API**: `/api/v1/meta/objects`
- **Unified Data API**: `/api/v1/data/:object` (CRUD operations)
- **Console UI**: Serves the ObjectUI Console frontend at `/`
- **Zero-Code Backend**: No need to create routes or controllers per object
- **Vercel Deployment**: Ready-to-deploy to Vercel with Hono adapter
- **In-Memory Database**: Uses ObjectStack's in-memory driver (configurable for production databases)

## Architecture

```
apps/server/
├── api/
│   ├── [[...route]].js      # Committed entry point for Vercel
│   └── _handler.js           # Generated bundle (not committed)
├── server/
│   └── index.ts              # Server implementation
├── scripts/
│   ├── build-vercel.sh       # Vercel build script
│   └── bundle-api.mjs        # API bundler configuration
├── objectstack.config.ts     # Server configuration
├── package.json
├── vercel.json               # Vercel deployment config
└── tsconfig.json
```

## Setup

### Prerequisites

- Node.js 18+ and pnpm 8+
- All dependencies installed in the workspace root

### Install & Run Locally

1. Install dependencies from workspace root:
   ```bash
   corepack enable && pnpm install
   ```

2. Run the development server:
   ```bash
   cd apps/server
   pnpm dev
   ```

   Server starts at http://localhost:3000
   - Console UI: http://localhost:3000/
   - API Discovery: http://localhost:3000/api/v1/discovery
   - Metadata API: http://localhost:3000/api/v1/meta/objects

3. Build for production:
   ```bash
   pnpm build
   ```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

### Quick Deploy to Vercel

1. Click the "Deploy with Vercel" button above, or:
   ```bash
   npm i -g vercel
   cd apps/server
   vercel
   ```

2. Set environment variables in Vercel dashboard:
   - `AUTH_SECRET`: A secure random string (minimum 32 characters)
   - Optional: `NEXT_PUBLIC_BASE_URL` for custom domains

3. Deploy:
   ```bash
   vercel --prod
   ```

## API Usage Examples

### 1. Get All Objects
```bash
curl http://localhost:3000/api/v1/meta/objects
```

Returns JSON array of loaded object definitions from all apps.

### 2. Create a Todo
```bash
curl -X POST http://localhost:3000/api/v1/data/todo_task \
  -H "Content-Type: application/json" \
  -d '{"title": "Buy Milk", "priority": "high"}'
```

### 3. List Todos
```bash
curl http://localhost:3000/api/v1/data/todo_task
```

### 4. Get Object Metadata
```bash
curl http://localhost:3000/api/v1/meta/objects/todo_task
```

## Configuration

### Environment Variables

Create a `.env` file (see `.env.example`):

```bash
# Required in production
AUTH_SECRET=your-secret-key-min-32-characters

# Optional - auto-detected on Vercel
NEXT_PUBLIC_BASE_URL=https://your-domain.com
```

### Adding More Apps

Edit `objectstack.config.ts` and add more AppPlugin instances:

```typescript
import myAppConfig from '@my-org/my-app/objectstack.config';

const plugins = [
  // ... existing plugins
  new AppPlugin(prepareConfig(resolveDefault(myAppConfig))),
];
```

## How It Works

### Build Process

1. **Console Build**: Console is built with `VITE_RUNTIME_MODE=server` (connects to API instead of MSW)
2. **API Bundle**: `server/index.ts` is bundled into `api/_handler.js` with all dependencies inlined
3. **Static Assets**: Console dist files are copied to `public/` directory

### Runtime

1. **Serverless Function**: Vercel calls `api/[[...route]].js` which delegates to `api/_handler.js`
2. **Kernel Boot**: ObjectStack kernel boots with all plugins on cold start
3. **Hono App**: Creates HTTP app using `@objectstack/hono` adapter
4. **Request Handling**: All `/api/*` requests go to serverless function, others serve static files

### Plugin Loading Order

Order is critical for proper initialization:

1. **MemoryI18nPlugin**: Registers i18n service before AppPlugin needs it
2. **ObjectQLPlugin**: Provides ObjectQL query engine
3. **DriverPlugin**: Registers in-memory database driver
4. **AppPlugins**: Load example apps (CRM, Todo, Kitchen Sink)
5. **SetupPlugin**: Must load before AuthPlugin (provides setupNav service)
6. **AuthPlugin**: Handles authentication (uses setupNav service)
7. **ConsolePlugin**: Serves the frontend UI

## Troubleshooting

### Build Fails

- Ensure all dependencies are installed: `pnpm install` from workspace root
- Check build logs in Vercel dashboard
- Verify `build-vercel.sh` is executable

### Runtime Errors

- Check function logs in Vercel dashboard
- Verify `AUTH_SECRET` is set and is at least 32 characters
- Test locally with `pnpm dev` first

### Console Shows MSW Mode

If the Console loads in Mock Service Worker mode instead of connecting to the API:

- Verify `vercel.json` includes `VITE_RUNTIME_MODE=server` in `build.env`
- Clear Vercel build cache: `vercel --force`
- Check browser DevTools Console for `[Console Config]` log

## License

MIT

## Links

- [ObjectUI Documentation](https://www.objectui.org)
- [ObjectStack Framework](https://github.com/objectstack-ai/framework)
- [Deployment Guide](./DEPLOYMENT.md)
