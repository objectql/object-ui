import { defineConfig } from './src/config';
import crmConfig from '@object-ui/example-crm/objectstack.config';
import todoConfig from '@object-ui/example-todo/objectstack.config';

export default defineConfig({
  // ============================================================================
  // Project Metadata
  // ============================================================================
  
  name: '@object-ui/example-msw-object-form',
  version: '0.1.0',
  description: 'ObjectUI Example: MSW Object Form (Wrapper)',
  
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
    '@objectstack/plugin-msw' // In core config
  ],

  // ============================================================================
  // Merged Stack Configuration (CRM + Todo)
  // ============================================================================
  objects: [
    ...(crmConfig.objects || []),
    ...(todoConfig.objects || [])
  ],
  apps: [
    ...(crmConfig.apps || []),
    ...(todoConfig.apps || [])
  ],
  manifest: {
    data: [
      ...(crmConfig.manifest?.data || []),
      ...(todoConfig.manifest?.data || [])
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
