// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PageBlockCanvas } from './PageBlockCanvas';

afterEach(cleanup);

/**
 * Empty-canvas messaging. Region-composed pages with no regions yet invite
 * the author to add one. (ADR-0047 interface pages never reach this canvas —
 * PagePreview renders them as a live InterfaceListPage in both modes — so
 * there is no interface-specific empty state here.)
 */
describe('PageBlockCanvas — empty state', () => {
  it('a region-composed page shows the "No regions yet / Add region" empty state', () => {
    render(<PageBlockCanvas draft={{ name: 'home', type: 'home', regions: [] }} onPatch={() => {}} />);
    expect(screen.getByText(/No regions yet/i)).toBeInTheDocument();
    expect(screen.getByText(/Add region/i)).toBeInTheDocument();
    expect(screen.queryByText(/configured in Properties/i)).not.toBeInTheDocument();
  });
});
