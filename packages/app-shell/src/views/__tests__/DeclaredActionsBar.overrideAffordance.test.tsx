// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * DeclaredActionsBar — the admin-override affordance (objectui#5178).
 *
 * The reported defect: an admin who holds NO slot in a request's pending
 * approver slate saw the exact same filled **Approve** a designated approver
 * sees. One unmarked click takes framework#3424's privileged branch, which is
 * authoritative — it finalises the node even under `per_group` / `unanimous` /
 * `quorum`, bypassing every co-sign group that has not voted. The measured
 * consequence was a PM who clicked Approve *"to see if it was real"* and
 * finalised a stage for an approver who never acted.
 *
 * What these pin, in the order they matter:
 *
 *   1. an override-only viewer gets a VISUALLY DISTINCT action (warning
 *      treatment, override label, `data-override-decision`) — not the declared
 *      `primary` / `danger` styling meant for the assigned approver;
 *   2. the dispatch carries a notice that NAMES the pending approvers being
 *      bypassed — the card's own finding is that a warning which does not say
 *      what is about to be bypassed would not have stopped that click;
 *   3. a designated approver is untouched — this must not become friction on
 *      the ordinary path;
 *   4. a submitter-gated action (`approval_recall`) is never relabelled, even
 *      for a viewer who also holds override rights;
 *   5. NO `confirmText` is added. These actions collect params, so the runtime
 *      opens the param dialog and nothing is POSTed until its own Confirm —
 *      chaining a confirm in front of it puts up a first dialog that already
 *      reads as "the action ran" (framework#7278, maintainer ruling 2026-08-10).
 *      One condition, one wording, one dialog.
 *
 * Nothing here asserts a permission change, and there is deliberately none: the
 * server stays the sole authority on who may act, the dispatched request is
 * byte-identical, and only what the viewer is TOLD changes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

const executeSpy = vi.fn().mockResolvedValue({ success: true });

// Same doubling strategy as the sibling DeclaredActionsBar suite: only the
// action DISPATCH is stubbed, while the predicate entry (`useCondition` /
// `toPredicateInput`) stays REAL — a stubbed gate would be a second copy of the
// semantics under test (objectui#3835).
vi.mock('@object-ui/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@object-ui/react')>();
  return {
    ...actual,
    ActionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useAction: () => ({ execute: executeSpy }),
  };
});

vi.mock('../../hooks/useConsoleActionRuntime', () => ({
  useConsoleActionRuntime: () => ({ actionProviderProps: {}, dialogs: null }),
}));
vi.mock('../../providers/AdapterProvider', () => ({ useAdapter: () => ({}) }));
vi.mock('../../providers/MetadataProvider', () => ({
  useMetadataItem: () => ({ item: null, loading: false, error: null }),
}));
vi.mock('../../utils/getIcon', () => ({
  getIcon: (name: string) => () => <i data-testid={`declared-icon-${name}`} />,
}));

/**
 * The i18n double interpolates `{{…}}` over `defaultValue`, unlike the sibling
 * suite's marker-style `t`. That is the point here: the override copy is only
 * worth anything if the APPROVER NAMES actually land in it, so the assertions
 * below read the composed English sentence rather than a key name.
 */
vi.mock('@object-ui/i18n', () => ({
  useObjectLabel: () => ({
    actionLabel: (_o: unknown, _n: unknown, fallback: string) => fallback,
    actionConfirm: (_o: unknown, _n: unknown, fallback?: string) => fallback,
    actionSuccess: (_o: unknown, _n: unknown, fallback?: string) => fallback,
  }),
  useObjectTranslation: () => ({
    t: (key: string, options?: any) =>
      String(options?.defaultValue ?? key).replace(
        /\{\{(\w+)\}\}/g,
        (_m: string, name: string) => String(options?.[name] ?? ''),
      ),
    language: 'en',
  }),
  pickLocalized: (value: unknown) => (typeof value === 'string' ? value : ''),
}));

vi.mock('@object-ui/components', async () => {
  const { hasDeclaredVisibilityGate } = await import(
    '../../../../components/src/renderers/action/visibility-gate'
  );
  return {
    Button: ({ children, onClick, ...props }: any) => (
      <button onClick={onClick} {...props}>{children}</button>
    ),
    Separator: () => <hr />,
    cn: (...args: any[]) => args.filter(Boolean).join(' '),
    hasDeclaredVisibilityGate,
  };
});

import { DeclaredActionsBar } from '../DeclaredActionsBar';

