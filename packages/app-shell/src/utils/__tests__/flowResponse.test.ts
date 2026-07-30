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
