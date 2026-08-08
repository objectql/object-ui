/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * usePendingActions — REST helper hook for the framework's HITL (Human-In-
 * The-Loop) approval queue, exposed by `@objectstack/service-ai` at
 * `/api/v1/ai/pending-actions/*`.
 *
 * Designed to be shared between the Console workspace inbox and the Studio
 * builder's AI traces panel. Pure React + fetch — no extra deps so it
 * stays inside `plugin-chatbot`'s tiny bundle.
 *
 * The hook polls the list endpoint (default 5 s) and exposes
 * `approve`/`reject` mutators that re-fetch on completion so consumers
 * don't need to micromanage state.
 *
 * @module
 */

import * as React from 'react';

import type {
  ApproveAiPendingActionResponse,
  RejectAiPendingActionResponse,
} from '@objectstack/spec/api';
import type {
  PendingActionRow,
  PendingActionStatus,
} from '@objectstack/spec/contracts';

/**
 * Lifecycle of a pending action proposal, and the row `GET
 * /api/v1/ai/pending-actions` returns — THE spec types, re-exported
 * (objectui#3160, objectstack#4115 ledger batch 6).
 *
 * `@objectstack/spec/contracts` declares both as the contract of
 * `IAIService.proposePendingAction` / `.listPendingActions`, which is exactly
 * what the REST route serialises; the copies that used to live here were a
 * hand transcription of the same rows and had drifted in three ways, each of
 * which silently disabled a compile-time check:
 *
 *  - `status: PendingActionStatus | string` — a union with `string` ABSORBS the
 *    literals, so the type conveyed nothing at all and `statusesForTab` could
 *    have returned a status the server has never heard of;
 *  - `[k: string]: unknown` — the objectstack#4075 mechanism: an index
 *    signature makes any structural comparison against the spec answer
 *    "identical" no matter how far the copy drifts;
 *  - `created_at` / `updated_at`, which the contract does not carry and no
 *    consumer in this repo reads. If the inbox ever needs them, the fix is to
 *    model them in the spec, not to re-widen the row here.
 *
 * `| null` was dropped with the copy for the same reason: it described what a
 * nullable SQL column might serialise to, not what the contract promises, and
 * every reader here (`formatRelative`, `safeParseJson`) already accepts
 * `null | undefined` on its own parameter.
 */
export type { PendingActionRow, PendingActionStatus };

/**
 * The two decision responses —
 * `POST /api/v1/ai/pending-actions/:id/approve` and `…/reject` — THE spec
 * types, re-exported under this package's published names (objectui#3783).
 *
 * `@objectstack/spec/api` declares both (`ApproveAiPendingActionResponseSchema`
 * / `RejectAiPendingActionResponseSchema` in `api/protocol.zod.ts`), and those
 * are the same schemas `@objectstack/client`'s `ai.pendingActions.approve()` /
 * `.reject()` type their return values with — so what is re-exported here IS
 * the wire, not a second reading of it. The local names stay `ApproveOutcome` /
 * `RejectOutcome` because they are this package's public API surface
 * (`src/index.tsx`); only the shapes change.
 *
 * `status: 'failed'` is an HTTP **200** carrying a reason, not a 5xx: the
 * approval succeeded, the execution did not (see the doc comment on
 * `ApproveAiPendingActionResponseSchema`). The comment that used to sit here
 * claimed 500, which contradicted both the spec and this hook's own design —
 * `call()` throws on `!res.ok`, so a 500 could never reach the resolved-value
 * path `AiPendingActionsInbox` reads `out.error` from.
 *
 * The copies this replaces were hand transcriptions and had drifted three ways.
 * Because the local names are NOT the spec's names,
 * `scripts/check-spec-symbol-derivation.mjs` — which fires when a local
 * declaration OCCUPIES a spec export name — had no handle on them at all;
 * renaming a hand copy is invisible to a name-based guard:
 *
 *  - `ApproveOutcome.id: string`, REQUIRED here and absent from the approve
 *    response — `id` is on the REJECT side. This drift was not dormant: the
 *    public `onDecided` callback (`useHitlInChat`) promised consumers a
 *    `string` and handed them `undefined` at runtime, with no compiler
 *    complaint anywhere;
 *  - `status: 'executed' | 'failed' | string` — a union with `string` ABSORBS
 *    the literals, so the annotation carried no information at all. The same
 *    drift #3220 removed from the row above;
 *  - `[k: string]: unknown` — the objectstack#4075 mechanism: an index
 *    signature makes any structural comparison against the spec answer
 *    "identical" however far the copy has drifted, so a parity test bolted onto
 *    the copy would have been green from its first day.
 */
export type ApproveOutcome = ApproveAiPendingActionResponse;
export type RejectOutcome = RejectAiPendingActionResponse;