/**
 * The declared gates, in the spelling this suite's evaluator can evaluate.
 *
 * The shipped predicates carry the #8990 sparse-face `has(...)` guards and are
 * `cel`; reaching CEL's builtins needs the `@objectstack/formula` engine, and a
 * bare string here normalizes onto the legacy JS path instead (see
 * `toPredicateInput`) — where `has(...)` faults and the gate fails CLOSED, so
 * every button would vanish and this suite would assert nothing. The sibling
 * approval suites (`RecordDetailView.approvalDeclaredActions.test.tsx`) use the
 * same reduced spelling for the same reason.
 *
 * The reduction is safe HERE because what this file tests is the affordance,
 * not the gate: the predicate still ORs in `can_override`, which is the only
 * term `actionAdmittedByOverride` reads. That reader is pinned against the
 * VERBATIM shipped predicate — `has(...)` guards and all — in
 * `utils/approvalOverride.test.ts`, so no drift in the real gate's text can
 * hide behind this simplification.
 */
const DECISION_VISIBLE = 'record.viewer.can_act || record.viewer.can_override';
const SUBMITTER_VISIBLE = 'record.viewer.is_submitter';

const ACTIONS = [
  {
    name: 'approval_approve',
    label: 'Approve',
    icon: 'check-circle',
    variant: 'primary',
    type: 'api',
    method: 'POST',
    target: '/api/v1/approvals/requests/{id}/approve',
    params: [{ name: 'comment', label: 'Comment', type: 'textarea' }],
    visible: DECISION_VISIBLE,
    locations: ['record_section'],
    successMessage: 'Approved.',
  },
  {
    name: 'approval_reject',
    label: 'Reject',
    icon: 'x-circle',
    variant: 'danger',
    description: 'Reject this request? A rejection is final for every approver.',
    type: 'api',
    method: 'POST',
    target: '/api/v1/approvals/requests/{id}/reject',
    params: [{ name: 'comment', label: 'Comment', type: 'textarea' }],
    visible: DECISION_VISIBLE,
    locations: ['record_section'],
  },
  {
    name: 'approval_recall',
    label: 'Recall',
    type: 'api',
    method: 'POST',
    target: '/api/v1/approvals/requests/{id}/recall',
    visible: SUBMITTER_VISIBLE,
    locations: ['record_section'],
  },
] as any[];

/** A staffed slate the viewer holds no place in — the reported situation. */
const STAFFED_REQUEST = {
  id: 'req_1',
  status: 'pending',
  record_id: 'proj_9',
  pending_approvers: ['u_qa_head', 'u_prod_head'],
  pending_approver_names: { u_qa_head: 'Qian Hua', u_prod_head: 'Li Lei' },
};

function renderBar(viewer: Record<string, unknown>, record: Record<string, unknown> = STAFFED_REQUEST) {
  return render(
    <DeclaredActionsBar
      objectName="sys_approval_request"
      record={{ ...record, viewer }}
      location="record_section"
      actions={ACTIONS}
    />,
  );
}

const OVERRIDE_ONLY = { can_act: false, is_submitter: false, can_override: true };
const DESIGNATED_APPROVER = { can_act: true, is_submitter: false, can_override: false };

beforeEach(() => {
  executeSpy.mockClear();
});

describe('DeclaredActionsBar — override-only viewer (objectui#5178)', () => {
  it('renders a visually distinct override action instead of the declared filled Approve', () => {
    renderBar(OVERRIDE_ONLY);
    const approve = screen.getByTestId('declared-action-approval_approve');

    // The affordance the card asks for, on the button itself.
    expect(approve.getAttribute('data-override-decision')).toBe('true');
    expect(approve.textContent).toContain('Override Approve');
    // NOT the declared `primary` styling meant for the assigned approver — that
    // resemblance IS the defect.
    expect(approve.getAttribute('variant')).toBe('outline');
    expect(approve.className).toContain('amber');
    // The declared icon describes the ordinary decision; an override replaces it.
    expect(screen.queryByTestId('declared-icon-check-circle')).toBeNull();
  });

  it('gives reject the SAME override treatment rather than its declared danger styling', () => {
    // Approve and Reject must not read as two different kinds of thing here:
    // both are the same privileged branch, and the viewer's question is "am I
    // overriding?", not "is this the red one?".
    renderBar(OVERRIDE_ONLY);
    const reject = screen.getByTestId('declared-action-approval_reject');
    expect(reject.getAttribute('data-override-decision')).toBe('true');
    expect(reject.textContent).toContain('Override Reject');
    expect(reject.getAttribute('variant')).toBe('outline');
  });

  it('dispatches a notice that NAMES the pending approvers being bypassed', async () => {
    renderBar(OVERRIDE_ONLY);
    fireEvent.click(screen.getByTestId('declared-action-approval_approve'));
    await waitFor(() => expect(executeSpy).toHaveBeenCalledTimes(1));

    const dispatch = executeSpy.mock.calls[0][0];
    const notice = String(dispatch.overrideNotice);
    // The load-bearing half: WHO is about to be bypassed, by resolved name.
    expect(notice).toContain('Qian Hua');
    expect(notice).toContain('Li Lei');
    // And what the click actually does — the two facts the reported click lacked.
    expect(notice).toContain('finalises the step immediately');
    expect(notice).toContain('recorded as an admin override');
    // The param dialog's title carries the framing too, so the warning survives
    // even where a description is sourced elsewhere.
    expect(String(dispatch.label)).toBe('Override Approve');
  });

  it('adds NO confirmText — one condition, one wording, one dialog (framework#7278)', async () => {
    renderBar(OVERRIDE_ONLY);
    fireEvent.click(screen.getByTestId('declared-action-approval_approve'));
    await waitFor(() => expect(executeSpy).toHaveBeenCalledTimes(1));
    // A chained confirm in front of the param dialog reads as "the action ran".
    expect(executeSpy.mock.calls[0][0].confirmText).toBeUndefined();
  });

  it('changes nothing about the request itself — same target, method and params', async () => {
    // The permission boundary: this card adds friction and visibility, it does
    // not alter what is sent or who may send it.
    renderBar(OVERRIDE_ONLY);
    fireEvent.click(screen.getByTestId('declared-action-approval_approve'));
    await waitFor(() => expect(executeSpy).toHaveBeenCalledTimes(1));
    const dispatch = executeSpy.mock.calls[0][0];
    expect(dispatch.target).toBe('/api/v1/approvals/requests/{id}/approve');
    expect(dispatch.method).toBe('POST');
    expect(dispatch.params._rowRecord.id).toBe('req_1');
    expect(dispatch.actionParams.map((p: any) => p.name)).toContain('comment');
  });

  it('has wording for the unstaffed-position rescue the override path exists for', async () => {
    // No pending approvers to name — the motivating case for framework#3424.
    // The warning must still be a warning, not an empty list.
    renderBar(OVERRIDE_ONLY, { id: 'req_2', status: 'pending', pending_approvers: [] });
    fireEvent.click(screen.getByTestId('declared-action-approval_approve'));
    await waitFor(() => expect(executeSpy).toHaveBeenCalledTimes(1));
    const notice = String(executeSpy.mock.calls[0][0].overrideNotice);
    expect(notice).toContain('bypassing any approver who has not acted');
    expect(notice).toContain('recorded as an admin override');
    expect(notice).not.toContain('—  ');
  });
});

