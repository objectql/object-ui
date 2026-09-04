/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `record:quick_actions` resolves its action array through
 * `resolveDeclaredActionIds` — the ONE rule it shares with `page:header`
 * (objectui#7182, maintainer ruling 2026-09-02, option C).
 *
 * Before this card the bar switched on the WHOLE array
 * (`rawActions.every((a) => typeof a === 'string')`): a mixed
 * `['convert', { … }]` took the object path, and the bare string reached the
 * engine as an "ActionDef" that rendered nothing — while `page:header`
 * normalised per element and drew both. One authored array, two meanings.
 *
 * The proof shape is the one PR objectui#7180 established for the header: the
 * same actions are authored TWICE — as ids and as the inline objects — and the
 * two renders are compared, with the object-shape render as the LIVE CONTROL
 * (asserted non-empty first, so an id-side green cannot come from two empty
 * bars agreeing). The population covers the two filters this bar's chain
 * applies to an already-resolved list — `locations` (`list_only` never renders
 * here) and `requiredPermissions` (`gated` is denied for this user) — so one
 * equivalence assertion measures both.
 */

import * as React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ActionProvider, MetadataCtx, RecordContextProvider } from '@object-ui/react';
import type { MetadataContextValue } from '@object-ui/react';
import { RecordQuickActionsRenderer } from '../record-quick-actions';

const ACTIONS: Record<string, any> = {
  convert: { name: 'convert', label: 'Convert Lead', type: 'flow', locations: ['record_header'] },
  qualify: { name: 'qualify', label: 'Qualify', type: 'api', locations: ['record_header'] },
  list_only: { name: 'list_only', label: 'List Only', type: 'api', locations: ['list_item'] },
  gated: {
    name: 'gated',
    label: 'Gated Action',
    type: 'api',
    locations: ['record_header'],
    requiredPermissions: ['nobody_holds_this'],
  },
};

const AUTHORED = ['convert', 'qualify', 'list_only', 'gated'];
const OBJECT_META = { name: 'lead', label: 'Lead', actions: AUTHORED.map((n) => ACTIONS[n]) };
const RECORD = { id: 'rec-1', name: 'Ada', status: 'open' };
const USER = { id: 'u1', systemPermissions: ['setup.access'] };

const getItem = vi.fn(async (type: string, name: string) =>
  type === 'object' && name === 'lead' ? OBJECT_META : null,
);

/**
 * Held at MODULE level on purpose: `getItem` is an effect dependency of
 * `useMetadataItem`, so a value rebuilt per render spins that hook forever.
 */
const METADATA: MetadataContextValue = {
  apps: [],
  objects: [OBJECT_META] as any,
  dashboards: [],
  reports: [],
  pages: [],
  loading: false,
  error: null,
  refresh: async () => {},
  invalidate: () => {},
  ensureType: async () => [],
  getItem: getItem as unknown as MetadataContextValue['getItem'],
  getItemsByType: () => [],
  getTypeStatus: () => 'ready' as const,
};

function mount(schema: Record<string, unknown>) {
  return render(
    <MetadataCtx.Provider value={METADATA}>
      <ActionProvider context={{ user: USER } as any}>
        <RecordContextProvider objectName="lead" recordId={RECORD.id} data={RECORD}>
          <RecordQuickActionsRenderer schema={schema as any} />
        </RecordContextProvider>
      </ActionProvider>
    </MetadataCtx.Provider>,
  );
}

/** Ordered accessible names of the buttons in the bar; `[]` when the bar drew none. */
const buttonNames = (c: HTMLElement): string[] => {
  const toolbar = c.querySelector('[role="toolbar"]');
  if (!toolbar) return [];
  return Array.from(toolbar.querySelectorAll('button')).map(
    (b) => (b.getAttribute('aria-label') || b.textContent || '').trim(),
  );
};

const objectAuthored = { actions: AUTHORED.map((n) => ACTIONS[n]) };
const idAuthored = { actions: [...AUTHORED] };