export interface UsePendingActionsOptions {
  /**
   * Base URL of the AI service, e.g. `http://localhost:3000/api/v1/ai`.
   * Falls back to `/api/v1/ai` (same-origin) when unset.
   */
  apiBase?: string;
  /**
   * Status filter forwarded as `?status=` to the list endpoint. Set to
   * `'all'` (or undefined) to fetch every row.
   */
  status?: PendingActionStatus | 'all';
  /**
   * Conversation filter forwarded as `?conversationId=`. Useful for
   * scoping the inbox to a specific chat thread.
   */
  conversationId?: string;
  /** Hard limit forwarded as `?limit=`. */
  limit?: number;
  /**
   * Extra headers merged into every request (e.g. `X-Environment-Id`,
   * `Authorization`). Cookies are always sent via `credentials: 'include'`.
   */
  headers?: Record<string, string>;
  /**
   * Polling interval in ms. `0` disables polling (caller must invoke
   * `refresh()` manually). Default: 5000.
   */
  pollInterval?: number;
  /** Disable the hook entirely (skips initial fetch + polling). */
  enabled?: boolean;
}

export interface UsePendingActionsReturn {
  items: PendingActionRow[];
  total: number;
  isLoading: boolean;
  error: Error | undefined;
  /** Re-fetch the list. Awaitable. */
  refresh: () => Promise<void>;
  /**
   * Approve a row. Resolves with the dispatcher outcome (success or
   * failed). Re-fetches the list on completion. Throws on transport,
   * 404, or 409 errors.
   */
  approve: (id: string) => Promise<ApproveOutcome>;
  /**
   * Reject a row with an optional reason. Re-fetches the list on
   * completion. Throws on transport, 404, or 409 errors.
   */
  reject: (id: string, reason?: string) => Promise<RejectOutcome>;
}

const DEFAULT_BASE = '/api/v1/ai';

function buildUrl(base: string, path: string, params?: Record<string, string | number | undefined>): string {
  const root = base.replace(/\/$/, '');
  const qs = new URLSearchParams();
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v == null || v === '') continue;
      qs.set(k, String(v));
    }
  }
  const tail = qs.toString();
  return `${root}${path}${tail ? `?${tail}` : ''}`;
}

async function call<T>(
  url: string,
  init: RequestInit,
  extraHeaders: Record<string, string> | undefined,
): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(extraHeaders ?? {}),
      ...(init.headers ?? {}),
    },
  });
  let body: any = null;
  try { body = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    const msg =
      body?.error?.message ??
      body?.message ??
      body?.error ??
      `${res.status} ${res.statusText}`;
    const err = new Error(typeof msg === 'string' ? msg : JSON.stringify(msg)) as Error & { status?: number; body?: unknown };
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body as T;
}

/**
 * Hook that drives the HITL pending-actions inbox.
 *
 * @example
 * ```tsx
 * const { items, isLoading, error, approve, reject, refresh } =
 *   usePendingActions({
 *     apiBase: 'http://localhost:3004/api/v1/ai',
 *     status: 'pending',
 *     headers: { 'X-Environment-Id': 'env_local' },
 *   });
 * ```
 */
export function usePendingActions(
  options: UsePendingActionsOptions = {},
): UsePendingActionsReturn {
  const {
    apiBase = DEFAULT_BASE,
    status = 'pending',
    conversationId,
    limit,
    headers,
    pollInterval = 5000,
    enabled = true,
  } = options;

  const [items, setItems] = React.useState<PendingActionRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | undefined>(undefined);

  // Stash mutable bits in a ref so the polling effect doesn't re-arm on
  // every header object identity change.
  const cfgRef = React.useRef({ apiBase, status, conversationId, limit, headers });
  cfgRef.current = { apiBase, status, conversationId, limit, headers };

  const refresh = React.useCallback(async () => {
    const { apiBase, status, conversationId, limit, headers } = cfgRef.current;
    setIsLoading(true);
    setError(undefined);
    try {
      const url = buildUrl(apiBase, '/pending-actions', {
        status: status && status !== 'all' ? status : undefined,
        conversationId,
        limit,
      });
      const out = await call<{ items: PendingActionRow[]; total?: number }>(
        url,
        { method: 'GET' },
        headers,
      );
      setItems(Array.isArray(out.items) ? out.items : []);
      setTotal(typeof out.total === 'number' ? out.total : (out.items?.length ?? 0));
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const approve = React.useCallback(async (id: string): Promise<ApproveOutcome> => {
    const { apiBase, headers } = cfgRef.current;
    const url = buildUrl(apiBase, `/pending-actions/${encodeURIComponent(id)}/approve`);
    try {
      const out = await call<ApproveOutcome>(url, { method: 'POST', body: '{}' }, headers);
      return out;
    } finally {
      void refresh();
    }
  }, [refresh]);

  const reject = React.useCallback(async (id: string, reason?: string): Promise<RejectOutcome> => {
    const { apiBase, headers } = cfgRef.current;
    const url = buildUrl(apiBase, `/pending-actions/${encodeURIComponent(id)}/reject`);
    try {
      const out = await call<RejectOutcome>(
        url,
        { method: 'POST', body: JSON.stringify(reason ? { reason } : {}) },
        headers,
      );
      return out;
    } finally {
      void refresh();
    }
  }, [refresh]);

  // Initial fetch + polling.
  React.useEffect(() => {
    if (!enabled) return;
    void refresh();
    if (!pollInterval || pollInterval <= 0) return;
    const id = setInterval(() => { void refresh(); }, pollInterval);
    return () => clearInterval(id);
  }, [enabled, pollInterval, refresh, apiBase, status, conversationId, limit]);

  return { items, total, isLoading, error, refresh, approve, reject };
}
