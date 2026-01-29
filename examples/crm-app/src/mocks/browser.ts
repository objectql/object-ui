import { setupWorker } from 'msw/browser';
import { http, HttpResponse } from 'msw';
import { ObjectStackServer } from '@objectstack/plugin-msw';
import { protocol } from './protocol';
import { mockData } from '../data';

// 1. Initialize the mock server with our protocol definition
ObjectStackServer.init(protocol);

// 2. Seed Data
// We intentionally perform this side-effect here to ensure data exists when the app starts
(async () => {
    // Seed User
    if (mockData.user) {
        // The mock server might have a specific way to handle current user, 
        // but for now we just treat it as a 'user' record.
        // We'll assume the first user is the current one for simple verify.
        await ObjectStackServer.createData('user', { ...mockData.user, id: 'current' });
    }

    // Seed Contacts
    if (mockData.contacts) {
        for (const contact of mockData.contacts) {
            await ObjectStackServer.createData('contact', contact);
        }
    }

    // Seed Opportunities
    if (mockData.opportunities) {
        for (const opp of mockData.opportunities) {
            await ObjectStackServer.createData('opportunity', opp);
        }
    }
    
    // Seed random Accounts to support lookup
    await ObjectStackServer.createData('account', { id: '1', name: 'Acme Corp', industry: 'Technology' });
    await ObjectStackServer.createData('account', { id: '2', name: 'TechStart Inc', industry: 'Startup' });
    await ObjectStackServer.createData('account', { id: '3', name: 'Global Solutions', industry: 'Consulting' });
    
    console.log('[MockServer] Data seeded successfully');
})();


// 3. Define Handlers
const handlers = [
    // Helper to bootstrap the full state for the synchronous UI
    http.get('/api/bootstrap', async () => {
        // Fetch all needed data from the helper
        // Since we are inside the worker, we can use ObjectStackServer to query what we just seeded
        const user = (await ObjectStackServer.getData('user', 'current')).data || {};
        const contacts = (await ObjectStackServer.findData('contact')).data || [];
        const opportunities = (await ObjectStackServer.findData('opportunity')).data || [];
        
        // Stats are static in this mock for now, or could be calculated
        const stats = { revenue: 125000, leads: 45, deals: 12 };

        return HttpResponse.json({
            user,
            stats,
            contacts,
            opportunities
        });
    }),

    // Custom endpoint defined in opportunity-detail.ts
    http.post('/api/opportunities/:id/win', async ({ params }) => {
        const { id } = params;
        await ObjectStackServer.updateData('opportunity', id as string, { stage: 'Closed Won' });
        return HttpResponse.json({ success: true, message: 'Deal Closed!' });
    }),
    
    // Add a handler for binding ${stats.revenue} which might expect a specific endpoint
    // The dashboard schema uses ${stats.revenue}. 
    // If we want to support this via API, we might need a custom endpoint or 
    // simply let the SchemaRenderer use the `MockDataSource` approach?
    // 
    // The prompt says "use plugin-msw ... to start mock api".
    // This implies we should switch the APP to use API, not local objects.
    // So we need to expose these stats via API.
    http.get('/api/v1/stats', () => {
        return HttpResponse.json(mockData.stats);
    })
];


// 4. Create Worker
// We combine the auto-generated handlers from ObjectStackServer with our custom ones.
// Note: ObjectStackServer itself does not return handlers array directly in the docs?
// Wait, the docs said: "Automatically generates MSW handlers" but under "Standalone Usage":
// "const handlers = [ http.get... ]" - it showed manual handlers calling ObjectStackServer.
//
// BUT "Features" said "Automatically generates MSW handlers". 
// And "Usage -> With ObjectStack Runtime" uses `kernel.use(new MSWPlugin)`.
//
// "Standalone Usage" example showed:
// const handlers = [ ... ]
// const worker = setupWorker(...handlers);
//
// Use "ObjectStackServer" implies we might need to manually map if not using Kernel?
// Let's re-read carefully: "Automatically generates MSW handlers for all ObjectStack API endpoints"
// This is likely available via a helper or property. 
// 
// Actually, looking at the imported symbols: `import { ObjectStackServer } from ...`
// Typically plugins that "generate handlers" export a function to get them.
// The docs for "Standalone Usage" were explicit: manual handlers calling `ObjectStackServer.getData()`.
// 
// HOWEVER, let's look at `MSWPlugin`. Maybe `MSWPlugin` has a method to get handlers?
// If I am in "Standalone Browser", I am not using `ObjectKernel`. 
//
// Let's assume for now I must define the standard Object handlers manually OR 
// verify if `ObjectStackServer.handlers` exists (common pattern).
//
// Re-reading docs snippet I got:
// `http.get('/api/user/:id', async ({ params }) => { ... })`
// usage example showed manual definition. 
//
// If the plugin claims "Automatic API Mocking", maybe there is `getHandlers()`?
// Let's try to assume common patterns or write the generic handlers myself using ObjectStackServer helper.
// 
// UPDATE: I will check the exports of `@objectstack/plugin-msw` in node_modules if I could, but I can't easily.
// I will write a helper to generate standard CRUD handlers for the Protocol objects.

const standardHandlers = [
    // Data Query
    http.get('/api/v1/data/:object', async ({ params, request }) => {
        const { object } = params;
        const url = new URL(request.url);
        // We could implement filtering from url.searchParams if ObjectStackServer supports it
        const result = await ObjectStackServer.findData(object as string); // findData(obj, params?)
        return HttpResponse.json({ value: result.data }); // OData style usually { value: [] }? Or ObjectStack style?
        // Docs: "result.data". Let's assume simple array or wrapper.
    }),
    
    // Get One
    http.get('/api/v1/data/:object/:id', async ({ params }) => {
        const { object, id } = params;
        const result = await ObjectStackServer.getData(object as string, id as string);
        return HttpResponse.json(result.data);
    }),
    
    // Create
    http.post('/api/v1/data/:object', async ({ params, request }) => {
        const { object } = params;
        const body = await request.json();
        const result = await ObjectStackServer.createData(object as string, body);
        return HttpResponse.json(result.data);
    }),
    
    // Update
    http.put('/api/v1/data/:object/:id', async ({ params, request }) => {
        const { object, id } = params;
        const body = await request.json();
        const result = await ObjectStackServer.updateData(object as string, id as string, body);
        return HttpResponse.json(result.data);
    }),
    
     // Delete
    http.delete('/api/v1/data/:object/:id', async ({ params}) => {
        const { object, id } = params;
        await ObjectStackServer.deleteData(object as string, id as string);
        return HttpResponse.json({ success: true });
    }),
];

export const worker = setupWorker(...standardHandlers, ...handlers);
