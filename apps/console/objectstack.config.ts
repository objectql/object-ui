
console.log("DEBUG: objectstack.config.ts LOADED");
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// @ts-ignore
globalThis.require = require;

import { defineConfig } from './src/config';
import { sharedConfig } from './objectstack.shared';

// @ts-ignore
import * as MSWPluginPkg from '@objectstack/plugin-msw';
// @ts-ignore
import * as ObjectQLPluginPkg from '@objectstack/objectql';
// @ts-ignore
import * as HonoServerPluginPkg from '@objectstack/plugin-hono-server';
// @ts-ignore
import * as DriverMemoryPkg from '@objectstack/driver-memory';
// @ts-ignore
import * as RuntimePkg from '@objectstack/runtime';

const MSWPlugin = MSWPluginPkg.MSWPlugin || (MSWPluginPkg as any).default?.MSWPlugin || (MSWPluginPkg as any).default;
const ObjectQLPlugin = ObjectQLPluginPkg.ObjectQLPlugin || (ObjectQLPluginPkg as any).default?.ObjectQLPlugin || (ObjectQLPluginPkg as any).default;
const InMemoryDriver = DriverMemoryPkg.InMemoryDriver || (DriverMemoryPkg as any).default?.InMemoryDriver || (DriverMemoryPkg as any).default;
const DriverPlugin = RuntimePkg.DriverPlugin || (RuntimePkg as any).default?.DriverPlugin || (RuntimePkg as any).default;
// const HonoServerPlugin = HonoServerPluginPkg.HonoServerPlugin || (HonoServerPluginPkg as any).default?.HonoServerPlugin || (HonoServerPluginPkg as any).default;

import ConsolePluginConfig from './plugin.js';

const FixedConsolePlugin = {
    ...ConsolePluginConfig,
    init: () => {},
    start: async (ctx: any) => {
        console.log('DEBUG: FixedConsolePlugin start called');

        let app = null;
        const staticRoot = './dist';
        
        // Wait for app to be available (in case HonoServerPlugin initializes it in start)
        const maxRetries = 50;
        for(let i=0; i<maxRetries; i++) { // 10 seconds timeout
            if (ctx.getService) {
                const httpService = ctx.getService('http-server') || ctx.getService('http.server');
                if (httpService) {
                    if (httpService.getRawApp) app = httpService.getRawApp();
                    else if (httpService.app) app = httpService.app;
                }
            }
            if (app) break;
            await new Promise(r => setTimeout(r, 200));
        }

        const path = require('path');
        const fs = require('fs');
        const absoluteStaticRoot = path.resolve(process.cwd(), staticRoot);
        
        if (app) {
             console.log('DEBUG: Registering SPA routes for ' + absoluteStaticRoot);
             
             // Manual Asset Handler
             app.get('/console/assets/*', async (c: any) => {
                const filePath = path.join(absoluteStaticRoot, c.req.path.replace('/console', ''));
                if (fs.existsSync(filePath)) {
                    const ext = path.extname(filePath);
                    let contentType = 'application/octet-stream';
                    if (ext === '.css') contentType = 'text/css';
                    else if (ext === '.js') contentType = 'application/javascript';
                    else if (ext === '.json') contentType = 'application/json';
                    else if (ext === '.png') contentType = 'image/png';
                    else if (ext === '.svg') contentType = 'image/svg+xml';
                    
                    const content = fs.readFileSync(filePath);
                    return c.body(content, 200, { 'Content-Type': contentType });
                }
                return c.text('Asset Not Found', 404);
            });

            // Redirect Root
            app.get('/', (c: any) => {
                return c.redirect('/console/');
            });

            // SPA Fallback
            app.get('/console/*', async (c: any) => {
                if (c.req.path.startsWith('/api')) {
                    return c.text('Not Found', 404);
                }
                try {
                    const indexPath = path.join(absoluteStaticRoot, 'index.html');
                    if (fs.existsSync(indexPath)) {
                            const indexContent = fs.readFileSync(indexPath, 'utf-8');
                            return c.html(indexContent);
                    }
                    return c.text('SPA Index Not Found at ' + indexPath, 404);
                } catch (e: any) {
                    console.error('DEBUG: Error serving index:', e);
                    return c.text('Server Error: ' + e.message, 500);
                }
            });
            console.log('SPA Fallback route registered');
        } else {
             console.log("DEBUG: Failed to find Hono app service. Routes not registered.");
        }
    }
};

const plugins: any[] = [
    new ObjectQLPlugin(),
    new DriverPlugin(new InMemoryDriver(), 'memory'),
    // new MSWPlugin(), // Disabled in production mode
    // HonoServerPlugin is auto-detected
    FixedConsolePlugin
];

// Re-enable MSW only if explicitly needed
if (process.env.ENABLE_MSW_PLUGIN === 'true') {
    plugins.push(new MSWPlugin());
}

export default defineConfig({
  ...sharedConfig,
  
  build: {
    outDir: './dist',
    sourcemap: true,
    minify: true,
    target: 'node18',
  },
  
  datasources: {
    default: {
      driver: 'memory', 
    },
  },
  
  plugins,
  
  dev: {
    port: 3000,
    host: '0.0.0.0',
    watch: true,
    hotReload: true,
  },
  
  deploy: {
    target: 'static',
    region: 'us-east-1',
  },
});
