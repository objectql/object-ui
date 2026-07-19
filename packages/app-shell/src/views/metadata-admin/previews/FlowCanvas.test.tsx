// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { FlowCanvas } from './FlowCanvas';
import { extractRegions, NODE_H } from './flow-canvas-layout';
import { predictExpandedNodeHeight } from './flow-region-metrics';
import type { FlowProblem } from './flow-problems';

afterEach(cleanup);

/**
 * ADR-0044: an un-declared cycle is surfaced INLINE on the canvas — the
 * offending edges/nodes are painted red (data-invalid) and an error banner
 * shows the message. Each banner row with a concrete target is clickable and
 * reveals (selects + pans to) the offending element — the same reveal the
 * Problems panel does — so the always-visible banner is actionable.
 */
describe('FlowCanvas — inline cycle/error surfacing', () => {
  const nodes = [
    { id: 'a', type: 'approval' },
    { id: 'w', type: 'wait' },
  ];
  const edges = [
    { source: 'a', target: 'w', label: 'revise' },
    { source: 'w', target: 'a', label: 'resubmit' }, // unmarked cycle
  ];
  const cycleProblem: FlowProblem = {
    id: 'cyc1',
    level: 'error',
    message: 'Cycle detected (a → w → a). Mark the closing edge as a back-edge.',
    target: { kind: 'edge', edgeKey: 'w->a#1', source: 'w', target: 'a' },
    source: 'structural',
  };

  it('renders the error banner (from problems) and marks invalid edges + nodes', () => {
    const { container } = render(
      <FlowCanvas
        nodes={nodes}
        edges={edges}
        editable={false}
        designMode={false}
        selectedId={null}
        onSelect={() => {}}
        invalidNodeIds={['a', 'w']}
        invalidEdges={new Set(['a->w', 'w->a'])}
        problems={[cycleProblem]}
      />,
    );
    expect(screen.getByText(/Cycle detected/)).toBeInTheDocument();
    // Two cycle edges + two cycle nodes carry the data-invalid marker.
    expect(container.querySelectorAll('[data-invalid="true"]').length).toBeGreaterThanOrEqual(4);
  });

  it('reveals the offending element when a banner row is clicked', () => {
    const onRevealProblem = vi.fn();
    render(
      <FlowCanvas
        nodes={nodes}
        edges={edges}
        editable={false}
        designMode={false}
        selectedId={null}
        onSelect={() => {}}
        problems={[cycleProblem]}
        onRevealProblem={onRevealProblem}
      />,
    );
    fireEvent.click(screen.getByText(/Cycle detected/));
    expect(onRevealProblem).toHaveBeenCalledWith(cycleProblem);
  });

  it('only counts error-level problems in the banner (warnings are not shown)', () => {
    render(
      <FlowCanvas
        nodes={nodes}
        edges={edges}
        editable={false}
        designMode={false}
        selectedId={null}
        onSelect={() => {}}
        problems={[{ id: 'w1', level: 'warning', message: 'Just a heads-up', target: { kind: 'flow' }, source: 'structural' }]}
      />,
    );
    expect(screen.queryByText(/Just a heads-up/)).toBeNull();
  });

  it('shows no banner and no invalid markers for a clean flow', () => {
    const { container } = render(
      <FlowCanvas
        nodes={nodes}
        edges={[{ source: 'a', target: 'w', label: 'revise' }]}
        editable={false}
        designMode={false}
        selectedId={null}
        onSelect={() => {}}
      />,
    );
    expect(screen.queryByText(/Cycle detected/)).toBeNull();
    expect(container.querySelectorAll('[data-invalid="true"]').length).toBe(0);
  });
});

describe('FlowCanvas — inline nested container regions (#2670 Phase 2)', () => {
  const LOOP_NODES = [
    { id: 'start', type: 'start' },
    {
      id: 'each',
      type: 'loop',
      label: 'For each order',
      config: { body: { nodes: [{ id: 'charge', type: 'http', label: 'Charge card' }], edges: [] } },
    },
    { id: 'after', type: 'end', label: 'After' },
  ];
  const LOOP_EDGES = [
    { source: 'start', target: 'each' },
    { source: 'each', target: 'after' },
  ];

  it('expands a loop body INLINE inside the container card, and collapses back', () => {
    const { container } = render(
      <FlowCanvas
        nodes={LOOP_NODES}
        edges={LOOP_EDGES}
        editable={false}
        designMode={false}
        selectedId={null}
        onSelect={() => {}}
      />,
    );
    // Collapsed by default: no body step, an expand control with aria-expanded=false.
    expect(screen.queryByText('Charge card')).not.toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'Expand nested regions' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    // Expanded: the body node renders INLINE inside the container card (not portaled).
    const card = container.querySelector('[data-node-id="each"]') as HTMLElement;
    expect(card).not.toBeNull();
    expect(card.textContent).toContain('Charge card');
    const collapse = screen.getByRole('button', { name: 'Collapse nested regions' });
    expect(collapse).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(collapse);
    expect(screen.queryByText('Charge card')).not.toBeInTheDocument();
  });

  it('pushes the layer below down by exactly the predicted height delta', () => {
    const { container } = render(
      <FlowCanvas
        nodes={LOOP_NODES}
        edges={LOOP_EDGES}
        editable={false}
        designMode={false}
        selectedId={null}
        onSelect={() => {}}
      />,
    );
    const topOfAfter = () =>
      parseFloat((container.querySelector('[data-node-id="after"]') as HTMLElement).style.top);
    const before = topOfAfter();
    fireEvent.click(screen.getByRole('button', { name: 'Expand nested regions' }));
    const predicted = predictExpandedNodeHeight(extractRegions(LOOP_NODES[1] as never));
    // The card renders at the predicted height, and the node below moved down
    // by exactly (predicted − NODE_H) — DOM and layout share one number.
    const card = container.querySelector('[data-node-id="each"]') as HTMLElement;
    expect(parseFloat(card.style.height)).toBeCloseTo(predicted, 3);
    expect(topOfAfter() - before).toBeCloseTo(predicted - NODE_H, 3);
  });

  it('labels parallel branches when expanded inline', () => {
    render(
      <FlowCanvas
        nodes={[
          {
            id: 'p',
            type: 'parallel',
            label: 'Fan out',
            config: {
              branches: [
                { name: 'Slack', nodes: [{ id: 'a', type: 'http', label: 'Notify Slack' }], edges: [] },
                { nodes: [{ id: 'b', type: 'http', label: 'Notify CRM' }], edges: [] },
              ],
            },
          },
        ]}
        edges={[]}
        editable={false}
        designMode={false}
        selectedId={null}
        onSelect={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Expand nested regions' }));
    expect(screen.getByText('Slack')).toBeInTheDocument(); // named branch
    expect(screen.getByText('Branch 2')).toBeInTheDocument(); // unnamed → indexed
    expect(screen.getByText('Notify CRM')).toBeInTheDocument();
  });

  it('does not add a region control to a legacy flat loop (no config.body)', () => {
    render(
      <FlowCanvas
        nodes={[{ id: 'l', type: 'loop', label: 'Legacy loop', config: { collection: '{items}' } }]}
        edges={[]}
        editable={false}
        designMode={false}
        selectedId={null}
        onSelect={() => {}}
      />,
    );
    expect(screen.queryByRole('button', { name: /nested regions/i })).not.toBeInTheDocument();
  });
});
