import { defineConfig } from './src/config';
import crmConfigImport from '@object-ui/example-crm/objectstack.config';
import todoConfigImport from '@object-ui/example-todo/objectstack.config';
import kitchenSinkConfigImport from '@object-ui/example-kitchen-sink/objectstack.config';

const crmConfig = (crmConfigImport as any).default || crmConfigImport;
const todoConfig = (todoConfigImport as any).default || todoConfigImport;
const kitchenSinkConfig = (kitchenSinkConfigImport as any).default || kitchenSinkConfigImport;

// Debug check for definition loading
console.log('DEBUG: CRM Objects Count:', crmConfig.objects?.length);
if (crmConfig.objects?.length) {
    console.log('DEBUG: CRM Objects:', crmConfig.objects.map((o: any) => o.name || o.id));
} else {
    // console.log('DEBUG: CRM Config content:', JSON.stringify(crmConfig, null, 2));
}

export const sharedConfig = {
  // ============================================================================
  // Project Metadata
  // ============================================================================
  
  name: '@object-ui/console',
  version: '0.1.0',
  description: 'ObjectStack Console',
  
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
  reports: [
    ...(crmConfig.reports || [])
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
  plugins: [],
  datasources: {
    default: {
      driver: '@objectstack/driver-memory'
    }
  }
};

export default defineConfig(sharedConfig);
