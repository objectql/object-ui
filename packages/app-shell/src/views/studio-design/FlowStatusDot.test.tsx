// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.
//
// The Automations rail's per-flow status dot (UX #6): a flow's live enable state
// must be visible at a glance, from the engine's runtime `_status` — not left to
// guess. Renders nothing for a flow the engine doesn't know yet (never published).

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FlowStatusDot } from './StudioDesignSurface';

describe('FlowStatusDot', () => {
  it('shows a green "On" for an enabled flow', () => {
    render(<FlowStatusDot state={{ enabled: true, bound: true }} locale="en" />);
    expect(screen.getByText('On')).toBeTruthy();
  });

  it('shows "Off" for a disabled flow', () => {
    render(<FlowStatusDot state={{ enabled: false, bound: false }} locale="en" />);
    expect(screen.getByText('Off')).toBeTruthy();
  });

  it('renders nothing when the flow has no runtime state (never published)', () => {
    const { container } = render(<FlowStatusDot state={undefined} locale="en" />);
    expect(container.firstChild).toBeNull();
  });

  it('distinguishes bound vs unbound (no-trigger) enabled flows in its tooltip', () => {
    const { rerender } = render(<FlowStatusDot state={{ enabled: true, bound: true }} locale="en" />);
    expect(screen.getByTitle(/bound to its trigger/i)).toBeTruthy();
    rerender(<FlowStatusDot state={{ enabled: true, bound: false }} locale="en" />);
    expect(screen.getByTitle(/no trigger/i)).toBeTruthy();
  });
});
