// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { flowAncestors, nodeOutputRefs, resolveFlowScope, triggerFieldRefs } from './flow-scope';

const tokens = (refs: ReadonlyArray<{ token: string }>) => refs.map((r) => r.token);
const groupTokens = (scope: { refs: Array<{ token: string; group: string }> }, group: string) =>
  scope.refs.filter((r) => r.group === group).map((r) => r.token);

describe('flowAncestors', () => {
  const edges = [
    { source: 'start', target: 'a' },
    { source: 'a', target: 'b' },
    { source: 'b', target: 'c' },
  ];
  it('collects all transitive predecessors, excluding the node itself', () => {
    expect([...flowAncestors('c', edges)].sort()).toEqual(['a', 'b', 'start']);
    expect(flowAncestors('c', edges).has('c')).toBe(false);
  });
  it('a node with no incoming edge has no ancestors', () => {
    expect([...flowAncestors('start', edges)]).toEqual([]);
  });
  it('does not count downstream nodes as ancestors', () => {
    expect(flowAncestors('a', edges).has('b')).toBe(false);
    expect(flowAncestors('a', edges).has('c')).toBe(false);
  });
  it('is cycle-safe (a back-edge revise loop does not spin)', () => {
    const cyclic = [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
      { source: 'c', target: 'a' }, // back-edge
    ];
    const anc = flowAncestors('b', cyclic);
    expect(anc.has('a')).toBe(true);
    expect(anc.has('c')).toBe(true);
    expect(anc.has('b')).toBe(false);
  });
  it('handles branch/merge (diamond) graphs', () => {
    const diamond = [
      { source: 's', target: 'l' },
      { source: 's', target: 'r' },
      { source: 'l', target: 'm' },
      { source: 'r', target: 'm' },
    ];
    expect([...flowAncestors('m', diamond)].sort()).toEqual(['l', 'r', 's']);
  });
});

describe('nodeOutputRefs', () => {
  it('reads a single outputVariable', () => {
    expect(tokens(nodeOutputRefs({ id: 'g', type: 'get_record', config: { outputVariable: 'records' } }))).toEqual(['records']);
  });
  it('reads a list of outputVariables (script)', () => {
    expect(tokens(nodeOutputRefs({ id: 's', type: 'script', config: { outputVariables: ['lead_score', 'qualified'] } }))).toEqual(['lead_score', 'qualified']);
  });
  it('flags a loop/map iterator as a loop ref and collects its output', () => {
    const refs = nodeOutputRefs({ id: 'm', type: 'map', config: { iteratorVariable: 'item', outputVariable: 'results' } });
    expect(refs.find((r) => r.token === 'item')!.group).toBe('loop');
    expect(refs.find((r) => r.token === 'results')!.group).toBe('outputs');
  });
  it('reads assignment keys from the array shape', () => {
    expect(tokens(nodeOutputRefs({ id: 'a', type: 'assignment', config: { assignments: [{ variable: 'lead_score', value: 0 }, { variable: 'qualified', value: false }] } }))).toEqual(['lead_score', 'qualified']);
  });
  it('reads assignment keys from the map shape', () => {
    expect(tokens(nodeOutputRefs({ id: 'a', type: 'assignment', config: { assignments: { foo: 1, bar: 2 } } }))).toEqual(['foo', 'bar']);
  });
  it('reads screen collected field names', () => {
    expect(tokens(nodeOutputRefs({ id: 'sc', type: 'screen', config: { fields: [{ name: 'discount' }, { name: 'reason' }] } }))).toEqual(['discount', 'reason']);
  });
  it('returns nothing for a node that introduces no variables', () => {
    expect(nodeOutputRefs({ id: 'd', type: 'decision', config: { conditions: [] } })).toEqual([]);
  });
});

