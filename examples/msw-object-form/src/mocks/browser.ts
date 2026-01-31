/**
 * MSW Browser Worker Setup via ObjectStack Service
 * 
 * This creates a complete ObjectStack environment in the browser using the In-Memory Driver
 * and the MSW Plugin which automatically exposes the API.
 */

import { ObjectKernel, DriverPlugin, AppPlugin } from '@objectstack/runtime';
import { ObjectQLPlugin } from '@objectstack/objectql';
import { InMemoryDriver } from '@objectstack/driver-memory';
import { MSWPlugin } from '@objectstack/plugin-msw';
// @ts-expect-error - Config file not in src directory
import appConfig from '../../objectstack.config';

let kernel: ObjectKernel | null = null;
let driver: InMemoryDriver | null = null;

export async function startMockServer() {
  if (kernel) {
    console.log('[MSW] ObjectStack Runtime already initialized');
    return kernel;
  }

  console.log('[MSW] Starting ObjectStack Runtime (Browser Mode)...');

  driver = new InMemoryDriver();

  // Create kernel with MiniKernel architecture
  kernel = new ObjectKernel();
  
  kernel
    // Register ObjectQL engine
    .use(new ObjectQLPlugin())
    
    // Register the driver
    .use(new DriverPlugin(driver, 'memory'))
    
    // Load app config as a plugin
    .use(new AppPlugin(appConfig))
    
    // MSW Plugin (intercepts network requests)
    .use(new MSWPlugin({
      enableBrowser: true,
      baseUrl: '/api/v1',
      logRequests: true
    }));
  
  await kernel.bootstrap();

  // Initialize default data from manifest if available
  const manifest = (appConfig as any).manifest;
  if (manifest && Array.isArray(manifest.data)) {
    console.log('[MSW] Loading initial data...');
    for (const dataset of manifest.data) {
      if (dataset.object && Array.isArray(dataset.records)) {
        for (const record of dataset.records) {
          await driver.create(dataset.object, record);
        }
        console.log(`[MSW] Loaded ${dataset.records.length} records for ${dataset.object}`);
      }
    }
  }
  
  console.log('[MSW] ObjectStack Runtime ready');
  return kernel;
}

export function getKernel(): ObjectKernel | null {
  return kernel;
}

export function getDriver(): InMemoryDriver | null {
  return driver;
}
