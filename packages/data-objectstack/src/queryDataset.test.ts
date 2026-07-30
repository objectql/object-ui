/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ObjectStackAdapter,
  clearSharedDiscoveryCache,
  isAnalyticsNotInstalledError,
} from './index';

/** A fetch mock that answers discovery + records the dataset-query POST. */
function makeFetch(datasetResponse: { ok: boolean; status?: number; body: unknown }) {
  const calls: Array<{ url: string; init?: any }> = [];
  const fetchImpl = vi.fn(async (url: any, init?: any) => {
    const u = String(url);
    calls.push({ url: u, init });
    if (u.includes('/api/v1/discovery')) {
      return { ok: true, status: 200, statusText: 'OK', json: async () => ({ success: true, data: { version: 'v1', routes: {} } }) } as any;
    }
    if (u.includes('/api/v1/analytics/dataset/query')) {
      return {
        ok: datasetResponse.ok,
        status: datasetResponse.status ?? (datasetResponse.ok ? 200 : 400),
        statusText: datasetResponse.ok ? 'OK' : 'Bad Request',
        json: async () => datasetResponse.body,
      } as any;
    }
    return { ok: true, status: 200, statusText: 'OK', json: async () => ({}) } as any;
  });
  return { fetchImpl, calls };
}

const inlineDataset = {
  name: 'sales', label: 'Sales', object: 'opportunity', include: ['account'],
  dimensions: [{ name: 'region', field: 'account.region', type: 'string' }],
  measures: [{ name: 'revenue', aggregate: 'sum', field: 'amount' }],
};
const selection = { dimensions: ['region'], measures: ['revenue'] };

describe('ObjectStackAdapter.queryDataset', () => {
  beforeEach(() => clearSharedDiscoveryCache());

  it('POSTs the inline dataset + selection and returns rows/fields', async () => {
    const { fetchImpl, calls } = makeFetch({
      ok: true,
      body: { rows: [{ region: 'NA', revenue: 100 }], fields: [{ name: 'revenue', type: 'number' }] },
    });
    const adapter = new ObjectStackAdapter({ baseUrl: 'http://localhost:3000', token: 'tok_123', autoReconnect: false, fetch: fetchImpl as any });

    const result = await adapter.queryDataset(inlineDataset as any, selection);

    expect(result.rows).toEqual([{ region: 'NA', revenue: 100 }]);
    expect(result.fields).toEqual([{ name: 'revenue', type: 'number' }]);

    const post = calls.find((c) => c.url.includes('/analytics/dataset/query'))!;
    expect(post.url).toBe('http://localhost:3000/api/v1/analytics/dataset/query');
    expect(post.init.method).toBe('POST');
    expect(post.init.headers.Authorization).toBe('Bearer tok_123');
    expect(JSON.parse(post.init.body)).toEqual({ dataset: inlineDataset, selection });
  });

  it('sends datasetName when given a string', async () => {
    const { fetchImpl, calls } = makeFetch({ ok: true, body: { rows: [], fields: [] } });
    const adapter = new ObjectStackAdapter({ baseUrl: 'http://localhost:3000', autoReconnect: false, fetch: fetchImpl as any });
    await adapter.queryDataset('sales', selection);
    const post = calls.find((c) => c.url.includes('/analytics/dataset/query'))!;
    expect(JSON.parse(post.init.body)).toEqual({ datasetName: 'sales', selection });
  });

  it('unwraps a { success, data } envelope', async () => {
    const { fetchImpl } = makeFetch({ ok: true, body: { success: true, data: { rows: [{ x: 1 }], fields: [] } } });
    const adapter = new ObjectStackAdapter({ baseUrl: 'http://localhost:3000', autoReconnect: false, fetch: fetchImpl as any });
    const result = await adapter.queryDataset(inlineDataset as any, selection);
    expect(result.rows).toEqual([{ x: 1 }]);
  });

  it('throws (no silent fallback) with the server message on a 4xx', async () => {
    const { fetchImpl } = makeFetch({ ok: false, status: 400, body: { code: 'DATASET_INVALID', message: 'relationship not declared' } });
    const adapter = new ObjectStackAdapter({ baseUrl: 'http://localhost:3000', autoReconnect: false, fetch: fetchImpl as any });
    await expect(adapter.queryDataset(inlineDataset as any, selection)).rejects.toThrow(/relationship not declared/);
  });

  // framework#3891 retired the degraded in-kernel analytics fallback, so a
  // deployment without @objectstack/service-analytics answers 501 (REST route
  // present, no service) or 404 (framework#4019 stopped mounting the routes).
  // Neither is an authoring mistake — the caller gets a typed, readable error
  // instead of `Dataset query failed: 501 Not Implemented — …`.
  describe('analytics capability absent', () => {
    it('maps 501 NOT_IMPLEMENTED to a readable ANALYTICS_NOT_INSTALLED error', async () => {
      const { fetchImpl } = makeFetch({
        ok: false,
        status: 501,
        body: {
          code: 'NOT_IMPLEMENTED',
          message: 'Analytics dataset query is not available on this deployment (no analytics service with queryDataset).',
        },
      });
      const adapter = new ObjectStackAdapter({ baseUrl: 'http://localhost:3000', autoReconnect: false, fetch: fetchImpl as any });

      const err = await adapter.queryDataset(inlineDataset as any, selection).catch((e) => e);

      expect(isAnalyticsNotInstalledError(err)).toBe(true);
      expect(err.code).toBe('ANALYTICS_NOT_INSTALLED');
      expect(err.message).toContain('Analytics capability is not installed');
      expect(err.message).toContain('@objectstack/service-analytics');
    });

    it('maps a 404 (routes not mounted) the same way', async () => {
      const { fetchImpl } = makeFetch({ ok: false, status: 404, body: { error: 'Not found' } });
      const adapter = new ObjectStackAdapter({ baseUrl: 'http://localhost:3000', autoReconnect: false, fetch: fetchImpl as any });

      const err = await adapter.queryDataset(inlineDataset as any, selection).catch((e) => e);

      expect(isAnalyticsNotInstalledError(err)).toBe(true);
    });

    it('leaves a real compile error alone (it is NOT a missing capability)', async () => {
      const { fetchImpl } = makeFetch({ ok: false, status: 400, body: { message: 'relationship not declared in include' } });
      const adapter = new ObjectStackAdapter({ baseUrl: 'http://localhost:3000', autoReconnect: false, fetch: fetchImpl as any });

      const err = await adapter.queryDataset(inlineDataset as any, selection).catch((e) => e);

      expect(isAnalyticsNotInstalledError(err)).toBe(false);
      expect(String(err.message)).toContain('relationship not declared');
    });
  });
});
