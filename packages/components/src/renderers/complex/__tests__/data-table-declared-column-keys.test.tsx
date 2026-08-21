/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `data-table` reads the DECLARED `header`, not the undeclared `label`
 * (objectui#5351).
 *
 * `TableColumn` (`packages/types/src/data-display.ts`) declares `header: string`
 * and `accessorKey: string`. It declares neither `label` nor `name`. The
 * adapter's column normalization nonetheless read
 *
 *     header:      col.header      || col.label
 *     accessorKey: col.accessorKey || col.name
 *
 * so one key had two spellings — one the type admits, one only the runtime did.
 * That second de-facto contract is what AGENTS.md #0.1 forbids, and the
 * maintainer ruling of 2026-08-20 settled the direction for the whole family:
 * retire the consumer-side alias, unify the producers. `data-table` is an
 * ADAPTER; `column-identity.ts` names its keys `TABLE_ADAPTER_COLUMN_KEY` /
 * `TABLE_ADAPTER_HEADER_KEY` and holds the metadata fold away from them on
 * purpose. Metadata vocabulary in, adapter vocabulary out; one translation, one
 * place — and that place is each producer, never here.
 *
 * SCOPE. The `label` alias retires here; the `name` alias is HELD, and the last
 * describe below pins it as still-read so the hold cannot be mistaken for the
 * retirement having happened. Two published skill guides teach a directly
 * authored `data-table` whose columns are spelled `{ name, label }`, and
 * `skill-guide-data-table-binding.test.tsx` renders those blocks straight out of
 * the guide files — so `name` cannot retire until the instruction corpus moves.
 * That is objectui#5120's remaining step and is nobody's to take unbidden:
 * `skills/**` is a customer-published surface with its own owning seat.
 *
 * The two aliases were DIFFERENT failure classes, which is why the cards were
 * filed apart: an unresolved `accessorKey` gives blank cells under a live
 * header, while an unresolved `header` gives a headerless column over live
 * cells. Neither is dropped and neither throws — that legibility is pinned
 * below too, because it is exactly what objectui#5349 measures against.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';
import { ComponentRegistry } from '@object-ui/core';
import '../data-table';

const ROWS = [
  { id: '1', stage: 'Won' },
  { id: '2', stage: 'Lost' },
];

function renderTable(columns: unknown[]) {
  const DataTable = ComponentRegistry.get('data-table') as any;
  if (!DataTable) throw new Error('data-table not registered');
  return render(
    <DataTable schema={{ type: 'data-table', data: ROWS, columns, pagination: false, searchable: false }} />,
  );
}

/** Every rendered header cell's text, in order. */
const headers = () =>
  Array.from(document.querySelectorAll('thead th')).map((th) => (th.textContent ?? '').trim());

/** Every rendered body cell's text, row-major. */
const bodyCells = () =>
  Array.from(document.querySelectorAll('tbody td')).map((td) => (td.textContent ?? '').trim());

describe('data-table columns — the declared keys render (unchanged)', () => {
  it('renders a column authored the declared way', () => {
    renderTable([{ header: 'Stage', accessorKey: 'stage' }]);
    expect(headers()).toEqual(['Stage']);
    expect(bodyCells()).toEqual(['Won', 'Lost']);
    expect(screen.getByText('Won')).toBeInTheDocument();
  });
});

describe('data-table columns — the `name` alias is still read, and that is a HOLD (#5120)', () => {
  it('still resolves an accessor from the undeclared `name`', () => {
    // NOT an endorsement — a receipt. The 2026-08-20 ruling retires this limb;
    // what stops it today is that two published skill guides teach it and
    // `skill-guide-data-table-binding.test.tsx` renders their bytes. Pinning the
    // CURRENT behaviour means the day the guides move, this test goes red and
    // names itself as the thing to delete, instead of the retirement quietly
    // never happening.
    renderTable([{ header: 'Stage', name: 'stage' }]);
    expect(bodyCells()).toEqual(['Won', 'Lost']);
  });

  it('keeps an authored `accessorKey` ahead of a divergent `name`', () => {
    // Precedence, unchanged and load bearing: columns can arrive in the table
    // library's own shape, and those must not be second-guessed.
    renderTable([{ header: 'Stage', accessorKey: 'stage', name: 'nonsense' }]);
    expect(bodyCells()).toEqual(['Won', 'Lost']);
  });
});

describe('data-table columns — the undeclared `label` alias is retired (#5351)', () => {
  it('does not resolve a header from `label`', () => {
    // A DIFFERENT failure class from #5120's, which is why the card was filed
    // separately: the cells are fine and the HEADER is what goes missing.
    renderTable([{ label: 'Stage', accessorKey: 'stage' }]);
    expect(headers()).toEqual(['']);
    expect(bodyCells()).toEqual(['Won', 'Lost']);
  });

  it('keeps an authored `header` winning over a divergent `label`', () => {
    renderTable([{ header: 'Stage', label: 'nonsense', accessorKey: 'stage' }]);
    expect(headers()).toEqual(['Stage']);
  });

  it('LEGIBILITY: a headerless column still renders its cells and its neighbour', () => {
    renderTable([
      { label: 'Stage', accessorKey: 'stage' },
      { header: 'Id', accessorKey: 'id' },
    ]);
    expect(headers()).toEqual(['', 'Id']);
    expect(bodyCells()).toEqual(['Won', '1', 'Lost', '2']);
  });
});

describe('data-table columns — the auto-width pass reads the same header key', () => {
  it('sizes from the declared `header`, not from `label`', () => {
    // The width pass is a SECOND read of the same columns, a few lines below
    // the first. If the two ever spell a key differently the table measures one
    // set of columns and renders another, so they are pinned to move together.
    // A column's estimated width starts from its HEADER length, so a long
    // `label` that the adapter no longer reads contributes nothing and the
    // column falls to the 80px floor, while its declared twin does not.
    const DataTable = ComponentRegistry.get('data-table') as any;
    const LONG = 'A Really Quite Long Column Header';
    render(
      <DataTable
        schema={{
          type: 'data-table',
          data: [{ id: '1', a: 'x', b: 'x' }],
          pagination: false,
          searchable: false,
          columns: [
            { label: LONG, accessorKey: 'a' },
            { header: LONG, accessorKey: 'b' },
          ],
        }}
      />,
    );
    const ths = Array.from(document.querySelectorAll('thead th')) as HTMLElement[];
    expect(ths).toHaveLength(2);
    expect(ths[0].style.width).toBe('80px');
    expect(parseInt(ths[1].style.width, 10)).toBeGreaterThan(80);
  });
});
