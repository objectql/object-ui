// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.
//
// Render regression for the run-observability UI (framework #2581 + this fix):
// the automation engine sends a run-level `error` as a plain STRING
// (`ExecutionLog.error`). The panel previously read `.message` off it and so
// dropped the failure reason — the single most useful thing about a failed run.
// This asserts a failed run's string reason actually reaches the DOM.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FlowRunsPanel } from './FlowRunsPanel';

const FAILED_RUN = {
  id: 'run_run_dfc987a9',
  status: 'failed',
  startedAt: '2026-07-04T13:51:13.000Z',
  durationMs: 12,
  trigger: { type: '' },
  steps: [], // durable history rows carry no step detail
  // The engine's run-level error IS a string (not { message }).
  error: "Node 'guarded_push' failed: catch region failed — Access denied",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('FlowRunsPanel (render)', () => {
  it('shows a failed run and its string failure reason', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ success: true, data: { runs: [FAILED_RUN] } }), { status: 200 })),
    );

    render(<FlowRunsPanel flowName="showcase_resilient_sync" />);

    // Status renders collapsed…
    expect(await screen.findByText('Failed')).toBeTruthy();

    // …expand the run to reveal the reason. The run row is the button carrying
    // aria-expanded (the Refresh control does not), so it is unambiguous.
    fireEvent.click(screen.getByRole('button', { expanded: false }));

    // The string reason must now be in the DOM (pre-fix it was silently dropped).
    expect(await screen.findByText(/catch region failed/)).toBeTruthy();
  });
});
