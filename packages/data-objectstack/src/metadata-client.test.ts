/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MetadataClient } from './metadata-client';

function mockFetch(handler: (url: string, init?: RequestInit) => Promise<Response>): typeof fetch {
  return vi.fn(handler) as unknown as typeof fetch;
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

describe('MetadataClient', () => {
  let urls: string[];
  let inits: (RequestInit | undefined)[];

  beforeEach(() => {
    urls = [];
    inits = [];
  });

  function client(baseUrl: string, environmentId?: string) {
    return new MetadataClient({
      baseUrl,
      environmentId,
      fetch: mockFetch(async (url, init) => {
        urls.push(url);
        inits.push(init);
        if (init?.method === 'PUT' || init?.method === 'DELETE') {
          return jsonResponse({ ok: true });
        }
        if (url.endsWith('/meta')) return jsonResponse([{ type: 'object' }]);
        if (url.match(/\/meta\/object$/)) return jsonResponse([{ name: 'account' }]);
        if (url.match(/\/meta\/object\/account$/)) {
          return jsonResponse({ name: 'account', label: 'Account' });
        }
        if (url.match(/\/meta\/object\/missing$/)) {
          return new Response('not found', { status: 404 });
        }
        if (url.match(/history$/)) return jsonResponse({ events: [] });
        return jsonResponse({ items: [{ name: 'fallback' }] });
      }),
    });
  }

  it('builds unscoped URLs against the bare baseUrl', async () => {
    await client('http://localhost:3000').list('object');
    expect(urls[0]).toBe('http://localhost:3000/api/v1/meta/object');
  });

  it('builds scoped URLs when environmentId is set', async () => {
    await client('http://localhost:3000', 'env_42').list('object');
    expect(urls[0]).toBe('http://localhost:3000/api/v1/environments/env_42/meta/object');
  });

  it('collapses /api/v1 suffix on baseUrl to avoid duplication', async () => {
    await client('http://localhost:3000/api/v1').list('object');
    expect(urls[0]).toBe('http://localhost:3000/api/v1/meta/object');
  });

  it('returns null on 404 from get()', async () => {
    const result = await client('http://localhost:3000').get('object', 'missing');
    expect(result).toBeNull();
  });

  it('unwraps `items` envelope on list when the server returns one', async () => {
    const c = new MetadataClient({
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch(async () => jsonResponse({ items: [{ name: 'wrapped' }] })),
    });
    const items = await c.list<{ name: string }>('field');
    expect(items).toEqual([{ name: 'wrapped' }]);
  });

  it('sends If-Match and X-Actor headers on save when provided', async () => {
    await client('http://localhost:3000').save('object', 'account', { foo: 1 }, {
      ifMatch: 'sha256:abc',
      actor: 'user_1',
    });
    expect(inits[0]?.method).toBe('PUT');
    const headers = inits[0]?.headers as Record<string, string>;
    expect(headers['If-Match']).toBe('sha256:abc');
    expect(headers['X-Actor']).toBe('user_1');
    expect(headers['Content-Type']).toBe('application/json');
    expect(inits[0]?.body).toBe(JSON.stringify({ foo: 1 }));
  });

  it('encodes type and name path segments', async () => {
    await client('http://localhost:3000').get('object', 'has spaces');
    expect(urls[0]).toBe('http://localhost:3000/api/v1/meta/object/has%20spaces');
  });

  it('builds history URL with query params', async () => {
    await client('http://localhost:3000').history('view', 'all', { sinceSeq: 10, limit: 5 });
    expect(urls[0]).toBe('http://localhost:3000/api/v1/meta/view/all/history?sinceSeq=10&limit=5');
  });

  it('throws MetadataError with status and body on failure', async () => {
    const c = new MetadataClient({
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch(async () =>
        new Response(JSON.stringify({ error: 'metadata_conflict', code: 'metadata_conflict' }), {
          status: 409,
          headers: { 'content-type': 'application/json' },
        })),
    });
    await expect(c.save('object', 'account', {})).rejects.toMatchObject({
      status: 409,
      code: 'metadata_conflict',
      message: 'metadata_conflict',
    });
  });

  it('extracts message, code + field-anchored issues from the dispatcher error shape', async () => {
    // The dispatcher sends `error` as an OBJECT { message, code, details:{ code, issues } }.
    // Reading `.message` (not String(object) → "[object Object]") and surfacing
    // `details.issues` is what lets the Studio point at the offending field.
    const c = new MetadataClient({
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch(async () =>
        new Response(
          JSON.stringify({
            success: false,
            error: {
              message: '[invalid_metadata] object/bad failed spec validation: label: Required',
              code: 422,
              details: {
                code: 'invalid_metadata',
                issues: [{ path: 'label', message: 'Required', code: 'invalid_type' }],
              },
            },
          }),
          { status: 422, headers: { 'content-type': 'application/json' } },
        )),
    });
    await expect(c.save('object', 'bad', {})).rejects.toMatchObject({
      status: 422,
      code: 'invalid_metadata',
      message: '[invalid_metadata] object/bad failed spec validation: label: Required',
      issues: [{ path: 'label', message: 'Required', code: 'invalid_type' }],
    });
  });

  it('listDrafts requests /meta/_drafts with packageId + type and parses {drafts}', async () => {
    const seen: string[] = [];
    const c = new MetadataClient({
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch(async (url) => {
        seen.push(url);
        return jsonResponse({
          drafts: [{ type: 'object', name: 'course', packageId: 'app.edu', updatedAt: 't', updatedBy: 'ai' }],
        });
      }),
    });
    const out = await c.listDrafts({ packageId: 'app.edu', type: 'object' });
    expect(seen[0]).toBe('http://localhost:3000/api/v1/meta/_drafts?packageId=app.edu&type=object');
    expect(out).toEqual([
      { type: 'object', name: 'course', packageId: 'app.edu', updatedAt: 't', updatedBy: 'ai' },
    ]);
  });

  it('listDrafts tolerates the {data:{drafts}} envelope and a bare array', async () => {
    const enveloped = new MetadataClient({
      baseUrl: '',
      fetch: mockFetch(async () =>
        jsonResponse({ data: { drafts: [{ type: 'view', name: 'v', packageId: null, updatedAt: null, updatedBy: null }] } })),
    });
    expect((await enveloped.listDrafts()).map((d) => d.name)).toEqual(['v']);

    const bare = new MetadataClient({
      baseUrl: '',
      fetch: mockFetch(async () =>
        jsonResponse([{ type: 'object', name: 'b', packageId: null, updatedAt: null, updatedBy: null }])),
    });
    expect((await bare.listDrafts()).map((d) => d.name)).toEqual(['b']);
  });

  it('publishDraft POSTs /meta/:type/:name/publish (promotes a draft by ref, no package needed)', async () => {
    const seen: { url: string; method?: string }[] = [];
    const c = new MetadataClient({
      baseUrl: 'http://localhost:3000',
      fetch: mockFetch(async (url, init) => {
        seen.push({ url, method: init?.method });
        return jsonResponse({ success: true });
      }),
    });
    await c.publishDraft('dashboard', 'sales_dashboard');
    expect(seen[0]?.method).toBe('POST');
    expect(seen[0]?.url).toBe('http://localhost:3000/api/v1/meta/dashboard/sales_dashboard/publish');
  });

  it('publishDraft throws on a non-ok response', async () => {
    const c = new MetadataClient({
      baseUrl: '',
      fetch: mockFetch(async () => new Response('nope', { status: 500 })),
    });
    await expect(c.publishDraft('view', 'x')).rejects.toBeTruthy();
  });

  it('publishDraft returns the result (incl. seedApplied) and unwraps the {data} envelope', async () => {
    // Flat shape (rest-server passes protocol result through).
    const flat = new MetadataClient({
      baseUrl: '',
      fetch: mockFetch(async () =>
        jsonResponse({ success: true, seedApplied: { success: false, error: 'no readable seed bodies' } })),
    });
    const r1 = await flat.publishDraft('seed', 'job_sample');
    expect(r1.seedApplied).toEqual({ success: false, error: 'no readable seed bodies' });

    // Dispatcher `{ success, data: {...} }` envelope.
    const enveloped = new MetadataClient({
      baseUrl: '',
      fetch: mockFetch(async () =>
        jsonResponse({ success: true, data: { success: true, seedApplied: { success: true, inserted: 6, updated: 0 } } })),
    });
    const r2 = await enveloped.publishDraft('seed', 'candidate_sample');
    expect(r2.seedApplied).toEqual({ success: true, inserted: 6, updated: 0 });
  });
});

describe('MetadataClient — ADR-0037 previewDrafts', () => {
  function previewClient(opts: { previewDrafts?: boolean; environmentId?: string } = {}) {
    const urls: string[] = [];
    const c = new MetadataClient({
      baseUrl: 'http://localhost:3000',
      ...opts,
      fetch: mockFetch(async (url) => {
        urls.push(url);
        return jsonResponse([{ name: 'account' }]);
      }),
    });
    return { c, urls };
  }

  it('list() and get() append ?preview=draft when enabled', async () => {
    const { c, urls } = previewClient({ previewDrafts: true });
    await c.list('object');
    await c.get('object', 'account');
    expect(urls[0]).toBe('http://localhost:3000/api/v1/meta/object?preview=draft');
    expect(urls[1]).toBe('http://localhost:3000/api/v1/meta/object/account?preview=draft');
  });

  it('combines preview with the package filter on list()', async () => {
    const { c, urls } = previewClient({ previewDrafts: true });
    await c.list('object', { packageId: 'app.crm' });
    expect(urls[0]).toBe('http://localhost:3000/api/v1/meta/object?package=app.crm&preview=draft');
  });

  it('an explicit state=draft read wins over the overlay flag', async () => {
    const { c, urls } = previewClient({ previewDrafts: true });
    await c.get('object', 'account', { state: 'draft' });
    expect(urls[0]).toBe('http://localhost:3000/api/v1/meta/object/account?state=draft');
  });

  it('default client never sends the flag', async () => {
    const { c, urls } = previewClient();
    await c.list('object');
    await c.get('object', 'account');
    expect(urls[0]).not.toContain('preview');
    expect(urls[1]).not.toContain('preview');
  });

  it('withPreviewDrafts derives a preview client and PRESERVES the environment scope', async () => {
    const { c } = previewClient({ environmentId: 'env_1' });
    const p = c.withPreviewDrafts(true);
    expect(p.previewDrafts).toBe(true);
    // Same instance back when the flag already matches.
    expect(p.withPreviewDrafts(true)).toBe(p);
    // Environment-scoped path survives the derivation (regression guard:
    // a naive rebuild dropped /environments/:id from the base).
    const urls: string[] = [];
    const scoped = new MetadataClient({
      baseUrl: 'http://localhost:3000',
      environmentId: 'env_1',
      previewDrafts: false,
      fetch: mockFetch(async (url) => {
        urls.push(url);
        return jsonResponse([]);
      }),
    }).withPreviewDrafts(true);
    await scoped.list('object');
    expect(urls[0]).toBe('http://localhost:3000/api/v1/environments/env_1/meta/object?preview=draft');
  });
});
