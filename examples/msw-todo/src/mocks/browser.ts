/**
 * MSW Browser Worker Setup via ObjectStack Service
 * 
 * This creates a complete ObjectStack environment in the browser using the In-Memory Driver
 * and the MSW Plugin which automatically exposes the API.
 */

import { ObjectKernel, DriverPlugin, AppPlugin, type Plugin } from '@objectstack/runtime';
import { ObjectQLPlugin } from '@objectstack/objectql';
import { InMemoryDriver } from '@objectstack/driver-memory';
import { MSWPlugin } from '@objectstack/plugin-msw';
// import appConfig from '../../objectstack.config';
import todoConfig from '@object-ui/example-todo/objectstack.config';

let kernel: ObjectKernel | null = null;

export async function startMockServer() {
  if (kernel) return;

  console.log('[MSW] Starting ObjectStack Runtime (Browser Mode)...');

  const driver = new InMemoryDriver();

  // Create kernel with MiniKernel architecture
  kernel = new ObjectKernel({
    skipSystemValidation: true
  });

  // Register ObjectQL engine
  await kernel.use(new ObjectQLPlugin() as unknown as Plugin)

  // Register the driver
  await kernel.use(new DriverPlugin(driver, 'memory') as unknown as Plugin)

  // Load todo app config as a plugin
  await kernel.use(new AppPlugin(todoConfig) as unknown as Plugin)

  // MSW Plugin (intercepts network requests)
  await kernel.use(new MSWPlugin({
    enableBrowser: true,
    baseUrl: '/api/v1',
    logRequests: true
  }) as unknown as Plugin);
  
  await kernel.bootstrap();

  // Initialize default data from manifest if available
  const manifest = (todoConfig as any).manifest;
  if (manifest && Array.isArray(manifest.data)) {
    console.log('[MSW] Loading initial data...');
    for (const dataset of manifest.data) {
      if (dataset.object && Array.isArray(dataset.records)) {
        for (const record of dataset.records) {
          // Check if record already exists to avoid duplicates on hot reload?
          // Since it's in-memory and we create new kernel/driver on refresh...
          // But 'kernel' variable is module-scoped singleton.
          // On HMR replacement, this module might re-execute.
          // If 'kernel' is not null, we return early (line 18).
          // So data loading happens only once per session. Good.
          await driver.create(dataset.object, record);
        }
        console.log(`[MSW] Loaded ${dataset.records.length} records for ${dataset.object}`);
      }
    }
  }
  
  return kernel;
}

