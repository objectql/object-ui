/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * A stand-in for the record-level explain probe, for the plugin-grid suites
 * that render `ObjectGrid` without wiring one themselves.
 *
 * [#4296] `ObjectGrid` batches a record-grained write verdict for the rows on
 * screen (`POST /api/v1/security/explain` with `recordIds`). With no host
 * `apiFetch` in the tree the hook falls back to the GLOBAL fetch — by design,
 * for standalone embeds — which under happy-dom is a REAL request to the
 * default origin. The verdict fails open on a failed request, so a suite that
 * ignores it stays green while stderr fills with `connect ECONNREFUSED
 * 127.0.0.1:3000`: exactly the escape objectui#3339 recorded for the singular
 * probe on the detail side, and the shape PR #4105 settled — answer it from a
 * double, never from the network, and never from a global error sink.
 *
 * Deliberately NOT a swallow-everything stub: it RECORDS every URL it is handed
 * and answers only the explain endpoint, so an escape to some other endpoint
 * stays observable instead of vanishing into a rejection the hook discards.
 *
 * The answer is `visible: true` for every id asked about, which reproduces the
 * pre-#4296 rendering exactly — a permitted record narrows nothing, so no
 * assertion in a consuming suite changes meaning. A suite that wants a DENYING
 * verdict is testing this card's behavior and should say so explicitly; see
 * `rowRecordCrudVerdict.test.tsx`, which serves both directions from a real
 * verdict table.
 */
import { vi } from 'vitest';

export interface ExplainDoubleCall {
  url: string;
  body: Record<string, unknown> | undefined;
}

/**
 * Install the double on the global `fetch`. Pair with `vi.unstubAllGlobals()`
 * in `afterEach`, and clear `__clearRecordCrudVerdictCache()` in `beforeEach`
 * when a suite's rows repeat across tests.
 *
 * @returns the live call log, in request order.
 */
export function installExplainDouble(): ExplainDoubleCall[] {
  const calls: ExplainDoubleCall[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: unknown, init?: { body?: unknown }) => {
      const body = init?.body
        ? (JSON.parse(String(init.body)) as Record<string, unknown>)
        : undefined;
      calls.push({ url: String(url), body });
      const recordIds = Array.isArray(body?.recordIds) ? (body!.recordIds as string[]) : undefined;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          allowed: true,
          object: body?.object,
          operation: body?.operation,
          principal: { userId: 'u_test' },
          layers: [],
          ...(recordIds ? { records: recordIds.map((id) => ({ recordId: id, visible: true })) } : {}),
        }),
      };
    }),
  );
  return calls;
}
