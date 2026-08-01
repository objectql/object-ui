/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The business record page's approval header — objectui#3055.
 *
 * The page used to hand-wire Approve / Reject off a CLIENT-side
 * `pending_approvers.includes(currentUserId)` test. Two things were wrong with
 * that, and both are pinned here:
 *
 *   • **Coverage.** Reassign / Send back / Request info / Remind / Recall /
 *     Resubmit had NO entry point on a business record — you had to know the
 *     Approval Center existed and navigate to it. They ship as declared
 *     metadata on `sys_approval_request`; mirroring that metadata is what gives
 *     the record page all of them at once.
 *
 *   • **Group approvers.** A position / team / department approver never
 *     matched the client test, so they saw no decision buttons at all. The
 *     server's `viewer` block is the authority (it mirrors the exact check the
 *     decision routes authorize with), and it is what the declared `visible`
 *     CEL gates on.
 *
 * `ACTIONS` below mirrors `sys-approval-request.object.ts` (the framework's
 * plugin-approvals) — same names, targets, `visible` predicates, params and
 * locations — so a drift in the real declaration shows up as a failure here
 * rather than as an empty header in production.
 */

import { describe, it, expect } from 'vitest';
import {
  APPROVAL_HEADER_ORDER_BASE,
  APPROVAL_REQUEST_OBJECT,
  buildApprovalRecordHeaderActions,
} from './approvalRecordActions';

const i18n = {
  actionLabel: (_o: string | undefined, _n: string, fallback: string) => fallback,
  actionConfirm: (_o: string | undefined, _n: string, fallback?: string) => fallback,
  actionSuccess: (_o: string | undefined, _n: string, fallback?: string) => fallback,
  t: (key: string) => `t:${key}`,
};

/** The nine declared actions, as `plugin-approvals` ships them. */
const ACTIONS = [
  {
    name: 'approval_approve', label: 'Approve', icon: 'check-circle', variant: 'primary',
    type: 'api', method: 'POST', target: '/api/v1/approvals/requests/{id}/approve',
    params: [
      { name: 'comment', label: 'Comment', type: 'textarea', required: false },
      { name: 'attachments', label: 'Attachments', type: 'file', multiple: true, required: false },
    ],
    visible: 'record.viewer.can_act || record.viewer.can_override',
    locations: ['record_section', 'list_item'],
    successMessage: 'Approved.', refreshAfter: true,
  },
  {
    name: 'approval_reject', label: 'Reject', icon: 'x-circle', variant: 'danger',
    type: 'api', method: 'POST', target: '/api/v1/approvals/requests/{id}/reject',
    params: [
      { name: 'comment', label: 'Comment', type: 'textarea', required: false },
      { name: 'attachments', label: 'Attachments', type: 'file', multiple: true, required: false },
    ],
    visible: 'record.viewer.can_act || record.viewer.can_override',
    confirmText: 'Reject this request? A rejection is final for every approver.',
    locations: ['record_section', 'list_item'],
    successMessage: 'Rejected.', refreshAfter: true,
  },
  {
    name: 'approval_reassign', label: 'Reassign', icon: 'arrow-right-left',
    type: 'api', method: 'POST', target: '/api/v1/approvals/requests/{id}/reassign',
    params: [
      { field: 'submitter_id', name: 'to', label: 'New approver', required: true },
      { name: 'comment', label: 'Comment', type: 'textarea', required: false },
    ],
    visible: 'record.viewer.can_act || record.viewer.can_override',
    locations: ['record_section'], successMessage: 'Reassigned.', refreshAfter: true,
  },
  {
    name: 'approval_send_back', label: 'Send back', icon: 'corner-up-left',
    type: 'api', method: 'POST', target: '/api/v1/approvals/requests/{id}/revise',
    params: [{ name: 'comment', label: 'Reason', type: 'textarea', required: false }],
    visible: 'record.viewer.can_act',
    locations: ['record_section'], successMessage: 'Sent back for revision.', refreshAfter: true,
  },
  {
    name: 'approval_request_info', label: 'Request info', icon: 'help-circle',
    type: 'api', method: 'POST', target: '/api/v1/approvals/requests/{id}/request-info',
    params: [{ name: 'comment', label: 'What do you need?', type: 'textarea', required: true }],
    visible: 'record.viewer.can_act',
    locations: ['record_section'], successMessage: 'Information requested.', refreshAfter: true,
  },
  {
    name: 'approval_remind', label: 'Send reminder', icon: 'bell-ring',
    type: 'api', method: 'POST', target: '/api/v1/approvals/requests/{id}/remind',
    params: [{ name: 'comment', label: 'Note', type: 'textarea', required: false }],
    visible: 'record.status == "pending" && record.viewer.is_submitter',
    locations: ['record_section'], successMessage: 'Reminder sent.', refreshAfter: true,
  },
  {
    name: 'approval_recall', label: 'Recall', icon: 'undo-2',
    type: 'api', method: 'POST', target: '/api/v1/approvals/requests/{id}/recall',
    params: [{ name: 'comment', label: 'Comment', type: 'textarea', required: false }],
    visible: '(record.status == "pending" || record.status == "returned") && record.viewer.is_submitter',
    confirmText: 'Recall this request? Approvers can no longer act on it and the record is unlocked.',
    locations: ['record_section'], successMessage: 'Recalled.', refreshAfter: true,
  },
  {
    name: 'approval_resubmit', label: 'Resubmit', icon: 'refresh-cw',
    type: 'api', method: 'POST', target: '/api/v1/approvals/requests/{id}/resubmit',
    params: [{ name: 'comment', label: 'What changed?', type: 'textarea', required: false }],
    visible: 'record.status == "returned" && record.viewer.is_submitter',
    locations: ['record_section'], successMessage: 'Resubmitted.', refreshAfter: true,
  },
];

