import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.map': 'application/json',
  '.webp': 'image/webp',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.wasm': 'application/wasm',
  '.gz': 'application/gzip',
  '.br': 'application/x-brotli',
};

function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

/**
 * Configuration options for the ConsolePlugin.
 */
export interface ConsolePluginOptions {
  /**
   * The base URL path where the console will be served.
   * @default '/'
   * @example '/console'
   */
  basePath?: string;

  /**
   * Path to the directory containing built console static files.
   * If not provided, the plugin looks for the bundled `client/` directory
   * shipped with this package.
   */
  clientPath?: string;

  /**
   * Whether to enable gzip/brotli compressed file serving.
   * When enabled, the plugin looks for .gz and .br versions of files.
   * @default true
   */
  compression?: boolean;

  /**
   * Cache-Control header value for static assets (JS, CSS, images).
   * @default 'public, max-age=31536000, immutable'
   */
  assetCacheControl?: string;

  /**
   * Cache-Control header value for the index.html file.
   * @default 'no-cache'
   */
  indexCacheControl?: string;
}

/**
 * Resolves the path to the console client directory.
 * Checks in order:
 * 1. Explicitly provided clientPath
 * 2. Bundled `client/` directory within this package
 * 3. `apps/console/dist` relative to workspace root (monorepo development)
 */
function resolveClientPath(options: ConsolePluginOptions): string | null {
  // 1. Explicit path
  if (options.clientPath) {
    const resolved = resolve(options.clientPath);
    if (existsSync(resolved) && existsSync(join(resolved, 'index.html'))) {
      return resolved;
    }
  }

  // 2. Bundled client directory (for published package)
  try {
    const pkgDir = dirname(fileURLToPath(import.meta.url));
    const bundledClient = resolve(pkgDir, '..', 'client');
    if (existsSync(bundledClient) && existsSync(join(bundledClient, 'index.html'))) {
      return bundledClient;
    }
  } catch {
    // fileURLToPath may fail in some environments
  }

  // 3. Monorepo development: look for apps/console/dist
  try {
    const pkgDir = dirname(fileURLToPath(import.meta.url));
    // Navigate from packages/console-server/dist/ to apps/console/dist
    const monorepoClient = resolve(pkgDir, '..', '..', '..', 'apps', 'console', 'dist');
    if (existsSync(monorepoClient) && existsSync(join(monorepoClient, 'index.html'))) {
      return monorepoClient;
    }
  } catch {
    // Ignore
  }

  return null;
}

/**
 * ObjectStack Console Server Plugin.
 *
 * Serves the ObjectUI Console as static files within a Hono-based
 * ObjectStack server. This allows any ObjectStack project to include
 * a full admin UI by simply adding this plugin.
 *
 * @example
 * ```ts
 * import { ConsolePlugin } from '@object-ui/console-server';
 *
 * const consolePlugin = new ConsolePlugin();
 * await kernel.use(consolePlugin);
 * ```
 *
 * @example
 * ```ts
 * // Mount at a sub-path
 * const consolePlugin = new ConsolePlugin({ basePath: '/admin' });
 * await kernel.use(consolePlugin);
 * ```
 */
export class ConsolePlugin {
  name = 'com.objectstack.server.console';
  version = '1.0.0';

  private options: Required<ConsolePluginOptions>;

  constructor(options: ConsolePluginOptions = {}) {
    this.options = {
      basePath: options.basePath ?? '/',
      clientPath: options.clientPath ?? '',
      compression: options.compression ?? true,
      assetCacheControl: options.assetCacheControl ?? 'public, max-age=31536000, immutable',
      indexCacheControl: options.indexCacheControl ?? 'no-cache',
    };

    // Normalize basePath: ensure it starts with / and doesn't end with /
    let basePath = this.options.basePath;
    if (!basePath.startsWith('/')) {
      basePath = '/' + basePath;
    }
    if (basePath.length > 1 && basePath.endsWith('/')) {
      basePath = basePath.slice(0, -1);
    }
    this.options.basePath = basePath;
  }

