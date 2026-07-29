/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The record header's Approve / Reject param contract (objectui#2955).
 *
 * Two things were broken on this surface and both are invisible from the
 * outside — the buttons rendered and the decision went through:
 *
 *  1. the collected inputs shipped under `collectParams`, a key NOTHING in the
 *     codebase reads (`ActionRunner` collects from `actionParams`, or `params`
 *     when it is an array). No dialog ever opened, so the approver's comment
 *     was dropped on every record-page decision — dead since ADR-0019;
 *  2. a node declaring `decisionOutputs` got no inputs at all here, so the
 *     decision resumed the flow with `vars.<node>.<key>` missing and the next
 *     node's `expression` approver failed or fell through to `onEmptyApprovers`
 *     — with no hint to the approver that anything was skipped.
 */

import { describe, it, expect } from 'vitest';
import { buildApprovalDecisionActions } from './RecordDetailView';

/** Object-translation stub: echoes the key, honouring `defaultValue`. */
const t = (key: string, opts?: any) => (opts?.defaultValue ?? `t:${key}`) as string;

const pending = (over: Record<string, any> = {}) => ({
  id: 'req_1',
  status: 'pending',
  ...over,
});

const byName = (actions: any[]) => Object.fromEntries(actions.map((a) => [a.name, a]));

describe('buildApprovalDecisionActions — param key (objectui#2955)', () => {
  it('collects through `actionParams`, the key the runner reads', () => {
    const actions = byName(buildApprovalDecisionActions(pending(), t) as any[]);
    for (const name of ['approve_request', 'reject_request']) {
      expect(Array.isArray(actions[name].actionParams)).toBe(true);
      // The dead key must not come back — it is why no dialog ever opened.
      expect(actions[name].collectParams).toBeUndefined();
    }
  });

  it('always offers the comment box, as a long-form input', () => {
    const [approve] = buildApprovalDecisionActions(pending(), t) as any[];
    // `multiline` does not survive param resolution — the type has to carry it.
    expect(approve.actionParams[0]).toMatchObject({ name: 'comment', type: 'textarea' });
  });

  it('keeps the decision buttons ahead of app header actions', () => {
    const actions = byName(buildApprovalDecisionActions(pending(), t) as any[]);
    expect(actions.approve_request.order).toBe(-100);
    expect(actions.reject_request.order).toBe(-99);
    expect(actions.reject_request.confirmText).toBeDefined();
  });
});

describe('buildApprovalDecisionActions — decision outputs (objectui#2955)', () => {
  it('adds one typed param per declared output', () => {
    const actions = byName(
      buildApprovalDecisionActions(
        pending({
          decision_outputs: ['parallel_positions'],
          decision_output_defs: [
            { key: 'parallel_positions', label: '并行会审岗位', type: 'position', multiple: true },
          ],
        }),
        t,
      ) as any[],
    );
    for (const name of ['approve_request', 'reject_request']) {
      const params = actions[name].actionParams as any[];
      expect(params.map((p) => p.name)).toEqual(['comment', 'outputs.parallel_positions']);
      expect(params[1]).toMatchObject({
        type: 'lookup',
        // The spec spelling — `referenceTo` is dropped by `resolveActionParams`
        // and the picker would degrade to a record-id text box.
        reference: 'sys_position',
        multiple: true,
        label: '并行会审岗位',
      });
    }
  });

  it('collects nothing extra when the node declares no outputs', () => {
    const [approve] = buildApprovalDecisionActions(pending(), t) as any[];
    expect((approve.actionParams as any[]).map((p) => p.name)).toEqual(['comment']);
  });

  it('still collects from a backend that only sends the bare key list', () => {
    const [approve] = buildApprovalDecisionActions(
      pending({ decision_outputs: ['next_reviewers'] }),
      t,
    ) as any[];
    expect((approve.actionParams as any[])[1]).toMatchObject({
      name: 'outputs.next_reviewers',
      type: 'text',
    });
  });

  it('requires a `required` output to approve, but never to reject', () => {
    const actions = byName(
      buildApprovalDecisionActions(
        pending({
          decision_output_defs: [
            { key: 'parallel_positions', type: 'position', multiple: true, required: true },
          ],
        }),
        t,
      ) as any[],
    );
    const paramOf = (name: string) =>
      (actions[name].actionParams as any[]).find((p) => p.name === 'outputs.parallel_positions');
    expect(paramOf('approve_request').required).toBe(true);
    // Mirrors the server, which enforces `required` on approve only — a reject
    // blocked on routing data the reject edge never reads would trap it.
    expect(paramOf('reject_request').required).toBe(false);
  });

  it('collects nothing extra when there is no pending request', () => {
    const [approve] = buildApprovalDecisionActions(null, t) as any[];
    expect((approve.actionParams as any[]).map((p) => p.name)).toEqual(['comment']);
  });
});
