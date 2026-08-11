/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import { ObjectStackAdapter } from './index';

/**
 * View metadata cache keys — invalidation matches the read keys (objectui#3778).
 *
 * `ObjectStackAdapter` caches exactly two view-shaped reads:
 *
 * | reader              | cache key                    |
 * |---------------------|------------------------------|
 * | `getView`           | `view:{object}:{viewId}`     |
 * | `listViewOverrides` | `view-overrides:{object}`    |
 *
 * `listViews` is **not** one of them: it fetches `meta.getItems('view')`
 * directly on every call, with no `metadataCache.get` wrapper. Five write
 * paths nevertheless used to invalidate a `views:{object}` key that no read
 * path has ever populated — five permanent no-ops. They are gone; these pins
 * keep both halves of that honest:
 *
 * 1. the surviving invalidations still name the keys that DO have readers, so
 *    the deletion cannot be mistaken for "cache invalidation was dropped"; and
 * 2. `listViews` keeps its uncached behavior — the deletion changed no
 *    request count, which is what makes it a pure dead-code removal rather
 *    than a caching change. (Whether `listViews` SHOULD be cached is a
 *    separate product question, deliberately not settled here.)
 */

interface Harness {
  ds: any;
  /** Every key passed to `metadataCache.invalidate`, in order. */
  invalidated: string[];
  /** Every key passed to `metadataCache.get`, in order. */
  cacheReads: string[];
  getItems: ReturnType<typeof vi.fn>;
  saveItem: ReturnType<typeof vi.fn>;
  deleteItem: ReturnType<typeof vi.fn>;
}

/**
 * Adapter with a recording metadata cache.
 *
 * @param opts.items      what `client.meta.getItems('view')` returns
 * @param opts.published  what `client.meta.getItem` answers (body, or an
 *                        Error to throw — a 404 means "no published overlay")
 * @param opts.draft      body served at `GET /meta/view/:name?state=draft`
 *                        (`null` → 404, i.e. nothing pending)
 */
function makeDS(opts: {
  items?: any[];
  published?: any | Error;
  draft?: any | null;
} = {}): Harness {
  const invalidated: string[] = [];
  const cacheReads: string[] = [];

  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    if (url.includes('/meta/view/')) {
      if ((init?.method ?? 'GET') === 'PUT') return json({ success: true, version: 2 });
      if (url.includes('state=draft')) {
        if (opts.draft == null) return json({ error: 'not found' }, 404);
        return json({ type: 'view', name: opts.draft.name, item: opts.draft });
      }
      return json({ error: 'not found' }, 404);
    }
    return json({ success: true, data: { capabilities: {}, routes: {} } });
  });

  const ds: any = new ObjectStackAdapter({ baseUrl: 'http://test.local', fetch: fetchImpl });
  ds.connected = true;
  ds.connectionState = 'connected';

  // Recording stand-in for the real MetadataCache: `get` records the key and
  // always misses (runs the loader), `invalidate` records the key.
  ds.metadataCache = {
    get: async (key: string, loader: () => Promise<any>) => {
      cacheReads.push(key);
      return loader();
    },
    invalidate: (key: string) => {
      invalidated.push(key);
    },
    getCachedSync: () => undefined,
    getStats: () => ({}),
  };

  const getItems = vi.fn(async () => ({ items: opts.items ?? [] }));
  const saveItem = vi.fn(async () => ({ success: true }));
  const deleteItem = vi.fn(async () => ({ deleted: true }));
  ds.client = {
    meta: {
      getItems,
      saveItem,
      deleteItem,
      getItem: vi.fn(async () => {
        if (opts.published instanceof Error) throw opts.published;
        return { item: opts.published ?? { name: 'v1', object: 'account' } };
      }),
    },
  };

  return { ds, invalidated, cacheReads, getItems, saveItem, deleteItem };
}

/** A published read that 404s, decorated the way the SDK client decorates. */
function notFound(): Error {
  return Object.assign(new Error('Metadata item not found'), { httpStatus: 404 });
}

const VIEW = {
  name: 'account.all',
  object: 'account',
  viewKind: 'list',
  label: 'All Accounts',
  config: { type: 'grid', data: { object: 'account' } },
};

describe('view metadata cache — invalidation names only keys with readers (#3778)', () => {
  it('listViews reads the transport on every call and consults no cache key', async () => {
    const { ds, getItems, cacheReads } = makeDS({ items: [VIEW] });

    await ds.listViews('account');
    await ds.listViews('account');

    // Uncached: two calls, two round trips. This is the behavior the removed
    // `views:{object}` invalidations pretended to manage.
    expect(getItems).toHaveBeenCalledTimes(2);
    expect(getItems).toHaveBeenCalledWith('view');
    expect(cacheReads).toEqual([]);
  });

  it('updateViewConfig invalidates exactly the two keys that have readers', async () => {
    const { ds, invalidated } = makeDS();

    await ds.updateViewConfig('account', 'v1', { label: 'Renamed' });

    // `view:{object}:{viewId}` → getView; `view-overrides:{object}` →
    // listViewOverrides. Nothing else is read back under a view-shaped key.
    expect(invalidated).toEqual(['view:account:v1', 'view-overrides:account']);
  });

  it('updateView (published overlay) invalidates the getView key only', async () => {
    const { ds, invalidated } = makeDS({ published: { name: 'v1', object: 'account' } });

    await ds.updateView('account', 'v1', { label: 'Renamed' });

    expect(invalidated).toEqual(['view:account:v1']);
  });

  it('updateView (pending draft) invalidates the getView key only', async () => {
    const { ds, invalidated } = makeDS({ draft: VIEW, published: notFound() });

    await ds.updateView('account', VIEW.name, { label: 'Renamed' });

    expect(invalidated).toEqual([`view:account:${VIEW.name}`]);
  });

  it('deleteView invalidates the getView key only', async () => {
    const { ds, invalidated } = makeDS();

    await ds.deleteView('account', 'v1');

    expect(invalidated).toEqual(['view:account:v1']);
  });

  it('no write path invalidates a `views:` key — nothing populates one', async () => {
    // createView is the path whose ONLY invalidation was the dead key, so it
    // now invalidates nothing. Asserted as "no `views:` key" rather than "no
    // invalidation at all": whether it ought to invalidate the override map
    // (`listViewOverrides` enumerates the same rows) is a separate question,
    // filed on its own card — this pin must not freeze the answer.
    const created = makeDS();
    await created.ds.createView('account', { name: 'account.mine', object: 'account' });

    const config = makeDS();
    await config.ds.updateViewConfig('account', 'v1', { label: 'Renamed' });

    const removed = makeDS();
    await removed.ds.deleteView('account', 'v1');

    for (const { invalidated } of [created, config, removed]) {
      expect(invalidated.filter((k) => k.startsWith('views:'))).toEqual([]);
    }
  });
});
