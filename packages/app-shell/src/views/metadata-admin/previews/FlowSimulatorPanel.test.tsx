// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { FlowSimulatorPanel } from './FlowSimulatorPanel';

afterEach(cleanup);

/**
 * ADR-0044: the Debug panel models an approval as a durable pause and offers its
 * out-edge labels (approve / reject / revise) as decision buttons, so an author
 * can walk a revise loop instead of fanning out to every branch.
 */
const reviseFlow = {
  nodes: [
    { id: 's', type: 'start' },
    { id: 'a', type: 'approval', label: 'Review' },
    { id: 'w', type: 'wait', label: 'Awaiting Revision' },
    { id: 'ok', type: 'end', label: 'Approved' },
    { id: 'no', type: 'end', label: 'Rejected' },
  ],
  edges: [
    { source: 's', target: 'a' },
    { source: 'a', target: 'ok', label: 'approve' },
    { source: 'a', target: 'no', label: 'reject' },
    { source: 'a', target: 'w', label: 'revise' },
    { source: 'w', target: 'a', label: 'resubmit', type: 'back' },
  ],
};

describe('FlowSimulatorPanel — approval decisions', () => {
  it('offers approve / reject / revise buttons when the run pauses at an approval', () => {
    render(<FlowSimulatorPanel nodes={reviseFlow.nodes} edges={reviseFlow.edges} variables={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /^run$/i }));
    expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /revise/i })).toBeInTheDocument();
  });

  it('walks the full revise loop through the UI: revise → continue → approve → done', () => {
    render(<FlowSimulatorPanel nodes={reviseFlow.nodes} edges={reviseFlow.edges} variables={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /^run$/i }));
    // Round 1: send back for revision.
    fireEvent.click(screen.getByRole('button', { name: /revise/i }));
    // Paused at the wait node → a plain Continue resumes over the back-edge.
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    // Round 2: the approval suspends again → decide approve.
    fireEvent.click(screen.getByRole('button', { name: /approve/i }));
    expect(screen.getByText('done')).toBeInTheDocument();
  });
});