describe('resolveFlowScope — graph-aware in-scope references', () => {
  // start(record-after-update crm_lead) -> assign -> get -> decide
  const draft = {
    variables: [
      { name: 'lead_score', type: 'number' },
      { name: 'qualified', type: 'boolean' },
    ],
    nodes: [
      { id: 'start', type: 'start', config: { triggerType: 'record-after-update', objectName: 'crm_lead' } },
      { id: 'assign', type: 'assignment', config: { assignments: [{ variable: 'lead_score', value: 0 }] } },
      { id: 'get', type: 'get_record', label: 'Fetch Account', config: { outputVariable: 'account_data' } },
      { id: 'decide', type: 'decision', config: {} },
    ],
    edges: [
      { source: 'start', target: 'assign' },
      { source: 'assign', target: 'get' },
      { source: 'get', target: 'decide' },
    ],
  };

  it('always offers flow variables', () => {
    expect(groupTokens(resolveFlowScope(draft, 'decide'), 'variables')).toEqual(['lead_score', 'qualified']);
  });

  it('offers an upstream node output at a downstream node', () => {
    expect(groupTokens(resolveFlowScope(draft, 'decide'), 'outputs')).toContain('account_data');
  });

  it('does NOT offer a downstream output at an upstream node (graph-aware)', () => {
    // `account_data` is produced by `get`, which is downstream of `assign`.
    expect(groupTokens(resolveFlowScope(draft, 'assign'), 'outputs')).not.toContain('account_data');
  });

  it('offers the trigger record (record.* prefix) downstream, plus previous', () => {
    const scope = resolveFlowScope(draft, 'decide');
    expect(groupTokens(scope, 'trigger')).toContain('record');
    expect(groupTokens(scope, 'trigger')).toContain('previous');
    expect(scope.trigger).toEqual({ objectName: 'crm_lead', fieldPrefix: 'record.' });
  });

  it('uses a BARE field prefix on the start node itself (entry condition)', () => {
    const scope = resolveFlowScope(draft, 'start');
    expect(scope.trigger).toEqual({ objectName: 'crm_lead', fieldPrefix: '' });
    // No whole-`record` token on the start node (fields are the bare context).
    expect(groupTokens(scope, 'trigger')).not.toContain('record');
    // `previous` is still available on an update trigger.
    expect(groupTokens(scope, 'trigger')).toContain('previous');
  });

  it('omits the trigger record for a non-record trigger', () => {
    const manual = { ...draft, nodes: [{ id: 'start', type: 'start', config: { triggerType: 'manual' } }, ...draft.nodes.slice(1)] };
    const scope = resolveFlowScope(manual, 'decide');
    expect(scope.trigger).toBeUndefined();
    expect(groupTokens(scope, 'trigger')).toEqual([]);
  });

  it('omits `previous` for a create trigger', () => {
    const create = { ...draft, nodes: [{ id: 'start', type: 'start', config: { triggerType: 'record-after-create', objectName: 'crm_lead' } }, ...draft.nodes.slice(1)] };
    expect(groupTokens(resolveFlowScope(create, 'decide'), 'trigger')).not.toContain('previous');
  });

  it('de-dupes a name that is both a declared variable and an upstream output', () => {
    // `lead_score` is declared AND assigned upstream — it should appear once.
    const scope = resolveFlowScope(draft, 'decide');
    expect(tokens(scope.refs).filter((t) => t === 'lead_score')).toHaveLength(1);
  });

  it('surfaces an enclosing loop iterator as a loop ref downstream, not at the loop itself', () => {
    const loopDraft = {
      nodes: [
        { id: 'start', type: 'start', config: { triggerType: 'manual' } },
        { id: 'loop', type: 'loop', config: { iteratorVariable: 'currentItem', collection: '{items}' } },
        { id: 'body', type: 'assignment', config: {} },
      ],
      edges: [
        { source: 'start', target: 'loop' },
        { source: 'loop', target: 'body' },
      ],
    };
    expect(groupTokens(resolveFlowScope(loopDraft, 'body'), 'loop')).toEqual(['currentItem']);
    // The iterator is NOT in scope at the loop node itself (it defines it).
    expect(groupTokens(resolveFlowScope(loopDraft, 'loop'), 'loop')).toEqual([]);
  });

  it('returns only flow variables for an unknown / disconnected node', () => {
    const scope = resolveFlowScope(draft, 'orphan');
    expect(groupTokens(scope, 'outputs')).toEqual([]);
    expect(scope.trigger).toBeUndefined();
    expect(groupTokens(scope, 'variables')).toEqual(['lead_score', 'qualified']);
  });
});

describe('triggerFieldRefs', () => {
  const fields = [
    { name: 'amount', label: 'Deal Amount', type: 'number' },
    { name: 'status', type: 'text' },
  ];
  it('prefixes fields with record. downstream', () => {
    expect(tokens(triggerFieldRefs({ objectName: 'o', fieldPrefix: 'record.' }, fields))).toEqual(['record.amount', 'record.status']);
  });
  it('uses bare field names on the start node', () => {
    expect(tokens(triggerFieldRefs({ objectName: 'o', fieldPrefix: '' }, fields))).toEqual(['amount', 'status']);
  });
});
