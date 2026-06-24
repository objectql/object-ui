// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';

// Capture the schema handed to the runtime SchemaRenderer so slotted-page
// tests can assert what was actually rendered (synthesized regions vs the raw
// empty draft). `vi.hoisted` lets the mock factory reference it despite hoisting.
const { schemaSpy } = vi.hoisted(() => ({ schemaSpy: vi.fn() }));

// Mock the heavy runtime/canvas children so the test isolates PagePreview's
// routing decision (which child it picks), not their internals.
vi.mock('../../InterfaceListPage', () => ({
  InterfaceListPage: () => <div data-testid="mock-interface-list" />,
}));
vi.mock('@object-ui/react', () => ({
  SchemaRenderer: ({ schema }: { schema: any }) => {
    schemaSpy(schema);
    return <div data-testid="mock-schema-renderer" />;
  },
  RecordContextProvider: ({ children }: { children: any }) => <>{children}</>,
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

describe('PagePreview — slotted record page synthesis', () => {
  beforeEach(() => {
    schemaSpy.mockClear();
    // Record binding fetches the object schema + sample records. Resolve both
    // to empty so the effect settles deterministically; synthesis falls back to
    // a def-less default page (structure only), which is all this test asserts.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({}) }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  // A slotted page overrides `highlights` + `tabs`; header/details/discussion
  // are omitted and must be filled by the synthesizer.
  const slottedDraft = {
    name: 'showcase_account_record',
    type: 'record',
    object: 'showcase_account',
    kind: 'slotted',
    regions: [], // slotted pages carry an empty regions[] — the blank-canvas trap
    slots: {
      highlights: [{ type: 'record:highlights', fields: ['industry', 'website'] }],
      tabs: [{ type: 'page:tabs', items: [{ label: 'Custom', children: [] }] }],
    },
  };

  it('renders synthesized default regions (not the empty draft) so the preview is not blank', async () => {
    render(<PagePreview draft={slottedDraft} />);
    await waitFor(() => expect(schemaSpy).toHaveBeenCalled());
    const rendered = schemaSpy.mock.calls.at(-1)![0];

    // The raw draft has regions:[] — synthesis must replace it with the
    // canonical record layout so SchemaRenderer has something to walk.
    expect(rendered.type).toBe('record');
    const main = (rendered.regions ?? []).find((r: any) => r.name === 'main');
    expect(main).toBeTruthy();
    expect(main.components.length).toBeGreaterThan(0);
  });

  it('fills omitted slots with synthesized defaults and applies authored overrides', async () => {
    render(<PagePreview draft={slottedDraft} />);
    await waitFor(() => expect(schemaSpy).toHaveBeenCalled());
    const rendered = schemaSpy.mock.calls.at(-1)![0];
    const main = rendered.regions.find((r: any) => r.name === 'main');
    const comps: any[] = main.components;
    const types = comps.map((c) => c.type);

    // Omitted slots → synthesized defaults.
    expect(types).toContain('page:header');
    expect(types).toContain('record:discussion');

    // Authored highlights override is applied verbatim (replaces the default
    // chips + chevron path).
    const highlights = comps.find((c) => c.type === 'record:highlights');
    expect(highlights?.fields).toEqual(['industry', 'website']);

    // Authored tabs override wins — the custom tab is present.
    const tabs = comps.find((c) => c.type === 'page:tabs');
    expect(tabs?.items?.[0]?.label).toBe('Custom');
  });

  it('renders the authored schema unchanged for a non-slotted (full) record page', async () => {
    const fullDraft = {
      name: 'acct_full',
      type: 'record',
      object: 'showcase_account',
      kind: 'full',
      regions: [{ name: 'main', components: [{ type: 'record:details' }] }],
    };
    render(<PagePreview draft={fullDraft} />);
    await waitFor(() => expect(schemaSpy).toHaveBeenCalled());
    const rendered = schemaSpy.mock.calls.at(-1)![0];
    // No synthesis — the authored single-region layout passes through as-is.
    expect(rendered.regions).toHaveLength(1);
    expect(rendered.regions[0].components).toEqual([{ type: 'record:details' }]);
  });
});
