import { http, HttpResponse } from 'msw';
import { ObjectStackServer } from '@objectstack/plugin-msw';
import { protocol } from './protocol';
import { mockData } from '../data';
import { MemoryProtocol } from './MemoryProtocol';

// Initialize the mock server with our protocol definition
// The JSON protocol def is insufficient for methods, so we wrap it or replace it with an implementation
const memoryProtocol = new MemoryProtocol({}, (protocol as any).objects);
ObjectStackServer.init(memoryProtocol as any);

export const seedData = async () => {
    // Seed User
    if (mockData.user) {
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
};

const customHandlers = [
    // Helper to bootstrap the full state for the synchronous UI
    http.get('/api/bootstrap', async () => {
        const user = (await ObjectStackServer.getData('user', 'current')).data || {};
        const contacts = (await ObjectStackServer.findData('contact')).data || [];
        const opportunities = (await ObjectStackServer.findData('opportunity')).data || [];
        
        const stats = { revenue: 125000, leads: 45, deals: 12 };

        return HttpResponse.json({
            user,
            stats,
            contacts,
            opportunities
        });
    }),

    http.post('/api/opportunities/:id/win', async ({ params }) => {
        const { id } = params;
        await ObjectStackServer.updateData('opportunity', id as string, { stage: 'Closed Won' });
        return HttpResponse.json({ success: true, message: 'Deal Closed!' });
    }),
    
    http.get('/api/v1/stats', () => {
        return HttpResponse.json(mockData.stats);
    })
];

const standardHandlers = [
    // Data Query
    http.get('/api/v1/data/:object', async ({ params }) => {
        const { object } = params;
        const result = await ObjectStackServer.findData(object as string);
        return HttpResponse.json({ value: result.data }); 
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

    // Metadata Get Object
    http.get('/api/v1/meta/objects/:object', async ({ params }) => {
        const { object } = params;
        const objDef = (protocol as any).objects.find((o: any) => o.name === object);
        if (!objDef) {
            return new HttpResponse(null, { status: 404 });
        }
        return HttpResponse.json(objDef);
    }),
];

export const handlers = [...standardHandlers, ...customHandlers];
