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
