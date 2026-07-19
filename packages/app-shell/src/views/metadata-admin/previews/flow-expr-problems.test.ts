// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { flowExpressionProblems } from './flow-expr-problems';

const startUpdate = { id: 'start', type: 'start', config: { triggerType: 'record-after-update', objectName: 'crm_lead' } };

describe('flowExpressionProblems', () => {
  it('flags a brace-in-CEL error on a decision branch expression (node target)', () => {
    const draft = {
      variables: [],
      nodes: [
        startUpdate,
        { id: 'd', type: 'decision', config: { conditions: [{ label: 'Big', expression: '{record.amount} > 10' }] } },
      ],
      edges: [{ source: 'start', target: 'd' }],
    };
    const ps = flowExpressionProblems(draft);
    const brace = ps.find((p) => p.level === 'error');
    expect(brace).toBeDefined();
    expect(brace!.target).toEqual({ kind: 'node', nodeId: 'd' });
    expect(brace!.message).toMatch(/Big:.*map literal/);
  });

  it('flags an unknown reference (warning) on a downstream decision condition', () => {
    const draft = {
      variables: [{ name: 'lead_score' }],
      nodes: [
        startUpdate,
        { id: 'd', type: 'decision', config: { condition: 'lead_scor >= 60' } },
      ],
      edges: [{ source: 'start', target: 'd' }],
    };
    const ps = flowExpressionProblems(draft);
    const warn = ps.find((p) => p.level === 'warning');
    expect(warn).toBeDefined();
    expect(warn!.target).toEqual({ kind: 'node', nodeId: 'd' });
    expect(warn!.message).toMatch(/did you mean `lead_score`/);
  });

  it('does NOT flag bare trigger fields on the START node (skipped)', () => {
    const draft = {
      variables: [],
      nodes: [{ id: 'start', type: 'start', config: { triggerType: 'record-after-update', objectName: 'crm_lead', condition: 'status == "qualifying" && previous.status != "qualifying"' } }],
      edges: [],
    };
    expect(flowExpressionProblems(draft)).toEqual([]);
  });

  it('flags a brace error on an edge guard (edge target)', () => {
    const draft = {
      variables: [],
      nodes: [startUpdate, { id: 'a', type: 'assignment', config: {} }, { id: 'b', type: 'end' }],
      edges: [
        { source: 'start', target: 'a' },
        { source: 'a', target: 'b', condition: '{record.x} == 1' },
      ],
    };
    const ps = flowExpressionProblems(draft);
    const edgeP = ps.find((p) => p.target.kind === 'edge');
    expect(edgeP).toBeDefined();
    expect(edgeP!.level).toBe('error');
    expect(edgeP!.target).toEqual({ kind: 'edge', source: 'a', target: 'b' });
  });

  it('ignores default edges and empty conditions', () => {
    const draft = {
      variables: [],
      nodes: [startUpdate, { id: 'a', type: 'assignment', config: {} }],
      edges: [{ source: 'start', target: 'a', isDefault: true, condition: '{bad}' }],
    };
    expect(flowExpressionProblems(draft)).toEqual([]);
  });

  it('returns nothing for a clean flow', () => {
    const draft = {
      variables: [{ name: 'lead_score' }],
      nodes: [startUpdate, { id: 'd', type: 'decision', config: { condition: 'lead_score >= 60 && record.amount > 0' } }],
      edges: [{ source: 'start', target: 'd' }],
    };
    expect(flowExpressionProblems(draft)).toEqual([]);
  });

  it('does NOT flag a loop collection `{leadList}` — it is a template surface, not a CEL predicate', () => {
    // The collection field is refMode:'template', so its single-brace `{var}`
    // template is legal and must not trip the CEL brace-trap (the pre-fix bug).
    const draft = {
      variables: [{ name: 'leadList' }],
      nodes: [
        startUpdate,
        { id: 'each', type: 'loop', config: { collection: '{leadList}', iteratorVariable: 'lead' } },
      ],
      edges: [{ source: 'start', target: 'each' }],
    };
    expect(flowExpressionProblems(draft)).toEqual([]);
  });

  it('still flags a genuine CEL predicate on the same flow (decision condition)', () => {
    // Guards against over-broadening the template skip: real predicate fields
    // keep their brace-trap.
    const draft = {
      variables: [],
      nodes: [
        startUpdate,
        { id: 'each', type: 'loop', config: { collection: '{leadList}' } },
        { id: 'd', type: 'decision', config: { condition: '{record.amount} > 10' } },
      ],
      edges: [
        { source: 'start', target: 'each' },
        { source: 'each', target: 'd' },
      ],
    };
    const ps = flowExpressionProblems(draft);
    expect(ps).toHaveLength(1);
    expect(ps[0]).toMatchObject({ level: 'error', target: { kind: 'node', nodeId: 'd' } });
  });
});
