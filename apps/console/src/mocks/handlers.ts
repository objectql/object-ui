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

/**
 * Create MSW request handlers for a given base URL.
 *
 * @param baseUrl - URL prefix, e.g. '/api/v1' (browser) or 'http://localhost:3000/api/v1' (node)
 * @param kernel  - Bootstrapped ObjectKernel with protocol service
 * @param driver  - InMemoryDriver for direct data access
 */
export function createHandlers(baseUrl: string, kernel: ObjectKernel, driver: InMemoryDriver) {
  const protocol = kernel.getService('protocol') as any;

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

    // ── Metadata: list objects ───────────────────────────────────────────
    http.get(`${prefix}${baseUrl}/meta/objects`, async () => {
      const response = await protocol.getMetaItems({ type: 'object' });
      return HttpResponse.json(response, { status: 200 });
    }),
    http.get(`${prefix}${baseUrl}/metadata/objects`, async () => {
      const response = await protocol.getMetaItems({ type: 'object' });
      return HttpResponse.json(response, { status: 200 });
    }),

    // ── Metadata: single object (legacy /meta/objects/:name) ─────────────
    http.get(`${prefix}${baseUrl}/meta/objects/:objectName`, async ({ params }) => {
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
    http.get(`${prefix}${baseUrl}/meta/object/:objectName`, async ({ params }) => {
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

    http.get(`${prefix}${baseUrl}/metadata/object/:objectName`, async ({ params }) => {
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
    http.get(`${prefix}${baseUrl}/meta/apps`, async () => {
      const response = await protocol.getMetaItems({ type: 'app' });
      return HttpResponse.json(response, { status: 200 });
    }),
    http.get(`${prefix}${baseUrl}/metadata/apps`, async () => {
      const response = await protocol.getMetaItems({ type: 'app' });
      return HttpResponse.json(response, { status: 200 });
    }),

    // ── Metadata: dashboards ────────────────────────────────────────────
    http.get(`${prefix}${baseUrl}/meta/dashboards`, async () => {
      const response = await protocol.getMetaItems({ type: 'dashboard' });
      return HttpResponse.json(response, { status: 200 });
    }),
    http.get(`${prefix}${baseUrl}/metadata/dashboards`, async () => {
      const response = await protocol.getMetaItems({ type: 'dashboard' });
      return HttpResponse.json(response, { status: 200 });
    }),

    // ── Metadata: reports ───────────────────────────────────────────────
    http.get(`${prefix}${baseUrl}/meta/reports`, async () => {
      const response = await protocol.getMetaItems({ type: 'report' });
      return HttpResponse.json(response, { status: 200 });
    }),
    http.get(`${prefix}${baseUrl}/metadata/reports`, async () => {
      const response = await protocol.getMetaItems({ type: 'report' });
      return HttpResponse.json(response, { status: 200 });
    }),

    // ── Metadata: pages ─────────────────────────────────────────────────
    http.get(`${prefix}${baseUrl}/meta/pages`, async () => {
      const response = await protocol.getMetaItems({ type: 'page' });
      return HttpResponse.json(response, { status: 200 });
    }),
    http.get(`${prefix}${baseUrl}/metadata/pages`, async () => {
      const response = await protocol.getMetaItems({ type: 'page' });
      return HttpResponse.json(response, { status: 200 });
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
