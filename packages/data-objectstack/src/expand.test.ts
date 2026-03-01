/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ObjectStackAdapter } from './index';

// We test the adapter's $expand handling by mocking the underlying ObjectStack client.
// The key scenarios:
//   1. find() with $expand should use data.query() (POST) instead of data.find() (GET)
//   2. find() without $expand should use data.find() (GET) as before
//   3. findOne() with $expand should use data.query() with an _id filter
//   4. findOne() without $expand should use data.get() as before

describe('ObjectStackAdapter $expand support', () => {
  let adapter: ObjectStackAdapter;
  let mockClient: any;

  beforeEach(() => {
    adapter = new ObjectStackAdapter({
      baseUrl: 'http://localhost:3000',
      autoReconnect: false,
    });

    // Mock the internal client after construction
    mockClient = {
      data: {
        find: vi.fn().mockResolvedValue({ records: [], total: 0 }),
        query: vi.fn().mockResolvedValue({ records: [], total: 0 }),
        get: vi.fn().mockResolvedValue({ record: { _id: '1', name: 'Test' } }),
      },
      connect: vi.fn().mockResolvedValue(undefined),
      discover: vi.fn().mockResolvedValue({ status: 'ok' }),
    };

    // Inject mock client and mark as connected to bypass connect()
    (adapter as any).client = mockClient;
    (adapter as any).connected = true;
  });

  describe('find() with $expand', () => {
    it('should use data.query() when $expand is present', async () => {
      mockClient.data.query.mockResolvedValue({
        records: [{ _id: '1', name: 'Order 1', customer: { _id: '2', name: 'Alice' } }],
        total: 1,
      });

      const result = await adapter.find('order', {
        $top: 10,
        $expand: ['customer', 'account'],
      });

      expect(mockClient.data.query).toHaveBeenCalledWith('order', expect.objectContaining({
        expand: {
          customer: {},
          account: {},
        },
        limit: 10,
      }));
      expect(mockClient.data.find).not.toHaveBeenCalled();
      expect(result.data).toHaveLength(1);
      expect(result.data[0].customer).toEqual({ _id: '2', name: 'Alice' });
    });

    it('should pass filters and sort to data.query()', async () => {
      mockClient.data.query.mockResolvedValue({ records: [], total: 0 });

      await adapter.find('order', {
        $filter: [['status', '=', 'active']],
        $orderby: [{ field: 'name', order: 'asc' }],
        $top: 50,
        $skip: 10,
        $expand: ['customer'],
      });

      expect(mockClient.data.query).toHaveBeenCalledWith('order', expect.objectContaining({
        filters: [['status', '=', 'active']],
        sort: ['name'],
        limit: 50,
        offset: 10,
        expand: { customer: {} },
      }));
    });

    it('should use data.find() when $expand is not present', async () => {
      mockClient.data.find.mockResolvedValue({ records: [{ _id: '1', name: 'Test' }], total: 1 });

      const result = await adapter.find('order', { $top: 10 });

      expect(mockClient.data.find).toHaveBeenCalled();
      expect(mockClient.data.query).not.toHaveBeenCalled();
      expect(result.data).toHaveLength(1);
    });

    it('should use data.find() when $expand is an empty array', async () => {
      mockClient.data.find.mockResolvedValue({ records: [], total: 0 });

      await adapter.find('order', { $top: 10, $expand: [] });

      expect(mockClient.data.find).toHaveBeenCalled();
      expect(mockClient.data.query).not.toHaveBeenCalled();
    });
  });

  describe('findOne() with $expand', () => {
    it('should use data.query() with _id filter when $expand is present', async () => {
      mockClient.data.query.mockResolvedValue({
        records: [{ _id: 'order-1', name: 'Order 1', customer: { _id: '2', name: 'Alice' } }],
      });

      const result = await adapter.findOne('order', 'order-1', {
        $expand: ['customer', 'account'],
      });

      expect(mockClient.data.query).toHaveBeenCalledWith('order', expect.objectContaining({
        filters: [['_id', '=', 'order-1']],
        expand: {
          customer: {},
          account: {},
        },
        limit: 1,
      }));
      expect(mockClient.data.get).not.toHaveBeenCalled();
      expect(result).toEqual({ _id: 'order-1', name: 'Order 1', customer: { _id: '2', name: 'Alice' } });
    });

    it('should return null when data.query() returns no records', async () => {
      mockClient.data.query.mockResolvedValue({ records: [] });

      const result = await adapter.findOne('order', 'nonexistent', {
        $expand: ['customer'],
      });

      expect(result).toBeNull();
    });

    it('should use data.get() when $expand is not present', async () => {
      mockClient.data.get.mockResolvedValue({ record: { _id: '1', name: 'Test' } });

      const result = await adapter.findOne('order', '1');

      expect(mockClient.data.get).toHaveBeenCalledWith('order', '1');
      expect(mockClient.data.query).not.toHaveBeenCalled();
      expect(result).toEqual({ _id: '1', name: 'Test' });
    });

    it('should return null for 404 errors without $expand', async () => {
      mockClient.data.get.mockRejectedValue({ status: 404 });

      const result = await adapter.findOne('order', 'nonexistent');

      expect(result).toBeNull();
    });
  });
});
