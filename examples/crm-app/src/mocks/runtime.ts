import { ObjectKernel, DriverPlugin, AppPlugin } from '@objectstack/runtime';
import { ObjectQLPlugin } from '@objectstack/objectql';
import { InMemoryDriver } from '@objectstack/driver-memory';
import { MSWPlugin } from '@objectstack/plugin-msw';
import appConfig from '../objectstack.config'; 
import { mockData } from '../data';
import { http, HttpResponse } from 'msw';

let kernel: ObjectKernel | null = null;

export async function startMockServer() {
  if (kernel) return kernel;

  console.log('[MSW] Starting ObjectStack Runtime (Browser Mode)...');

  const driver = new InMemoryDriver();

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
      logRequests: true,
      customHandlers: [
          // Custom handlers that are not part of standard CRUD
          http.get('/api/bootstrap', async () => {
             // We can use ObjectStackServer helper which proxies to the kernel if initialized
             // Or better, use the kernel instance we have right here.
             // But MSWPlugin might not expose the kernel globally to the handler context easily without closure
             // So we use the closure 'kernel' variable.
             
             // However, ObjectQL usually requires a 'session'. 
             const session = { userId: 'current', isSpaceAdmin: true }; // Mock session
             
             try {
                const objectql = kernel!.getService<any>('objectql');
                const user = (await objectql.getObject('user').findOne('current', {}, session)) || {};
                const contacts = await objectql.getObject('contact').find({}, session);
                const opportunities = await objectql.getObject('opportunity').find({}, session);
                const stats = { revenue: 125000, leads: 45, deals: 12 };

                return HttpResponse.json({
                    user,
                    stats,
                    contacts,
                    opportunities
                });
             } catch (e) {
                 console.error(e);
                 return new HttpResponse(null, { status: 500 });
             }
          })
      ]
    }));
  
  await kernel.bootstrap();

  // Seed Data
  await seedData(kernel);
  
  return kernel;
}

// Helper to seed data into the in-memory driver
async function seedData(kernel: ObjectKernel) {
    const session = { userId: 'system' };
    const objectql = kernel.getService<any>('objectql');
    
    // Seed User
    if (mockData.user) {
        // ObjectQL insert usually needs specific structure, but we try simplest first
        await objectql.getObject('user').insert({ ...mockData.user, id: 'current', _id: 'current' }, session);
    }

    // Seed Contacts
    if (mockData.contacts) {
        for (const contact of mockData.contacts) {
            await objectql.getObject('contact').insert({ ...contact, _id: contact.id }, session);
        }
    }

    // Seed Opportunities
    if (mockData.opportunities) {
        for (const opp of mockData.opportunities) {
            await objectql.getObject('opportunity').insert({ ...opp, _id: opp.id }, session);
        }
    }

    // Seed Accounts
    const accounts = [
        { id: '1', name: 'Acme Corp', industry: 'Technology' },
        { id: '2', name: 'TechStart Inc', industry: 'Startup' },
        { id: '3', name: 'Global Solutions', industry: 'Consulting' }
    ];

    for (const acc of accounts) {
        await objectql.getObject('account').insert({ ...acc, _id: acc.id }, session);
    }

    console.log('[MockServer] Data seeded successfully');
}
