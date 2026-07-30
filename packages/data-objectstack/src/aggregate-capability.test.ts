/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `aggregate()` against an analytics endpoint that cannot answer.
 *
 * WHY THIS EXISTS. `@objectstack/client`'s `analytics.query()` returns
 * `res.json()` WITHOUT checking `res.ok`, so a non-2xx never throws — the error
 * body arrives where rows were expected. The adapter's row parser matched none
 * of its shapes, produced `[]`, and returned it as a RESULT: the `catch` that
 * promises a client-side fallback never ran, and a KPI on a deployment without
 * `@objectstack/service-analytics` rendered a confident **zero**.
 *
 * That is the same lie framework#3891 removed from the server side (a degraded
 * shim answering 200 with unscoped numbers), reproduced one layer up. These
 * tests pin the three outcomes:
 *   - capability absent (404 / 501)  → client-side fallback over a scoped find();
 *   - our body is off-contract (400) → THROWS, never silently re-answered;
 *   - a normal result                → untouched.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ObjectStackAdapter, clearSharedDiscoveryCache } from './index';

const RECORDS = [
  { id: '1', stage: 'won', amount: 100 },
  { id: '2', stage: 'won', amount: 50 },
  { id: '3', stage: 'lost', amount: 20 },
];

/**
 * A fetch mock answering discovery, the analytics query (with `analyticsBody`
 * at `analyticsStatus`), and the `/data` read the fallback performs.
 */
function makeFetch(analyticsStatus: number, analyticsBody: unknown) {
  const calls: string[] = [];
  const fetchImpl = vi.fn(async (url: any, init?: any) => {
    const u = String(url);
    calls.push(`${init?.method ?? 'GET'} ${u}`);
    if (u.includes('/api/v1/discovery')) {
      return { ok: true, status: 200, statusText: 'OK', json: async () => ({ success: true, data: { version: 'v1', routes: {} } }) } as any;
    }
    if (u.includes('/api/v1/analytics/query')) {
      return {
        ok: analyticsStatus >= 200 && analyticsStatus < 300,
        status: analyticsStatus,
        statusText: 'x',
        json: async () => analyticsBody,
      } as any;
    }
    // The fallback's scoped read.
    return {
      ok: true, status: 200, statusText: 'OK',
      json: async () => ({ success: true, data: { object: 'opportunity', records: RECORDS, total: RECORDS.length } }),
    } as any;
  });
  return { fetchImpl, calls };
}

function makeAdapter(fetchImpl: any) {
  return new ObjectStackAdapter({
    baseUrl: 'http://localhost:3000',
    autoReconnect: false,
    fetch: fetchImpl as any,
  });
}

const SUM_BY_STAGE = { function: 'sum', field: 'amount', groupBy: 'stage' };

describe('aggregate() when the analytics capability is absent', () => {
  beforeEach(() => clearSharedDiscoveryCache());

  it('404 (routes not mounted, framework#4019) falls back instead of returning an empty result', async () => {
    const { fetchImpl, calls } = makeFetch(404, { error: 'Not found' });
    const rows = await makeAdapter(fetchImpl).aggregate('opportunity', SUM_BY_STAGE);

    // Pre-fix this was `[]` — a chart reading "no data" on a populated table.
    expect(rows.length).toBeGreaterThan(0);
    const won = rows.find((r: any) => r.stage === 'won');
    expect(won?.amount).toBe(150);
    // It really did fall back to a server-side read (not invent numbers).
    expect(calls.some((c) => c.includes('/api/v1/data'))).toBe(true);
  });

  it('501 NOT_IMPLEMENTED (REST route, no service) falls back the same way', async () => {
    const { fetchImpl } = makeFetch(501, {
      code: 'NOT_IMPLEMENTED',
      message: 'Analytics is not available on this deployment.',
    });
    const rows = await makeAdapter(fetchImpl).aggregate('opportunity', SUM_BY_STAGE);
    expect(rows.find((r: any) => r.stage === 'won')?.amount).toBe(150);
  });

  it('warns ONCE per adapter, not once per widget', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { fetchImpl } = makeFetch(404, { error: 'Not found' });
      const adapter = makeAdapter(fetchImpl);
      await adapter.aggregate('opportunity', SUM_BY_STAGE);
      await adapter.aggregate('opportunity', SUM_BY_STAGE);
      await adapter.aggregate('opportunity', SUM_BY_STAGE);

      const capabilityWarnings = warn.mock.calls.filter((c) =>
        String(c[0]).includes('analytics capability unavailable'),
      );
      expect(capabilityWarnings).toHaveLength(1);
      expect(String(capabilityWarnings[0][0])).toContain('@objectstack/service-analytics');
    } finally {
      warn.mockRestore();
    }
  });

  it('forwards the widget filter into the fallback (never aggregates the whole table)', async () => {
    const { fetchImpl, calls } = makeFetch(404, { error: 'Not found' });
    await makeAdapter(fetchImpl).aggregate('opportunity', { ...SUM_BY_STAGE, filter: { stage: 'won' } });

    const dataCall = calls.find((c) => c.includes('/api/v1/data'));
    expect(dataCall).toBeDefined();
    expect(decodeURIComponent(dataCall!)).toContain('won');
  });
});

describe('aggregate() when the server REJECTS our query body', () => {
  beforeEach(() => clearSharedDiscoveryCache());

  // framework#4010 validates /analytics/query at the entry. A 400 means the
  // adapter sent an off-contract body — answering it with numbers from the
  // client-side path would bury our own bug behind plausible output, which is
  // exactly the misdirection framework#3878 documented.
  it('400 VALIDATION_FAILED throws — it must NOT be answered by the fallback', async () => {
    const { fetchImpl, calls } = makeFetch(400, {
      success: false,
      error: {
        code: 'VALIDATION_FAILED',
        httpStatus: 400,
        message: 'Invalid AnalyticsQuery body: measures: Invalid input',
        details: { fields: [{ field: 'measures', code: 'invalid_type' }] },
      },
    });

    const err = await makeAdapter(fetchImpl).aggregate('opportunity', SUM_BY_STAGE).catch((e) => e);

    expect(err).toBeInstanceOf(Error);
    expect((err as { code?: string }).code).toBe('ANALYTICS_QUERY_REJECTED');
    expect(String(err.message)).toContain('measures');
    // No silent second answer from a different code path.
    expect(calls.some((c) => c.includes('/api/v1/data'))).toBe(false);
  });
});

describe('aggregate() on a healthy analytics endpoint', () => {
  beforeEach(() => clearSharedDiscoveryCache());

  it('returns the server rows untouched (no false capability detection)', async () => {
    const { fetchImpl, calls } = makeFetch(200, {
      rows: [{ stage: 'won', amount_sum: 150 }],
      fields: [{ name: 'amount_sum', type: 'number' }],
    });

    const rows = await makeAdapter(fetchImpl).aggregate('opportunity', SUM_BY_STAGE);

    // Measure key mapped back to the caller's column (`amount`), rows from the server.
    expect(rows).toEqual([{ stage: 'won', amount: 150 }]);
    expect(calls.some((c) => c.includes('/api/v1/data'))).toBe(false);
  });

  it('a `{ success, data: { rows } }` envelope is still a result, not an error', async () => {
    const { fetchImpl } = makeFetch(200, { success: true, data: { rows: [{ stage: 'won', amount_sum: 150 }] } });
    const rows = await makeAdapter(fetchImpl).aggregate('opportunity', SUM_BY_STAGE);
    expect(rows).toEqual([{ stage: 'won', amount: 150 }]);
  });
});
