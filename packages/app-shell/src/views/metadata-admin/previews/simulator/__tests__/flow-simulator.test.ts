// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { FlowSimulator } from '../flow-simulator';
import { validateFlowDraft } from '../flow-sim-validate';
import type { SimEdge, SimNode } from '../flow-sim-types';

const run = (nodes: SimNode[], edges: SimEdge[], seed = {}, mocks = {}) => {
  const sim = new FlowSimulator(nodes, edges);
  sim.reset(seed, mocks);
  sim.runToEnd();
  return sim;
};

describe('validateFlowDraft', () => {
  it('flags a missing entry node', () => {
    const v = validateFlowDraft(
      [{ id: 'a', type: 'decision' }, { id: 'b', type: 'end' }],
      [{ source: 'a', target: 'b' }, { source: 'b', target: 'a' }],
    );
    expect(v.errors.some((e) => /entry node/.test(e.message))).toBe(true);
  });

  it('rejects multiple start nodes and edges to missing nodes', () => {
    const v = validateFlowDraft(
      [{ id: 's1', type: 'start' }, { id: 's2', type: 'start' }],
      [{ source: 's1', target: 'ghost' }],
    );
    expect(v.errors.some((e) => /start nodes/.test(e.message))).toBe(true);
    expect(v.errors.some((e) => /does not exist/.test(e.message))).toBe(true);
  });

  it('resolves the start node and warns on unreachable nodes', () => {
    const v = validateFlowDraft(
      [{ id: 's', type: 'start' }, { id: 'e', type: 'end' }, { id: 'orphan', type: 'script' }],
      [{ source: 's', target: 'e' }],
    );
    expect(v.startNodeId).toBe('s');
    expect(v.warnings.some((w) => /unreachable/.test(w.message))).toBe(true);
  });
});

