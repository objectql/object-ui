
import fs from 'fs';
import path from 'path';

const root = process.cwd();

const browserTs = `
import { ObjectKernel, DriverPlugin, AppPlugin } from '@objectstack/runtime';
import { ObjectQLPlugin } from '@objectstack/objectql';
import { InMemoryDriver } from '@objectstack/driver-memory';
import { MSWPlugin } from '@objectstack/plugin-msw';
import { config as crmConfig } from '@object-ui/example-crm';
import { http, HttpResponse } from 'msw';

let kernel: ObjectKernel | null = null;

export async function startMockServer() {
  if (kernel) return kernel;

  console.log('[MSW] Starting ObjectStack Runtime (Browser Mode)...');
  console.log('[MSW] Loaded Config:', crmConfig ? 'Found' : 'Missing', crmConfig?.apps?.length);

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

    kernel.use(new MSWPlugin({
        enableBrowser: true,
        baseUrl: '/api/v1', // Use root to match client
        logRequests: true,
        customHandlers: [
            http.get('/api/bootstrap', async () => {
                const contacts = await driver.find('contact', { object: 'contact' });
                const stats = { revenue: 125000, leads: 45, deals: 12 };
                return HttpResponse.json({
                    user: { name: "Demo User", role: "admin" },
                    stats,
                    contacts: contacts || []
                });
            })
        ]
    }));
    
    console.log('[Kernel] Bootstrapping...');
    await kernel.bootstrap();
    console.log('[Kernel] Bootstrap Complete');

    // Seed Data
    if (crmConfig) {
        await initializeMockData(driver);
    }
  } catch (err: any) {
    console.error('❌ Mock Server Start Failed:', err);
    throw err;
  }
  
  return kernel;
}

// Helper to seed data into the in-memory driver
async function initializeMockData(driver: InMemoryDriver) {
    console.log('[MockServer] Initializing mock data...');
    // @ts-ignore
    const manifest = crmConfig.manifest;
    if (manifest && manifest.data) {
        for (const dataSet of manifest.data) {
            console.log(\`[MockServer] Seeding \${dataSet.object}...\`);
            if (dataSet.records) {
                for (const record of dataSet.records) {
                    await driver.create(dataSet.object, record);
                }
            }
        }
    }
}
`;

const clientTs = `
import { ObjectStackClient } from '@objectstack/client';
import { ObjectStackAdapter } from '@object-ui/data-objectstack';

// Use empty string to use current origin. 
// Matches MSW baseUrl: ''
const BASE_URL = '/api/v1'; 

export const client = new ObjectStackClient({
  baseUrl: BASE_URL, 
  fetch: globalThis.fetch.bind(globalThis)
});

export const dataSource = new ObjectStackAdapter({
  baseUrl: BASE_URL,
  token: 'mock-token',
  fetch: globalThis.fetch.bind(globalThis)
});

export const initClient = async () => {
    console.log('[Client] Connecting...');
    // Only connect client (adapter connects lazily or we can connect it too)
    await client.connect();
    // await dataSource.connect(); // Adapter usually auto-connects on request
    console.log('[Client] Connected');
}
`;


const files = {
    'examples/crm-app/src/mocks/browser.ts': browserTs,
    'examples/crm-app/src/client.ts': clientTs
};

for (const [f, c] of Object.entries(files)) {
    const p = path.join(root, f);
    fs.writeFileSync(p, c.trim());
    console.log(`Updated ${f}`);
}
