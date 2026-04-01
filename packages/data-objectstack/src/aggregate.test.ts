/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ObjectStackAdapter } from './index';

/**
 * Tests for ObjectStackAdapter.aggregate() — verifies that the analytics
 * query payload uses the correct string-based measure/dimension format
 * expected by the backend analytics service (MemoryAnalyticsService).
 *
 * See: https://github.com/objectstack-ai/objectui/issues (measures format bug)
 */
describe('ObjectStackAdapter aggregate()', () => {
  let adapter: ObjectStackAdapter;
  let mockAnalyticsQuery: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockAnalyticsQuery = vi.fn().mockResolvedValue({ data: [] });

    adapter = new ObjectStackAdapter({
      baseUrl: 'http://localhost:3000',
      autoReconnect: false,
    });

    // Inject mock client and mark as connected to bypass connect()
    (adapter as any).client = {
      data: {
        find: vi.fn().mockResolvedValue({ records: [], total: 0 }),
      },
      analytics: {
        query: mockAnalyticsQuery,
      },
      connect: vi.fn().mockResolvedValue(undefined),
      discover: vi.fn().mockResolvedValue({ status: 'ok' }),
    };
    (adapter as any).connected = true;
  });

  it('should send measures as string array with field_function format for sum', async () => {
    mockAnalyticsQuery.mockResolvedValue({ data: [] });

    await adapter.aggregate('opportunity', {
      field: 'amount',
      function: 'sum',
      groupBy: 'stage',
    });

    expect(mockAnalyticsQuery).toHaveBeenCalledWith({
      cube: 'opportunity',
      measures: ['amount_sum'],
      dimensions: ['stage'],
    });
  });

  it('should send measures as ["count"] for count aggregation', async () => {
    mockAnalyticsQuery.mockResolvedValue({ data: [] });

    await adapter.aggregate('opportunity', {
      field: 'amount',
      function: 'count',
      groupBy: 'stage',
    });

    expect(mockAnalyticsQuery).toHaveBeenCalledWith({
      cube: 'opportunity',
      measures: ['count'],
      dimensions: ['stage'],
    });
  });

  it('should send measures as string for avg aggregation', async () => {
    mockAnalyticsQuery.mockResolvedValue({ data: [] });

    await adapter.aggregate('opportunity', {
      field: 'amount',
      function: 'avg',
      groupBy: 'stage',
    });

    expect(mockAnalyticsQuery).toHaveBeenCalledWith({
      cube: 'opportunity',
      measures: ['amount_avg'],
      dimensions: ['stage'],
    });
  });

  it('should send empty dimensions when groupBy is _all', async () => {
    mockAnalyticsQuery.mockResolvedValue({ data: [] });

    await adapter.aggregate('opportunity', {
      field: 'amount',
      function: 'sum',
      groupBy: '_all',
    });

    expect(mockAnalyticsQuery).toHaveBeenCalledWith({
      cube: 'opportunity',
      measures: ['amount_sum'],
      dimensions: [],
    });
  });

  it('should include filters in payload when provided', async () => {
    const filter = [{ member: 'stage', operator: 'equals', values: ['Closed Won'] }];
    mockAnalyticsQuery.mockResolvedValue({ data: [] });

    await adapter.aggregate('opportunity', {
      field: 'amount',
      function: 'sum',
      groupBy: 'stage',
      filter,
    });

    expect(mockAnalyticsQuery).toHaveBeenCalledWith({
      cube: 'opportunity',
      measures: ['amount_sum'],
      dimensions: ['stage'],
      filters: filter,
    });
  });

  it('should map measure key back to field name in response', async () => {
    mockAnalyticsQuery.mockResolvedValue({
      data: [
        { stage: 'Prospect', amount_sum: 300 },
        { stage: 'Closed Won', amount_sum: 500 },
      ],
    });

    const result = await adapter.aggregate('opportunity', {
      field: 'amount',
      function: 'sum',
      groupBy: 'stage',
    });

    expect(result).toEqual([
      { stage: 'Prospect', amount: 300 },
      { stage: 'Closed Won', amount: 500 },
    ]);
  });

  it('should map count measure back to field name in response', async () => {
    mockAnalyticsQuery.mockResolvedValue({
      data: [
        { stage: 'Prospect', count: 5 },
        { stage: 'Closed Won', count: 3 },
      ],
    });

    const result = await adapter.aggregate('opportunity', {
      field: 'amount',
      function: 'count',
      groupBy: 'stage',
    });

    expect(result).toEqual([
      { stage: 'Prospect', amount: 5 },
      { stage: 'Closed Won', amount: 3 },
    ]);
  });

  it('should handle direct array response from analytics', async () => {
    mockAnalyticsQuery.mockResolvedValue([
      { stage: 'Prospect', amount_sum: 300 },
    ]);

    const result = await adapter.aggregate('opportunity', {
      field: 'amount',
      function: 'sum',
      groupBy: 'stage',
    });

    expect(result).toEqual([
      { stage: 'Prospect', amount: 300 },
    ]);
  });

  it('should handle results wrapper in response', async () => {
    mockAnalyticsQuery.mockResolvedValue({
      results: [
        { stage: 'Prospect', amount_avg: 150 },
      ],
    });

    const result = await adapter.aggregate('opportunity', {
      field: 'amount',
      function: 'avg',
      groupBy: 'stage',
    });

    expect(result).toEqual([
      { stage: 'Prospect', amount: 150 },
    ]);
  });

  it('should fall back to client-side aggregation when analytics endpoint fails', async () => {
    mockAnalyticsQuery.mockRejectedValue(new Error('Analytics not available'));

    // Mock find() to return records for client-side aggregation
    (adapter as any).client.data.find = vi.fn().mockResolvedValue({
      records: [
        { stage: 'Prospect', amount: 100 },
        { stage: 'Prospect', amount: 200 },
        { stage: 'Closed Won', amount: 500 },
      ],
      total: 3,
    });

    const result = await adapter.aggregate('opportunity', {
      field: 'amount',
      function: 'sum',
      groupBy: 'stage',
    });

    expect(result).toHaveLength(2);
    expect(result.find((r: any) => r.stage === 'Prospect')?.amount).toBe(300);
    expect(result.find((r: any) => r.stage === 'Closed Won')?.amount).toBe(500);
  });
});