const request = (over: Record<string, any> = {}) => ({
  id: 'req_1',
  status: 'pending',
  object_name: 'qif',
  record_id: 'QIF202607310002',
  submitter_id: 'u_qc',
  // The literal CSV a group-routed step carries — the exact shape the retired
  // client-side check could never match.
  pending_approvers: ['position:qc_director'],
  viewer: { can_act: false, is_submitter: false, can_override: false },
  ...over,
});

const build = (over: Record<string, any> = {}, actions: unknown = ACTIONS) =>
  buildApprovalRecordHeaderActions({ actions, request: request(over), i18n });

const names = (actions: any[]) => actions.map((a) => a.name);

describe('buildApprovalRecordHeaderActions — who sees what (objectui#3055)', () => {
  it('gives a GROUP approver the full approver action set', () => {
    // The regression that started #3055: `pending_approvers` holds
    // `position:qc_director`, so the old client-side membership test hid even
    // Approve/Reject. `viewer.can_act` is the server's own verdict.
    const actions = build({ viewer: { can_act: true, is_submitter: false } });
    expect(names(actions)).toEqual([
      'approval_approve',
      'approval_reject',
      'approval_reassign',
      'approval_send_back',
      'approval_request_info',
    ]);
  });

  it('gives the submitter their own levers and no decision', () => {
    const actions = build({ viewer: { can_act: false, is_submitter: true } });
    expect(names(actions)).toEqual(['approval_remind', 'approval_recall']);
  });

  it('gives an admin the override levers on a stuck request (framework#3424)', () => {
    // No slot, not the submitter — but a platform/tenant admin may rescue a
    // request routed to an unstaffed position.
    const actions = build({ viewer: { can_act: false, is_submitter: false, can_override: true } });
    expect(names(actions)).toEqual([
      'approval_approve',
      'approval_reject',
      'approval_reassign',
    ]);
    // Override does NOT hand out the approver-only secondary decisions.
    expect(names(actions)).not.toContain('approval_send_back');
  });

  it('shows a bystander nothing', () => {
    expect(build()).toEqual([]);
  });

  it('offers the returned-round levers to the submitter reworking the record', () => {
    // ADR-0044: send-back returns the request so the submitter can fix the
    // record — which happens HERE, on the record page, not in the inbox.
    const actions = build({
      status: 'returned',
      viewer: { can_act: false, is_submitter: true },
    });
    expect(names(actions)).toEqual(['approval_recall', 'approval_resubmit']);
  });

  it('fails CLOSED when the backend sends no `viewer` block', () => {
    // A predicate that cannot be evaluated hides its action rather than
    // offering a decision the server would reject.
    expect(build({ viewer: undefined })).toEqual([]);
  });

  it('renders nothing without a live request or without declared actions', () => {
    expect(buildApprovalRecordHeaderActions({ actions: ACTIONS, request: null, i18n })).toEqual([]);
    expect(buildApprovalRecordHeaderActions({ actions: undefined, request: request(), i18n })).toEqual([]);
  });
});

