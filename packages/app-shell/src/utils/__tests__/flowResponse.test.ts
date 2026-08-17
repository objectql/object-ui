/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * The flow trigger/resume response rule, once (#2958). Three hand-rolled copies
 * existed and only one was complete; these cases pin the shapes the two
 * incomplete ones got wrong.
 */

import { describe, it, expect } from 'vitest';
import { interpretFlowResponse } from '../flowResponse';

const ok = { ok: true, status: 200 };

describe('interpretFlowResponse — the reported bug: failure read as terminal success', () => {
    it('catches a flow failure hiding under HTTP 200 with an outer success:true', () => {
        // THE bug: no `status`, no `screen`, outer `success: true`. The launch
        // handlers checked only the outer envelope, so this fell through to
        // their terminal-success return — green toast, no dialog, refresh.
        const out = interpretFlowResponse(ok, {
            success: true,
            data: { success: false, error: "Node 'apply' failed: Update requires an ID" },
        }, 'Flow "convert_lead"');

        expect(out.kind).toBe('failed');
        expect(out).toMatchObject({ error: "Node 'apply' failed: Update requires an ID" });
    });

    it('catches an explicit status:failed even when `success` is absent', () => {
        const out = interpretFlowResponse(ok, {
            success: true,
            data: { status: 'failed', error: 'boom' },
        }, 'Flow "x"');
        expect(out).toMatchObject({ kind: 'failed', error: 'boom' });
    });

    it('prefers the flow-declared friendly errorMessage over the raw error', () => {
        // `flow.errorMessage` exists precisely so the user sees something other
        // than an engine stack message.
        const out = interpretFlowResponse(ok, {
            success: true,
            data: {
                success: false,
                error: "Node 'apply' failed: constraint violation on lead.status",
                errorMessage: 'This lead has already been converted.',
            },
        }, 'Flow "convert_lead"');
        expect(out).toMatchObject({ kind: 'failed', error: 'This lead has already been converted.' });
    });

    it('marks a flow failure NON-retryable — the suspension is already consumed', () => {
        const out = interpretFlowResponse(ok, {
            success: true, data: { success: false, error: 'boom' },
        }, 'Resume');
        expect(out).toMatchObject({ kind: 'failed', retryable: false });
    });
});

describe('interpretFlowResponse — transport failures stay retryable', () => {
    it('catches a non-ok status', () => {
        const out = interpretFlowResponse({ ok: false, status: 502 }, {
            success: false, error: 'gateway timeout',
        }, 'Resume');
        expect(out).toMatchObject({ kind: 'failed', error: 'gateway timeout', retryable: true });
    });

    it('catches a transport-level success:false under HTTP 200', () => {
        const out = interpretFlowResponse(ok, { success: false, error: 'no such flow' }, 'Flow "x"');
        expect(out).toMatchObject({ kind: 'failed', error: 'no such flow', retryable: true });
    });

    it('falls back to a labelled message when the body carries none', () => {
        const out = interpretFlowResponse({ ok: false, status: 500 }, null, 'Resume');
        expect(out).toMatchObject({ kind: 'failed', error: 'Resume failed (HTTP 500)' });
    });
});

/**
 * The ADR-0112 error envelope, reproduced from the producer rather than
 * imagined: `apiErrorResponse` (objectstack `packages/runtime/src/error-envelope.ts`)
 * emits `{success:false, error:{code, message, httpStatus, details?}}`, and
 * `splitSemanticCode` promotes a `details.code` into `error.code` while keeping
 * the remaining `details` keys on the wire.
 */
function errorEnvelope(
    status: number,
    code: string,
    message: string,
    details?: Record<string, unknown>,
) {
    return {
        success: false,
        error: { code, message, httpStatus: status, ...(details ? { details } : {}) },
    };
}

const RESUME_FAILED = "Node 'create_opportunity' failed: Amount must be greater than zero";

describe('interpretFlowResponse — a 400 FLOW_FAILED on resume is TERMINAL (objectui#4784)', () => {
    // objectstack#8684 moves this exact event off `200 {data:{success:false}}`
    // onto a real status code. It must land in the same class as the inner
    // envelope failure, NOT in the transport class: the engine consumed the
    // suspension (resume-once), so the wizard must close rather than offer a
    // retry that can only reach "No suspended run".
    it('classifies it NON-retryable — keyed on the code, not on the status alone', () => {
        const out = interpretFlowResponse(
            { ok: false, status: 400 },
            errorEnvelope(400, 'FLOW_FAILED', RESUME_FAILED),
            'Resume',
        );
        expect(out).toMatchObject({ kind: 'failed', retryable: false, error: RESUME_FAILED });
    });

    it('prefers the flow-declared errorMessage from `error.details` over the raw error', () => {
        // The 200 path prefers `data.errorMessage`; the error envelope has no
        // `data`, so `error.details` is the declared carrier that survives to
        // the wire. Losing this half was the second regression #4784 names.
        const out = interpretFlowResponse(
            { ok: false, status: 400 },
            errorEnvelope(400, 'FLOW_FAILED', RESUME_FAILED, {
                errorMessage: 'This lead has already been converted.',
            }),
            'Resume',
        );
        expect(out).toMatchObject({
            kind: 'failed',
            retryable: false,
            error: 'This lead has already been converted.',
        });
    });

    it('falls back to the envelope message when no errorMessage was carried', () => {
        const out = interpretFlowResponse(
            { ok: false, status: 400 },
            errorEnvelope(400, 'FLOW_FAILED', RESUME_FAILED, { durationMs: 45 }),
            'Resume',
        );
        expect(out).toMatchObject({ kind: 'failed', error: RESUME_FAILED, retryable: false });
    });

    it('matches the pre-ADR-0112 lowercase spelling too — the console outlives one vocabulary', () => {
        const out = interpretFlowResponse(
            { ok: false, status: 400 },
            errorEnvelope(400, 'flow_failed', RESUME_FAILED),
            'Resume',
        );
        expect(out).toMatchObject({ kind: 'failed', retryable: false });
    });

    it('needs BOTH the 400 and the code — FLOW_FAILED on another status stays retryable', () => {
        // A 500 is the server saying it broke, whatever code rode along; that
        // did not consume the suspension.
        const out = interpretFlowResponse(
            { ok: false, status: 500 },
            errorEnvelope(500, 'FLOW_FAILED', 'Internal server error'),
            'Resume',
        );
        expect(out).toMatchObject({ kind: 'failed', retryable: true });
    });

    it('leaves the OTHER 400s on this route retryable — the engine refused before consuming', () => {
        // `INVALID_SCREEN_INPUT` / `INVALID_SIGNAL` are refused at the one place
        // a signal reaches the variable map, i.e. before the suspension is
        // consumed. The user fixes the input and resubmits the same run — the
        // exact case the flag exists to keep open.
        for (const code of ['INVALID_SCREEN_INPUT', 'INVALID_SIGNAL', 'VALIDATION_ERROR']) {
            const out = interpretFlowResponse(
                { ok: false, status: 400 },
                errorEnvelope(400, code, 'Field "amount" is required'),
                'Resume',
            );
            expect(out, code).toMatchObject({ kind: 'failed', retryable: true });
        }
    });
});

describe('interpretFlowResponse — a 404 is terminal for a different reason (objectui#4784)', () => {
    // NOT dormant: the route answers this today (`RUN_NOT_FOUND` → 404), and
    // every one of them had been keeping the wizard open for a retry that can
    // only 404 again.
    it('marks "no such suspended run" non-retryable, keeping the endpoint’s own message', () => {
        const out = interpretFlowResponse(
            { ok: false, status: 404 },
            errorEnvelope(404, 'RESOURCE_NOT_FOUND', 'No such suspended run'),
            'Resume',
        );
        expect(out).toMatchObject({
            kind: 'failed',
            retryable: false,
            error: 'No such suspended run',
        });
    });

    it('holds for a BARE 404 with no envelope at all — status alone decides', () => {
        // A proxy or an unmounted route answers 404 with HTML; `json` is null
        // because parsing threw. The disposition must not depend on that.
        const out = interpretFlowResponse({ ok: false, status: 404 }, null, 'Resume');
        expect(out).toMatchObject({
            kind: 'failed',
            retryable: false,
            error: 'Resume failed (HTTP 404)',
        });
    });
});

describe('interpretFlowResponse — error is ALWAYS a string (React #31)', () => {
    it('resolves the nested {code, message} object to a string', () => {
        // Handing this object to `toast.error()` puts an object where React
        // expects a child and crashes the page.
        const out = interpretFlowResponse({ ok: false, status: 403 }, {
            success: false,
            error: { message: 'Run is parked on a service-owned node', code: 'PERMISSION_DENIED' },
        }, 'Resume');
        expect(typeof (out as { error: string }).error).toBe('string');
        expect(out).toMatchObject({ error: 'Run is parked on a service-owned node' });
    });

    it('resolves a nested error object on the INNER envelope too', () => {
        const out = interpretFlowResponse(ok, {
            success: true,
            data: { success: false, error: { message: 'constraint violation', code: 400 } },
        }, 'Flow "x"');
        expect(typeof (out as { error: string }).error).toBe('string');
        expect(out).toMatchObject({ error: 'constraint violation' });
    });

    it('never returns a non-string error for an object-shaped errorMessage', () => {
        // `errorMessage` is declared as a string, but the body is untyped at
        // runtime — a non-string must not be passed through as the toast child.
        const out = interpretFlowResponse(ok, {
            success: true,
            data: { success: false, errorMessage: { nope: true }, error: 'the real message' },
        }, 'Flow "x"');
        expect(out).toMatchObject({ error: 'the real message' });
    });
});

describe('interpretFlowResponse — paused is not a failure', () => {
    it('reports a paused screen with its runId and screen', () => {
        const screen = { nodeId: 'confirm', title: 'Confirm', fields: [] };
        const out = interpretFlowResponse(ok, {
            success: true,
            data: { success: true, status: 'paused', runId: 'run-7', screen },
        }, 'Flow "convert_lead"');

        expect(out).toMatchObject({ kind: 'paused', runId: 'run-7', screen });
    });

    it('does NOT treat a pause as terminal — a screen-less pause falls through to done', () => {
        // `status: 'paused'` with no `screen` is a non-screen suspension (an
        // approval / wait node). There is nothing for the runner to render, so
        // it must not be reported as a screen pause.
        const out = interpretFlowResponse(ok, {
            success: true, data: { success: true, status: 'paused', runId: 'run-8' },
        }, 'Flow "x"');
        expect(out.kind).toBe('done');
    });
});

describe('interpretFlowResponse — terminal success', () => {
    it('exposes the AutomationResult as `data`, unchanged', () => {
        const out = interpretFlowResponse(ok, {
            success: true,
            data: { success: true, status: 'completed', output: { id: 'opp_1' }, durationMs: 12 },
        }, 'Flow "convert_lead"');

        expect(out).toMatchObject({
            kind: 'done',
            data: { success: true, status: 'completed', output: { id: 'opp_1' }, durationMs: 12 },
        });
    });

    it('surfaces the flow-declared successMessage', () => {
        const out = interpretFlowResponse(ok, {
            success: true, data: { success: true, successMessage: 'Lead converted.' },
        }, 'Flow "x"');
        expect(out).toMatchObject({ kind: 'done', successMessage: 'Lead converted.' });
    });

    it('leaves `data` undefined when the body carried none — not an invented {}', () => {
        // `ActionResult.data` has always exposed the raw `body.data`; the launch
        // handlers returned `json?.data` and consumers may test for absence.
        const out = interpretFlowResponse(ok, { success: true }, 'Flow "x"');
        expect(out).toMatchObject({ kind: 'done' });
        expect((out as { data?: unknown }).data).toBeUndefined();
    });
});
