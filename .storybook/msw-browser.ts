/**
 * MSW Browser Setup for Storybook
 * 
 * This file integrates the ObjectStack runtime with MSW in browser mode
 * for use within Storybook stories. Based on the pattern from examples/crm-app.
 */

import { ObjectKernel, DriverPlugin, AppPlugin } from '@objectstack/runtime';
import { ObjectQLPlugin } from '@objectstack/objectql';
import { InMemoryDriver } from '@objectstack/driver-memory';
import { MSWPlugin } from '@objectstack/plugin-msw';
import { config as crmConfig } from '@object-ui/example-crm';

let kernel: ObjectKernel | null = null;
let mswPlugin: MSWPlugin | null = null;

export async function startMockServer() {
  if (kernel) return kernel;

  console.log('[Storybook MSW] Starting ObjectStack Runtime (Browser Mode)...');

  console.log('[Storybook MSW] Loaded Config:', crmConfig ? 'Found' : 'Missing', crmConfig?.apps?.length);

  if (crmConfig && crmConfig.objects) {
    console.log('[Storybook MSW] Objects in Config:', crmConfig.objects.map(o => o.name));
  } else {
    console.error('[Storybook MSW] No objects found in config!');
  }

  const driver = new InMemoryDriver();
  kernel = new ObjectKernel();

  try {
    kernel
        .use(new ObjectQLPlugin())
        .use(new DriverPlugin(driver, 'memory'));

    if (crmConfig) {
        kernel.use(new AppPlugin(crmConfig));
    } else {
        console.error('❌ CRM Config is missing! Skipping AppPlugin.');
    }

    mswPlugin = new MSWPlugin({
        enableBrowser: false, 
        baseUrl: '/api/v1', 
        logRequests: true
    });

    kernel.use(mswPlugin);
    
    console.log('[Storybook MSW] Bootstrapping kernel...');
    await kernel.bootstrap();
    console.log('[Storybook MSW] Bootstrap Complete');

    // Seed Data
    if (crmConfig) {
        await initializeMockData(driver);
    }
  } catch (err: any) {
    console.error('❌ Storybook Mock Server Start Failed:', err);
    throw err;
  }
  
  return kernel;
}

// Helper to seed data into the in-memory driver
async function initializeMockData(driver: InMemoryDriver) {
    console.log('[Storybook MSW] Initializing mock data...');
    // @ts-ignore
    const manifest = crmConfig.manifest;
    if (manifest && manifest.data) {
        for (const dataSet of manifest.data) {
            console.log(`[Storybook MSW] Seeding ${dataSet.object}...`);
            if (dataSet.records) {
                for (const record of dataSet.records) {
                    await driver.create(dataSet.object, record);
                }
            }
        }
    }
}

export function getHandlers() {
    return mswPlugin?.getHandlers() || [];
}

export { kernel };
