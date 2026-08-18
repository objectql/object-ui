/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `createServerActionHandler` — the core server-action dispatcher factory
 * (objectui#2904, the follow-up #2896 deferred).
 *
 * `ActionSchema.body` (HookBodySchema — L1 expression / L2 sandboxed JS) is the
 * spec's preferred binding for script actions, and bodies execute SERVER-side:
 * `POST /api/v1/actions/{object}/{action}` → the runtime sandbox. This client
 * never interprets a body (L2 needs an isolated VM enforcing capabilities /
 * `timeoutMs` / `memoryMb`, which a browser cannot provide; L1 is formula-engine
 * CEL, a different dialect from this package's `${…}` evaluator). The client
 * DISPATCHES; it does not interpret — see the `ActionDef.body` doc and #2896.
 *
 * Until this factory existed, only the console could dispatch: app-shell's
 * `useConsoleActionRuntime` and `RecordDetailView` each hand-rolled the same
 * POST (and drifted — objectstack#3913, framework#3935), while every other
 * `@object-ui/core` consumer fell through to the built-in `executeScript` and
 * hit a dead end. The factory is deliberately opinion-free about the three
 * things core has no business deciding (#2904):
 *
 * - **auth** — inject `fetch` (an authenticated wrapper: Bearer, tenant,
 *   cookies — whatever the host's transport needs);
 * - **base URL** — inject `baseUrl` (a string or a thunk; core inherits no
 *   bundler env convention like `VITE_SERVER_URL`);
 * - **object scope** — inject `resolveObject` for the fallback when the action
 *   declares no `objectName` of its own.
 *
 * Everything protocol-shaped lives here, once: name-only action identity
 * (ADR-0110 D1), the record-id resolution dance (`_rowRecord`, `recordIdField`,
 * aggregate `_selectedIds`, toolbar-selection fallback with its guards), the
 * re-entrancy guard, the POST body shape `{ recordId, params }`, and the
 * `/actions` envelope rule (`interpretActionResponse`).
 *
 * Standalone usage:
 *
 * ```ts
 * import { createServerActionHandler } from '@object-ui/core';
 *
 * const script = createServerActionHandler({
 *   fetch: myAuthenticatedFetch,
 *   baseUrl: 'https://api.example.com',
 *   resolveObject: () => currentObjectName,
 *   onRefresh: () => notifyDataChanged(),
 * });
 * // Register it — registered handlers beat the built-in executeScript:
 * // <ActionProvider handlers={{ script }} … />  (or runner.registerHandler('script', script))
 * ```
 */

import type { ActionContext, ActionDef, ActionResult } from './ActionRunner.js';
import { interpretActionResponse } from './actionResponse.js';

/** The response surface the dispatcher needs — satisfied by a WHATWG `Response`. */
export interface ServerActionFetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<any>;
}

/**
 * The injected transport. Core has no auth opinion: pass an authenticated
 * wrapper (e.g. app-shell's `createAuthenticatedFetch()`), not the bare global
 * `fetch`, unless your deployment really needs no credentials.
 */
export type ServerActionFetch = (
  url: string,
  init: { method: 'POST'; headers: Record<string, string>; body: string },
) => Promise<ServerActionFetchResponse>;

/**
 * What a record-id resolver reports: a record id (absent for object-scoped
 * dispatches), or a blocking error the handler returns without POSTing.
 */
export interface ServerActionRecordIdResolution {
  recordId?: unknown;
  error?: string;
}

export type ServerActionRecordIdResolver = (
  action: ActionDef,
  context: ActionContext | undefined,
) => ServerActionRecordIdResolution;

/**
 * A dispatch handler produced by {@link createServerActionHandler}. Assignable
 * to `ActionRunnerHandler` — register it under `'script'` (and, where the host
 * routes them server-side, other action types).
 */
export type ServerActionHandler = (
  action: ActionDef,
  context?: ActionContext,
) => Promise<ActionResult>;

export interface ServerActionHandlerConfig {
  /** Authenticated transport — see {@link ServerActionFetch}. */
  fetch: ServerActionFetch;
  /**
   * Server origin prefix (`''`/omitted = same-origin). A thunk is read per
   * dispatch, so hosts with late-bound configuration can inject one.
   */
  baseUrl?: string | (() => string);
  /**
   * Fallback object scope when the action declares no `objectName` — e.g. the
   * current view's object. When neither yields a name the dispatch is `global`.
   */
  resolveObject?: (action: ActionDef, context: ActionContext | undefined) => string | undefined;
  /**
   * Replace the standard record-id dance ({@link resolveServerActionRecordId})
   * wholesale — e.g. a record page resolves against ITS record, not a grid
   * selection.
   */
  resolveRecordId?: ServerActionRecordIdResolver;
  /**
   * Invoked after a successful dispatch that requests a refresh
   * (`refreshAfter !== false`) — wire your data invalidation here.
   */
  onRefresh?: () => void;
}

/**
 * An action that also mounts on list rows (`list_item`) or record pages is
 * designed to run against a single record. When such an action is launched
 * from the list toolbar with nothing selected, there is no record context to
 * resolve — block up front instead of triggering a run that fails at its
 * first record-bound step (#2210: "Update requires an ID"). Actions declaring
 * only object-level locations (e.g. `['list_toolbar']`) are left alone: they
 * legitimately run without a record.
 */
export function isRecordScopedAction(action: ActionDef): boolean {
  const locations = action.locations;
  if (!Array.isArray(locations)) return false;
  return locations.some((l) =>
    l === 'list_item' || l === 'record_header' || l === 'record_more' || l === 'record_section');
}

/**
 * The standard record-id resolution dance, shared by the dispatcher and by
 * consumers that need the id BEFORE dispatching (e.g. app-shell's zero-roundtrip
 * `newTabUrl` fast path). Pure — reads the action/context, mutates nothing.
 *
 * Order: explicit `params.recordId` → the stashed `_rowRecord`'s
 * `recordIdField` (list_item invocations) → the grid's checkbox selection from
 * the runner context (`selectedRecords`, list_toolbar invocations). An
 * AGGREGATE bulk dispatch (objectui#3139) carries the whole selection as
 * `params._selectedIds` — the server reads that array, not `recordId`, so the
 * selection fallback must not touch it (resolving a recordId would mislabel
 * the run as record-scoped, and the multi-select guard would block exactly the
 * selection the dispatch exists to carry). Multi-select is ambiguous for a
 * single-record action — block with a message; so is zero selection when the
 * action is record-scoped (see {@link isRecordScopedAction}).
 */
export function resolveServerActionRecordId(
  action: ActionDef,
  context: ActionContext | undefined,
): ServerActionRecordIdResolution {
  const params = (action.params && !Array.isArray(action.params))
    ? (action.params as Record<string, unknown>)
    : {};
  const rowRecord = params._rowRecord as Record<string, any> | undefined;
  const recordIdField = action.recordIdField || 'id';
  let recordId = (params as { recordId?: unknown }).recordId ?? rowRecord?.[recordIdField];
  const isAggregateDispatch = Array.isArray(params._selectedIds);
  if (recordId == null && !isAggregateDispatch) {
    const selected = Array.isArray(context?.selectedRecords) ? context!.selectedRecords : [];
    if (selected.length === 1) {
      recordId = selected[0]?.[recordIdField];
    } else if (selected.length > 1) {
      // The runner's post-execution hook surfaces `error` as a toast.
      return { error: 'This action runs on a single record — select exactly one row.' };
    } else if (isRecordScopedAction(action)) {
      return { error: 'This action runs on a single record — select a row first.' };
    }
  }
  return { recordId: recordId ?? undefined };
}

/**
 * Build a server-action dispatch handler. See the module doc for what the
 * factory owns and what the config injects.
 */
export function createServerActionHandler(config: ServerActionHandlerConfig): ServerActionHandler {
  const { fetch: dispatchFetch, resolveObject, onRefresh } = config;
  const resolveRecordId = config.resolveRecordId ?? resolveServerActionRecordId;
  // Guards against double-firing a server action (slow SSO handoff, etc.).
  // Handler-instance state: keep the produced handler stable for its guard to
  // span invocations.
  const inFlight = new Set<string>();

  return async function serverActionDispatch(
    action: ActionDef,
    context?: ActionContext,
  ): Promise<ActionResult> {
    // [ADR-0110 D1] The URL identifies the action by its declarative `name`,
    // never by `target`. `target` is a BINDING EXPRESSION — the handler's
    // registration key here, but a URL / flow id / FormView name for other
    // types, `${param.X}`-interpolatable, and legitimately non-unique — so it
    // cannot identify a declaration. Posting it (the old `target || name`)
    // meant the server resolved NO declaration for a target-bound action and
    // silently skipped both the ADR-0066 D4 capability gate and the ADR-0104
    // param contract (framework#3935). The server derives the handler key from
    // the declaration it resolves by name.
    const actionName = action.name;
    if (!actionName) {
      return { success: false, error: 'Action has no name — a server action must declare one' };
    }

    // The row record is a CLIENT-side stash (list_item invocations park it
    // under `params._rowRecord` for param defaults and id resolution) — never
    // part of the server contract, so it is stripped from the POSTed params.
    const params = (action.params && !Array.isArray(action.params))
      ? { ...(action.params as Record<string, unknown>) }
      : {};
    delete params._rowRecord;

    const resolution = resolveRecordId(action, context);
    if (resolution.error) {
      return { success: false, error: resolution.error };
    }
    const recordId = resolution.recordId;

    // Re-entrancy guard.
    const inflightKey = `${actionName}:${recordId ?? ''}`;
    if (inFlight.has(inflightKey)) {
      return { success: false, error: 'Action already in progress' };
    }
    inFlight.add(inflightKey);
    try {
      const baseUrl = typeof config.baseUrl === 'function' ? config.baseUrl() : (config.baseUrl ?? '');
      const objectName = action.objectName || resolveObject?.(action, context) || 'global';
      const res = await dispatchFetch(
        `${baseUrl}/api/v1/actions/${encodeURIComponent(objectName)}/${encodeURIComponent(actionName)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recordId, params }),
        },
      );
      const json = await res.json().catch(() => null);
      // The `/actions` envelope rule, once — see ./actionResponse.
      const outcome = interpretActionResponse(res, json, `Action "${actionName}"`);
      if (!outcome.ok) {
        // Don't toast here — the ActionRunner's post-execution hook surfaces
        // `error` as a toast; a handler-side toast double-fires it.
        return { success: false, error: outcome.error };
      }
      const shouldRefresh = action.refreshAfter !== false;
      if (shouldRefresh) onRefresh?.();
      // `data` carries the ACTION ENVELOPE (`{ success, data }`), the level
      // `ActionResult.data` has always carried; consumers reading the
      // handler's own return value go through `readActionPayload`.
      return { success: true, data: outcome.envelope, reload: shouldRefresh };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    } finally {
      inFlight.delete(inflightKey);
    }
  };
}
