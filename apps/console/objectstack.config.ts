
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

const MSWPlugin = MSWPluginPkg.MSWPlugin || (MSWPluginPkg as any).default?.MSWPlugin || (MSWPluginPkg as any).default;
const ObjectQLPlugin = ObjectQLPluginPkg.ObjectQLPlugin || (ObjectQLPluginPkg as any).default?.ObjectQLPlugin || (ObjectQLPluginPkg as any).default;
const HonoServerPlugin = HonoServerPluginPkg.HonoServerPlugin || (HonoServerPluginPkg as any).default?.HonoServerPlugin || (HonoServerPluginPkg as any).default;

import ConsolePluginConfig from './plugin.js';

// FIX: Ensure init is own property for runtime compatibility
class PatchedMSWPlugin extends MSWPlugin {
    constructor(...args: any[]) {
        super(...args);
        // @ts-ignore
        this.init = this.init.bind(this);
        // @ts-ignore
        this.start = this.start?.bind(this);
    }
}

class PatchedHonoServerPlugin extends HonoServerPlugin {
    constructor(...args: any[]) {
        super(...args);
        console.log('DEBUG: PatchedHonoServerPlugin instantiated');
        // @ts-ignore
        this.init = this.init.bind(this);
        
        // Capture original start method (which is an arrow function property)
        // @ts-ignore
        const originalStart = this.start;

        // Override start with custom logic
        // @ts-ignore
        this.start = async (ctx: any) => {
            // Call original start first to ensure server is created and listening
            if (originalStart) {
                await originalStart(ctx);
            }

            console.log('DEBUG: Attempting to register SPA routes...');
            console.log('DEBUG: Plugin keys:', Object.keys(this));
            // @ts-ignore
            if (this.app) console.log('DEBUG: Found this.app');
            // @ts-ignore
            if (this.server) console.log('DEBUG: Found this.server');

            // Try to find the app from various sources
            // @ts-ignore
            let app = this.server?.getRawApp?.(); // If this.server exists
            
            // If not found, try to get from service
            if (!app && ctx.getService) {
                const httpService = ctx.getService('http-server') || ctx.getService('http.server');
                if (httpService) {
                     // console.log('DEBUG: Found http-server service keys:', Object.keys(httpService));
                     if (httpService.getRawApp) app = httpService.getRawApp();
                     else if (httpService.app) app = httpService.app;
                }
            }

            // @ts-ignore
            const staticRoot = this.options?.staticRoot || './dist';
            
            if (app && staticRoot) {
                const fs = require('fs');
                const path = require('path');
                
                console.log('DEBUG: Registering SPA routes for ' + staticRoot);

                // Manual Asset Handler to ensure assets are served
                app.get('/console/assets/*', async (c: any) => {
                    const filePath = path.join(path.resolve(staticRoot), c.req.path.replace('/console', ''));
                    // console.log('DEBUG: Asset Request:', c.req.path, '->', filePath);
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

                // Server-side Redirect: Root -> Console
                app.get('/', (c: any) => {
                    return c.redirect('/console/');
                });

                // Register fallback 
                app.get('/console/*', async (c: any) => {
                    // Ignore API calls -> let them 404
                    if (c.req.path.startsWith('/api')) {
                        return c.text('Not Found', 404);
                    }
                    
                    try {
                        // Debugging path resolution
                        const indexPath = path.resolve(staticRoot, 'index.html');
                        console.log('DEBUG: Request Path:', c.req.path);
                        console.log('DEBUG: Serving index from:', indexPath);
                        console.log('DEBUG: File exists?', fs.existsSync(indexPath));

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
                console.log('SPA Fallback route registered for ' + staticRoot);
            } else {
                 console.log("DEBUG: failed to register routes. app found:", !!app, "staticRoot:", staticRoot);
            }
        };
    }
}

const FixedConsolePlugin = {
    ...ConsolePluginConfig,
    init: () => {},
    start: async (ctx: any) => {
        const httpService = ctx.getService('http-server') || ctx.getService('http.server');
        if (httpService) {
            const app = httpService.app || httpService.getRawApp?.();
            
            if (app) {
                const fs = require('fs');
                const path = require('path');
                const staticRoot = './dist'; 

                // Manual Asset Handler
                app.get('/console/assets/*', async (c: any) => {
                    const filePath = path.join(path.resolve(staticRoot), c.req.path.replace('/console', ''));
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

                // Server-side Redirect
                app.get('/', (c: any) => c.redirect('/console/'));
                app.get('/console', (c: any) => c.redirect('/console/'));

                // SPA Fallback
                app.get('/console/*', async (c: any) => {
                     if (c.req.path.startsWith('/api')) return c.text('Not Found', 404);
                     const indexPath = path.resolve(staticRoot, 'index.html');
                     if (fs.existsSync(indexPath)) {
                         return c.html(fs.readFileSync(indexPath, 'utf-8'));
                     }
                     return c.text('SPA Index Not Found', 404);
                });
                console.log('SPA routes registered for Console');
            }
        }
    }
};

// Workaround: Override the built-in api-registry plugin which fails due to async service issue
const DummyApiRegistryPlugin = {
    name: 'com.objectstack.runtime.api-registry', 
    version: '1.0.0',
    init: (ctx: any) => {
        // Polyfill missing critical services to pass the Runtime health check
        
        // ctx.registerService('metadata', {
        //     getApp: () => null,
        //     getObject: () => null,
        //     getObjects: () => []
        // });

        // ctx.registerService('data', {
        //     find: async () => [],
        //     findOne: async () => null,
        //     insert: async () => {},
        //     update: async () => {},
        //     delete: async () => {},
        //     count: async () => 0
        // });

        // ctx.registerService('auth', {
        //     validate: async () => true,
        //     getSession: async () => ({ userId: 'mock-user', username: 'mock' })
        // });

        // Mock API Registry Service
        const apiEndpoints: any[] = [];
        ctx.registerService('api-registry', {
            registerApi: (entry: any) => {
                apiEndpoints.push(entry);
            },
            getRegistry: () => ({
                apis: apiEndpoints,
                totalApis: apiEndpoints.length,
                totalEndpoints: apiEndpoints.reduce((acc, api) => acc + (api.endpoints?.length || 0), 0)
            }),
            registerRoute: () => {},
            getRoutes: () => []
        });
    },
    start: () => {
        console.log('Skipping com.objectstack.runtime.api-registry (Disabled via config override)');
    }
};

const plugins: any[] = [
    new ObjectQLPlugin(),
    // new PatchedMSWPlugin(), // Disabled in production mode
    new PatchedHonoServerPlugin({
        staticRoot: './dist'
    }),
    FixedConsolePlugin,
    DummyApiRegistryPlugin
];

// Re-enable MSW only if explicitly needed
if (process.env.ENABLE_MSW_PLUGIN === 'true') {
    plugins.push(new PatchedMSWPlugin());
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
