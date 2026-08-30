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
import { TableColumnSchema } from '@object-ui/types/zod';
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

describe('data-table columns — `headerIcon` is DECLARED and renders (#6424)', () => {
  // Maintainer ruling 2026-08-27 (Option C, per-key): `headerIcon` moves from
  // undeclared-but-honoured to declared on `TableColumn` + its zod mirror. The
  // two pins below are the two halves the card measured as broken: the render
  // read (always live) and the parse road (which used to STRIP the key).

  it('renders the headerIcon node inside the header cell, before the header text', () => {
    renderTable([
      {
        header: 'Stage',
        accessorKey: 'stage',
        headerIcon: <svg data-testid="stage-header-icon" />,
      },
    ]);
    const icon = screen.getByTestId('stage-header-icon');
    expect(icon).toBeInTheDocument();
    const th = icon.closest('th');
    expect(th).not.toBeNull();
    expect(th!.textContent).toContain('Stage');
  });

  it('SURVIVES the zod mirror parse — no longer silently stripped', () => {
    // Acceptance alone cannot pin this: a non-strict z.object() ACCEPTS an
    // undeclared key and silently STRIPS it (the pre-#6424 behaviour — parse
    // succeeded green while the icon vanished). The pin is the key surviving
    // into the parsed OUTPUT, same discipline as `editable: false` in
    // `static-table-narrow-surface.test.ts`.
    const node = React.createElement('svg');
    const result = TableColumnSchema.safeParse({
      header: 'Stage',
      accessorKey: 'stage',
      headerIcon: node,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect('headerIcon' in result.data).toBe(true);
      expect(result.data.headerIcon).toBe(node);
    }
  });
});

describe('data-table columns — `fitContent` is DECLARED and survives parse (#6424)', () => {
  // The card's SECOND key, ruled 2026-08-28 (Option A) in the same shape
  // `headerIcon` landed in above. Retire was excluded by measurement — shipped
  // source authors `fitContent: true` on the injected row-actions column — so
  // the key is declared on `TableColumn` + its zod mirror instead.
  //
  // The RENDER half is already pinned, and deliberately not duplicated here:
  // `data-table-fit-content.test.tsx` holds the width:1% + nowrap + no-clip
  // behaviour. What was broken and is fixed here is the AUTHORING surface, so
  // that is what these pin.

  it('SURVIVES the zod mirror parse — no longer silently stripped', () => {
    // Acceptance cannot pin this: a non-strict z.object() ACCEPTS an
    // undeclared key and silently STRIPS it, so this exact parse was green
    // BEFORE the declaration — while the flag vanished and the row-actions
    // column fell back to the estimated 80px floor that clipped its buttons.
    // The pin is survival into the parsed OUTPUT, same discipline as
    // `headerIcon` above and `editable: false` in
    // `static-table-narrow-surface.test.ts`.
    const result = TableColumnSchema.safeParse({
      header: 'Actions',
      accessorKey: '_actions',
      fitContent: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect('fitContent' in result.data).toBe(true);
      expect(result.data.fitContent).toBe(true);
    }
  });

  it('is TYPED by the mirror, not waved through — a non-boolean is a loud refusal', () => {
    // `fitContent` is serializable metadata, unlike the `z.any()` runtime
    // slots (`cell`, `headerIcon`), so the mirror types it. Without this the
    // declaration would buy acceptance without validation — the lenient face
    // that lets AI-authored metadata errors through (the defect objectui#5853
    // fixed for `type`).
    const result = TableColumnSchema.safeParse({
      header: 'Actions',
      accessorKey: '_actions',
      fitContent: 'yes',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((i) => i.path.join('.'))).toContain('fitContent');
    }
  });

  it('parses through the whole authored column — declared keys travel together', () => {
    // Both of this card's keys on one column, the way ObjectGrid emits them.
    const node = React.createElement('svg');
    const result = TableColumnSchema.safeParse({
      header: 'Actions',
      accessorKey: '_actions',
      headerIcon: node,
      fitContent: true,
      align: 'right',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fitContent).toBe(true);
      expect(result.data.headerIcon).toBe(node);
      expect(result.data.align).toBe('right');
    }
  });
});