describe('FlowSimulator', () => {
  it('runs a linear flow to completion', () => {
    const sim = run(
      [{ id: 's', type: 'start' }, { id: 'e', type: 'end' }],
      [{ source: 's', target: 'e' }],
    );
    expect(sim.state.status).toBe('done');
    expect(sim.state.visitedNodeIds).toEqual(['s', 'e']);
  });

  it('routes a decision to the first truthy edge', () => {
    const sim = run(
      [
        { id: 's', type: 'start' },
        { id: 'd', type: 'decision' },
        { id: 'hi', type: 'end' },
        { id: 'lo', type: 'end' },
      ],
      [
        { source: 's', target: 'd' },
        { id: 'e_hi', source: 'd', target: 'hi', condition: 'amount > 100' },
        { id: 'e_lo', source: 'd', target: 'lo', isDefault: true },
      ],
      { amount: 250 },
    );
    expect(sim.state.visitedNodeIds).toContain('hi');
    expect(sim.state.visitedNodeIds).not.toContain('lo');
    const dStep = sim.state.steps.find((s) => s.nodeId === 'd')!;
    expect(dStep.edges?.find((x) => x.selected)?.target).toBe('hi');
  });

  it('falls back to the default branch when no condition matches', () => {
    const sim = run(
      [
        { id: 's', type: 'start' },
        { id: 'd', type: 'decision' },
        { id: 'hi', type: 'end' },
        { id: 'lo', type: 'end' },
      ],
      [
        { source: 's', target: 'd' },
        { source: 'd', target: 'hi', condition: 'amount > 100' },
        { source: 'd', target: 'lo', isDefault: true },
      ],
      { amount: 5 },
    );
    expect(sim.state.visitedNodeIds).toContain('lo');
  });

  it('errors a decision dead-end (no match, no default)', () => {
    const sim = run(
      [
        { id: 's', type: 'start' },
        { id: 'd', type: 'decision' },
        { id: 'hi', type: 'end' },
      ],
      [
        { source: 's', target: 'd' },
        { source: 'd', target: 'hi', condition: 'amount > 100' },
      ],
      { amount: 5 },
    );
    expect(sim.state.status).toBe('error');
    expect(sim.state.steps.find((s) => s.nodeId === 'd')?.status).toBe('error');
  });

  it('surfaces a CEL evaluation error in the edge diagnostics', () => {
    const sim = run(
      [
        { id: 's', type: 'start' },
        { id: 'd', type: 'decision' },
        { id: 'x', type: 'end' },
      ],
      [
        { source: 's', target: 'd' },
        { source: 'd', target: 'x', condition: 'a b c (((' },
      ],
    );
    const dStep = sim.state.steps.find((s) => s.nodeId === 'd')!;
    expect(dStep.edges?.[0].error).toBeTruthy();
  });

  it('writes a mocked single outputVariable into the variables', () => {
    const sim = run(
      [
        { id: 's', type: 'start' },
        { id: 'g', type: 'get_record', config: { objectName: 'lead', outputVariable: 'lead' } },
        { id: 'e', type: 'end' },
      ],
      [
        { source: 's', target: 'g' },
        { source: 'g', target: 'e' },
      ],
      {},
      { g: { id: '1', name: 'Acme' } },
    );
    expect(sim.state.variables.lead).toEqual({ id: '1', name: 'Acme' });
    expect(sim.state.steps.find((s) => s.nodeId === 'g')?.status).toBe('mocked');
  });

  it('writes mocked outputVariables[] for a code script', () => {
    const sim = run(
      [
        { id: 's', type: 'start' },
        { id: 'sc', type: 'script', config: { script: 'x', outputVariables: ['score'] } },
        { id: 'e', type: 'end' },
      ],
      [
        { source: 's', target: 'sc' },
        { source: 'sc', target: 'e' },
      ],
      {},
      { sc: { score: 42 } },
    );
    expect(sim.state.variables.score).toBe(42);
  });

  it('pauses on a wait node and resumes', () => {
    const sim = new FlowSimulator(
      [
        { id: 's', type: 'start' },
        { id: 'w', type: 'wait' },
        { id: 'e', type: 'end' },
      ],
      [
        { source: 's', target: 'w' },
        { source: 'w', target: 'e' },
      ],
    );
    sim.reset();
    sim.runToEnd();
    expect(sim.state.status).toBe('paused');
    expect(sim.state.activeNodeId).toBe('w');
    sim.resume();
    sim.runToEnd();
    expect(sim.state.status).toBe('done');
    expect(sim.state.visitedNodeIds).toContain('e');
  });

  it('pauses on an input-bearing screen and merges provided outputs on resume', () => {
    const sim = new FlowSimulator(
      [
        { id: 's', type: 'start' },
        { id: 'scr', type: 'screen', config: { fields: [{ name: 'discount', label: 'Discount' }] } },
        { id: 'e', type: 'end' },
      ],
      [
        { source: 's', target: 'scr' },
        { source: 'scr', target: 'e' },
      ],
    );
    sim.reset();
    sim.runToEnd();
    expect(sim.state.pausedReason).toBe('screen');
    sim.resume({ discount: 10 });
    sim.runToEnd();
    expect(sim.state.variables.discount).toBe(10);
    expect(sim.state.status).toBe('done');
  });

  it('passes a field-less screen through without pausing (engine parity)', () => {
    const sim = new FlowSimulator(
      [
        { id: 's', type: 'start' },
        { id: 'scr', type: 'screen' },
        { id: 'e', type: 'end' },
      ],
      [
        { source: 's', target: 'scr' },
        { source: 'scr', target: 'e' },
      ],
    );
    sim.reset();
    sim.runToEnd();
    expect(sim.state.status).toBe('done');
    expect(sim.state.visitedNodeIds).toContain('e');
    expect(sim.state.steps.find((st) => st.nodeId === 'scr')?.status).toBe('ok');
  });

  it('applies assignment config (assignments map + {var} interpolation) to variables', () => {
    const sim = new FlowSimulator(
      [
        { id: 's', type: 'start' },
        { id: 'a', type: 'assignment', config: { assignments: { who: 'Ada', greeting: 'hi {who}' } } },
        { id: 'e', type: 'end' },
      ],
      [
        { source: 's', target: 'a' },
        { source: 'a', target: 'e' },
      ],
    );
    sim.reset();
    sim.runToEnd();
    expect(sim.state.variables.who).toBe('Ada');
    expect(sim.state.variables.greeting).toBe('hi Ada');
    expect(sim.state.status).toBe('done');
  });

  it('guards against infinite loops with a step ceiling', () => {
    const sim = new FlowSimulator(
      [
        { id: 's', type: 'start' },
        { id: 'a', type: 'assignment' },
        { id: 'b', type: 'assignment' },
      ],
      [
        { source: 's', target: 'a' },
        { source: 'a', target: 'b' },
        { source: 'b', target: 'a' },
      ],
    );
    sim.reset();
    sim.runToEnd();
    expect(sim.state.status).toBe('error');
    expect(sim.state.error).toMatch(/step limit/i);
  });

  it('marks join_gateway as unsupported instead of faking it', () => {
    const sim = run(
      [
        { id: 's', type: 'start' },
        { id: 'j', type: 'join_gateway' },
        { id: 'e', type: 'end' },
      ],
      [
        { source: 's', target: 'j' },
        { source: 'j', target: 'e' },
      ],
    );
    const jStep = sim.state.steps.find((s) => s.nodeId === 'j')!;
    expect(jStep.status).toBe('skipped');
    expect(jStep.note).toMatch(/not modelled/i);
  });
});