describe('buildApprovalRecordHeaderActions — surface mapping', () => {
  it('puts the two primary decisions inline and everything else in the ⋯ overflow', () => {
    const actions = build({ viewer: { can_act: true, is_submitter: true } });
    const byName = Object.fromEntries(actions.map((a: any) => [a.name, a]));
    // `list_item` (the compact declared surface) → inline header button.
    expect(byName.approval_approve.locations).toEqual(['record_header']);
    expect(byName.approval_reject.locations).toEqual(['record_header']);
    // `record_section`-only → the header's overflow menu.
    for (const n of ['approval_reassign', 'approval_send_back', 'approval_request_info', 'approval_remind', 'approval_recall']) {
      expect(byName[n].locations).toEqual(['record_more']);
    }
  });

  it('orders the approval actions ahead of the object\'s own header actions', () => {
    const actions = build({ viewer: { can_act: true, is_submitter: false } });
    expect(actions.map((a: any) => a.order)).toEqual([
      APPROVAL_HEADER_ORDER_BASE,
      APPROVAL_HEADER_ORDER_BASE + 1,
      APPROVAL_HEADER_ORDER_BASE + 2,
      APPROVAL_HEADER_ORDER_BASE + 3,
      APPROVAL_HEADER_ORDER_BASE + 4,
    ]);
    // App `record_header` actions default to `order: 0`, so every one of these
    // sorts ahead of them.
    expect(actions.every((a: any) => a.order < 0)).toBe(true);
  });

  it('strips the predicates it already resolved', () => {
    // The header re-evaluates `visible` against the HOST record, which carries
    // no `viewer` — leaving the predicate on would hide every action there.
    const actions = build({ viewer: { can_act: true, is_submitter: false } });
    for (const a of actions as any[]) {
      expect('visible' in a).toBe(false);
      expect('hidden' in a).toBe(false);
    }
  });

  it('maps the spec `danger` variant onto the header Button\'s `destructive`', () => {
    const actions = build({ viewer: { can_act: true, is_submitter: false } });
    const byName = Object.fromEntries(actions.map((a: any) => [a.name, a]));
    expect(byName.approval_approve.variant).toBe('primary');
    expect(byName.approval_reject.variant).toBe('destructive');
  });

  it('resolves a declared `disabled` predicate against the request', () => {
    const actions = buildApprovalRecordHeaderActions({
      actions: [{ ...ACTIONS[0], disabled: 'record.status == "pending"' }],
      request: request({ viewer: { can_act: true, is_submitter: false } }),
      i18n,
    });
    expect((actions[0] as any).disabled).toBe(true);
  });
});

describe('buildApprovalRecordHeaderActions — dispatch shape', () => {
  const decided = () => build({ viewer: { can_act: true, is_submitter: false } });

  it('stashes the REQUEST under `params._rowRecord` so `{id}` resolves to it', () => {
    // Not the business record: the decide route is keyed by request id.
    const approve = decided()[0] as any;
    expect(approve.objectName).toBe(APPROVAL_REQUEST_OBJECT);
    expect(approve.target).toBe('/api/v1/approvals/requests/{id}/approve');
    expect(approve.params._rowRecord.id).toBe('req_1');
  });

  it('surfaces the declared `params` array as `actionParams`, including attachments', () => {
    const approve = decided()[0] as any;
    expect(approve.actionParams).toEqual([
      { name: 'comment', label: 'Comment', type: 'textarea', required: false },
      { name: 'attachments', label: 'Attachments', type: 'file', multiple: true, required: false },
    ]);
    // The array must not stay on `params` — that key is the row stash.
    expect(Array.isArray(approve.params)).toBe(false);
  });

  it('keeps the declared confirm copy and success message', () => {
    const reject = decided()[1] as any;
    expect(reject.confirmText).toBe('Reject this request? A rejection is final for every approver.');
    expect(reject.successMessage).toBe('Rejected.');
    expect(reject.refreshAfter).toBe(true);
  });

  it('synthesizes the node\'s decision outputs onto the decide actions only', () => {
    const actions = buildApprovalRecordHeaderActions({
      actions: ACTIONS,
      request: request({
        viewer: { can_act: true, is_submitter: false },
        decision_output_defs: [
          { key: 'parallel_positions', label: '并行会审岗位', type: 'position', multiple: true, required: true },
        ],
      }),
      i18n,
    });
    const byName = Object.fromEntries(actions.map((a: any) => [a.name, a]));
    const outputParam = (name: string) =>
      (byName[name].actionParams as any[]).find((p) => p.name === 'outputs.parallel_positions');

    // The picker target rides `reference` — see decisionOutputParams.
    expect(outputParam('approval_approve')).toMatchObject({
      label: '并行会审岗位', type: 'lookup', reference: 'sys_position', multiple: true,
    });
    // `required` is enforced on approve only, exactly like the server.
    expect(outputParam('approval_approve').required).toBe(true);
    expect(outputParam('approval_reject').required).toBe(false);
    // A non-decision lever collects no outputs.
    expect(outputParam('approval_reassign')).toBeUndefined();
  });
});
