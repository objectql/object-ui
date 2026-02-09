/**
 * MSW Browser Worker Setup via ObjectStack Runtime
 *
 * Bootstraps a full ObjectStack kernel (ObjectQL + InMemoryDriver + AppPlugin)
 * in the browser, then creates MSW handlers manually so responses match the
 * format the ObjectStackClient expects (same as HonoServerPlugin / RestServer).
 *
 * This intentionally does NOT use @objectstack/plugin-msw because its
 * HttpDispatcher wraps every response in a { success, data } envelope that
 * the client does not expect.
 */

import { ObjectKernel, DriverPlugin, AppPlugin } from '@objectstack/runtime';
import { ObjectQLPlugin } from '@objectstack/objectql';
import { InMemoryDriver } from '@objectstack/driver-memory';
import { setupWorker } from 'msw/browser';
import { http, HttpResponse } from 'msw';
import appConfig from '../../objectstack.shared';

let kernel: ObjectKernel | null = null;
let driver: InMemoryDriver | null = null;
let worker: ReturnType<typeof setupWorker> | null = null;

export async function startMockServer() {
  // Polyfill process.on for ObjectKernel in browser environment
  try {
    if (typeof process !== 'undefined' && !(process as any).on) {
      (process as any).on = () => {};
    }
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[MSW] Failed to polyfill process.on', e);
  }

  if (kernel) {
    if (import.meta.env.DEV) console.log('[MSW] ObjectStack Runtime already initialized');
    return kernel;
  }

  if (import.meta.env.DEV) console.log('[MSW] Starting ObjectStack Runtime (Browser Mode)...');

  driver = new InMemoryDriver();

  kernel = new ObjectKernel({
    skipSystemValidation: true
  });

  await kernel.use(new ObjectQLPlugin());
  await kernel.use(new DriverPlugin(driver, 'memory'));
  await kernel.use(new AppPlugin(appConfig));

  // Bootstrap kernel WITHOUT MSW plugin — we create handlers manually below
  await kernel.bootstrap();

  // Create MSW handlers that match the response format of HonoServerPlugin
  const baseUrl = '/api/v1';
  const handlers = createHandlers(baseUrl, kernel, driver);

  // Start MSW service worker
  worker = setupWorker(...handlers);
  await worker.start({ onUnhandledRequest: 'bypass' });

  if (import.meta.env.DEV) console.log('[MSW] ObjectStack Runtime ready');
  return kernel;
}

