// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import * as React from 'react';

/**
 * `LoadState<T>` — the one shape the metadata-admin loaders use to keep a
 * FAULT and a MEASUREMENT distinguishable (objectui#5170, objectui#5169).
 *
 * ## The defect class this exists to close
 *
 * A loader that holds `items: T[]` plus `loading: boolean` can spell only two
 * of the three facts it has to report. There is no value left for "the request
 * failed", so the catch reaches for the nearest one — `setItems([])` — which is
 * byte-identical to a *successful* call that found nothing. Every consumer then
 * reads a refusal, a dropped connection, an expired session or an unparseable
 * body as an affirmative, measured "there is nothing here".
 *
 * Making the fault its own arm makes the wrong combination unrepresentable: no
 * value of this type is both `error` and `loaded`, so no render path can read a
 * failure as a measurement. That is a stronger guarantee than the render-order
 * discipline the sibling panels use (`!loading && error` checked before
 * `!loading && !error && items.length === 0`), which is correct today but is
 * re-derived by hand at every render site and silently breaks when a branch is
 * reordered.
 *
 * ## Why this spelling and not another
 *
 * Not invented here. Four in-tree references were read before this was written,
 * and this is the one they agree on:
 *
 *   1. `ResourceEditPage`'s `ReferencesState` (objectui#5110, landed) — the
 *      same four arms, `idle | loading | loaded | error`, with the error arm
 *      checked first. This type is structurally identical to it on purpose, so
 *      the two can be collapsed later without a behaviour change; #5110's union
 *      is deliberately left alone here because it is already correct and
 *      rewriting it would be churn, not a fix.
 *   2. `RelatedPanel` — per-group `{ loading, error, items }`, error branch
 *      rendered before the empty branch.
 *   3. `DiagnosticsPage` — `{!loading && error}` / `{!loading && !error &&
 *      groups.length === 0}`, mutually exclusive by construction.
 *   4. `ResourceHistoryPage`'s history loader — the catch sets `error` only and
 *      leaves `events` untouched, so a failure never fabricates a count.
 *
 * ## `idle` is not a synonym for `loading`
 *
 * `idle` means the question was never asked — a lazily-opened panel before its
 * first open, or a picker whose source object is not bound yet. It is what lets
 * a re-entry guard tell "never asked" from "asked and failed" (and so lets a
 * retry through) without a second flag.
 *
 * ADR-0110 D3 — a miss and a fault are different facts.
 */
export type LoadState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; data: T }
  | { status: 'error'; message: string };

/**
 * Normalise a thrown value into the message the failure state shows.
 *
 * `client.*` throws `parseError(res)` for every non-ok status other than the
 * 404s it maps to an empty result, so the thrown value is normally an `Error`
 * carrying the server's message. Anything else (a string, a rejected non-Error)
 * is stringified rather than dropped: an unhelpful cause is still evidence that
 * the question was not answered, which is the fact being reported.
 */
export function loadErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  const message = (err as { message?: unknown } | null | undefined)?.message;
  if (typeof message === 'string' && message) return message;
  return String(err);
}

/**
 * The data of a COMPLETED load, or `fallback` for every other arm.
 *
 * The fallback is what a consumer that cannot render a failure gets. Callers
 * that CAN render one must check `status === 'error'` first — this accessor
 * deliberately cannot tell them apart, which is the whole point of routing the
 * failure through its own arm instead of through the fallback.
 */
export function loadedData<T>(state: LoadState<T>, fallback: T): T {
  return state.status === 'loaded' ? state.data : fallback;
}

/** True only while a request is actually in flight. `idle` is not loading. */
export function isLoading(state: LoadState<unknown>): boolean {
  return state.status === 'loading';
}

/** The failure message when this load failed, otherwise `undefined`. */
export function loadErrorOf(state: LoadState<unknown>): string | undefined {
  return state.status === 'error' ? state.message : undefined;
}

/**
 * The one loader every metadata-admin option-picker catalog shares
 * (objectui#5170, objectui#5227).
 *
 * Each catalog used to hand-roll the same effect, and each hand-rolled the same
 * bug in it: the `catch` wrote the empty array — the value a *successful*
 * response with nothing in it writes — and the `finally` flipped loading to
 * false. The picker then rendered a completed, empty list, and an operator
 * authoring a view, a permission row or an action read that as the metadata
 * graph's answer ("this object has no fields") and went and created one.
 *
 * Sharing one hook is what makes that unrepeatable: the catch is written once,
 * and it can only produce the `error` arm. Copy-pasted unions are how the next
 * drift starts — which is exactly what happened: `FieldSelectorWidget` in
 * `widgets.tsx` was a fourth loader with the same swallow, missed by
 * objectui#5170 because it does not go through `MetadataClient` at all. It now
 * calls this hook too, so the hook lives here rather than private to
 * `ResourceEditPage` (`widgets.tsx` cannot import that module — `ResourceEditPage`
 * imports `widgets`).
 *
 * The loaders differ only in what they fetch and in whether they are gated on a
 * bound source object, and both differences fit through the argument:
 *
 *   • `load` is the request, memoised by the caller — its identity is the
 *     dependency, so the caller keeps its own explicit dep list and this hook
 *     needs no dep-array passthrough.
 *   • `load === null` means "not applicable" (no source object is bound). That
 *     is the `idle` arm: a question never asked, which is NOT a failure and
 *     must not render as one.
 *
 * The initial state follows `load` rather than defaulting to `idle`, so an
 * enabled loader is already `loading` on first paint. Starting at `idle` would
 * flash one frame of "not loading, zero results" before the effect runs — the
 * exact false reading this card is about, just briefly.
 *
 * The `cancelled` guard is load-bearing, not hygiene: once a failure has its
 * own arm, a late response for a PREVIOUS question can no longer only stale a
 * list — it can post a failure banner over a catalog that loaded fine, or hide
 * a real one behind a stale success.
 */
export function usePickerLoad<T>(load: (() => Promise<T>) | null): LoadState<T> {
  const [state, setState] = React.useState<LoadState<T>>(() =>
    load ? { status: 'loading' } : { status: 'idle' },
  );
  React.useEffect(() => {
    if (!load) {
      setState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    void (async () => {
      try {
        const data = await load();
        if (!cancelled) setState({ status: 'loaded', data });
      } catch (err) {
        // NOT `{ status: 'loaded', data: [] }`. An unanswered question is not
        // an answer of "nothing" — that substitution is the entire defect.
        if (!cancelled) setState({ status: 'error', message: loadErrorMessage(err) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);
  return state;
}
