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
