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
 */

import { actionErrorDetail } from '@object-ui/core';

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
    if (!res.ok || (json && json.success === false)) {
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
