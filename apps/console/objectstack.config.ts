import { defineConfig } from './src/config';
import { MSWPlugin } from '@objectstack/plugin-msw';
import { ObjectQLPlugin } from '@objectstack/objectql';
import ConsolePluginConfig from './plugin.js';
import crmConfig from '@object-ui/example-crm/objectstack.config';
import todoConfig from '@object-ui/example-todo/objectstack.config';
import kitchenSinkConfig from '@object-ui/example-kitchen-sink/objectstack.config';

const FixedConsolePlugin = {
    ...ConsolePluginConfig,
    init: () => {}
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
    new MSWPlugin(),
    FixedConsolePlugin
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
