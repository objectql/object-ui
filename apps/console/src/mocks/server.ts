/**
 * MSW Server Setup for Tests
 * 
 * This creates a complete ObjectStack environment for testing using MSW setupServer
 * instead of setupWorker (which is for browser only).
 */

import { ObjectKernel, DriverPlugin, AppPlugin } from '@objectstack/runtime';
import { ObjectQLPlugin } from '@objectstack/objectql';
import { InMemoryDriver } from '@objectstack/driver-memory';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import appConfig from '../../objectstack.shared';

let kernel: ObjectKernel | null = null;
let driver: InMemoryDriver | null = null;
let server: ReturnType<typeof setupServer> | null = null;

export async function startMockServer() {
  if (kernel) {
    console.log('[MSW] ObjectStack Runtime already initialized');
    return kernel;
  }

  console.log('[MSW] Starting ObjectStack Runtime (Test Mode)...');

  driver = new InMemoryDriver();

  // Create kernel
  kernel = new ObjectKernel({
    skipSystemValidation: true
  });
  
  await kernel.use(new ObjectQLPlugin());
  await kernel.use(new DriverPlugin(driver, 'memory'));
  await kernel.use(new AppPlugin(appConfig));
  
  // Bootstrap kernel WITHOUT MSW plugin (we'll handle MSW separately for tests)
  await kernel.bootstrap();

  // Load initial data from manifest
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

  // Create MSW handlers manually for both paths to ensure compatibility with client defaults
  const v1Handlers = createHandlers('http://localhost:3000/api/v1', kernel, driver!);
  const legacyHandlers = createHandlers('http://localhost:3000/api', kernel, driver!);
  const handlers = [...v1Handlers, ...legacyHandlers];
  
  // Setup MSW server for Node.js environment
  server = setupServer(...handlers);
  server.listen({ onUnhandledRequest: 'bypass' });
  
  console.log('[MSW] ObjectStack Runtime ready');
  return kernel;
}

export function stopMockServer() {
  if (server) {
    server.close();
    server = null;
  }
  kernel = null;
  driver = null;
}

export function getKernel(): ObjectKernel | null {
  return kernel;
}

export function getDriver(): InMemoryDriver | null {
  return driver;
}

/**
 * Create MSW request handlers for ObjectStack API
 */
