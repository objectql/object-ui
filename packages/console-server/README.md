# @object-ui/console-server

ObjectStack Console Server Plugin — serves the ObjectUI Console as a Hono middleware in ObjectStack servers.

## Overview

This package allows any ObjectStack project to embed the full ObjectUI Console
admin interface by simply registering a plugin with the kernel. When loaded, the
console UI is served as static files through the Hono HTTP server.

## Installation

```bash
pnpm add @object-ui/console-server
```

## Usage

### Basic (serve at root `/`)

```ts
import { ObjectKernel } from '@objectstack/core';
import { HonoServerPlugin } from '@objectstack/plugin-hono-server';
import { ConsolePlugin } from '@object-ui/console-server';

const kernel = new ObjectKernel();

// ... register other plugins (ObjectQL, drivers, etc.)

const serverPlugin = new HonoServerPlugin({ port: 3000 });
await kernel.use(serverPlugin);

const consolePlugin = new ConsolePlugin();
await kernel.use(consolePlugin);

await kernel.bootstrap();
// Console available at http://localhost:3000/
```

### Mount at a sub-path

```ts
const consolePlugin = new ConsolePlugin({ basePath: '/console' });
await kernel.use(consolePlugin);
// Console available at http://localhost:3000/console
```

### Custom client path

```ts
const consolePlugin = new ConsolePlugin({
  clientPath: './my-console-dist',
});
await kernel.use(consolePlugin);
```

## Options

| Option | Type | Default | Description |
|---|---|---|---|
| `basePath` | `string` | `'/'` | URL path where the console is mounted |
| `clientPath` | `string` | (auto-detected) | Path to the built console static files |
| `compression` | `boolean` | `true` | Serve pre-compressed `.gz`/`.br` files when available |
| `assetCacheControl` | `string` | `'public, max-age=31536000, immutable'` | Cache-Control for static assets |
| `indexCacheControl` | `string` | `'no-cache'` | Cache-Control for index.html |

## Building

### In the monorepo

```bash
# Build the console app first
pnpm --filter @object-ui/console build

# Build this package (compile TS)
pnpm --filter @object-ui/console-server build

# Copy console dist into this package for publishing
pnpm --filter @object-ui/console-server build:client
```

### For publishing

```bash
pnpm --filter @object-ui/console-server build:all
```

## How It Works

1. The plugin registers with the ObjectStack kernel
2. On `start()`, it locates the Hono app via the `http-server` service
3. It resolves the console client files (bundled `client/` dir or `apps/console/dist`)
4. Static file routes are registered on the Hono app with proper MIME types and caching
5. A SPA fallback ensures all non-file routes serve `index.html` for client-side routing
