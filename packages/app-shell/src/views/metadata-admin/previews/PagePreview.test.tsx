// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

// Mock the heavy runtime/canvas children so the test isolates PagePreview's
// routing decision (which child it picks), not their internals.
vi.mock('../../InterfaceListPage', () => ({
  InterfaceListPage: () => <div data-testid="mock-interface-list" />,
}));
vi.mock('@object-ui/react', () => ({
  SchemaRenderer: () => <div data-testid="mock-schema-renderer" />,
}));
vi.mock('./PageBlockCanvas', () => ({
  PageBlockCanvas: () => <div data-testid="mock-page-canvas" />,
}));

import { PagePreview } from './PagePreview';

afterEach(cleanup);

const interfaceDraft = {
  name: 'wb',
  type: 'list',
  regions: [],
  interfaceConfig: { source: 'task', userFilters: { element: 'dropdown', fields: [{ field: 'status' }] } },
};
const regionDraft = {
  name: 'home',
  type: 'home',
  regions: [{ name: 'main', components: [{ type: 'container' }] }],
};

describe('PagePreview — interface-page routing (ADR-0047)', () => {
  it('renders the runtime InterfaceListPage for an interface page in preview mode', () => {
    // preview mode = no onSelectionChange (not editing the canvas)
    render(<PagePreview draft={interfaceDraft} />);
    expect(screen.getByTestId('mock-interface-list')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-schema-renderer')).not.toBeInTheDocument();
  });

  it('also renders the live InterfaceListPage in design mode (no canvas hint)', () => {
    render(
      <PagePreview
        draft={interfaceDraft}
        editing
        onSelectionChange={() => {}}
        onPatch={() => {}}
      />,
    );
    // Interface pages are config-driven: the design tab shows the live list
    // (mirroring the runtime), not the region canvas/placeholder.
    expect(screen.getByTestId('mock-interface-list')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-page-canvas')).not.toBeInTheDocument();
  });

  it('renders the generic SchemaRenderer for a region-composed page (not an interface page)', () => {
    render(<PagePreview draft={regionDraft} />);
    expect(screen.queryByTestId('mock-interface-list')).not.toBeInTheDocument();
    expect(screen.getByTestId('mock-schema-renderer')).toBeInTheDocument();
  });
});
