// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * The column inspector reads identity in the CANONICAL spelling only
 * (objectui#5344, ruled 2026-08-22).
 *
 * `ViewColumnInspector` used to read `c.field ?? c.accessorKey` and
 * `c.label ?? c.header` — the same undeclared-alias read `ObjectGrid` retired
 * in objectui#5068, surviving one layer up in the authoring tool. `ListColumn`
 * refuses `accessorKey` / `header` by name, so that read presented a
 * spec-refused key as though it were a valid column identity: the author saw
 * `name` in the field-key box for a column the spec says has no field key.
 *
 * What the ruling asks for is OBSERVABLE, not type-level — "the inspector
 * stops presenting a refused spelling as a valid column identity" — so this
 * suite mounts the real component and reads what it displays.
 *
 * Deliberately NOT changed, and pinned here so a later reader does not
 * "finish the job" by accident:
 *   - `patchIdentity`'s writeback still re-emits whichever spelling it was
 *     handed (option A was ruled OUT once the maintainer confirmed there is no
 *     population of legacy stored documents: 「无」, 2026-08-22). No stored
 *     document is rewritten.
 *   - A legacy column therefore stays unsaveable before AND after an edit.
 *     That closed loop is the RULED OUTCOME, not an oversight; what this change
 *     removes is its invisibility.
 */

import '@testing-library/jest-dom/vitest';
import * as React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ViewMetadataSchema } from '@objectstack/spec/ui';

// The inspector renders FieldsListEditor, whose `useObjectFields` reaches for
// the shared metadata client. The variant below binds no object so the hook
// short-circuits, but the client itself is still constructed — stub it so no
// test can escape to the network. Same mechanism as
// ViewVariantInspector.homeGate.test.tsx.
const state = vi.hoisted(() => ({
  metadataClient: { get: vi.fn(async () => undefined), list: vi.fn(async () => [] as unknown[]) },
}));
vi.mock('../useMetadata', () => ({
  useMetadataClient: () => state.metadataClient,
}));

import { ViewColumnInspector } from './ViewColumnInspector';

afterEach(cleanup);

const FIELD_KEY = 'Field key'; // engine.inspector.viewColumn.accessorKey
const HEADER = 'Header'; //     engine.inspector.viewColumn.header

/** A view draft whose `list` variant binds no object → no field catalog. */
const draftWith = (columns: unknown[]): Record<string, unknown> => ({
  name: 'invoices',
  label: 'Invoices',
  list: { type: 'grid', columns },
});

function mount(columns: unknown[], onPatch = vi.fn()) {
  render(
    <ViewColumnInspector
      type="view"
      name="invoices"
      draft={draftWith(columns)}
      selection={{ kind: 'column', id: 'list.columns[0]' } as never}
      onPatch={onPatch}
      onClearSelection={() => {}}
      onSelectionChange={() => {}}
      readOnly={false}
      locale={'en-US' as never}
    />,
  );
  return onPatch;
}

/**
 * What the inspector DISPLAYS as the column's field key.
 *
 * The control is a `<Input>` when the field catalog yields no options and a
 * Radix combobox when it yields some — and which one renders is itself part of
 * the observable change, since the retired alias is what used to seed an option
 * from `accessorKey`. Read both shapes rather than assuming one.
 */
function shownFieldKey(): { widget: 'input' | 'combobox'; text: string } {
  const el = screen.getByLabelText(FIELD_KEY);
  return el instanceof HTMLInputElement
    ? { widget: 'input', text: el.value }
    : { widget: 'combobox', text: el.textContent ?? '' };
}

const shownHeader = () => (screen.getByLabelText(HEADER) as HTMLInputElement).value;

const parses = (columns: unknown[]) => ViewMetadataSchema.safeParse(draftWith(columns)).success;

describe('ViewColumnInspector — identity is read in the canonical spelling only', () => {
  it('shows an EMPTY field key for a legacy {accessorKey, header} column', () => {
    mount([{ accessorKey: 'name', header: 'Name' }]);

    // The ruled behaviour: no field key, so the author re-authors it.
    expect(shownFieldKey()).toEqual({ widget: 'input', text: '' });
    // `header` is not a label either — both halves of the alias are retired.
    expect(shownHeader()).toBe('');
    // The retired read also used to seed a picker option from `accessorKey`,
    // labelling a spec-refused key as a real (if unknown) field.
    expect(screen.queryByText('name (not in object)')).not.toBeInTheDocument();
  });

  it('leaves a canonical {field, label} column exactly as it was', () => {
    mount([{ field: 'name', label: 'Name', width: 120 }]);

    expect(shownFieldKey().text).toContain('name');
    expect(shownHeader()).toBe('Name');
  });

  it('leaves a bare string column exactly as it was', () => {
    mount(['name']);

    expect(shownFieldKey().text).toContain('name');
    // A string column has no label of its own; the box stays empty rather
    // than echoing the field key.
    expect(shownHeader()).toBe('');
  });

  it('still writes back the spelling it was handed — option A did not land', () => {
    const onPatch = mount([{ accessorKey: 'name', header: 'Name' }]);

    fireEvent.change(screen.getByLabelText(FIELD_KEY), { target: { value: 'title' } });

    expect(onPatch).toHaveBeenCalledTimes(1);
    const written = (onPatch.mock.calls[0][0] as any).list.columns[0];
    // The edit lands on `accessorKey`, NOT on a freshly minted `field` — the
    // writeback is out of scope for this card and no document is normalised.
    expect(written).toEqual({ accessorKey: 'title', header: 'Name' });
    expect(written).not.toHaveProperty('field');
  });

  it('pins the closed loop as the ruled outcome: legacy stays refused, controls stay accepted', () => {
    // Measured against the same gate ResourceEditPage uses on edit
    // (clientValidation.ts, mode 'edit'). Unchanged by this card in every row —
    // what changed is only what the inspector SHOWS.
    expect(parses([{ accessorKey: 'name', header: 'Name' }])).toBe(false);
    expect(parses([{ accessorKey: 'title', header: 'Name' }])).toBe(false);

    expect(parses([{ field: 'name', label: 'Name', width: 120 }])).toBe(true);
    expect(parses([{ field: 'title', label: 'Name', width: 120 }])).toBe(true);
    expect(parses(['name'])).toBe(true);
    expect(parses(['title'])).toBe(true);
  });

  it('records the residue this card is fenced out of: the column LIST still shows the legacy name', () => {
    mount([{ accessorKey: 'name', header: 'Name' }]);

    // `FieldsListEditor` renders inside this same panel and reads its row
    // labels through `previews/view-column-io.ts`, which still carries the very
    // alias retired above (`o.label ?? o.header ?? o.field ?? o.accessorKey`).
    // So the panel's identity controls stop presenting the refused spelling
    // while the list one line above still does. That file is outside this
    // card's granted surface; filed separately. When that lands, this
    // expectation flips — deliberately, so the boundary is visible rather than
    // silently forgotten.
    expect(screen.getByText('Name')).toBeInTheDocument();
  });
});
