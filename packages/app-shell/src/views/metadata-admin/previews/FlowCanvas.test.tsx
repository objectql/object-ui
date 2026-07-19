// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { FlowCanvas } from './FlowCanvas';
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

describe('FlowCanvas — nested container regions (#2670)', () => {
  it('reveals a loop body region in a popover when the container control is opened', async () => {
    const nodes = [
      { id: 'start', type: 'start' },
      {
        id: 'each',
        type: 'loop',
        label: 'For each order',
        config: { body: { nodes: [{ id: 'charge', type: 'http', label: 'Charge card' }], edges: [] } },
      },
    ];
    render(
      <FlowCanvas
        nodes={nodes}
        edges={[{ source: 'start', target: 'each' }]}
        editable={false}
        designMode={false}
        selectedId={null}
        onSelect={() => {}}
      />,
    );
    // Closed by default: the body step is not rendered, but a "show regions" control is.
    expect(screen.queryByText('Charge card')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /show nested regions/i }));
    // Open: the loop body node now renders nested in the popover.
    expect(await screen.findByText('Charge card')).toBeInTheDocument();
  });

  it('labels parallel branches and try/catch handlers when opened', async () => {
    const nodes = [
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
    ];
    render(
      <FlowCanvas nodes={nodes} edges={[]} editable={false} designMode={false} selectedId={null} onSelect={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /show nested regions/i }));
    expect(await screen.findByText('Slack')).toBeInTheDocument(); // named branch
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