function createHandlers(baseUrl: string, kernel: ObjectKernel, driver: InMemoryDriver) {
  const protocol = kernel.getService('protocol') as any;
  
  // Extract origin from baseUrl for .well-known endpoint
  const origin = new URL(baseUrl).origin;
  
  return [
    // .well-known discovery endpoint (probed first by client.connect())
    http.get(`${origin}/.well-known/objectstack`, async () => {
      const response = await protocol.getDiscovery();
      return HttpResponse.json(response, { status: 200 });
    }),

    // Discovery endpoint - Handle both with and without trailing slash
    http.get(`${baseUrl}`, async () => {
      const response = await protocol.getDiscovery();
      return HttpResponse.json(response, { status: 200 });
    }),
    http.get(`${baseUrl}/`, async () => {
      const response = await protocol.getDiscovery();
      return HttpResponse.json(response, { status: 200 });
    }),

    // Metadata endpoints - Support both legacy /meta and new /metadata paths
    http.get(`${baseUrl}/meta/objects`, async () => {
      const response = await protocol.getMetaItems({ type: 'object' });
      return HttpResponse.json(response, { status: 200 });
    }),
    http.get(`${baseUrl}/metadata/objects`, async () => {
      const response = await protocol.getMetaItems({ type: 'object' });
      return HttpResponse.json(response, { status: 200 });
    }),

    http.get(`${baseUrl}/meta/objects/:objectName`, async ({ params }) => {
      console.log('MSW: getting meta item for (legacy)', params.objectName);
      try {
        const response = await protocol.getMetaItem({ 
          type: 'object', 
          name: params.objectName as string 
        });
        return HttpResponse.json(response || { error: 'Not found' }, { status: response ? 200 : 404 });
      } catch (e) {
        return HttpResponse.json({ error: String(e) }, { status: 500 });
      }
    }),

    http.get(`${baseUrl}/meta/object/:objectName`, async ({ params }) => {
      console.log('MSW: getting meta item for /meta/object', params.objectName);
      try {
        const response = await protocol.getMetaItem({ 
          type: 'object', 
          name: params.objectName as string 
        });
        
        // Unwrap item if present
        const payload = (response && response.item) ? response.item : response;
        
        return HttpResponse.json(payload || { error: 'Not found' }, { status: payload ? 200 : 404 });
      } catch (e) {
        console.error('MSW: error getting meta item', e);
        return HttpResponse.json({ error: String(e) }, { status: 500 });
      }
    }),

    http.get(`${baseUrl}/metadata/object/:objectName`, async ({ params }) => {
      console.log('MSW: getting meta item for', params.objectName);
      try {
        const response = await protocol.getMetaItem({ 
          type: 'object', 
          name: params.objectName as string 
        });
        
        // Unwrap item if present
        const payload = (response && response.item) ? response.item : response;
        
        return HttpResponse.json(payload || { error: 'Not found' }, { status: payload ? 200 : 404 });
      } catch (e) {
        console.error('MSW: error getting meta item', e);
        return HttpResponse.json({ error: String(e) }, { status: 500 });
      }
    }),

    // Data endpoints - Find all
    http.get(`${baseUrl}/data/:objectName`, async ({ params, request }) => {
      const url = new URL(request.url);
      const query: any = {};
      
      // Parse query parameters
      url.searchParams.forEach((value, key) => {
        try {
          query[key] = JSON.parse(value);
        } catch {
          query[key] = value;
        }
      });

      // Use driver directly
      const response = await driver.find(params.objectName as string, query);
      return HttpResponse.json({ value: response }, { status: 200 }); // Wrap in value for OData/Client?
    }),

    // Data endpoints - Find by ID
    http.get(`${baseUrl}/data/:objectName/:id`, async ({ params }) => {
      try {
        console.log('MSW: getData', params.objectName, params.id);
        
        // Fetch ALL records for the object to ensure we find it regardless of driver query syntax quirks
        const allRecords = await driver.find(params.objectName as string, {
            object: params.objectName as string
        });

        // Manual filter
        const record = allRecords ? allRecords.find((r: any) => 
            String(r.id) === String(params.id) || 
            String(r._id) === String(params.id)
        ) : null;
        
        console.log('MSW: getData result', JSON.stringify(record));
        return HttpResponse.json(record, { status: record ? 200 : 404 });
      } catch (e) {
        console.error('MSW: getData error', e); 
        return HttpResponse.json({ error: String(e) }, { status: 500 });
      }
    }),

    // Data endpoints - Create
    http.post(`${baseUrl}/data/:objectName`, async ({ params, request }) => {
      const body = await request.json();
      console.log('MSW: createData', params.objectName, JSON.stringify(body));
      const response = await driver.create(params.objectName as string, body as any);
      console.log('MSW: createData result', JSON.stringify(response));
      return HttpResponse.json(response, { status: 201 });
    }),

    // Data endpoints - Update
    http.patch(`${baseUrl}/data/:objectName/:id`, async ({ params, request }) => {
      const body = await request.json();
      console.log('MSW: updateData', params.objectName, params.id, JSON.stringify(body));
      const response = await driver.update(params.objectName as string, params.id as string, body as any);
      console.log('MSW: updateData result', JSON.stringify(response));
      return HttpResponse.json(response, { status: 200 });
    }),

    // Data endpoints - Delete
    http.delete(`${baseUrl}/data/:objectName/:id`, async ({ params }) => {
      const response = await driver.delete(params.objectName as string, params.id as string);
      return HttpResponse.json(response, { status: 200 });
    }),
  ];
}
