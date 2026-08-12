// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import * as React from 'react';
import { describe, it, expect, afterEach, vi, type Mock } from 'vitest';
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

describe('FlowCanvas — nested-node selection on the inline canvas (#2670 Phase 3)', () => {
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

  it('emits a structured nested path (not the container) when a body node is clicked', () => {
    const onSelect = vi.fn();
    const onSelectNested = vi.fn();
    render(
      <FlowCanvas
        nodes={LOOP_NODES}
        edges={LOOP_EDGES}
        editable
        designMode
        selectedId={null}
        onSelect={onSelect}
        onSelectNested={onSelectNested}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Expand nested regions' }));
    onSelect.mockClear(); // the expand toggle itself must not have selected anything
    fireEvent.click(screen.getByText('Charge card'));
    // The nested node routes to onSelectNested with its full path + node…
    expect(onSelectNested).toHaveBeenCalledTimes(1);
    const [path, node] = onSelectNested.mock.calls[0];
    expect(path).toEqual({ containerId: 'each', regionKey: 'body', nodeId: 'charge' });
    expect(node.id).toBe('charge');
    // …and the click never bubbles up to select the container node.
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('paints the selection ring (aria-pressed) on the matching nested node', () => {
    const { container } = render(
      <FlowCanvas
        nodes={LOOP_NODES}
        edges={LOOP_EDGES}
        editable
        designMode
        selectedId={null}
        onSelect={() => {}}
        onSelectNested={() => {}}
        selectedNestedPath={{ containerId: 'each', regionKey: 'body', nodeId: 'charge' }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Expand nested regions' }));
    const nested = container.querySelector('[data-region-node-id="charge"]') as HTMLElement;
    expect(nested).not.toBeNull();
    expect(nested.getAttribute('aria-pressed')).toBe('true');
  });

  it('clears the nested selection when its container is collapsed', () => {
    const onSelectNested = vi.fn();
    render(
      <FlowCanvas
        nodes={LOOP_NODES}
        edges={LOOP_EDGES}
        editable
        designMode
        selectedId={null}
        onSelect={() => {}}
        onSelectNested={onSelectNested}
        selectedNestedPath={{ containerId: 'each', regionKey: 'body', nodeId: 'charge' }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Expand nested regions' }));
    fireEvent.click(screen.getByRole('button', { name: 'Collapse nested regions' }));
    expect(onSelectNested).toHaveBeenCalledWith(null);
  });

  it('tags a parallel branch node with its indexed region key', () => {
    const onSelectNested = vi.fn();
    render(
      <FlowCanvas
        nodes={[
          {
            id: 'fan',
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
        editable
        designMode
        selectedId={null}
        onSelect={() => {}}
        onSelectNested={onSelectNested}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Expand nested regions' }));
    fireEvent.click(screen.getByText('Notify CRM'));
    expect(onSelectNested).toHaveBeenCalledTimes(1);
    const [path] = onSelectNested.mock.calls[0];
    expect(path).toEqual({ containerId: 'fan', regionKey: 'branch-1', nodeId: 'b' });
  });

  it('keeps the tray read-only (no nested selection) outside design mode', () => {
    const onSelectNested = vi.fn();
    const { container } = render(
      <FlowCanvas
        nodes={LOOP_NODES}
        edges={LOOP_EDGES}
        editable={false}
        designMode={false}
        selectedId={null}
        onSelect={() => {}}
        onSelectNested={onSelectNested}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Expand nested regions' }));
    const nested = container.querySelector('[data-region-node-id="charge"]') as HTMLElement;
    // The hook is always present, but read-only → not a button, no click routing.
    expect(nested).not.toBeNull();
    expect(nested.getAttribute('role')).toBeNull();
    fireEvent.click(screen.getByText('Charge card'));
    expect(onSelectNested).not.toHaveBeenCalled();
  });
});

/**
 * objectui#3172 — node geometry is the spec's `FlowNode.position`.
 *
 * `FlowNodeSchema` is `.strict()` (objectstack#4001), so the designer's retired
 * `ui: { x, y }` spelling is not a cosmetic divergence: a draft carrying it is
 * flagged by the live client validation and rejected on save with a 422. These
 * tests therefore assert BOTH halves of the fix — every write path emits
 * `position`, and no patch may carry `ui` anywhere, including the legacy nodes a
 * patch merely passes through (migrate-on-write).
 *
 * The compiler cannot help here: `FlowDesignerNode` has an index signature, so
 * `ui: {…}` type-checks. These assertions are the guard.
 */
describe('FlowCanvas — geometry writes are spec-canonical `position` (#3172)', () => {
  /** A stored flow from before the convergence: node `b` is pinned via `ui`. */
  const LEGACY_NODES = [
    { id: 'a', type: 'start', label: 'Start' },
    { id: 'b', type: 'script', label: 'Do the thing', ui: { x: 400, y: 120 } },
  ];
  const LEGACY_EDGES = [{ source: 'a', target: 'b' }];

  const patchedNodes = (onPatch: ReturnType<typeof vi.fn>): Array<Record<string, unknown>> => {
    expect(onPatch).toHaveBeenCalledTimes(1);
    const patch = onPatch.mock.calls[0][0] as { nodes?: Array<Record<string, unknown>> };
    expect(Array.isArray(patch.nodes)).toBe(true);
    return patch.nodes!;
  };

  /** No node in the patch may carry the retired key — the strict-schema gate. */
  const expectNoLegacyKey = (nodes: Array<Record<string, unknown>>) => {
    for (const n of nodes) expect(Object.keys(n)).not.toContain('ui');
  };

  const dragCard = (container: HTMLElement, id: string, dx: number, dy: number) => {
    const card = container.querySelector(`[data-node-id="${id}"] [role="button"]`) as HTMLElement;
    expect(card).not.toBeNull();
    fireEvent.pointerDown(card, { button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(card, { clientX: dx, clientY: dy });
    fireEvent.pointerUp(card, { clientX: dx, clientY: dy });
  };

  // `Mock<…>` with the prop's own signature, not `ReturnType<typeof vi.fn>` —
  // the latter is the un-instantiated `Mock<Procedure | Constructable>`, which
  // `onPatch` does not accept (objectui#4040).
  const renderCanvas = (
    onPatch: Mock<NonNullable<React.ComponentProps<typeof FlowCanvas>['onPatch']>>,
    { nodes = LEGACY_NODES, selectedId = null }: { nodes?: typeof LEGACY_NODES; selectedId?: string | null } = {},
  ) =>
    render(
      <FlowCanvas
        nodes={nodes}
        edges={LEGACY_EDGES}
        editable
        designMode
        selectedId={selectedId}
        onSelect={() => {}}
        onPatch={onPatch}
      />,
    );

  it('renders a legacy `ui`-pinned node at its stored point (compat read)', () => {
    const { container } = renderCanvas(vi.fn());
    const card = container.querySelector('[data-node-id="b"]') as HTMLElement;
    expect(card.style.left).toBe('400px');
    expect(card.style.top).toBe('120px');
  });

  it('drag → the dragged node gets `position`, and no node keeps `ui`', () => {
    const onPatch = vi.fn();
    const { container } = renderCanvas(onPatch);
    dragCard(container, 'b', 30, 20);
    const nodes = patchedNodes(onPatch);
    const dragged = nodes.find((n) => n.id === 'b')!;
    // Dropped 30/20 px from its stored (400, 120) pin — committed as `position`.
    expect(dragged.position).toEqual({ x: 430, y: 140 });
    expectNoLegacyKey(nodes);
  });

  it('drag of ANOTHER node still heals the legacy one (migrate-on-write)', () => {
    const onPatch = vi.fn();
    const { container } = renderCanvas(onPatch);
    dragCard(container, 'a', 25, 25);
    const nodes = patchedNodes(onPatch);
    // The untouched legacy node is lifted onto `position` at the same point…
    expect(nodes.find((n) => n.id === 'b')!.position).toEqual({ x: 400, y: 120 });
    // …and the dragged node carries a fresh finite position.
    const moved = nodes.find((n) => n.id === 'a')!.position as { x: number; y: number };
    expect(Number.isFinite(moved.x) && Number.isFinite(moved.y)).toBe(true);
    expectNoLegacyKey(nodes);
  });

  it('insert-on-edge → the new node is pinned via `position`', () => {
    const onPatch = vi.fn();
    renderCanvas(onPatch);
    fireEvent.click(screen.getByRole('button', { name: 'Insert node here' }));
    const nodes = patchedNodes(onPatch);
    expect(nodes).toHaveLength(3);
    const inserted = nodes[2].position as { x: number; y: number };
    expect(Number.isFinite(inserted.x) && Number.isFinite(inserted.y)).toBe(true);
    expectNoLegacyKey(nodes);
  });

  it('append (+ handle) → new node is auto-laid, legacy node still healed', () => {
    const onPatch = vi.fn();
    renderCanvas(onPatch);
    fireEvent.click(screen.getAllByRole('button', { name: 'Add connected node' })[0]);
    const nodes = patchedNodes(onPatch);
    expect(nodes).toHaveLength(3);
    // An appended node is deliberately unpinned (the layered layout slots it).
    expect(nodes[2].position).toBeUndefined();
    expect(nodes.find((n) => n.id === 'b')!.position).toEqual({ x: 400, y: 120 });
    expectNoLegacyKey(nodes);
  });

  it('a patch that is not about geometry at all is still `ui`-free (delete)', () => {
    const onPatch = vi.fn();
    renderCanvas(onPatch, { selectedId: 'a' });
    fireEvent.keyDown(screen.getByRole('application', { name: 'Flow canvas' }), { key: 'Delete' });
    const nodes = patchedNodes(onPatch);
    expect(nodes.map((n) => n.id)).toEqual(['b']);
    expectNoLegacyKey(nodes);
  });
});
