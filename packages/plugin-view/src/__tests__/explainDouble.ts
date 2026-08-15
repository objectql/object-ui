/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * A stand-in for the record-level explain probe, for this package's suites
 * that render a real `ObjectGrid` (via `ObjectView`) without wiring a host
 * `apiFetch` themselves.
 *
 * [objectui#4688] `ObjectGrid` batches a record-grained write verdict for the
 * rows on screen (`POST /api/v1/security/explain` with `recordIds`), rooted
 * in [#4296]. With no host `apiFetch` in the tree the hook falls back to the
 * GLOBAL fetch — by design, for standalone embeds — which under happy-dom is
 * a REAL request to the default origin. The verdict fails open on a failed
 * request, so a suite that ignores it stays green while stderr fills with
 * `connect ECONNREFUSED 127.0.0.1:3000`: the same class of escape as
 * objectui#3339 (detail side, closed by PR #4105) and the shape that PR
 * settled — answer it from a double, never from the network, and never from
 * a global error sink.
 *
 * This is a per-package copy of `packages/plugin-grid/src/__tests__/
 * explainDouble.ts`, following the #4105 convention (no repo convention for
 * importing another package's test-only files across a workspace boundary).
 *
 * Deliberately NOT a swallow-everything stub: it RECORDS every URL it is
 * handed and answers only the explain endpoint, so an escape to some other
 * endpoint stays observable instead of vanishing into a rejection the hook
 * discards.
 *
 * The answer is `visible: true` for every id asked about, which reproduces
 * the pre-#4296 rendering exactly — a permitted record narrows nothing, so no
 * assertion in a consuming suite changes meaning.
 */
import { vi } from 'vitest';

export interface ExplainDoubleCall {
  url: string;
  body: Record<string, unknown> | undefined;
}

/**
 * Install the double on the global `fetch`. Pair with `vi.unstubAllGlobals()`
 * in `afterEach`.
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
