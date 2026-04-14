// Copyright (c) 2025 ObjectUI. Licensed under the MIT license.

/**
 * Vercel Serverless Function Entrypoint
 *
 * Boots the ObjectStack kernel with Hono adapter and exports a Vercel-compatible
 * handler using @hono/node-server's getRequestListener().
 *
 * This file is bundled by scripts/bundle-api.mjs during the Vercel build step
 * and becomes the self-contained API handler at api/_handler.js.
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// @ts-ignore
globalThis.require = require;

// @ts-ignore
import { Kernel } from '@objectstack/runtime';
// @ts-ignore
import { createHonoApp } from '@objectstack/hono';
import { getRequestListener } from '@hono/node-server';
// @ts-ignore
import config from '../objectstack.config';

let kernel: any = null;
let app: any = null;

/**
 * Initialize the kernel and Hono app (happens once on cold start)
 */
async function initializeApp() {
  if (app) return app;

  console.log('[server] Initializing ObjectStack kernel...');

  // Boot the kernel with all plugins
  kernel = new Kernel();
  await kernel.boot(config);

  console.log('[server] Creating Hono app...');

  // Create Hono app from kernel
  app = createHonoApp(kernel);

  console.log('[server] Server initialized successfully');

  return app;
}

/**
 * Vercel serverless function handler
 *
 * Vercel calls this function for each request. We initialize once on cold start
 * and reuse the kernel/app for subsequent requests in the same container.
 */
export default async function handler(req: any, res: any) {
  try {
    // Initialize on first request (cold start)
    const honoApp = await initializeApp();

    // Convert Vercel request to Node.js request listener format
    const requestListener = getRequestListener(honoApp.fetch);

    // Handle the request
    return requestListener(req, res);
  } catch (error) {
    console.error('[server] Fatal error:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }));
  }
}
