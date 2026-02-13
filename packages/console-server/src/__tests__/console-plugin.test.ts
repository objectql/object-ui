import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConsolePlugin } from '../console-plugin';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const TEST_DIR = join(process.cwd(), '.test-client-dist');

function createTestClientDir() {
  mkdirSync(join(TEST_DIR, 'assets'), { recursive: true });
  writeFileSync(join(TEST_DIR, 'index.html'), '<!DOCTYPE html><html><body>Console</body></html>');
  writeFileSync(join(TEST_DIR, 'assets', 'app.js'), 'console.log("app")');
  writeFileSync(join(TEST_DIR, 'assets', 'style.css'), 'body { margin: 0 }');
  writeFileSync(join(TEST_DIR, 'favicon.ico'), 'icon-data');
}

function cleanTestDir() {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true });
  }
}

describe('ConsolePlugin', () => {
  beforeEach(() => {
    createTestClientDir();
  });

  afterEach(() => {
    cleanTestDir();
  });

  it('should have correct plugin name and version', () => {
    const plugin = new ConsolePlugin();
    expect(plugin.name).toBe('com.objectstack.server.console');
    expect(plugin.version).toBe('1.0.0');
  });

  it('should initialize without errors', async () => {
    const plugin = new ConsolePlugin();
    await expect(plugin.init({})).resolves.toBeUndefined();
  });

  it('should warn when no HTTP server is found', async () => {
    const plugin = new ConsolePlugin({ clientPath: TEST_DIR });
    const warn = vi.fn();
    const ctx = {
      logger: { info: vi.fn(), warn },
      getService: () => null,
    };
    await plugin.start(ctx);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('HTTP Server service not found')
    );
  });

  it('should warn when client files are not found', async () => {
    const plugin = new ConsolePlugin({ clientPath: '/nonexistent/path' });
    const warn = vi.fn();
    const ctx = {
      logger: { info: vi.fn(), warn },
      getService: () => null,
    };
    await plugin.start(ctx);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Console client files not found')
    );
  });

  it('should register routes on the Hono app', async () => {
    const plugin = new ConsolePlugin({ clientPath: TEST_DIR });
    const getMock = vi.fn();
    const ctx = {
      logger: { info: vi.fn(), warn: vi.fn() },
      getService: (name: string) => {
        if (name === 'http-server') {
          return { getRawApp: () => ({ get: getMock }) };
        }
        return null;
      },
    };
    await plugin.start(ctx);
    // Should register '/*' route for basePath '/'
    expect(getMock).toHaveBeenCalledWith('/*', expect.any(Function));
  });

  it('should register routes with custom basePath', async () => {
    const plugin = new ConsolePlugin({
      clientPath: TEST_DIR,
      basePath: '/console',
    });
    const getMock = vi.fn();
    const ctx = {
      logger: { info: vi.fn(), warn: vi.fn() },
      getService: (name: string) => {
        if (name === 'http-server') {
          return { getRawApp: () => ({ get: getMock }) };
        }
        return null;
      },
    };
    await plugin.start(ctx);
    // Should register both '/console/*' and '/console' routes
    expect(getMock).toHaveBeenCalledWith('/console/*', expect.any(Function));
    expect(getMock).toHaveBeenCalledWith('/console', expect.any(Function));
  });

  it('should serve static files correctly', async () => {
    const plugin = new ConsolePlugin({ clientPath: TEST_DIR });
    let registeredHandler: Function | null = null;
    const getMock = vi.fn((path: string, handler: Function) => {
      if (path === '/*') {
        registeredHandler = handler;
      }
    });
    const ctx = {
      logger: { info: vi.fn(), warn: vi.fn() },
      getService: (name: string) => {
        if (name === 'http-server') {
          return { getRawApp: () => ({ get: getMock }) };
        }
        return null;
      },
    };
    await plugin.start(ctx);
    expect(registeredHandler).toBeTruthy();

    // Simulate request for a JS file
    const bodyMock = vi.fn();
    const mockContext = {
      req: {
        path: '/assets/app.js',
        header: () => '',
      },
      body: bodyMock,
      text: vi.fn(),
    };
    await registeredHandler!(mockContext);
    expect(bodyMock).toHaveBeenCalledWith(
      expect.any(Buffer),
      200,
      expect.objectContaining({
        'Content-Type': 'application/javascript; charset=utf-8',
      })
    );
  });

  it('should serve index.html as SPA fallback', async () => {
    const plugin = new ConsolePlugin({ clientPath: TEST_DIR });
    let registeredHandler: Function | null = null;
    const getMock = vi.fn((path: string, handler: Function) => {
      if (path === '/*') {
        registeredHandler = handler;
      }
    });
    const ctx = {
      logger: { info: vi.fn(), warn: vi.fn() },
      getService: (name: string) => {
        if (name === 'http-server') {
          return { getRawApp: () => ({ get: getMock }) };
        }
        return null;
      },
    };
    await plugin.start(ctx);

    // Request for a non-existent route should return index.html
    const bodyMock = vi.fn();
    const mockContext = {
      req: {
        path: '/some/app/route',
        header: () => '',
      },
      body: bodyMock,
      text: vi.fn(),
    };
    await registeredHandler!(mockContext);
    expect(bodyMock).toHaveBeenCalledWith(
      expect.any(Buffer),
      200,
      expect.objectContaining({
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache',
      })
    );
  });

  it('should block directory traversal attempts', async () => {
    const plugin = new ConsolePlugin({ clientPath: TEST_DIR });
    let registeredHandler: Function | null = null;
    const getMock = vi.fn((path: string, handler: Function) => {
      if (path === '/*') {
        registeredHandler = handler;
      }
    });
    const ctx = {
      logger: { info: vi.fn(), warn: vi.fn() },
      getService: (name: string) => {
        if (name === 'http-server') {
          return { getRawApp: () => ({ get: getMock }) };
        }
        return null;
      },
    };
    await plugin.start(ctx);

    const textMock = vi.fn();
    const mockContext = {
      req: {
        path: '/../../../etc/passwd',
        header: () => '',
      },
      body: vi.fn(),
      text: textMock,
    };
    await registeredHandler!(mockContext);
    expect(textMock).toHaveBeenCalledWith('Forbidden', 403);
  });

  it('should normalize basePath correctly', () => {
    // @ts-expect-error accessing private options for testing
    const p1 = new ConsolePlugin({ basePath: 'console' }).options;
    expect(p1.basePath).toBe('/console');

    // @ts-expect-error accessing private options for testing
    const p2 = new ConsolePlugin({ basePath: '/console/' }).options;
    expect(p2.basePath).toBe('/console');

    // @ts-expect-error accessing private options for testing
    const p3 = new ConsolePlugin({ basePath: '/' }).options;
    expect(p3.basePath).toBe('/');
  });
});
