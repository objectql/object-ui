/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ViewDataProvider,
  type DataFetcher,
  type ViewDataConfig,
} from '../ViewDataProvider';

describe('ViewDataProvider', () => {
  let provider: ViewDataProvider;

  beforeEach(() => {
    provider = new ViewDataProvider();
  });

  // ===== Value Provider =====
  describe('value provider', () => {
    it('resolves static items', async () => {
      const config: ViewDataConfig = {
        provider: 'value',
        items: [
          { id: 1, name: 'Alice' },
          { id: 2, name: 'Bob' },
        ],
      };

      const result = await provider.resolve(config);

      expect(result.provider).toBe('value');
      expect(result.records).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.loading).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it('handles empty items', async () => {
      const result = await provider.resolve({
        provider: 'value',
        items: [],
      });
      expect(result.records).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('handles non-array items gracefully', async () => {
      const result = await provider.resolve({
        provider: 'value',
        items: null as any,
      });
      expect(result.records).toHaveLength(0);
    });
  });

  // ===== API Provider =====
  describe('api provider', () => {
    it('returns error when no fetchUrl implementation', async () => {
      const config: ViewDataConfig = {
        provider: 'api',
        read: { url: 'https://api.example.com/records' },
      };

      const result = await provider.resolve(config);
      expect(result.error).toContain('No fetchUrl implementation');
    });

    it('fetches data from API URL', async () => {
      const fetcher: DataFetcher = {
        fetchRecords: vi.fn(),
        fetchUrl: vi.fn().mockResolvedValue({
          records: [{ id: 1 }],
          total: 1,
        }),
      };
      provider.setFetcher(fetcher);

      const result = await provider.resolve({
        provider: 'api',
        read: { url: 'https://api.example.com/data', method: 'GET' },
      });

      expect(result.records).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(fetcher.fetchUrl).toHaveBeenCalledWith(
        'https://api.example.com/data',
        {
          method: 'GET',
          headers: undefined,
        },
      );
    });

    it('handles array response shape', async () => {
      const fetcher: DataFetcher = {
        fetchRecords: vi.fn(),
        fetchUrl: vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
      };
      provider.setFetcher(fetcher);

      const result = await provider.resolve({
        provider: 'api',
        read: { url: 'https://api.example.com/data' },
      });

      expect(result.records).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('handles { data: [] } response shape', async () => {
      const fetcher: DataFetcher = {
        fetchRecords: vi.fn(),
        fetchUrl: vi.fn().mockResolvedValue({ data: [{ id: 1 }] }),
      };
      provider.setFetcher(fetcher);

      const result = await provider.resolve({
        provider: 'api',
        read: { url: 'https://api.example.com/data' },
      });

      expect(result.records).toHaveLength(1);
    });

    it('handles API errors gracefully', async () => {
      const fetcher: DataFetcher = {
        fetchRecords: vi.fn(),
        fetchUrl: vi.fn().mockRejectedValue(new Error('Network error')),
      };
      provider.setFetcher(fetcher);

      const result = await provider.resolve({
        provider: 'api',
        read: { url: 'https://api.example.com/data' },
      });

      expect(result.error).toBe('Network error');
      expect(result.records).toHaveLength(0);
    });
  });

  // ===== Object Provider =====
  describe('object provider', () => {
    it('returns error when no fetcher configured', async () => {
      const result = await provider.resolve({
        provider: 'object',
        object: 'Account',
      });
      expect(result.error).toContain('No data fetcher configured');
    });

    it('fetches records for object', async () => {
      const fetcher: DataFetcher = {
        fetchRecords: vi.fn().mockResolvedValue({
          records: [{ id: '1', name: 'Acme Corp' }],
          total: 1,
        }),
      };
      provider.setFetcher(fetcher);

      const result = await provider.resolve({
        provider: 'object',
        object: 'Account',
      });

      expect(result.records).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(fetcher.fetchRecords).toHaveBeenCalledWith('Account', undefined);
    });

    it('passes filter/sort/limit options', async () => {
      const fetcher: DataFetcher = {
        fetchRecords: vi.fn().mockResolvedValue({ records: [], total: 0 }),
      };
      provider.setFetcher(fetcher);

      const options = {
        filter: { status: 'active' },
        sort: [{ field: 'name', order: 'asc' as const }],
        limit: 10,
      };

      await provider.resolve(
        { provider: 'object', object: 'Account' },
        options,
      );

      expect(fetcher.fetchRecords).toHaveBeenCalledWith('Account', options);
    });

    it('fetches metadata when available', async () => {
      const fetcher: DataFetcher = {
        fetchRecords: vi.fn().mockResolvedValue({ records: [], total: 0 }),
        fetchMetadata: vi.fn().mockResolvedValue({
          name: 'Account',
          label: 'Accounts',
          fields: [{ name: 'name', type: 'string', label: 'Name' }],
        }),
      };
      provider.setFetcher(fetcher);

      const result = await provider.resolve({
        provider: 'object',
        object: 'Account',
      });

      expect(result.metadata).toBeDefined();
      expect(result.metadata?.name).toBe('Account');
      expect(result.metadata?.fields).toHaveLength(1);
    });

    it('handles fetch errors gracefully', async () => {
      const fetcher: DataFetcher = {
        fetchRecords: vi
          .fn()
          .mockRejectedValue(new Error('Connection failed')),
      };
      provider.setFetcher(fetcher);

      const result = await provider.resolve({
        provider: 'object',
        object: 'Account',
      });

      expect(result.error).toBe('Connection failed');
      expect(result.records).toHaveLength(0);
    });
  });

  // ===== Element Data Source =====
  describe('resolveElementDataSource', () => {
    it('resolves element-level data source', async () => {
      const fetcher: DataFetcher = {
        fetchRecords: vi
          .fn()
          .mockResolvedValue({ records: [{ id: '1' }], total: 1 }),
      };
      provider.setFetcher(fetcher);

      const result = await provider.resolveElementDataSource({
        object: 'Contact',
        filter: { accountId: '123' },
        sort: [{ field: 'name', order: 'asc' }],
        limit: 5,
      });

      expect(result.records).toHaveLength(1);
      expect(fetcher.fetchRecords).toHaveBeenCalledWith('Contact', {
        filter: { accountId: '123' },
        sort: [{ field: 'name', order: 'asc' }],
        limit: 5,
      });
    });

    // ===== `view` — objectstack#5576 =====
    //
    // This method used to forward `filter`/`sort`/`limit` and DROP `view`, and it
    // had no caller outside this file. "Reference a saved view by name" was a
    // published binding with no implementation: a page that used it got every
    // record the object had, with no error, and the author had no way to tell.
    describe('view (objectstack#5576)', () => {
      const savedViews = {
        'Contact.hot': {
          type: 'grid',
          columns: ['name', 'email'],
          filter: [['rating', '=', 'hot']],
          sort: [{ field: 'name', order: 'asc' }],
          pagination: { pageSize: 20 },
        },
      };

      const fetcherWithViews = (): DataFetcher => ({
        fetchRecords: vi.fn().mockResolvedValue({ records: [{ id: '1' }], total: 1 }),
        fetchViews: vi.fn().mockResolvedValue(savedViews),
      });

      it('applies the named view’s columns, filter, sort and page size', async () => {
        const fetcher = fetcherWithViews();
        provider.setFetcher(fetcher);

        const result = await provider.resolveElementDataSource({
          object: 'Contact',
          view: 'hot',
        });

        expect(result.error).toBeUndefined();
        expect(fetcher.fetchViews).toHaveBeenCalledWith('Contact');
        expect(fetcher.fetchRecords).toHaveBeenCalledWith('Contact', {
          filter: [['rating', '=', 'hot']],
          sort: [{ field: 'name', order: 'asc' }],
          limit: 20,
          fields: ['name', 'email'],
        });
      });

      it('AND-combines the binding filter onto the view’s ("additional criteria")', async () => {
        const fetcher = fetcherWithViews();
        provider.setFetcher(fetcher);

        await provider.resolveElementDataSource({
          object: 'Contact',
          view: 'hot',
          filter: { owner: 'me' },
        });

        expect((fetcher.fetchRecords as any).mock.calls[0][1].filter).toEqual([
          'and',
          [['rating', '=', 'hot']],
          ['owner', '=', 'me'],
        ]);
      });

      it('reports an unresolvable view instead of returning every record', async () => {
        const fetcher = fetcherWithViews();
        provider.setFetcher(fetcher);

        const result = await provider.resolveElementDataSource({
          object: 'Contact',
          view: 'nope',
        });

        expect(result.records).toEqual([]);
        expect(result.error).toContain('"nope"');
        expect(result.error).toContain('Contact.hot');
        // The load that must NOT have happened: a named view the runtime cannot
        // apply may never degrade into an unfiltered query.
        expect(fetcher.fetchRecords).not.toHaveBeenCalled();
      });

      it('reports a fetcher that cannot list views at all', async () => {
        const fetcher: DataFetcher = {
          fetchRecords: vi.fn().mockResolvedValue({ records: [], total: 0 }),
        };
        provider.setFetcher(fetcher);

        const result = await provider.resolveElementDataSource({
          object: 'Contact',
          view: 'hot',
        });

        expect(result.error).toContain('fetchViews');
        expect(fetcher.fetchRecords).not.toHaveBeenCalled();
      });

      it('surfaces a failed view lookup as an error, not as an empty view', async () => {
        const fetcher: DataFetcher = {
          fetchRecords: vi.fn().mockResolvedValue({ records: [], total: 0 }),
          fetchViews: vi.fn().mockRejectedValue(new Error('meta unavailable')),
        };
        provider.setFetcher(fetcher);

        const result = await provider.resolveElementDataSource({
          object: 'Contact',
          view: 'hot',
        });

        expect(result.error).toBe('meta unavailable');
        expect(fetcher.fetchRecords).not.toHaveBeenCalled();
      });
    });
  });

  // ===== Unknown Provider =====
  describe('unknown provider', () => {
    it('returns error for unknown provider type', async () => {
      const result = await provider.resolve({
        provider: 'unknown' as any,
      } as ViewDataConfig);
      expect(result.error).toContain('Unknown data provider');
    });
  });
});
