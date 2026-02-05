import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// @ts-ignore
globalThis.require = require;

import { defineConfig } from './src/config';
// @ts-ignore
import * as MSWPluginPkg from '@objectstack/plugin-msw';
// @ts-ignore
import * as ObjectQLPluginPkg from '@objectstack/objectql';
// @ts-ignore
import * as HonoServerPluginPkg from '@objectstack/plugin-hono-server';

const MSWPlugin = MSWPluginPkg.MSWPlugin || (MSWPluginPkg as any).default?.MSWPlugin || (MSWPluginPkg as any).default;
const ObjectQLPlugin = ObjectQLPluginPkg.ObjectQLPlugin || (ObjectQLPluginPkg as any).default?.ObjectQLPlugin || (ObjectQLPluginPkg as any).default;
const HonoServerPlugin = HonoServerPluginPkg.HonoServerPlugin || (HonoServerPluginPkg as any).default?.HonoServerPlugin || (HonoServerPluginPkg as any).default;

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
        // @ts-ignore
        this.init = this.init.bind(this);
        // @ts-ignore
        this.start = this.start?.bind(this);
    }
}

import ConsolePluginConfig from './plugin.js';
import crmConfig from '@object-ui/example-crm/objectstack.config';
import todoConfig from '@object-ui/example-todo/objectstack.config';
import kitchenSinkConfig from '@object-ui/example-kitchen-sink/objectstack.config';

const FixedConsolePlugin = {
    ...ConsolePluginConfig,
    init: () => {}
};

// Workaround: Override the built-in api-registry plugin which fails due to async service issue
const DummyApiRegistryPlugin = {
    name: 'com.objectstack.runtime.api-registry', 
    version: '1.0.0',
    init: (ctx: any) => {
        // Polyfill missing critical services to pass the Runtime health check
        // These are normally provided by standard plugins not currently included in this lightweight setup
        
        ctx.registerService('metadata', {
            getApp: () => null,
            getObject: () => null,
            getObjects: () => []
        });

        ctx.registerService('data', {
            find: async () => [],
            findOne: async () => null,
            insert: async () => {},
            update: async () => {},
            delete: async () => {},
            count: async () => 0
        });

        ctx.registerService('auth', {
            validate: async () => true,
            getSession: async () => ({ userId: 'mock-user', username: 'mock' })
        });

        // Mock API Registry Service
        const apiEndpoints: any[] = [];
        ctx.registerService('api-registry', {
            registerApi: (entry: any) => {
                // console.log('Mock: Registering API', entry.id);
                apiEndpoints.push(entry);
            },
            getRegistry: () => ({
                apis: apiEndpoints,
                totalApis: apiEndpoints.length,
                totalEndpoints: apiEndpoints.reduce((acc, api) => acc + (api.endpoints?.length || 0), 0)
            }),
            // Add other potential methods if needed
            registerRoute: () => {},
            getRoutes: () => []
        });
    },
    start: () => {
        console.log('Skipping com.objectstack.runtime.api-registry (Disabled via config override)');
    }
};

export default defineConfig({
  // ============================================================================
  // Project Metadata
  // ============================================================================
  
  name: '@object-ui/console',
  version: '0.1.0',
  description: 'ObjectStack Console',
  
  // ============================================================================
  // Build Settings
  // ============================================================================
  
  build: {
    outDir: './dist',
    sourcemap: true,
    minify: true,
    target: 'node18',
  },
  
  // ============================================================================
  // Database Configuration
  // ============================================================================
  
  datasources: {
    default: {
      driver: 'memory', // Use memory driver for browser example
    },
  },
  
  // ============================================================================
  // Plugin Configuration
  // ============================================================================
  
  plugins: [
    new ObjectQLPlugin(),
    new PatchedMSWPlugin(),
    new PatchedHonoServerPlugin(),
    FixedConsolePlugin,
    DummyApiRegistryPlugin
  ],

  // ============================================================================
  // Merged Stack Configuration (CRM + Todo + Kitchen Sink + Mock Metadata)
  // ============================================================================
  objects: [
    ...(crmConfig.objects || []),
    ...(todoConfig.objects || []),
    ...(kitchenSinkConfig.objects || [])
  ],
  apps: [
    ...(crmConfig.apps || []),
    ...(todoConfig.apps || []),
    ...(kitchenSinkConfig.apps || [])
  ],
  dashboards: [
    ...(crmConfig.dashboards || []),
    ...(todoConfig.dashboards || []),
    ...(kitchenSinkConfig.dashboards || [])
  ],
  pages: [
    ...(crmConfig.pages || []),
    ...(todoConfig.pages || []),
    ...(kitchenSinkConfig.pages || [])
  ],
  manifest: {
    data: [
      ...(crmConfig.manifest?.data || []),
      ...(todoConfig.manifest?.data || []),
      ...(kitchenSinkConfig.manifest?.data || [])
    ]
  },
  
  // ============================================================================
  // Development Server
  // ============================================================================
  
  dev: {
    port: 3000,
    host: '0.0.0.0',
    watch: true,
    hotReload: true,
  },
  
  // ============================================================================
  // Deployment
  // ============================================================================
  
  deploy: {
    target: 'static', // This is a static SPA
    region: 'us-east-1',
  },
});
