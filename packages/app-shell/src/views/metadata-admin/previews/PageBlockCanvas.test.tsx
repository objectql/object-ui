// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PageBlockCanvas } from './PageBlockCanvas';

afterEach(cleanup);

/**
 * Empty-canvas messaging (ADR-0047). An interface page (config-driven, no
 * regions) must NOT be invited to "Add region" — it points the author at the
 * Properties → Interface panel instead. A region-composed page keeps the
 * normal "No regions yet / Add region" empty state.
 */
describe('PageBlockCanvas — empty state', () => {
  it('interface page (interfaceConfig present) shows the Properties hint, not Add region', () => {
    render(
      <PageBlockCanvas
        draft={{ name: 'wb', type: 'list', regions: [], interfaceConfig: { source: 'task' } }}
        onPatch={() => {}}
      />,
    );
    expect(screen.getByText(/configured in Properties/i)).toBeInTheDocument();
    expect(screen.queryByText(/Add region/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/No regions yet/i)).not.toBeInTheDocument();
  });

  it('a list page without regions is treated as interface mode', () => {
    render(<PageBlockCanvas draft={{ name: 'wb', type: 'list', regions: [] }} onPatch={() => {}} />);
    expect(screen.getByText(/configured in Properties/i)).toBeInTheDocument();
    expect(screen.queryByText(/Add region/i)).not.toBeInTheDocument();
  });

  it('a region-composed page keeps the "No regions yet / Add region" empty state', () => {
    render(<PageBlockCanvas draft={{ name: 'home', type: 'home', regions: [] }} onPatch={() => {}} />);
    expect(screen.getByText(/No regions yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Add region/i)).toBeInTheDocument();
    expect(screen.queryByText(/configured in Properties/i)).not.toBeInTheDocument();
  });
});
