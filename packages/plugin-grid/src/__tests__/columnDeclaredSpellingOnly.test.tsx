/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `ObjectGrid` reads ONE column spelling — the declared one (objectui#5068).
 *
 * `ObjectGridSchema.columns` is declared `string[] | ListColumn[]`, and
 * `ListColumnSchema` in `@objectstack/spec/ui` is a STRICT object: `field` is
 * required and `accessorKey` / `header` are refused BY NAME
 * (`unrecognized_keys`, with a prescriptive message). The renderer used to
 * accept that refused spelling anyway, via a branch that sniffed `columns[0]`
 * for an `accessorKey` and synthesized a `ListColumn` from it — so the same
 * key had two spellings, one the schema admits and one only the runtime did.
 * That is the second de-facto contract AGENTS.md #0.1 forbids, and it is the
 * reason the fictional `{ header, accessorKey }` shape in the plugin README
 * (objectui#5013) looked credible: it rendered.
 *
 * The disposition is inherited from objectui#3951 — unify at the producer, no
 * consumer-side tolerance alias — so this file pins the consumer half:
 *
 *   declared   `{ field, label }`        → renders (unchanged)
 *   undeclared `{ accessorKey, header }` → does not resolve
 *
 * `accessorKey` remains the vocabulary of the data-table ADAPTER on the way
 * OUT (`@object-ui/components`' TanStack column key, `columnIdentity.ts`'s
 * `TABLE_ADAPTER_COLUMN_KEY`). This card is about the way IN.
 *
 * LEGIBILITY (pinned below, deliberately, rather than left as folklore): an
 * undeclared column does not throw, does not render an empty header, and
 * produces no console line — it is simply DROPPED, so a grid whose columns are
 * all mis-spelled renders as the row-number column alone. Whether that silence
 * deserves a dev-time diagnostic is its own decision (objectui#5068 Q2) and is
 * deliberately NOT implemented here.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

import { ObjectGrid } from '../ObjectGrid';
import { registerAllFields } from '@object-ui/fields';
import { ActionProvider } from '@object-ui/react';

registerAllFields();

const ROWS = [
  { id: '1', name: 'Ada', amount: 100 },
  { id: '2', name: 'Grace', amount: 200 },
];

/** Render a bare `object-grid` node over inline data — no host, no dataSource. */
function renderGrid(columns: unknown[]) {
  return render(
    <ActionProvider>
      <ObjectGrid schema={{ type: 'object-grid', data: ROWS, columns } as any} />
    </ActionProvider>,
  );
}

/** Every rendered header, in order. `#` is the built-in row-number column. */
function headers(): string[] {
  return screen.getAllByRole('columnheader').map((h) => (h.textContent ?? '').trim());
}

describe('ObjectGrid columns — the declared spelling is the only one read (#5068)', () => {
  it('renders a column authored the declared way (field / label)', () => {
    renderGrid([
      { field: 'name', label: 'Name' },
      { field: 'amount', label: 'Amount' },
    ]);

    expect(headers()).toEqual(['#', 'Name', 'Amount']);
    expect(screen.getByText('Ada')).toBeInTheDocument();
    expect(screen.getByText('Grace')).toBeInTheDocument();
  });

  it('does not resolve a column authored the undeclared way (accessorKey / header)', () => {
    // The change. Before this card the tolerance branch synthesized
    // `{ field: col.accessorKey, label: col.header }` and these rendered
    // identically to the declared spelling above — which is precisely why
    // nothing signalled that the spec refuses them.
    renderGrid([
      { accessorKey: 'name', header: 'Name' },
      { accessorKey: 'amount', header: 'Amount' },
    ]);

    expect(headers()).toEqual(['#']);
    expect(screen.queryByText('Ada')).not.toBeInTheDocument();
    expect(screen.queryByText('Grace')).not.toBeInTheDocument();
  });

  it('drops the undeclared column and keeps the declared one, whichever comes first', () => {
    // Per-column, not a first-element sniff. The retired branch dispatched on
    // `columns[0]` alone, so on the old code the FIRST entry decided the fate
    // of the whole array: a declared column standing behind an undeclared one
    // was lost with it. Both orders are pinned so that cannot come back.
    renderGrid([
      { accessorKey: 'amount', header: 'Amount' },
      { field: 'name', label: 'Name' },
    ]);

    expect(headers()).toEqual(['#', 'Name']);
    expect(screen.getByText('Ada')).toBeInTheDocument();
    expect(screen.queryByText('100')).not.toBeInTheDocument();
  });

  it('drops a trailing undeclared column without disturbing the declared one', () => {
    renderGrid([
      { field: 'name', label: 'Name' },
      { accessorKey: 'amount', header: 'Amount' },
    ]);

    expect(headers()).toEqual(['#', 'Name']);
    expect(screen.getByText('Grace')).toBeInTheDocument();
  });

  it('leaves the grid standing — and silent — when every column is undeclared', () => {
    // The legibility pin. Not an error, not an empty header cell, not a
    // console line: the columns are simply gone. Recorded as behaviour so the
    // follow-up diagnostics decision (Q2) has something to measure against.
    const { container } = renderGrid([{ accessorKey: 'name', header: 'Name' }]);

    expect(headers()).toEqual(['#']);
    expect(container.querySelector('table')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('still renders a plain string[] column list', () => {
    // Untouched by this card — the other declared spelling — pinned because
    // the retired branch sat between `normalizeColumns` and this arm.
    renderGrid(['name', 'amount']);

    expect(headers()).toEqual(['#', 'Name', 'Amount']);
    expect(screen.getByText('Ada')).toBeInTheDocument();
  });
});
