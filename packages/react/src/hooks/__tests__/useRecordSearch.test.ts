/**
 * ObjectUI — useRecordSearch Tests
 * Copyright (c) 2024-present ObjectStack Inc.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useRecordSearch } from '../useRecordSearch';

const objects = [
  { name: 'account', label: 'Account', titleField: 'name' },
  { name: 'contact', label: 'Contact', titleFormat: '{{first_name}} {{last_name}}' },
  { name: 'opportunity', label: 'Opportunity', searchable: false },
];

function makeDataSource(byObject: Record<string, any[]>) {
  return {
    find: vi.fn(async (objectName: string, _q: any) => ({
      data: byObject[objectName] ?? [],
    })),
  };
}

describe('useRecordSearch', () => {
  it('returns empty results when query is shorter than minLength', async () => {
    const ds = makeDataSource({});
    const { result } = renderHook(() =>
      useRecordSearch({ query: 'a', objects, dataSource: ds, debounceMs: 0 }),
    );
    expect(result.current.results).toEqual([]);
    // Give a tick to confirm nothing fires.
    await new Promise((r) => setTimeout(r, 20));
    expect(ds.find).not.toHaveBeenCalled();
  });

  it('returns empty results when disabled', async () => {
    const ds = makeDataSource({ account: [{ id: '1', name: 'Acme' }] });
    renderHook(() =>
      useRecordSearch({
        query: 'acme',
        objects,
        dataSource: ds,
        enabled: false,
        debounceMs: 0,
      }),
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(ds.find).not.toHaveBeenCalled();
  });

  it('fans out across searchable objects after debounce and aggregates hits', async () => {
    const ds = makeDataSource({
      account: [{ id: 'a1', name: 'Acme Corp' }],
      contact: [{ id: 'c1', first_name: 'Ada', last_name: 'Lovelace' }],
    });

    const { result } = renderHook(() =>
      useRecordSearch({
        query: 'acme',
        objects,
        dataSource: ds,
        debounceMs: 10,
        topPerObject: 3,
      }),
    );

    await waitFor(() => {
      expect(result.current.isSearching).toBe(false);
      expect(result.current.results.length).toBe(2);
    });

    expect(ds.find).toHaveBeenCalledTimes(2);
    expect(ds.find).toHaveBeenCalledWith('account', { $search: 'acme', $top: 3 });
    expect(ds.find).toHaveBeenCalledWith('contact', { $search: 'acme', $top: 3 });
    expect(ds.find).not.toHaveBeenCalledWith('opportunity', expect.anything());

    const names = result.current.results.map((h) => h.display).sort();
    expect(names).toEqual(['Acme Corp', 'Ada Lovelace']);
  });

  it('honors the objectNames whitelist', async () => {
    const ds = makeDataSource({
      account: [{ id: 'a1', name: 'Acme' }],
      contact: [{ id: 'c1', first_name: 'Ada', last_name: 'L' }],
    });

    renderHook(() =>
      useRecordSearch({
        query: 'acme',
        objects,
        dataSource: ds,
        objectNames: ['contact'],
        debounceMs: 0,
      }),
    );

    await waitFor(() => {
      expect(ds.find).toHaveBeenCalledTimes(1);
    });
    expect(ds.find).toHaveBeenCalledWith('contact', expect.objectContaining({ $search: 'acme' }));
  });

  it('discards stale results when query changes mid-flight', async () => {
    const accountResolvers: Array<(v: any) => void> = [];
    const ds = {
      find: vi.fn((objectName: string, q: any) => {
        if (objectName === 'account') {
          return new Promise((resolve) => {
            accountResolvers.push((v) => resolve(v));
          });
        }
        return Promise.resolve({ data: [] });
      }),
    };

    const { result, rerender } = renderHook(
      ({ q }: { q: string }) =>
        useRecordSearch({
          query: q,
          objects,
          dataSource: ds,
          debounceMs: 0,
        }),
      { initialProps: { q: 'old' } },
    );

    // Wait for the first run to dispatch find('account').
    await waitFor(() => {
      expect(accountResolvers.length).toBe(1);
    });

    // Change query; this should bump runId so the in-flight 'old' run is stale.
    rerender({ q: 'newq' });

    // Wait for the newer run to also dispatch find('account').
    await waitFor(() => {
      expect(accountResolvers.length).toBe(2);
    });

    // Resolve the stale call FIRST with a STALE id, then the fresh call empty.
    accountResolvers[0]({ data: [{ id: 'STALE', name: 'Should-Be-Ignored' }] });
    accountResolvers[1]({ data: [] });

    await waitFor(() => {
      expect(result.current.isSearching).toBe(false);
    });

    expect(result.current.results.some((h) => h.recordId === 'STALE')).toBe(false);
  });

  it('tolerates per-object errors via Promise.allSettled', async () => {
    const ds = {
      find: vi.fn((objectName: string) => {
        if (objectName === 'account') {
          return Promise.reject(Object.assign(new Error('not found'), { httpStatus: 404 }));
        }
        return Promise.resolve({
          data: [{ id: 'c1', first_name: 'Ada', last_name: 'L' }],
        });
      }),
    };

    const { result } = renderHook(() =>
      useRecordSearch({ query: 'ada', objects, dataSource: ds, debounceMs: 0 }),
    );

    await waitFor(() => {
      expect(result.current.isSearching).toBe(false);
      expect(result.current.results.length).toBe(1);
    });

    expect(result.current.results[0].display).toBe('Ada L');
    expect(result.current.error).toBeUndefined();
  });

  it('orders hits by relevance, not by object-fanout order', async () => {
    // Fanout puts `account` before `contact` (per the candidates list),
    // but a startsWith match in `contact` should still beat a substring
    // match in `account`.
    const ds = {
      find: vi.fn(async (objectName: string) => {
        if (objectName === 'account') {
          // substring match: "ad" appears in middle
          return { data: [{ id: 'a1', name: 'Big Trader Ad Co' }] };
        }
        if (objectName === 'contact') {
          // startsWith match
          return { data: [{ id: 'c1', first_name: 'Ada', last_name: 'L' }] };
        }
        return { data: [] };
      }),
    };

    const { result } = renderHook(() =>
      useRecordSearch({
        query: 'ad',
        objects,
        dataSource: ds,
        debounceMs: 0,
      }),
    );

    await waitFor(() => {
      expect(result.current.results.length).toBe(2);
    });

    // contact (startsWith 'Ada L') should outrank account (substring).
    expect(result.current.results[0].display).toBe('Ada L');
    expect(result.current.results[0].score).toBeGreaterThan(result.current.results[1].score);
  });

  it('treats exact-id paste as the top hit', async () => {
    const ds = {
      find: vi.fn(async (objectName: string) => {
        if (objectName === 'account') {
          return {
            data: [
              { id: 'OPP-9999', name: 'Some unrelated thing' },
              { id: 'a2', name: 'Acme Corp' },
            ],
          };
        }
        return { data: [] };
      }),
    };

    const { result } = renderHook(() =>
      useRecordSearch({
        query: 'OPP-9999',
        objects,
        dataSource: ds,
        debounceMs: 0,
      }),
    );

    await waitFor(() => {
      expect(result.current.results.length).toBeGreaterThan(0);
    });

    expect(result.current.results[0].recordId).toBe('OPP-9999');
  });

  it('sends the query as $search (server-side full-text), not $filter', async () => {
    // ADR-0054 §6 / ADR-0061: the palette delegates matching to the backend via
    // `$search`; it must NOT silently fall back to a client-side `$filter`. The
    // hook also trims surrounding whitespace before it leaves the page.
    const ds = makeDataSource({ account: [{ id: 'a1', name: 'Acme Corp' }] });

    renderHook(() =>
      useRecordSearch({
        query: '  Acme  ',
        objects,
        dataSource: ds,
        objectNames: ['account'],
        topPerObject: 5,
        debounceMs: 0,
      }),
    );

    await waitFor(() => {
      expect(ds.find).toHaveBeenCalledTimes(1);
    });

    const [calledName, calledQuery] = ds.find.mock.calls[0];
    expect(calledName).toBe('account');
    // Exactly the trimmed $search + $top — no $filter, no $search_fields, etc.
    expect(calledQuery).toEqual({ $search: 'Acme', $top: 5 });
  });

  it('re-fires $search as the (debounced) query changes', async () => {
    const ds = makeDataSource({ account: [{ id: 'a1', name: 'Acme' }] });

    const { rerender } = renderHook(
      ({ q }: { q: string }) =>
        useRecordSearch({
          query: q,
          objects,
          dataSource: ds,
          objectNames: ['account'],
          debounceMs: 0,
        }),
      { initialProps: { q: 'ac' } },
    );

    await waitFor(() => {
      expect(ds.find).toHaveBeenCalledWith('account', { $search: 'ac', $top: 3 });
    });

    rerender({ q: 'acme' });

    await waitFor(() => {
      expect(ds.find).toHaveBeenCalledWith('account', { $search: 'acme', $top: 3 });
    });
  });

  // ADR-0061 / framework #3371: when the data source exposes the unified global
  // search endpoint (`searchAll` → GET /api/v1/search), the palette must use it
  // instead of the per-object `find({ $search })` fanout — the fanout misses
  // records that only the global index knows about.
  describe('global searchAll endpoint', () => {
    function makeSearchDataSource(hits: any[]) {
      return {
        find: vi.fn(async () => ({ data: [] })),
        searchAll: vi.fn(async () => ({ query: 'wayne', hits })),
      };
    }

    it('prefers searchAll and maps hits without fanning out to find', async () => {
      const ds = makeSearchDataSource([
        { object: 'account', id: 'a1', title: 'Wayne Enterprises', snippet: 'Wayne Enterprises' },
        { object: 'contact', id: 'c1', title: 'Bruce Wayne', record: { id: 'c1' } },
      ]);

      const { result } = renderHook(() =>
        useRecordSearch({ query: 'wayne', objects, dataSource: ds, debounceMs: 0 }),
      );

      await waitFor(() => {
        expect(result.current.isSearching).toBe(false);
        expect(result.current.results.length).toBe(2);
      });

      expect(ds.searchAll).toHaveBeenCalledTimes(1);
      expect(ds.find).not.toHaveBeenCalled();

      const byId = Object.fromEntries(result.current.results.map((h) => [h.recordId, h]));
      expect(byId.a1.display).toBe('Wayne Enterprises');
      expect(byId.a1.objectName).toBe('account');
      expect(byId.a1.objectLabel).toBe('Account');
      expect(byId.c1.display).toBe('Bruce Wayne');
    });

    it('trims and forwards the whitelist as the objects scope', async () => {
      const ds = makeSearchDataSource([]);
      renderHook(() =>
        useRecordSearch({
          query: '  wayne  ',
          objects,
          dataSource: ds,
          objectNames: ['account', 'contact'],
          debounceMs: 0,
        }),
      );

      await waitFor(() => {
        expect(ds.searchAll).toHaveBeenCalledTimes(1);
      });
      const [term, opts] = ds.searchAll.mock.calls[0];
      expect(term).toBe('wayne');
      expect(opts.objects).toEqual(['account', 'contact']);
    });

    it('drops hits for objects outside the candidate whitelist', async () => {
      // Server ignored our `objects` filter and returned an out-of-scope object.
      const ds = makeSearchDataSource([
        { object: 'account', id: 'a1', title: 'Wayne Enterprises' },
        { object: 'secret_object', id: 's1', title: 'Should be hidden' },
      ]);

      const { result } = renderHook(() =>
        useRecordSearch({
          query: 'wayne',
          objects,
          dataSource: ds,
          objectNames: ['account'],
          debounceMs: 0,
        }),
      );

      await waitFor(() => {
        expect(result.current.isSearching).toBe(false);
      });
      expect(result.current.results.map((h) => h.objectName)).toEqual(['account']);
    });

    it('floats an exact-id paste above the server ranking', async () => {
      const ds = makeSearchDataSource([
        { object: 'account', id: 'a1', title: 'Alpha' },
        { object: 'account', id: 'OPP-42', title: 'Unrelated name' },
      ]);

      const { result } = renderHook(() =>
        useRecordSearch({ query: 'OPP-42', objects, dataSource: ds, debounceMs: 0 }),
      );

      await waitFor(() => {
        expect(result.current.results.length).toBe(2);
      });
      expect(result.current.results[0].recordId).toBe('OPP-42');
    });

    it('surfaces searchAll errors and clears results', async () => {
      const ds = {
        find: vi.fn(),
        searchAll: vi.fn(async () => {
          throw new Error('index unavailable');
        }),
      };

      const { result } = renderHook(() =>
        useRecordSearch({ query: 'wayne', objects, dataSource: ds, debounceMs: 0 }),
      );

      await waitFor(() => {
        expect(result.current.isSearching).toBe(false);
        expect(result.current.error?.message).toBe('index unavailable');
      });
      expect(result.current.results).toEqual([]);
      expect(ds.find).not.toHaveBeenCalled();
    });
  });
});