  async init(_ctx: unknown): Promise<void> {
    // No initialization needed
  }

  async start(ctx: any): Promise<void> {
    const logger = ctx.logger || console;

    // Resolve the client directory
    const clientDir = resolveClientPath(this.options);
    if (!clientDir) {
      logger.warn(
        '[ConsolePlugin] Console client files not found. ' +
        'Build the console first with `pnpm --filter @object-ui/console build` ' +
        'or provide a clientPath option.'
      );
      return;
    }

    // Get the HTTP server service
    const httpServer = ctx.getService?.('http-server') || ctx.getService?.('http.server');
    if (!httpServer) {
      logger.warn('[ConsolePlugin] HTTP Server service not found. Console UI will not be available.');
      return;
    }

    const app = typeof httpServer.getRawApp === 'function'
      ? httpServer.getRawApp()
      : httpServer.app;

    if (!app) {
      logger.warn('[ConsolePlugin] Could not get Hono app instance. Console UI will not be available.');
      return;
    }

    const { basePath, compression, assetCacheControl, indexCacheControl } = this.options;

    logger.info(`[ConsolePlugin] Serving console from ${clientDir}`);
    logger.info(`[ConsolePlugin] Console UI available at ${basePath}`);

    // Route pattern: basePath/* (e.g., /console/* or /*)
    const routePattern = basePath === '/' ? '/*' : `${basePath}/*`;

    app.get(routePattern, async (c: any) => {
      const reqPath = c.req.path;

      // Skip API routes
      if (reqPath.startsWith('/api') || reqPath.startsWith('/graphql')) {
        return undefined; // Let other handlers process
      }

      // Strip basePath prefix to get the file path
      let filePath: string;
      if (basePath === '/') {
        filePath = reqPath;
      } else {
        filePath = reqPath.startsWith(basePath)
          ? reqPath.slice(basePath.length) || '/'
          : reqPath;
      }

      // Security: prevent directory traversal
      if (filePath.includes('..')) {
        return c.text('Forbidden', 403);
      }

      // Determine the full file path
      const fullPath = join(clientDir, filePath);

      // Try to serve the exact file
      if (filePath !== '/' && existsSync(fullPath) && statSync(fullPath).isFile()) {
        return this.serveFile(c, fullPath, compression, assetCacheControl);
      }

      // SPA fallback: serve index.html
      const indexPath = join(clientDir, 'index.html');
      if (existsSync(indexPath)) {
        return this.serveFile(c, indexPath, false, indexCacheControl);
      }

      return c.text('Console UI not found', 404);
    });

    // If basePath is not '/', also handle exact basePath request (without trailing /)
    if (basePath !== '/') {
      app.get(basePath, async (c: any) => {
        const indexPath = join(clientDir, 'index.html');
        if (existsSync(indexPath)) {
          return this.serveFile(c, indexPath, false, indexCacheControl);
        }
        return c.text('Console UI not found', 404);
      });
    }
  }

  private serveFile(
    c: any,
    filePath: string,
    useCompression: boolean,
    cacheControl: string,
  ) {
    const contentType = getMimeType(filePath);
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Cache-Control': cacheControl,
    };

    // Try compressed versions if compression is enabled
    if (useCompression) {
      const acceptEncoding = (c.req.header('accept-encoding') || '') as string;

      if (acceptEncoding.includes('br') && existsSync(filePath + '.br')) {
        const content = readFileSync(filePath + '.br');
        headers['Content-Encoding'] = 'br';
        return c.body(content, 200, headers);
      }

      if (acceptEncoding.includes('gzip') && existsSync(filePath + '.gz')) {
        const content = readFileSync(filePath + '.gz');
        headers['Content-Encoding'] = 'gzip';
        return c.body(content, 200, headers);
      }
    }

    const content = readFileSync(filePath);
    return c.body(content, 200, headers);
  }
}
