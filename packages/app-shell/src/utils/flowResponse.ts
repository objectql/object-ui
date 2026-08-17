/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * The ONE place the console interprets a flow `trigger` / `resume` response.
 *
 * This is the `/actions` story again (see {@link ./actionResponse}), on the
 * automation route: the rule lived in THREE hand-rolled copies — the flow
 * handlers in `useConsoleActionRuntime` and `RecordDetailView`, plus
 * `FlowRunner`'s resume — and only the third one was complete. The two launch
 * copies checked the transport envelope and then treated *everything else* as
 * terminal success, so a flow that failed on its first node was
 * indistinguishable from one that ran to completion: no dialog, a green
 * "completed successfully" toast, and a refresh (#2958).
 *
 * ## The response wraps once, and failure has three shapes
 *
 * ```
 * {                        ← transport envelope
 *   success: true,
 *   data: {                ← AutomationResult (spec: contracts/automation-service)
 *     success: boolean,    ← required; FALSE when the run failed
 *     status?: 'completed' | 'paused' | 'failed',
 *     runId?, screen?,     ← set when paused at a `screen` node
 *     error?, errorMessage?, successMessage?
 *   }
 * }
 * ```
 *
 * - **transport failure** — `!res.ok`, or the outer `success: false`. The run
 *   may never have started; nothing was consumed.
 * - **flow failure** — the run started and failed. HTTP **200**, outer
 *   `success: true`, and `data.success === false` (or `status: 'failed'`).
 *   `res.ok` is TRUE, so only the inner envelope shows it. This is the one the
 *   launch handlers missed.
 * - **paused** — suspended at a `screen` node awaiting input. NOT a failure:
 *   the engine always stamps `success: true` alongside `status: 'paused'`
 *   (service-automation `engine.ts`), which is why failure can be classified
 *   before pausing without swallowing a wizard.
 *
 * Callers get one more thing out of routing through here: `error` is always a
 * STRING. Handing a `{code, message}` object to `toast.error()` puts an object
 * where React expects a child and crashes the page (React #31) — the same trap
 * `actionErrorDetail` exists for.
 *
 * ## A failed run does NOT always arrive as HTTP 200 (objectui#4784)
 *
 * The three shapes above describe the route as it answers today. objectstack#8684
 * unifies the resume route onto real status codes — inheriting the #3962 ruling
 * that business failures must not ride HTTP 200 inside a double envelope — so the
 * SAME terminal node failure that answers `200 {data:{success:false}}` today will
 * answer `400` + `FLOW_FAILED` once that lands, in the ADR-0112 error envelope:
 *
 * ```
 * { success: false, error: { code, message, httpStatus, details? } }
 * ```
 *
 * That moves a terminal failure into the `!res.ok` branch, which is the
 * TRANSPORT branch — and the two are not interchangeable, because `retryable`
 * is what `FlowRunner` uses to decide whether to keep the wizard open. A
 * terminal failure classified as transport leaves the dialog open offering a
 * retry that is *guaranteed* to fail: the engine consumes the suspension before
 * running downstream nodes (resume-once), so the retry can only reach "No
 * suspended run". Hence the two non-retryable arms below, both keyed on what is
 * already on the wire rather than on which caller invoked us:
 *
 * - **400 + `FLOW_FAILED`** — the flow RAN and failed. Terminal. Only this code
 *   qualifies: the other 400s on this route (`INVALID_SIGNAL`,
 *   `INVALID_SCREEN_INPUT`) are refused by the engine *before* the signal
 *   reaches the variable map, so the suspension survives and a corrected
 *   resubmit is meaningful — they stay retryable, and that distinction is the
 *   whole point of the flag.
 * - **404** — there is no such run (or no such flow). Terminal for a different
 *   reason: not "your submission was rejected" but "there is nothing to submit
 *   to". Unlike the branch above this one is NOT dormant — the route already
 *   answers `404 No such suspended run` today (`RUN_NOT_FOUND`), and every one
 *   of those has been keeping the wizard open for a retry that can only 404
 *   again. Keyed on the STATUS alone, deliberately: a 404 from a proxy or an
 *   unmounted route carries no envelope to read a code out of, and the user's
 *   disposition must not depend on whether a body parsed.
 *
 * Landing this BEFORE the backend flip is the ruling's explicit sequencing
 * (objectstack#8684, maintainer ruling of 2026-08-15, sub-decision 3). It is
 * forward-compatible: nothing sends `400 FLOW_FAILED` on this route yet, so that
 * arm is simply dormant until it does.
 *
 * ⚠️ **The authorable `errorMessage` needs a slot on the wire.** A flow declares
 * `errorMessage` so the user sees its words instead of an engine string, and the
 * 200-path failure prefers it (`flowFailureMessage`). The error envelope has no
 * `data`, so the producer must carry it in `error.details` — the envelope's own
 * declared carrier for structured extras, and the only one that survives to the
 * wire (`splitSemanticCode` promotes `details.code` to `error.code` and keeps
 * the rest). That is the single location read below; there is deliberately no
 * alias chain hunting for it elsewhere (commandment #0.1 — one strict contract
 * beats N dialects). If it is absent the message degrades to the envelope's own
 * `error.message`, never to silence.
 */

import { actionErrorDetail } from '@object-ui/core';
import { errorCodeIs } from '@object-ui/types';

/**
 * The `AutomationResult` fields the console reads. Deliberately loose: this is
 * a parsed HTTP body, not a value the type system has vouched for.
 */
export interface FlowRunResult {
    success?: boolean;
    status?: 'completed' | 'paused' | 'failed' | string;
    runId?: string;
    screen?: unknown;
    error?: unknown;
    errorMessage?: unknown;
    successMessage?: unknown;
    [key: string]: unknown;
}

/**
 * `S` is the caller's screen type (`ScreenSpec`, which lives in the views
 * layer). Generic rather than imported so this util stays a leaf.
 */
export type FlowResponseOutcome<S = unknown> =
    | {
        kind: 'failed';
        /** Always a string — safe to hand to `toast.error()`. */
        error: string;
        /**
         * The request failed at the transport, so the run was NOT consumed —
         * a retry of the same run is meaningful. False for a flow failure:
         * the engine consumed the suspension before running downstream nodes
         * (resume-once), so retrying only reaches "No suspended run", and a
         * runner should close rather than leave a dead form open.
         */
        retryable: boolean;
    }
    | { kind: 'paused'; runId?: string; screen: S; data: FlowRunResult }
    | { kind: 'done'; data: FlowRunResult | undefined; successMessage?: string };

/**
 * A flow declares a friendly `errorMessage`; prefer it over the raw `error`,
 * then fall back to the label. `actionErrorDetail` guarantees a string.
 */
function flowFailureMessage(data: FlowRunResult, fallback: string): string {
    const friendly = data.errorMessage;
    if (typeof friendly === 'string' && friendly.length > 0) return friendly;
    return actionErrorDetail(data, fallback);
}

/**
 * `error.details` out of an ADR-0112 error envelope, as the loose result shape
 * the failure-message rule reads. `{}` when there is none — this route's `error`
 * has always been able to arrive as a bare string, and a non-2xx may carry no
 * parseable body at all, so nothing here may assume an object.
 */
function errorEnvelopeDetails(json: unknown): FlowRunResult {
    const envelope = (json as { error?: { details?: unknown } } | null | undefined)?.error;
    const details = envelope?.details;
    if (!details || typeof details !== 'object' || Array.isArray(details)) return {};
    return details as FlowRunResult;
}

/**
 * Classify a `POST /api/v1/automation/{flow}/trigger` or
 * `.../runs/{runId}/resume` response.
 *
 * `label` names the flow for fallback messages (e.g. `Flow "convert_lead"`).
 * `json` is the parsed body, or `null` when it could not be parsed.
 */
export function interpretFlowResponse<S = unknown>(
    res: { ok: boolean; status: number },
    json: any,
    label: string,
): FlowResponseOutcome<S> {
    if (!res.ok) {
        // The flow RAN and failed — same event as the inner-envelope failure
        // below, just carried on a real status code. Terminal, and the
        // authorable `errorMessage` stays preferred for it; the envelope's own
        // `message` is the fallback. See the header note.
        if (res.status === 400 && errorCodeIs(json?.error, 'FLOW_FAILED')) {
            return {
                kind: 'failed',
                error: flowFailureMessage(
                    errorEnvelopeDetails(json),
                    actionErrorDetail(json, `${label} failed`),
                ),
                retryable: false,
            };
        }

        // Nothing to resume (or no such flow). A retry cannot conjure the run
        // back; status alone decides, since a proxy 404 carries no envelope.
        if (res.status === 404) {
            return {
                kind: 'failed',
                error: actionErrorDetail(json, `${label} failed (HTTP ${res.status})`),
                retryable: false,
            };
        }

        // Every other non-2xx is a genuine transport failure: it did not consume
        // the suspension, so retrying the same run is meaningful.
        return {
            kind: 'failed',
            error: actionErrorDetail(json, `${label} failed (HTTP ${res.status})`),
            retryable: true,
        };
    }

    if (json && json.success === false) {
        // Outer envelope failure under a 2xx — the request was refused before
        // the run started, so nothing was consumed.
        return {
            kind: 'failed',
            error: actionErrorDetail(json, `${label} failed (HTTP ${res.status})`),
            retryable: true,
        };
    }

    const data: FlowRunResult = (json?.data ?? {}) as FlowRunResult;

    // Checked BEFORE `paused` on purpose — see the header note on why a paused
    // run can never land here.
    if (data.success === false || data.status === 'failed') {
        return {
            kind: 'failed',
            error: flowFailureMessage(data, `${label} failed`),
            retryable: false,
        };
    }

    if (data.status === 'paused' && data.screen) {
        return { kind: 'paused', runId: data.runId, screen: data.screen as S, data };
    }

    // Terminal success. `data` is the raw `json?.data` — `undefined` when the
    // body carried none, which is what `ActionResult.data` has always exposed.
    return {
        kind: 'done',
        data: json?.data as FlowRunResult | undefined,
        successMessage: typeof data.successMessage === 'string' ? data.successMessage : undefined,
    };
}
