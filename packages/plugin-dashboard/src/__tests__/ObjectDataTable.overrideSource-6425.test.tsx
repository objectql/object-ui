/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The CONSUMER half of `declared = enforced` for `ObjectDataTable`'s column
 * seam (objectui#6425). `ObjectDataTable.emitBoundary-6373.test.tsx` is its
 * twin from the other end: that one asks what the producer WRITES into the
 * `TableColumn[]` slot, this one asks what it READS off the authored column.
 *
 * `enrich()` handed `buildFieldMeta` six values taken off the authored column.
 * Five — `format`, `options`, `referenceTo`, `currency`, `decimals` — are
 * declared by neither `TableColumn` nor its `TableColumnSchema` zod mirror.
 * Three arrived through `(col as any)`; the other two through
 * `NormalizedColumn`'s `[key: string]: any`, which answers `any` just as
 * loudly without the tell. `AuthoredColumnOverrides` replaces both with a
 * written hold per key plus a derived refusal band.
 *
 * ## The ruling landed — this file now pins the ruled state
 *
 * This suite began as the PREREQUISITE for the declare-or-retire ruling: the
 * runtime half measures, per key, whether an authored override reaches
 * anything at all, so the ruling could be made on evidence. The maintainer
 * ruled per key on 2026-08-27 (objectui#6425): `format` / `options` /
 * `currency` DECLARED on `TableColumn` + its zod mirror; `decimals` RETIRED
 * immediately (the authored read is gone; the derived band refuses the key);
 * `referenceTo` ⛔ NOT declared as spelled — still HELD, owned by
 * objectui#6597. The measurements below are unchanged because the ruling did
 * not change behaviour; what changed is which artefact answers for each key.
 *
 * ## Every zero here is paired with a positive control
 *
 * Two of the five reach no reader. A test that renders two columns and finds
 * them equal proves that only if the SAME query shape is shown separating two
 * columns elsewhere — otherwise it is measuring a broken harness. So each
 * inert pair sits next to a live pair built the same way: `decimals` against
 * `currency`, `referenceTo` against `options`.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

vi.mock('@object-ui/react', async () => {
  const actual: any = await vi.importActual('@object-ui/react');
  return {
    ...actual,
    // The same stand-in the cells suite uses: it invokes each column's `cell`
    // closure, which is the only thing that reads the overrides under test.
    SchemaRenderer: ({ schema }: any) => {
      const cols = schema.columns || [];
      const rows = schema.data || [];
      return (
        <table>
          <tbody>
            {rows.map((row: any, i: number) => (
              <tr key={i}>
                {cols.map((c: any) => (
                  <td key={c.accessorKey} data-testid={`cell-${c.accessorKey}`}>
                    {typeof c.cell === 'function' ? c.cell(row[c.accessorKey], row) : String(row[c.accessorKey] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    },
    useDataScope: () => undefined,
    SchemaRendererContext: actual.SchemaRendererContext,
  };
});

import { ObjectDataTable, normalizeColumns } from '../ObjectDataTable';
import type { AuthoredColumnOverrides, ObjectDataTableColumnHolds } from '../ObjectDataTable';

afterEach(() => cleanup());

/**
 * Render one table over a row whose two fields hold the SAME value, so the
 * only thing that can separate the two cells is the override under test.
 */
async function renderPair(
  fields: Record<string, any>,
  row: Record<string, any>,
  columns: any[],
): Promise<{ a: string; b: string }> {
  const dataSource = {
    find: async () => ({ data: [row] }),
    getObjectSchema: async () => ({ fields }),
  };
  render(
    <ObjectDataTable
      schema={{ type: 'object-data-table', objectName: 'probe', columns } as any}
      dataSource={dataSource}
    />,
  );
  await waitFor(() => expect(screen.getByTestId('cell-a')).toBeInTheDocument(), { timeout: 2000 });
  await waitFor(() => expect(screen.getByTestId('cell-a').textContent).not.toBe(''), { timeout: 2000 });
  return {
    a: screen.getByTestId('cell-a').textContent ?? '',
    b: screen.getByTestId('cell-b').textContent ?? '',
  };
}

/* ── the runtime half: what each held key actually reaches ────────────────── */

describe('per-key liveness of the five undeclared overrides (#6425)', () => {
  it('currency IS live — it beats the symbol inferred from `format`', async () => {
    // The positive control for the `decimals` zero below: same harness, same
    // two-columns-over-equal-values shape, and it SEPARATES them.
    const { a, b } = await renderPair(
      { a: { type: 'number' }, b: { type: 'number' } },
      { a: 150000, b: 150000 },
      [
        { header: 'Plain', accessorKey: 'a', format: '$0,0' },
        { header: 'Euro', accessorKey: 'b', format: '$0,0', currency: 'EUR' },
      ],
    );
    expect(a).toMatch(/150,000/);
    expect(b).toMatch(/150,000/);
    expect(b).not.toBe(a);
    expect(b).toContain('€');
  });

  it('decimals reaches NOTHING — the RETIRED key changes no render (ruling, 2026-08-27)', async () => {
    // Measured statically too: zero `.decimals` reads across `@object-ui/fields`,
    // `@object-ui/i18n` and `@object-ui/components`. `NumberCellRenderer` reads
    // `scale`; `PercentCellRenderer` reads `precision`; `renderFieldValue`'s
    // percent branch counts digits in the FORMAT STRING. That measurement is
    // what justified the ruling's RETIRE verdict — no user could reach the
    // key — and this same pin now proves the retire itself changed nothing:
    // an authored `decimals` renders byte-identical to its absence, before
    // the read was removed and after.
    const { a, b } = await renderPair(
      { a: { type: 'number' }, b: { type: 'number' } },
      { a: 3.14159, b: 3.14159 },
      [
        { header: 'Plain', accessorKey: 'a' },
        { header: 'Three places', accessorKey: 'b', decimals: 3 },
      ],
    );
    expect(a).not.toBe('');
    expect(b).toBe(a);
  });

  it('options IS live — an authored option list relabels the badge', async () => {
    // The positive control for the `referenceTo` zero below.
    const schemaOptions = [{ value: 'tech', label: 'Technology' }];
    const { a, b } = await renderPair(
      {
        a: { type: 'select', options: schemaOptions },
        b: { type: 'select', options: schemaOptions },
      },
      { a: 'tech', b: 'tech' },
      [
        { header: 'From schema', accessorKey: 'a' },
        { header: 'Overridden', accessorKey: 'b', options: [{ value: 'tech', label: 'Overridden' }] },
      ],
    );
    expect(a).toBe('Technology');
    expect(b).toBe('Overridden');
  });

  it('referenceTo reaches NOTHING on this path', async () => {
    // `LookupCellRenderer` resolves its target from `reference_to` / `reference`
    // — never `referenceTo` — and `computeLookupExpand` builds `$expand` from
    // the OBJECT SCHEMA's field types, so authoring it on a column does not add
    // the field to the expand whitelist either. Values arrive already expanded.
    const expanded = { id: 'acc-1', name: 'Acme' };
    const { a, b } = await renderPair(
      { a: { type: 'lookup' }, b: { type: 'lookup' } },
      { a: expanded, b: { ...expanded } },
      [
        { header: 'Plain', accessorKey: 'a' },
        { header: 'With referenceTo', accessorKey: 'b', referenceTo: 'account' },
      ],
    );
    expect(a).toContain('Acme');
    expect(b).toBe(a);
  });
});

/* ── the type-level half ─────────────────────────────────────────────────── */

/** True only when `T` is `any` — the one type `0 extends (1 & T)` admits. */
type IsAny<T> = 0 extends (1 & T) ? true : false;

/** What `enrich` receives: the authored bag `normalizeColumns` produces. */
type AuthoredBag = ReturnType<typeof normalizeColumns>[number];

describe('the override reads are typed, and the band can FAIL (#6425)', () => {
  it('turns the `any` reads into declared ones', () => {
    // ⭐ The before/after pair, in one file and one query shape. The bag is the
    // pre-fix read: `(col as any).currency` and `col.decimals` both answered
    // `any`, the first loudly and the second through the index signature. The
    // keyhole answers the declared type. `IsAny` returning `true` for the bag
    // is the positive control that makes the two `false`s a measurement rather
    // than a query that never fires.
    const bagCurrencyIsAny: IsAny<AuthoredBag['currency']> = true;
    const bagDecimalsIsAny: IsAny<AuthoredBag['decimals']> = true;
    const heldCurrencyIsAny: IsAny<AuthoredColumnOverrides['currency']> = false;
    const heldDecimalsIsAny: IsAny<AuthoredColumnOverrides['decimals']> = false;
    const heldReferenceToIsAny: IsAny<AuthoredColumnOverrides['referenceTo']> = false;

    expect([bagCurrencyIsAny, bagDecimalsIsAny]).toEqual([true, true]);
    expect([heldCurrencyIsAny, heldDecimalsIsAny, heldReferenceToIsAny]).toEqual([false, false, false]);
  });

  it('accepts exactly the adjudicated set', () => {
    // The positive control. Without it the refusals below could be satisfied by
    // a type that refuses everything, which would pin nothing. `decimals` is
    // deliberately NOT here any more: the ruling retired it, and its refusal
    // is pinned with the band below.
    const accepted: AuthoredColumnOverrides = {
      accessorKey: 'amount',
      type: 'currency',
      format: '$0,0',
      options: [{ value: 'tech', label: 'Technology' }],
      referenceTo: 'account',
      currency: 'EUR',
    };
    expect(accepted.currency).toBe('EUR');
  });

  it('refuses an unheld FieldMeta member — and the BAND is what refuses it', () => {
    // Checked by `tsc -p tsconfig.test.json`, which this package's `type-check`
    // script chains and CI's Type Check job runs. A directive whose error stops
    // happening is reported UNUSED (TS2578), so this cannot decay into
    // decoration.
    //
    // ⚠️ The source is a VARIABLE, not a fresh object literal, on purpose. A
    // literal is refused by the excess-property check whether or not the band
    // exists, so it would pin "something refused this" without pinning what —
    // exactly the decay the emit-side twin documents. Assigning a non-fresh
    // source reaches the band and nothing else: measured by removing the band
    // and watching this directive, and only this one, turn TS2578.
    const carriesLabel: { accessorKey: string; label?: string } = { accessorKey: 'amount' };
    // @ts-expect-error objectui#6425 — `label` is in the derived refusal band.
    const labelRefused: AuthoredColumnOverrides = carriesLabel;
    expect(labelRefused.accessorKey).toBe('amount');

    const carriesName: { accessorKey: string; name?: string } = { accessorKey: 'amount' };
    // @ts-expect-error objectui#6425 — `name` is in the derived refusal band.
    const nameRefused: AuthoredColumnOverrides = carriesName;
    expect(nameRefused.accessorKey).toBe('amount');

    // `decimals` used to be HELD here; the ruling (2026-08-27) RETIRED it, so
    // it fell into the derived band with no hand-edit to the band itself —
    // removing the hold member IS the flip. This directive is the pin.
    const carriesDecimals: { accessorKey: string; decimals?: number } = { accessorKey: 'amount' };
    // @ts-expect-error objectui#6425 — `decimals` RETIRED into the derived refusal band.
    const decimalsRefused: AuthoredColumnOverrides = carriesDecimals;
    expect(decimalsRefused.accessorKey).toBe('amount');
  });

  it('the same source is ACCEPTED by the holds without the band', () => {
    // The band's counter-control: this is `AuthoredColumnOverrides` minus the
    // `?: never` members, and it takes the very source the directives above
    // refuse. So the refusal comes from the band, not from the holds, not from
    // the required `accessorKey`, and not from weak-type detection.
    const carriesLabel: { accessorKey: string; label?: string } = { accessorKey: 'amount' };
    const unbanded: { accessorKey: string; type?: string } & ObjectDataTableColumnHolds = carriesLabel;
    expect(unbanded.accessorKey).toBe('amount');
  });

  it('refuses a key outside the override vocabulary written by hand', () => {
    // Needs no band: a hand-written property is subject to the excess-property
    // check. Kept because it is the OTHER way a tolerance gets added back, and
    // separated from the band pins because the two are different machinery.
    // @ts-expect-error objectui#6425 — `scale` is not an adjudicated override key.
    const written: AuthoredColumnOverrides = { accessorKey: 'amount', scale: 2 };
    expect(written.accessorKey).toBe('amount');
  });

  it('refuses a READ of an unadjudicated key — the mechanism `enrich` runs on', () => {
    // ⭐ The two pins above act on ASSIGNMENT INTO the keyhole. This one acts on
    // the read OUT of it, which is what `enrich` actually does: it never
    // assigns a banded source, it reads `authored.currency` and friends. The
    // keyhole carries no index signature, so a key nobody adjudicated is
    // TS2339 AT THE READ — where the pre-fix code answered `any` twice over,
    // through `(col as any)` and through `NormalizedColumn`'s `[key: string]:
    // any`. This is the enforcement a future maintainer meets first.
    const authored = {} as AuthoredColumnOverrides;
    // The positive control, same query shape: an adjudicated key reads clean.
    expect(authored.currency).toBeUndefined();
    // @ts-expect-error objectui#6425 — unadjudicated key; the read itself is refused.
    const unadjudicated = authored.scale;
    expect(unadjudicated).toBeUndefined();
  });
});
