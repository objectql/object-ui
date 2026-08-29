// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * The rendered "inactive values retained" affordance (objectui#6499, Option C).
 *
 * The predicate is pinned in `flow-node-config.inactiveRetained.test.ts`; this
 * file pins what the AUTHOR sees, because the whole ruling is about what is
 * visible on screen. A hidden-but-stored dependent value keeps rendering — the
 * ruling forbids deleting it — so the only thing that can tell the author it is
 * inert is this notice beside it.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';

vi.mock('../previews/useFlowNodePalette', () => ({
  useActionConfigSchemas: () => ({}),
  useFlowNodePalette: () => [],
}));
vi.mock('../previews/useObjectFields', () => ({
  useObjectFields: () => ({ fields: [], loading: false, error: null }),
}));

import { FlowNodeInspector } from './FlowNodeInspector';
import type { MetadataSelection } from '../preview-registry';

afterEach(cleanup);

function draftWith(config: Record<string, unknown>, type = 'approval') {
  return { nodes: [{ id: 'gate', type, label: 'Gate', config }], edges: [] };
}

function renderInspector(draft: Record<string, unknown>, readOnly = false) {
  const onPatch = vi.fn();
  const utils = render(
    <FlowNodeInspector
      type="flow"
      name="renewal"
      draft={draft}
      selection={{ kind: 'node', id: 'gate' } as MetadataSelection}
      onPatch={onPatch}
      onClearSelection={vi.fn()}
      readOnly={readOnly}
      locale="en-US"
    />,
  );
  return { onPatch, ...utils };
}

const notices = () => screen.queryAllByTestId('inactive-retained');

describe('the affordance appears exactly when a value is hidden-but-stored', () => {
  it('appears for the escalation residue the card measured', () => {
    // enable → fill → toggle back off → save. The stored payload the UI has
    // been manufacturing: `{ enabled: false, timeoutHours: 24 }`.
    renderInspector(draftWith({ escalation: { enabled: false, timeoutHours: 24 } }));
    const found = notices();
    expect(found).toHaveLength(1);
    expect(found[0].textContent).toMatch(/kept, not in effect/i);
    expect(found[0].textContent).toMatch(/controlling field is off/i);
    expect(found[0].getAttribute('data-inactive-retained')).toBe('controller-off');
    // The value itself is still on screen and still stored — nothing pruned.
    expect(screen.getByDisplayValue('24')).toBeInTheDocument();
  });

  it('does NOT appear when the controller is on — same stored value', () => {
    renderInspector(draftWith({ escalation: { enabled: true, timeoutHours: 24 } }));
    expect(notices()).toHaveLength(0);
    expect(screen.getByDisplayValue('24')).toBeInTheDocument(); // control: the field IS rendered
  });

  it('does NOT appear when the controller is off and nothing is stored', () => {
    renderInspector(draftWith({ escalation: { enabled: false } }));
    expect(notices()).toHaveLength(0);
    expect(screen.queryByDisplayValue('24')).not.toBeInTheDocument();
  });

  it('does NOT appear on a node with no gated fields at all', () => {
    renderInspector(draftWith({ objectName: 'contract', outputVariable: 'r' }, 'create_record'));
    expect(notices()).toHaveLength(0);
  });

  it('appears once per retained dependent, not once for the group', () => {
    renderInspector(draftWith({ escalation: { enabled: false, timeoutHours: 24, escalateTo: 'sre-lead' } }));
    expect(notices()).toHaveLength(2);
  });

  it('uses the no-controller wording for a `__legacy__` render-only key', () => {
    renderInspector({ nodes: [{ id: 'gate', type: 'decision', label: 'Gate', config: { condition: 'amount > 10000' } }], edges: [] });
    const found = notices();
    expect(found).toHaveLength(1);
    expect(found[0].getAttribute('data-inactive-retained')).toBe('no-controller');
    expect(found[0].textContent).toMatch(/nothing activates this field/i);
    // and NOT the controller wording — there is no toggle to point at
    expect(found[0].textContent).not.toMatch(/controlling field is off/i);
  });
});

describe('clearing is deliberate, author-initiated, and goes through the ordinary field commit', () => {
  it('offers a clear button that removes the retained key', () => {
    const { onPatch } = renderInspector(draftWith({ escalation: { enabled: false, timeoutHours: 24 } }));
    const clear = within(notices()[0]).getByRole('button', { name: /clear value/i });
    fireEvent.click(clear);
    const patched = onPatch.mock.calls.at(-1)![0] as any;
    // The retained key is gone; the controller the author actually set stays.
    expect(patched.nodes[0].config.escalation).toEqual({ enabled: false });
  });

  it('does not clear anything until the author clicks — rendering is a read', () => {
    const { onPatch } = renderInspector(draftWith({ escalation: { enabled: false, timeoutHours: 24 } }));
    expect(onPatch).not.toHaveBeenCalled();
  });

  it('offers no clear button in a read-only inspector', () => {
    renderInspector(draftWith({ escalation: { enabled: false, timeoutHours: 24 } }), true);
    expect(notices()).toHaveLength(1); // the author can still SEE the state
    expect(within(notices()[0]).queryByRole('button', { name: /clear value/i })).toBeNull();
  });
});

describe('assertions that must NOT move', () => {
  it('an ordinary live field renders with no notice and no clear button', () => {
    renderInspector(draftWith({ escalation: { enabled: true, timeoutHours: 24 } }));
    expect(screen.queryByRole('button', { name: /clear value/i })).toBeNull();
    expect(notices()).toHaveLength(0);
  });

  it('the retained value survives a re-render — the affordance never prunes on its own', () => {
    const draft = draftWith({ escalation: { enabled: false, timeoutHours: 24 } });
    const { onPatch, rerender } = renderInspector(draft);
    rerender(
      <FlowNodeInspector
        type="flow"
        name="renewal"
        draft={draft}
        selection={{ kind: 'node', id: 'gate' } as MetadataSelection}
        onPatch={onPatch}
        onClearSelection={vi.fn()}
        readOnly={false}
        locale="en-US"
      />,
    );
    expect(onPatch).not.toHaveBeenCalled();
    expect((draft as any).nodes[0].config.escalation).toEqual({ enabled: false, timeoutHours: 24 });
  });
});