describe('record:quick_actions — declared action ids through the shared rule (objectui#7182)', () => {
  let error: ReturnType<typeof vi.spyOn>;
  const errorMessages = (): string[] =>
    (error.mock.calls as unknown[][]).map((c) => String(c[0]));

  beforeEach(() => {
    getItem.mockClear();
    error = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    error.mockRestore();
  });

  it('renders the same buttons from ids as from the inline objects', async () => {
    // Live control FIRST: the object-shape authoring must draw a real bar.
    const objectRender = mount(objectAuthored);
    const controlNames = buttonNames(objectRender.container);
    expect(controlNames).toContain('Convert Lead');
    expect(controlNames.length).toBeGreaterThan(1);
    // The filters the chain applies, measured on the control so the id side
    // inherits them by equality rather than by four more assertions.
    expect(controlNames).not.toContain('List Only');
    expect(controlNames).not.toContain('Gated Action');
    // An all-object array never asks the metadata layer.
    expect(getItem).not.toHaveBeenCalled();
    objectRender.unmount();

    const idRender = mount(idAuthored);
    // Resolution runs through `useMetadataItem`, which settles in an effect.
    await screen.findByRole('button', { name: /Convert Lead/i });
    expect(getItem).toHaveBeenCalledWith('object', 'lead');

    expect(buttonNames(idRender.container)).toEqual(controlNames);
  });

  it('resolves `actionNames` — the spec-declared spelling — through the same rule', async () => {
    mount({ actionNames: ['qualify', 'convert'] });
    await screen.findByRole('button', { name: /Qualify/i });
    // Authored order, not registration order.
    expect(buttonNames(document.body)).toEqual(['Qualify', 'Convert Lead']);
    expect(getItem).toHaveBeenCalledWith('object', 'lead');
  });

  it('refuses a mixed id/object array — no buttons, and the placeholder and the console name the offending index', async () => {
    const { container } = mount({ actions: ['convert', ACTIONS.qualify] });
    // The refusal is visible on the surface, not only in the console.
    expect(await screen.findByText(/actions refused at index 1/i)).toBeInTheDocument();
    expect(buttonNames(container)).toEqual([]);
    expect(screen.queryByRole('button', { name: /Convert Lead/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Qualify/i })).toBeNull();
    // Refused BEFORE any lookup: the metadata layer is never asked.
    expect(getItem).not.toHaveBeenCalled();

    const hits = errorMessages().filter((m) => m.includes('[record:quick_actions] actions refused'));
    expect(hits.length).toBe(1);
    expect(hits[0]).toContain('refused at index 1');
    expect(hits[0]).toContain('element 1 is an inline action object but element 0 is an action id');
    expect(hits[0]).toContain('mixed id/object action arrays are refused; use all ids or all objects');
  });

  it('refuses a mixed `actionNames` array under the key it was authored on', async () => {
    const { container } = mount({ actionNames: [ACTIONS.convert, 'qualify'] });
    expect(await screen.findByText(/actionNames refused at index 1/i)).toBeInTheDocument();
    expect(buttonNames(container)).toEqual([]);
    const hits = errorMessages().filter((m) => m.includes('[record:quick_actions] actionNames refused'));
    expect(hits.length).toBe(1);
    expect(hits[0]).toContain('element 1 is an action id but element 0 is an inline action object');
  });

  it('a lone unresolvable id renders the empty placeholder, not a refusal', async () => {
    // The control that separates "refused" from "resolved to nothing": a typo
    // is an all-id array that resolves nothing, and the bar says so in its
    // ordinary empty state.
    mount({ actions: ['covert_lead'] });
    expect(await screen.findByText(/no actions configured/i)).toBeInTheDocument();
    expect(getItem).toHaveBeenCalledWith('object', 'lead');
    expect(errorMessages().filter((m) => m.includes('refused'))).toEqual([]);
  });
});
