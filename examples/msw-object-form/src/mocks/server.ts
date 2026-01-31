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
import appConfig from '../../objectstack.config';

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
  kernel = new ObjectKernel();
  
  kernel
    .use(new ObjectQLPlugin())
    .use(new DriverPlugin(driver, 'memory'))
    .use(new AppPlugin(appConfig));
  
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

  // Create MSW handlers manually
  const baseUrl = 'http://localhost:3000/api/v1';
  const handlers = createHandlers(baseUrl, kernel);
  
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
function createHandlers(baseUrl: string, kernel: ObjectKernel) {
  const protocol = kernel.getService('protocol');
  
  return [
    // Discovery endpoint
    http.get(`${baseUrl}/`, async () => {
      const response = await protocol.handleDiscovery();
      return HttpResponse.json(response, { status: 200 });
    }),

    // Metadata endpoints
    http.get(`${baseUrl}/meta/objects`, async () => {
      const response = await protocol.handleMetadataListObjects();
      return HttpResponse.json(response, { status: 200 });
    }),

    http.get(`${baseUrl}/meta/objects/:objectName`, async ({ params }) => {
      const response = await protocol.handleMetadataGetObject({ objectName: params.objectName as string });
      return HttpResponse.json(response, { status: 200 });
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

      const response = await protocol.handleFind({
        objectName: params.objectName as string,
        query
      });
      return HttpResponse.json(response, { status: 200 });
    }),

    // Data endpoints - Find by ID
    http.get(`${baseUrl}/data/:objectName/:id`, async ({ params }) => {
      const response = await protocol.handleFindById({
        objectName: params.objectName as string,
        id: params.id as string
      });
      return HttpResponse.json(response, { status: 200 });
    }),

    // Data endpoints - Create
    http.post(`${baseUrl}/data/:objectName`, async ({ params, request }) => {
      const body = await request.json();
      const response = await protocol.handleCreate({
        objectName: params.objectName as string,
        data: body
      });
      return HttpResponse.json(response, { status: 201 });
    }),

    // Data endpoints - Update
    http.patch(`${baseUrl}/data/:objectName/:id`, async ({ params, request }) => {
      const body = await request.json();
      const response = await protocol.handleUpdate({
        objectName: params.objectName as string,
        id: params.id as string,
        data: body
      });
      return HttpResponse.json(response, { status: 200 });
    }),

    // Data endpoints - Delete
    http.delete(`${baseUrl}/data/:objectName/:id`, async ({ params }) => {
      const response = await protocol.handleDelete({
        objectName: params.objectName as string,
        id: params.id as string
      });
      return HttpResponse.json(response, { status: 200 });
    }),
  ];
}