export function stopMockServer() {
  if (worker) {
    worker.stop();
    worker = null;
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
 * Create MSW request handlers for ObjectStack API.
 *
 * Response shapes intentionally match HonoServerPlugin / RestServer so that
 * ObjectStackClient works identically in both MSW and server mode.
 */
function createHandlers(baseUrl: string, kernel: ObjectKernel, driver: InMemoryDriver) {
  const protocol = kernel.getService('protocol') as any;

  return [
    // ── Discovery ────────────────────────────────────────────────────────
    http.get('*/.well-known/objectstack', async () => {
      const response = await protocol.getDiscovery();
      return HttpResponse.json(response, { status: 200 });
    }),

    http.get(`*${baseUrl}`, async () => {
      const response = await protocol.getDiscovery();
      return HttpResponse.json(response, { status: 200 });
    }),
    http.get(`*${baseUrl}/`, async () => {
      const response = await protocol.getDiscovery();
      return HttpResponse.json(response, { status: 200 });
    }),

    // ── Metadata: list objects ───────────────────────────────────────────
    http.get(`*${baseUrl}/meta/objects`, async () => {
      const response = await protocol.getMetaItems({ type: 'object' });
      return HttpResponse.json(response, { status: 200 });
    }),
    http.get(`*${baseUrl}/metadata/objects`, async () => {
      const response = await protocol.getMetaItems({ type: 'object' });
      return HttpResponse.json(response, { status: 200 });
    }),

    // ── Metadata: single object (legacy /meta/objects/:name) ─────────────
    http.get(`*${baseUrl}/meta/objects/:objectName`, async ({ params }) => {
      if (import.meta.env.DEV) console.log('[MSW] meta/objects/', params.objectName);
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

    // ── Metadata: single object (/meta/object/:name & /metadata/object/:name)
    http.get(`*${baseUrl}/meta/object/:objectName`, async ({ params }) => {
      if (import.meta.env.DEV) console.log('[MSW] meta/object/', params.objectName);
      try {
        const response = await protocol.getMetaItem({
          type: 'object',
          name: params.objectName as string
        });
        const payload = (response && response.item) ? response.item : response;
        return HttpResponse.json(payload || { error: 'Not found' }, { status: payload ? 200 : 404 });
      } catch (e) {
        console.error('[MSW] error getting meta item', e);
        return HttpResponse.json({ error: String(e) }, { status: 500 });
      }
    }),

    http.get(`*${baseUrl}/metadata/object/:objectName`, async ({ params }) => {
      if (import.meta.env.DEV) console.log('[MSW] metadata/object/', params.objectName);
      try {
        const response = await protocol.getMetaItem({
          type: 'object',
          name: params.objectName as string
        });
        const payload = (response && response.item) ? response.item : response;
        return HttpResponse.json(payload || { error: 'Not found' }, { status: payload ? 200 : 404 });
      } catch (e) {
        console.error('[MSW] error getting meta item', e);
        return HttpResponse.json({ error: String(e) }, { status: 500 });
      }
    }),

    // ── Metadata: apps ──────────────────────────────────────────────────
    http.get(`*${baseUrl}/meta/apps`, async () => {
      const response = await protocol.getMetaItems({ type: 'app' });
      return HttpResponse.json(response, { status: 200 });
    }),
    http.get(`*${baseUrl}/metadata/apps`, async () => {
      const response = await protocol.getMetaItems({ type: 'app' });
      return HttpResponse.json(response, { status: 200 });
    }),

    // ── Metadata: dashboards ────────────────────────────────────────────
    http.get(`*${baseUrl}/meta/dashboards`, async () => {
      const response = await protocol.getMetaItems({ type: 'dashboard' });
      return HttpResponse.json(response, { status: 200 });
    }),
    http.get(`*${baseUrl}/metadata/dashboards`, async () => {
      const response = await protocol.getMetaItems({ type: 'dashboard' });
      return HttpResponse.json(response, { status: 200 });
    }),

    // ── Metadata: reports ───────────────────────────────────────────────
    http.get(`*${baseUrl}/meta/reports`, async () => {
      const response = await protocol.getMetaItems({ type: 'report' });
      return HttpResponse.json(response, { status: 200 });
    }),
    http.get(`*${baseUrl}/metadata/reports`, async () => {
      const response = await protocol.getMetaItems({ type: 'report' });
      return HttpResponse.json(response, { status: 200 });
    }),

    // ── Metadata: pages ─────────────────────────────────────────────────
    http.get(`*${baseUrl}/meta/pages`, async () => {
      const response = await protocol.getMetaItems({ type: 'page' });
      return HttpResponse.json(response, { status: 200 });
    }),
    http.get(`*${baseUrl}/metadata/pages`, async () => {
      const response = await protocol.getMetaItems({ type: 'page' });
      return HttpResponse.json(response, { status: 200 });
    }),

    // ── Data: find all ──────────────────────────────────────────────────
    http.get(`*${baseUrl}/data/:objectName`, async ({ params, request }) => {
      const url = new URL(request.url);
      const query: any = {};

      url.searchParams.forEach((value, key) => {
        try {
          query[key] = JSON.parse(value);
        } catch {
          query[key] = value;
        }
      });

      if (import.meta.env.DEV) console.log('[MSW] find', params.objectName, query);
      const response = await driver.find(params.objectName as string, query);
      return HttpResponse.json({ value: response }, { status: 200 });
    }),

    // ── Data: find by ID ────────────────────────────────────────────────
    http.get(`*${baseUrl}/data/:objectName/:id`, async ({ params }) => {
      try {
        if (import.meta.env.DEV) console.log('[MSW] getData', params.objectName, params.id);

        const allRecords = await driver.find(params.objectName as string, {
          object: params.objectName as string
        });
        const record = allRecords
          ? allRecords.find((r: any) =>
              String(r.id) === String(params.id) ||
              String(r._id) === String(params.id)
            )
          : null;

        if (import.meta.env.DEV) console.log('[MSW] getData result', JSON.stringify(record));
        return HttpResponse.json({ record }, { status: record ? 200 : 404 });
      } catch (e) {
        console.error('[MSW] getData error', e);
        return HttpResponse.json({ error: String(e) }, { status: 500 });
      }
    }),

    // ── Data: create ────────────────────────────────────────────────────
    http.post(`*${baseUrl}/data/:objectName`, async ({ params, request }) => {
      const body = await request.json();
      if (import.meta.env.DEV) console.log('[MSW] create', params.objectName, JSON.stringify(body));
      const response = await driver.create(params.objectName as string, body as any);
      if (import.meta.env.DEV) console.log('[MSW] create result', JSON.stringify(response));
      return HttpResponse.json({ record: response }, { status: 201 });
    }),

    // ── Data: update ────────────────────────────────────────────────────
    http.patch(`*${baseUrl}/data/:objectName/:id`, async ({ params, request }) => {
      const body = await request.json();
      if (import.meta.env.DEV) console.log('[MSW] update', params.objectName, params.id, JSON.stringify(body));
      const response = await driver.update(params.objectName as string, params.id as string, body as any);
      if (import.meta.env.DEV) console.log('[MSW] update result', JSON.stringify(response));
      return HttpResponse.json({ record: response }, { status: 200 });
    }),

    // ── Data: delete ────────────────────────────────────────────────────
    http.delete(`*${baseUrl}/data/:objectName/:id`, async ({ params }) => {
      const response = await driver.delete(params.objectName as string, params.id as string);
      return HttpResponse.json(response, { status: 200 });
    }),
  ];
}
