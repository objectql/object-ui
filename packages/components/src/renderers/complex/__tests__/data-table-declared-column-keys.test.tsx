/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `data-table` reads the two column keys `TableColumn` DECLARES, and no others
 * (objectui#5120 for `accessorKey`, objectui#5351 for `header`).
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
 * The two aliases were DIFFERENT failure classes and are pinned separately:
 * an unresolved `accessorKey` gives blank cells under a live header, while an
 * unresolved `header` gives a headerless column over live cells. Neither is
 * dropped and neither throws — that legibility is pinned below too, because it
 * is exactly what objectui#5349 measures against.
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

describe('data-table columns — the undeclared `name` alias is retired (#5120)', () => {
  it('does not resolve an accessor from `name`', () => {
    // THE CHANGE. Before the retirement this rendered both cells, because the
    // adapter fell back to `col.name`. The declared key is `accessorKey`, and a
    // producer resolves it (`columnIdentity`) before delivery.
    renderTable([{ header: 'Stage', name: 'stage' }]);
    expect(bodyCells()).toEqual(['', '']);
  });

  it('keeps an authored `accessorKey` winning over a divergent `name`', () => {
    // `name` is not consulted at all, so it cannot win and cannot conflict.
    renderTable([{ header: 'Stage', accessorKey: 'stage', name: 'nonsense' }]);
    expect(bodyCells()).toEqual(['Won', 'Lost']);
  });

  it('LEGIBILITY: an unresolvable accessor keeps its header and its neighbour', () => {
    // Measured, not assumed, and deliberately unchanged by this card: the
    // column is neither dropped nor refused. It renders a live header over
    // blank cells, and the column beside it is unaffected. Whether that silence
    // earns a dev-time diagnostic is objectui#5349's question, not this one's.
    renderTable([
      { header: 'Stage', name: 'stage' },
      { header: 'Id', accessorKey: 'id' },
    ]);
    expect(headers()).toEqual(['Stage', 'Id']);
    expect(bodyCells()).toEqual(['', '1', '', '2']);
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

describe('data-table columns — the auto-width pass reads the same two keys', () => {
  it('sizes from the declared keys, not the retired aliases', () => {
    // The width pass is a SECOND read of the same columns, five lines below the
    // first. If the two ever spell the accessor differently the table measures
    // one set of columns and renders another, so they are pinned to move
    // together. A `name`-spelled column samples `row[undefined]`, contributes no
    // content width and falls to the 80px floor; its declared twin over the
    // same long values does not.
    const DataTable = ComponentRegistry.get('data-table') as any;
    const LONG = 'a-really-quite-long-cell-value-here';
    render(
      <DataTable
        schema={{
          type: 'data-table',
          data: [{ id: '1', note: LONG }],
          pagination: false,
          searchable: false,
          columns: [
            { header: 'A', name: 'note' },
            { header: 'B', accessorKey: 'note' },
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
