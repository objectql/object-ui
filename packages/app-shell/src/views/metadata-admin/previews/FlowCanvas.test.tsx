// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { FlowCanvas } from './FlowCanvas';

afterEach(cleanup);

/**
 * ADR-0044: an un-declared cycle is surfaced INLINE on the canvas — the
 * offending edges/nodes are painted red (data-invalid) and an error banner
 * shows the message — so the author needn't open the Debug panel.
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

  it('renders the error banner and marks invalid edges + nodes', () => {
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
        validationErrors={['Cycle detected (a → w → a). Mark the closing edge as a back-edge.']}
      />,
    );
    // Banner message is visible on the canvas.
    expect(screen.getByText(/Cycle detected/)).toBeInTheDocument();
    // Two cycle edges + two cycle nodes carry the data-invalid marker.
    expect(container.querySelectorAll('[data-invalid="true"]').length).toBeGreaterThanOrEqual(4);
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
