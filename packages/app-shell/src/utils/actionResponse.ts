/**
 * The ONE place the console interprets a `POST /api/v1/actions/...` response.
 *
 * This existed twice — `useConsoleActionRuntime.serverActionHandler` and
 * `RecordDetailView`'s copy of the same handler — and the two drifted, which is
 * the whole reason objectstack#3913 was filed against the console: one copy
 * learned to inspect the inner envelope and the other did not, so a failed
 * action fired a green "completed" toast on every list/page surface. Two copies
 * of a subtle envelope rule is a bug generator; this is the rule, once.
 *
 * ## The envelope is DOUBLE, and that is the trap
 *
 * ```
 * {                          ← transport envelope
 *   success: true,
 *   data: {                  ← action envelope
 *     success: true,
 *     data: { … }            ← what the handler actually returned
 *   }
 * }
 * ```
 *
 * Unlike `/api/v1/<anything-else>`, which wraps ONCE, `/actions` wraps twice —
 * the route's own `{success, data}` sits inside the dispatcher's. Reading one
 * level (the natural instinct, and what the other handlers correctly do) lands
 * on the action envelope, not the payload.
 *
 * ## Failure has three shapes, and `res.ok` alone catches only one
 *
 * - **dispatch failure** — 404 no such action, 403 denied, 400 wrong action
 *   type, 503 unavailable, 500 the handler crashed. `res.ok` is false.
 * - **business rejection** — the handler ran and said no. HTTP **200** with
 *   `data.success === false`. `res.ok` is TRUE; only the inner envelope shows
 *   it. This is the one that got missed.
 * - **transport-level `success: false`** — the outer envelope reporting a
 *   failure directly.
 */

import { actionErrorDetail } from './actionErrorDetail';

export interface ActionResponseOutcome {
    ok: boolean;
    /** Human-readable failure text. Always a string when `ok` is false. */
    error?: string;
    /**
     * The ACTION ENVELOPE (`body.data`) — `{ success, data }`. Kept as-is
     * because `ActionResult.data` has always carried this level and
     * `resultDialog` field paths in the wild may compensate for it; see the
     * note in {@link readActionPayload}.
     */
    envelope?: unknown;
    /** What the handler actually returned (`body.data.data`). */
    payload?: unknown;
}

/**
 * The handler's own return value — one level deeper than the action envelope.
 *
 * `body.data` is `{ success, data }`; the handler's value is `body.data.data`.
 * Reading the shallower level is why an action returning `{ redirectUrl }` was
 * silently ignored: `body.data.redirectUrl` is never set by anything, because
 * that level is constructed by the server and only ever holds `success`/`data`.
 */
export function readActionPayload(envelope: unknown): unknown {
    if (envelope && typeof envelope === 'object' && !Array.isArray(envelope) && 'success' in envelope) {
        return (envelope as { data?: unknown }).data;
    }
    // A server that did not double-wrap (or a stubbed response in a test):
    // treat what we have as the payload rather than inventing an undefined.
    return envelope;
}

/**
 * Classify an `/actions` response. `label` names the action for the fallback
 * message (e.g. `Action "log_call" failed`).
 *
 * `json` is the parsed body, or `null` when it could not be parsed.
 */
export function interpretActionResponse(
    res: { ok: boolean; status: number },
    json: any,
    label: string,
): ActionResponseOutcome {
    const envelope = json?.data;
    const innerFailed = !!envelope && typeof envelope === 'object' && (envelope as any).success === false;

    if (!res.ok || (json && json.success === false) || innerFailed) {
        // A business rejection carries its message on the INNER envelope; a
        // dispatch failure carries it on the outer one (as a nested
        // `{message, code}` object, which `actionErrorDetail` resolves to a
        // string — handing that object to `toast.error()` as a React child
        // crashes the page, React #31).
        return {
            ok: false,
            error: innerFailed
                ? actionErrorDetail(envelope, `${label} failed`)
                : actionErrorDetail(json, `${label} failed (HTTP ${res.status})`),
        };
    }

    return { ok: true, envelope, payload: readActionPayload(envelope) };
}
