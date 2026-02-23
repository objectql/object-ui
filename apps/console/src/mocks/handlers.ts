/**
 * Shared MSW Handler Factory
 *
 * Creates MSW request handlers for ObjectStack API endpoints.
 * Response shapes intentionally match HonoServerPlugin / RestServer so that
 * ObjectStackAdapter works identically in both MSW and server mode.
 *
 * Used by both browser.ts (setupWorker) and server.ts (setupServer).
 */

import { ObjectKernel } from '@objectstack/runtime';
import { InMemoryDriver } from '@objectstack/driver-memory';
import { http, HttpResponse } from 'msw';

/** Minimal shape of the stack config used to enrich protocol responses. */
interface StackConfig {
  objects?: Array<{ name: string; listViews?: Record<string, unknown> }>;
}

/**
 * Create MSW request handlers for a given base URL.
 *
 * @param baseUrl   - URL prefix, e.g. '/api/v1' (browser) or 'http://localhost:3000/api/v1' (node)
 * @param kernel    - Bootstrapped ObjectKernel with protocol service
 * @param driver    - InMemoryDriver for direct data access
 * @param appConfig - Original stack config (used to enrich protocol responses with listViews)
 */
export function createHandlers(baseUrl: string, kernel: ObjectKernel, driver: InMemoryDriver, appConfig?: StackConfig) {
  const protocol = kernel.getService('protocol') as any;

  // Build a lookup of listViews by object name from the original config.
  // The runtime protocol strips listViews from object metadata, so we
  // re-attach them here to ensure the console can resolve named views.
  const listViewsByObject: Record<string, Record<string, unknown>> = {};
  if (appConfig?.objects) {
    for (const obj of appConfig.objects) {
      if (obj.listViews && Object.keys(obj.listViews).length > 0) {
        listViewsByObject[obj.name] = obj.listViews;
      }
    }
  }

  /** Merge listViews from config into a single object metadata item. */
  function enrichObject(obj: any): any {
    const views = listViewsByObject[obj.name];
    return views ? { ...obj, listViews: { ...(obj.listViews || {}), ...views } } : obj;
  }

  // Determine whether we're in a browser (relative paths, wildcard prefix)
  // or in Node.js tests (absolute URLs)
  const isBrowser = !baseUrl.startsWith('http');
  const prefix = isBrowser ? '*' : '';

  // For .well-known, extract origin (Node) or use wildcard (browser)
  const wellKnownPrefix = isBrowser
    ? '*'
    : new URL(baseUrl).origin;

  return [
    // ── Discovery ────────────────────────────────────────────────────────
    http.get(`${wellKnownPrefix}/.well-known/objectstack`, async () => {
      const response = await protocol.getDiscovery();
      return HttpResponse.json(response, { status: 200 });
    }),

    http.get(`${prefix}${baseUrl}`, async () => {
      const response = await protocol.getDiscovery();
      return HttpResponse.json(response, { status: 200 });
    }),
    http.get(`${prefix}${baseUrl}/`, async () => {
      const response = await protocol.getDiscovery();
      return HttpResponse.json(response, { status: 200 });
    }),

    // ── Metadata: list items by type ────────────────────────────────────
    // The client sends GET /meta/<type> where <type> is singular (e.g. app,
    // object, dashboard, report, page).  We also keep the legacy plural
    // routes (/meta/apps, /meta/objects, …) for backward compatibility.
    // A single dynamic handler covers both forms.
    http.get(`${prefix}${baseUrl}/meta/:type`, async ({ params }) => {
      const metadataType = params.type as string;
      const response = await protocol.getMetaItems({ type: metadataType });
      // Enrich object metadata with listViews from stack config
      if ((metadataType === 'object' || metadataType === 'objects') && response?.items) {
        response.items = response.items.map(enrichObject);
      }
      return HttpResponse.json(response, { status: 200 });
    }),
    http.get(`${prefix}${baseUrl}/metadata/:type`, async ({ params }) => {
      const metadataType = params.type as string;
      const response = await protocol.getMetaItems({ type: metadataType });
      if ((metadataType === 'object' || metadataType === 'objects') && response?.items) {
        response.items = response.items.map(enrichObject);
      }
      return HttpResponse.json(response, { status: 200 });
    }),

    // ── Metadata: single item by type + name ─────────────────────────────
    http.get(`${prefix}${baseUrl}/meta/:type/:name`, async ({ params }) => {
      try {
        const response = await protocol.getMetaItem({
          type: params.type as string,
          name: params.name as string
        });
        let payload = (response && response.item) ? response.item : response;
        if ((params.type === 'object' || params.type === 'objects') && payload?.name) {
          payload = enrichObject(payload);
        }
        return HttpResponse.json(payload || { error: 'Not found' }, { status: payload ? 200 : 404 });
      } catch (e) {
        return HttpResponse.json({ error: String(e) }, { status: 500 });
      }
    }),
    http.get(`${prefix}${baseUrl}/metadata/:type/:name`, async ({ params }) => {
      try {
        const response = await protocol.getMetaItem({
          type: params.type as string,
          name: params.name as string
        });
        let payload = (response && response.item) ? response.item : response;
        if ((params.type === 'object' || params.type === 'objects') && payload?.name) {
          payload = enrichObject(payload);
        }
        return HttpResponse.json(payload || { error: 'Not found' }, { status: payload ? 200 : 404 });
      } catch (e) {
        return HttpResponse.json({ error: String(e) }, { status: 500 });
      }
    }),

    // ── Metadata: save item by type + name ───────────────────────────────
    http.put(`${prefix}${baseUrl}/meta/:type/:name`, async ({ params, request }) => {
      try {
        const body = await request.json();
        if (typeof protocol.saveMetaItem === 'function') {
          const result = await protocol.saveMetaItem({
            type: params.type as string,
            name: params.name as string,
            item: body,
          });
          return HttpResponse.json(result, { status: 200 });
        }
        return HttpResponse.json({ error: 'Save not supported' }, { status: 501 });
      } catch (e) {
        return HttpResponse.json({ error: String(e) }, { status: 500 });
      }
    }),
    http.put(`${prefix}${baseUrl}/metadata/:type/:name`, async ({ params, request }) => {
      try {
        const body = await request.json();
        if (typeof protocol.saveMetaItem === 'function') {
          const result = await protocol.saveMetaItem({
            type: params.type as string,
            name: params.name as string,
            item: body,
          });
          return HttpResponse.json(result, { status: 200 });
        }
        return HttpResponse.json({ error: 'Save not supported' }, { status: 501 });
      } catch (e) {
        return HttpResponse.json({ error: String(e) }, { status: 500 });
      }
    }),

    // ── Data: find all ──────────────────────────────────────────────────
    http.get(`${prefix}${baseUrl}/data/:objectName`, async ({ params, request }) => {
      const url = new URL(request.url);
      const query: any = {};

      url.searchParams.forEach((value, key) => {
        try {
          query[key] = JSON.parse(value);
        } catch {
          query[key] = value;
        }
      });

      const response = await driver.find(params.objectName as string, query);
      return HttpResponse.json({ value: response }, { status: 200 });
    }),

    // ── Data: find by ID ────────────────────────────────────────────────
    http.get(`${prefix}${baseUrl}/data/:objectName/:id`, async ({ params }) => {
      try {
        const allRecords = await driver.find(params.objectName as string, {
          object: params.objectName as string
        });
        const record = allRecords
          ? allRecords.find((r: any) =>
              String(r.id) === String(params.id) ||
              String(r._id) === String(params.id)
            )
          : null;

        return HttpResponse.json({ record }, { status: record ? 200 : 404 });
      } catch (e) {
        console.error('[MSW] getData error', e);
        return HttpResponse.json({ error: String(e) }, { status: 500 });
      }
    }),

    // ── Data: create ────────────────────────────────────────────────────
    http.post(`${prefix}${baseUrl}/data/:objectName`, async ({ params, request }) => {
      const body = await request.json();
      const response = await driver.create(params.objectName as string, body as any);
      return HttpResponse.json({ record: response }, { status: 201 });
    }),

    // ── Data: update ────────────────────────────────────────────────────
    http.patch(`${prefix}${baseUrl}/data/:objectName/:id`, async ({ params, request }) => {
      const body = await request.json();
      const response = await driver.update(params.objectName as string, params.id as string, body as any);
      return HttpResponse.json({ record: response }, { status: 200 });
    }),

    // ── Data: delete ────────────────────────────────────────────────────
    http.delete(`${prefix}${baseUrl}/data/:objectName/:id`, async ({ params }) => {
      const response = await driver.delete(params.objectName as string, params.id as string);
      return HttpResponse.json(response, { status: 200 });
    }),
  ];
}
