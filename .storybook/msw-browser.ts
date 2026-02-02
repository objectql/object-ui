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
import { http, HttpResponse } from 'msw';

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


    // Create handlers manually, similar to console app tests
    const protocol = kernel.getService('protocol') as any;
    
    // We override mswPlugin handlers or just add ours.
    // Since we are not using startServer(), we need to pass handlers to msw-storybook-addon via context
    // But this function returns kernel.
    // The msw-browser handles customHandlers inside MSWPlugin initialization?
    // No, we passed them in constructor.

    // Let's redefine handlers to be robust
    const manualHandlers = [
        // Discovery endpoint
        http.get('/api/v1', async () => {
             const response = await protocol.getDiscovery();
             return HttpResponse.json(response);
        }),
        http.get('/api/v1/', async () => {
             const response = await protocol.getDiscovery();
             return HttpResponse.json(response);
        }),
        
        // Metadata endpoints
        http.get('/api/v1/meta/object/:objectName', async ({ params }) => {
            console.log('[MSW] Get Meta:', params.objectName);
            try {
                const response = await protocol.getMetaItem({ 
                    type: 'object', 
                    name: params.objectName as string 
                });
                const payload = (response && response.item) ? response.item : response;
                return HttpResponse.json(payload || { error: 'Not found' }, { status: payload ? 200 : 404 });
            } catch (e) {
                return HttpResponse.json({ error: String(e) }, { status: 500 });
            }
        }),

        // Data List
        http.get('/api/v1/data/:objectName', async ({ params, request }) => {
             console.log('[MSW] Find:', params.objectName);
             try {
                 const url = new URL(request.url);
                 const query: any = {};
                 // Simple query parsing if needed, but for now just pass to driver
                 const records = await driver.find(params.objectName as string, {});
                 
                 // Wrap if protocol expects it (OData style often matches { value: [] })
                 // But Protocol service might do this.
                 // If we bypass protocol and go to driver, we get raw array.
                 // Client expects { value: [] } usually?
                 // Let's check console mock: It returns { value: response }
                 return HttpResponse.json({ value: records }, { status: 200 });
             } catch (e) {
                 return HttpResponse.json({ error: String(e) }, { status: 500 });
             }
        }),

        // Data Detail
        http.get('/api/v1/data/:objectName/:id', async ({ params }) => {
             console.log('[MSW] FindOne:', params.objectName, params.id);
             try {
                 // For InMemoryDriver, findOne might need exact ID match.
                 // Console mock used driver.find with where clause.
                 // Let's use findOne if available or scan.
                 const record = await driver.findOne(params.objectName as string, params.id as string);
                 if (record) return HttpResponse.json(record);
                 
                 // Fallback to find
                 const records = await driver.find(params.objectName as string, {});
                 const found = records.find((r: any) => r._id === params.id || r.id === params.id);
                 return HttpResponse.json(found || { error: 'Not Found' }, { status: found ? 200 : 404 });
             } catch (e) {
                 return HttpResponse.json({ error: String(e) }, { status: 500 });
             }
        }),
         http.get('/api/bootstrap', async () => {
                const contacts = await driver.find('contact', { object: 'contact' });
                const stats = { revenue: 125000, leads: 45, deals: 12 };
                return HttpResponse.json({
                    user: { name: "Demo User", role: "admin" },
                    stats,
                    contacts: contacts || []
                });
            })
    ];

    mswPlugin = new MSWPlugin({
        enableBrowser: false, 
        baseUrl: '/api/v1', 
        logRequests: true,
        customHandlers: manualHandlers
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