describe('DeclaredActionsBar — the ordinary path is untouched (objectui#5178)', () => {
  it('leaves a designated approver with the declared label, variant and icon', async () => {
    renderBar(DESIGNATED_APPROVER);
    const approve = screen.getByTestId('declared-action-approval_approve');
    expect(approve.getAttribute('data-override-decision')).toBeNull();
    expect(approve.textContent).toContain('Approve');
    expect(approve.textContent).not.toContain('Override');
    expect(approve.getAttribute('variant')).toBe('default');
    expect(screen.getByTestId('declared-icon-check-circle')).toBeTruthy();
    expect(screen.getByTestId('declared-action-approval_reject').getAttribute('variant')).toBe('destructive');

    fireEvent.click(approve);
    await waitFor(() => expect(executeSpy).toHaveBeenCalledTimes(1));
    expect(executeSpy.mock.calls[0][0].overrideNotice).toBeUndefined();
  });

  it('leaves an admin who ALSO holds a slot on the ordinary path', () => {
    // `can_act:true` — the server takes the ordinary branch and writes
    // `via_override: false`, so warning about a bypass would be a lie.
    renderBar({ can_act: true, is_submitter: false, can_override: true });
    const approve = screen.getByTestId('declared-action-approval_approve');
    expect(approve.getAttribute('data-override-decision')).toBeNull();
    expect(approve.textContent).not.toContain('Override');
  });

  it('never relabels a submitter-gated action for an override-capable viewer', () => {
    // `approval_recall` is admitted by `is_submitter`, not by `can_override`.
    renderBar({ can_act: false, is_submitter: true, can_override: true });
    const recall = screen.getByTestId('declared-action-approval_recall');
    expect(recall.getAttribute('data-override-decision')).toBeNull();
    expect(recall.textContent).toContain('Recall');
    expect(recall.textContent).not.toContain('Override');
  });

  it('marks a NEW decision action with no console code (the metadata contract)', () => {
    // The record page's premise is that a ninth decision action ships as
    // metadata alone. Keying the affordance off an action-name list would leave
    // this one rendering as an ordinary decision — objectui#5178 all over again.
    render(
      <DeclaredActionsBar
        objectName="sys_approval_request"
        record={{ ...STAFFED_REQUEST, viewer: OVERRIDE_ONLY }}
        location="record_section"
        actions={[{
          name: 'approval_finalise_now',
          label: 'Finalise',
          type: 'api',
          method: 'POST',
          target: '/api/v1/approvals/requests/{id}/finalise',
          visible: DECISION_VISIBLE,
          locations: ['record_section'],
        }] as any}
      />,
    );
    const finalise = screen.getByTestId('declared-action-approval_finalise_now');
    expect(finalise.getAttribute('data-override-decision')).toBe('true');
    expect(finalise.textContent).toContain('Override Finalise');
  });
});
