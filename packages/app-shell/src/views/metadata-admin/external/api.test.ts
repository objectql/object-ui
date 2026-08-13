// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  listRemoteTables,
  generateObjectDraft,
  validateDatasource,
  importObjectDraft,
  ExternalServiceUnavailableError,
  type ObjectDraft,
} from './api';

/**
 * Build a minimal Response-like object the client's `jsonOrThrow` accepts.
 *
 * `headers` is real (objectui#4467): these calls go out through
 * `createAuthenticatedFetch`, which reads `set-auth-token` off every API
 * response to adopt a session rotation the server declares — the same capture
 * the auth lane has always done. A fake that omits `headers` is not a
 * `Response`, and the cast is the only reason the compiler ever believed it
 * was; an empty `Headers` keeps the fake honest without asserting anything
 * about rotation.
 */
function jsonResponse(body: unknown, init: { status?: number; ok?: boolean } = {}): Response {
  const status = init.status ?? 200;
  return {
    ok: init.ok ?? status < 400,
    status,
    statusText: 'STATUS',
    headers: new Headers(),
    json: async () => body,
  } as unknown as Response;
}

function stubFetch(impl: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
    impl(typeof input === 'string' ? input : String(input), init),
  );
  vi.stubGlobal('fetch', spy);
  return spy;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('external datasource api', () => {
  it('lists remote tables and unwraps the { tables } envelope', async () => {
    const spy = stubFetch(() =>
      jsonResponse({ tables: [{ schema: 'public', name: 'orders', columnCount: 7 }] }),
    );
    const tables = await listRemoteTables('warehouse');
    expect(tables).toEqual([{ schema: 'public', name: 'orders', columnCount: 7 }]);
    const url = String(spy.mock.calls[0][0]);
    expect(url).toContain('/api/v1/datasources/warehouse/external/tables');
  });

  it('passes the ?schema filter through', async () => {
    const spy = stubFetch(() => jsonResponse({ tables: [] }));
    await listRemoteTables('warehouse', { schema: 'analytics' });
    expect(String(spy.mock.calls[0][0])).toContain('tables?schema=analytics');
  });

  it('maps 503 external_service_unavailable to a typed error', async () => {
    stubFetch(() => jsonResponse({ error: 'external_service_unavailable' }, { status: 503, ok: false }));
    await expect(listRemoteTables('warehouse')).rejects.toBeInstanceOf(
      ExternalServiceUnavailableError,
    );
  });

  it('surfaces a generic server error message', async () => {
    stubFetch(() => jsonResponse({ error: 'boom' }, { status: 500, ok: false }));
    await expect(validateDatasource('warehouse')).rejects.toThrow('boom');
  });

  it('POSTs draft generation with the remote schema option', async () => {
    const spy = stubFetch(() =>
      jsonResponse({
        draft: { name: 'orders', datasource: 'warehouse', definition: {}, source: '', review: [] },
      }),
    );
    const draft = await generateObjectDraft('warehouse', 'orders', { remoteSchema: 'public' });
    expect(draft.name).toBe('orders');
    const [url, init] = spy.mock.calls[0];
    expect(String(url)).toContain('/external/tables/orders/draft');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ remoteSchema: 'public' });
  });

  it('imports a draft as an object via PUT /meta/object/:name', async () => {
    const spy = stubFetch(() => jsonResponse({ ok: true }));
    const draft: ObjectDraft = {
      name: 'orders',
      datasource: 'warehouse',
      definition: { name: 'orders', label: 'Orders' },
      source: '',
      review: [],
    };
    await importObjectDraft(draft);
    const [url, init] = spy.mock.calls[0];
    expect(String(url)).toContain('/api/v1/meta/object/orders');
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(String(init?.body))).toEqual({ name: 'orders', label: 'Orders' });
  });
});
