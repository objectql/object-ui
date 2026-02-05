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
import appConfig from '../../objectstack.config';

let kernel: ObjectKernel | null = null;
let driver: InMemoryDriver | null = null;

export async function startMockServer() {
  // Polyfill process.on for ObjectKernel in browser environment
  // This prevents the "process.on is not a function" error when ObjectKernel initializes
  try {
    if (typeof process !== 'undefined' && !(process as any).on) {
      (process as any).on = () => {};
    }
  } catch (e) {
    console.warn('[MSW] Failed to polyfill process.on', e);
  }

  if (kernel) {
    console.log('[MSW] ObjectStack Runtime already initialized');
    return kernel;
  }

  console.log('[MSW] Starting ObjectStack Runtime (Browser Mode)...');

  driver = new InMemoryDriver();

  // Create kernel with MiniKernel architecture
  kernel = new ObjectKernel({
    skipSystemValidation: true
  });
  
  // Register ObjectQL engine
  await kernel.use(new ObjectQLPlugin())
    
  // Register the driver
  await kernel.use(new DriverPlugin(driver, 'memory'))
    
  // Load app config as a plugin
  await kernel.use(new AppPlugin(appConfig))
    
  // MSW Plugin (intercepts network requests)
  const mswPlugin = new MSWPlugin({
    enableBrowser: true,
    baseUrl: '/api/v1',
    logRequests: true
  });

  // WORKAROUND: ObjectRuntime's PluginLoader spreads the plugin object ({ ...plugin }),
  // which strips methods from class instances (prototype methods).
  // We must bind 'init' and 'start' as own properties.
  const fixedMswPlugin = {
    ...mswPlugin,
    init: mswPlugin.init.bind(mswPlugin),
    start: mswPlugin.start ? mswPlugin.start.bind(mswPlugin) : undefined
  };

  await kernel.use(fixedMswPlugin);
  
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
