/**
 * ObjectStack Console Plugin
 *
 * Serves the pre-built Console SPA as a static UI plugin.
 * When registered alongside HonoServerPlugin, it mounts the SPA at `/console`
 * with static asset serving and SPA fallback routing.
 *
 * Usage in any ObjectStack application:
 *
 *   import ConsolePlugin from '@object-ui/console';
 *
 *   export default defineStack({
 *     plugins: [
 *       new HonoServerPlugin({ port: 3000 }),
 *       ConsolePlugin,
 *     ],
 *   });
 *
 * Then visit http://localhost:3000/console
 *
 * @see https://github.com/objectstack-ai/objectui
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync, readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Absolute path to the built SPA assets (dist/) */
export const staticPath = resolve(__dirname, 'dist');

/** URL mount path for the console */
export const mountPath = '/console';

export interface ConsolePluginOptions {
  /** Override the mount path (default: '/console') */
  path?: string;
}

function createConsolePlugin(options?: ConsolePluginOptions) {
  const basePath = options?.path || mountPath;

  return {
    name: '@object-ui/console',
    version: '1.0.0',
    type: 'ui-plugin' as const,
    slug: 'console',
    staticPath,
    default: true, // Redirect / → /console
    description: 'ObjectStack Console - The standard runtime UI for ObjectStack applications',

    init() {
      // No initialization needed
    },

    async start(ctx: any) {
      const httpService = ctx.getService?.('http-server') || ctx.getService?.('http.server');
      if (!httpService || typeof httpService.getRawApp !== 'function') {
        const logger = ctx.logger || console;
        logger.warn('[Console] HTTP server not available. SPA routes not registered.');
        return;
      }

      const app = httpService.getRawApp();
      const logger = ctx.logger || console;
      const distDir = staticPath;

      if (!existsSync(distDir)) {
        logger.warn(`[Console] dist/ not found at ${distDir}. Run "pnpm build" first.`);
        return;
      }

      // Try to use @hono/node-server/serve-static for efficient file serving
      let serveStatic: any;
      try {
        const mod = await import('@hono/node-server/serve-static');
        serveStatic = mod.serveStatic;
      } catch {
        // Fallback: manual file serving if @hono/node-server not available
        serveStatic = null;
      }

      if (serveStatic) {
        // Serve static assets: /console/assets/* → dist/assets/*
        app.use(`${basePath}/*`, serveStatic({
          root: distDir,
          rewriteRequestPath: (reqPath: string) => reqPath.replace(new RegExp(`^${basePath}`), ''),
        }));

        // SPA fallback: any non-file route under /console → dist/index.html
        app.get(`${basePath}/*`, serveStatic({
          root: distDir,
          rewriteRequestPath: () => '/index.html',
        }));
      } else {
        // Manual fallback when serveStatic is unavailable
        const indexPath = resolve(distDir, 'index.html');

        app.get(`${basePath}/*`, async (c: any) => {
          const reqPath = c.req.path.replace(new RegExp(`^${basePath}`), '');
          const filePath = resolve(distDir, reqPath.replace(/^\//, ''));

          // Try to serve the exact file first
          if (existsSync(filePath) && !filePath.endsWith('/')) {
            const ext = filePath.split('.').pop() || '';
            const mimeTypes: Record<string, string> = {
              js: 'application/javascript',
              css: 'text/css',
              json: 'application/json',
              html: 'text/html',
              svg: 'image/svg+xml',
              png: 'image/png',
              ico: 'image/x-icon',
              woff2: 'font/woff2',
              woff: 'font/woff',
              gz: 'application/gzip',
              br: 'application/x-brotli',
            };
            const contentType = mimeTypes[ext] || 'application/octet-stream';
            const content = readFileSync(filePath);
            return c.body(content, 200, { 'Content-Type': contentType });
          }

          // SPA fallback: return index.html
          if (existsSync(indexPath)) {
            return c.html(readFileSync(indexPath, 'utf-8'));
          }
          return c.text('Console not built. Run: pnpm --filter @object-ui/console build', 404);
        });
      }

      // Redirect root → /console
      app.get('/', (c: any) => c.redirect(basePath));

      logger.info(`[Console] SPA mounted at ${basePath}`);
    },

    metadata: {
      author: 'ObjectUI Team',
      license: 'MIT',
      homepage: 'https://www.objectui.org',
      repository: 'https://github.com/objectstack-ai/objectui',
      capabilities: [
        'ui-rendering',
        'crud-operations',
        'multi-app-support',
        'dynamic-navigation',
        'theme-support',
      ],
    },
  };
}

/** Pre-configured console plugin instance (mounted at /console) */
const ConsolePlugin = createConsolePlugin();

export { createConsolePlugin };
export default ConsolePlugin;
