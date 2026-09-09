/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#8441 — the `repeater` cell counted its rows in hardcoded Chinese,
 * and the `file` cell counted its files in hardcoded English.
 *
 * ## What was measured before anything moved
 *
 * `getCellRenderer('repeater')` returned an inline arrow that rendered the row
 * count followed by a Chinese unit word (U+9879, spelled as an escape
 * throughout this file — AGENTS.md #-1 governs comments and source too). Every
 * reader on every locale saw it, English ones included, next to the English
 * siblings `[Vector]`, `[Grid]` and `FileCellRenderer`'s `N files` on the same
 * detail page. Two rules broke on one literal: #-1 (English-only codebase) and
 * "it bypasses i18n entirely".
 *
 * ## Why the fix is the i18n channel and not "make it English"
 *
 * Maintainer ruling on the card: making it English answers only the FIRST of
 * the two rules the card names — "every reader on every locale sees an
 * unlocalized literal" survives verbatim, in another language. The channel
 * (`useFieldTranslate` -> `useObjectTranslation`) was already imported by this
 * very file and already used by `DateCellRenderer`, `DateTimeCellRenderer`,
 * `ImageCellRenderer` and `FormulaCellRenderer`, so routing costs no new
 * dependency and no new published surface.
 *
 * `FileCellRenderer` rides along for the same reason: it spelled the same
 * concept `count === 1 ? 'file' : 'files'` two hundred lines up. That is not a
 * rule violation — it is English — but a two-branch ternary cannot spell `ru`'s
 * four plural categories or `ar`'s six, and two adjacent cells answering one
 * concept two ways is the shape the ruling closes.
 *
 * ## The shape of the assertions here, and why each one is needed
 *
 * - **Every pin reads RENDERED DOM TEXT**, never source text. A source-text
 *   assertion passes the day someone re-adds the literal through a constant.
 * - **A LIT CONTROL for the channel, in this same run.** Every negative
 *   assertion below ("no U+9879 survives", "no English survives") is also
 *   satisfied by a provider that never mounted and a pack that never loaded.
 *   The control renders `detail.unresolvedReference` — a key that resolved
 *   through THIS file's `useFieldTranslate` before this card — under `ru`, and
 *   asserts the Russian value. If it fails, nothing else here means anything.
 * - **`ru` is the non-English leg, not `zh`, and that is load-bearing.**
 *   `Intl.PluralRules('ru').select(2)` is `few`, a category no pack in this
 *   repo enumerates, so count 2 can only be answered by the BASE key — in
 *   Russian, from the `ru` pack. A leg that renders English there is
 *   objectui#3863 reopened. `zh` is asserted too, because the same Chinese
 *   string that was the DEFECT as a source literal is the CORRECT rendering as
 *   a pack value, and only a locale-varying assertion can tell those apart.
 * - **The provider-less English fallback is pinned byte-equal to the `en`
 *   pack.** `check:i18n-keys` compares an inline `defaultValue` against the
 *   pack; this call site's fallback is a ternary, not that shape, so the gate
 *   cannot see it. This pin is the comparison instead — the same duty
 *   `userCell.unresolvedReference-8434.test.tsx` performs for its sentence.
 * - **The table entry is pinned STABLE across `getCellRenderer` calls.**
 *   `getCellRenderer` rebuilds `standardMap` on every call and both call sites
 *   (`DetailSection`, `renderFieldValue`) resolve inside render, so an inline
 *   arrow is a new component TYPE per render: React unmounts and remounts the
 *   cell, taking react-i18next's language subscription with it. Hoisting the
 *   renderer to a module-level function is what makes the hook safe to hold,
 *   and identity is the only observable that says so.
 *
 * ## The call mechanism this card's premise turned on
 *
 * The ruling made the fix conditional on hooks being legal in that table. Both
 * halves were measured on `origin/main` before a line was written: four table
 * entries already call hooks, and every call site renders the resolved value as
 * a JSX ELEMENT (`<CellRenderer value={…} field={…} />` in
 * `plugin-detail/src/DetailSection.tsx`, `<Renderer … />` in
 * `plugin-dashboard/src/recordFields.tsx` and
 * `fields/src/widgets/lookupColumnDisplay.tsx`), never a plain call. The tests
 * below render through the same shape.
 *
 * ## What this file deliberately does NOT pin
 *
 * The `[Vector]` / `[Grid]` placeholders in the same table. They are a
 * different class — type placeholders, not count phrases — the card did not
 * measure them, and the ruling fenced them off. Pinning their current text here
 * would read as an endorsement of it.
 */
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import { I18nProvider, en, ru, zh } from '@object-ui/i18n';

import { getCellRenderer } from '../index';

/**
 * The Chinese unit word the defect hardcoded, written as an escape so this file
 * stays English source (AGENTS.md #-1) and so a careless find-and-replace over
 * the character cannot silently disarm the assertions.
 */
const CN_ITEM_UNIT = '\u9879';

const repeaterField = { name: 'stuff', label: 'Stuff', type: 'repeater' } as any;
const fileField = { name: 'docs', label: 'Docs', type: 'file' } as any;

/**
 * Resolve and render exactly the way the production call sites do — resolve the
 * component, then render it as an ELEMENT. `DetailSection.tsx:381` is
 * `const CellRenderer = getCellRenderer(resolvedType); return <CellRenderer
 * value={value} field={…} />`; this is that, verbatim.
 */
function renderCell(type: string, value: unknown, field: any, language?: string) {
  const CellRenderer = getCellRenderer(type);
  const element = <CellRenderer value={value} field={field} />;
  return render(
    language === undefined ? (
      element
    ) : (
      <I18nProvider config={{ defaultLanguage: language, detectBrowserLanguage: false }}>
        {element}
      </I18nProvider>
    ),
  );
}

const textOf = (container: HTMLElement) => container.textContent ?? '';

/** An `n`-element array — the value shape a `repeater` / multi-file cell holds. */
const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ q: i + 1 }));

beforeEach(() => {
  cleanup();
});

/* -------------------------------------------------------------------------- */
/* Control: the channel is live in THIS run.                                    */
/* -------------------------------------------------------------------------- */

describe('the locale channel is live in this run (control for objectui#8441)', () => {
  it('resolves detail.unresolvedReference under `ru` — a key keyed before this card', () => {
    // Same file, same `useFieldTranslate`, same provider. A blank or English
    // result in any test below is a dead provider unless this one passes.
    const { container } = renderCell('user', 'Ada Lovelace', { name: 'owner', type: 'user' }, 'ru');
    const stated = container.querySelector('[data-slot="unresolved-reference"]')?.getAttribute('title');
    const packed = (ru as any).detail.unresolvedReference.replace('{{value}}', 'Ada Lovelace');
    expect(stated, 'the ru pack must be loaded and the provider mounted').toBe(packed);
    expect(stated, 'and it must not be the English sentence').not.toBe(
      (en as any).detail.unresolvedReference.replace('{{value}}', 'Ada Lovelace'),
    );
  });
});

/* -------------------------------------------------------------------------- */
/* THE DEFECT: the repeater count under an English locale.                      */
/* -------------------------------------------------------------------------- */

describe('objectui#8441 — the `repeater` count is English under an English locale', () => {
  it('a two-element array renders `2 items`, with no Chinese unit word anywhere', () => {
    const { container } = renderCell('repeater', rows(2), repeaterField, 'en');
    expect(textOf(container)).not.toContain(CN_ITEM_UNIT);
    expect(textOf(container)).toBe('2 items');
  });

  it('a one-element array renders the singular — a count phrase must agree with its number', () => {
    const { container } = renderCell('repeater', rows(1), repeaterField, 'en');
    expect(textOf(container)).toBe('1 item');
  });

  it('an empty array still renders the shared empty affordance, unchanged by this card', () => {
    const { container } = renderCell('repeater', [], repeaterField, 'en');
    expect(textOf(container)).not.toContain(CN_ITEM_UNIT);
    expect(textOf(container)).not.toMatch(/item/);
  });

  it('a non-array value is still empty, unchanged by this card', () => {
    const { container } = renderCell('repeater', null, repeaterField, 'en');
    expect(textOf(container)).not.toMatch(/item/);
  });
});

/* -------------------------------------------------------------------------- */
/* The label really varies by locale — the half "make it English" cannot buy.    */
/* -------------------------------------------------------------------------- */

describe('objectui#8441 — the `repeater` count varies by locale', () => {
  it('`zh` renders the Chinese unit word as a PACK VALUE, not as a source literal', () => {
    const { container } = renderCell('repeater', rows(2), repeaterField, 'zh');
    expect(textOf(container)).toContain(CN_ITEM_UNIT);
    expect(textOf(container)).toBe((zh as any).detail.repeaterItemCount.replace('{{count}}', '2'));
    // …and the same value under `en` does not, which is the whole difference
    // between a translation and a hardcode.
    cleanup();
    expect(textOf(renderCell('repeater', rows(2), repeaterField, 'en').container)).not.toContain(
      CN_ITEM_UNIT,
    );
  });

  it('`ru` at count 1 uses `_one` from the ru pack', () => {
    const { container } = renderCell('repeater', rows(1), repeaterField, 'ru');
    expect(textOf(container)).toBe((ru as any).detail.repeaterItemCount_one.replace('{{count}}', '1'));
  });

  it('`ru` at count 2 falls to the BASE key IN RUSSIAN — objectui#3863, not English', () => {
    // `Intl.PluralRules('ru').select(2)` is `few`, and no pack here enumerates
    // `_few`. Without the base key i18next walks `fallbackLng` to `en` and a
    // Russian reader gets English at counts 2-20. This is the pin that says the
    // base key is doing its job.
    expect(new Intl.PluralRules('ru').select(2)).toBe('few');
    const { container } = renderCell('repeater', rows(2), repeaterField, 'ru');
    const rendered = textOf(container);
    // ⚠️ The RENDER-side assertion runs FIRST, deliberately. Reading the pack for
    // the oracle throws when the base key is absent, and a pin that dies on its
    // own oracle reddens without ever saying what the reader saw. Measured: with
    // the ru base key deleted this leg reported a `TypeError` on the oracle and
    // nothing about the DOM — so the order is the difference between "red" and
    // "red for the stated reason".
    expect(rendered, 'a Russian reader must not be handed English').not.toBe('2 items');
    expect(rendered).toBe((ru as any).detail.repeaterItemCount.replace('{{count}}', '2'));
  });
});

/* -------------------------------------------------------------------------- */
/* FileCellRenderer — in scope because the premise held: one channel, two sites. */
/* -------------------------------------------------------------------------- */

describe('objectui#8441 — the `file` count reads the same channel', () => {
  it('`en` keeps its English text byte for byte — this half is a no-op pin', () => {
    expect(textOf(renderCell('file', rows(2), fileField, 'en').container)).toBe('2 files');
    cleanup();
    expect(textOf(renderCell('file', rows(1), fileField, 'en').container)).toBe('1 file');
  });

  it('`ru` at count 1 uses `_one`, and at count 2 the base key IN RUSSIAN', () => {
    expect(textOf(renderCell('file', rows(1), fileField, 'ru').container)).toBe(
      (ru as any).detail.fileCount_one.replace('{{count}}', '1'),
    );
    cleanup();
    const two = textOf(renderCell('file', rows(2), fileField, 'ru').container);
    expect(two).toBe((ru as any).detail.fileCount.replace('{{count}}', '2'));
    expect(two, 'the ternary this replaced could only ever say `2 files`').not.toBe('2 files');
  });

  it('a falsy value is still the empty affordance — the hook sits ABOVE that guard', () => {
    // The hoist is the rules-of-hooks half of this change: the early return was
    // this renderer's first statement, so a hook written after it would be
    // skipped for an empty value and hook order would desync between renders.
    const { container } = renderCell('file', null, fileField, 'en');
    expect(textOf(container)).not.toMatch(/file/);
  });

  it('a single file object still renders its name, untouched by this card', () => {
    const { container } = renderCell('file', { name: 'contract.pdf' }, fileField, 'en');
    expect(textOf(container)).toBe('contract.pdf');
  });
});

/* -------------------------------------------------------------------------- */
/* The provider-less path, and the pack it must not drift from.                 */
/* -------------------------------------------------------------------------- */

describe('objectui#8441 — the provider-less English fallback matches the `en` pack', () => {
  it('`repeater` — singular and plural, byte-equal to `en`', () => {
    expect(textOf(renderCell('repeater', rows(1), repeaterField).container)).toBe(
      (en as any).detail.repeaterItemCount_one.replace('{{count}}', '1'),
    );
    cleanup();
    expect(textOf(renderCell('repeater', rows(2), repeaterField).container)).toBe(
      (en as any).detail.repeaterItemCount_other.replace('{{count}}', '2'),
    );
  });

  it('`file` — singular and plural, byte-equal to `en`', () => {
    expect(textOf(renderCell('file', rows(1), fileField).container)).toBe(
      (en as any).detail.fileCount_one.replace('{{count}}', '1'),
    );
    cleanup();
    expect(textOf(renderCell('file', rows(2), fileField).container)).toBe(
      (en as any).detail.fileCount_other.replace('{{count}}', '2'),
    );
  });
});

/* -------------------------------------------------------------------------- */
/* Why the renderer had to leave the table literal.                             */
/* -------------------------------------------------------------------------- */

describe('objectui#8441 — the `repeater` entry is a STABLE component reference', () => {
  it('two resolutions return the same function object', () => {
    // `getCellRenderer` rebuilds `standardMap` per call, and both production
    // call sites resolve inside render. An inline arrow would be a fresh
    // component TYPE every render: React remounts the cell and tears down the
    // hook state — react-i18next's language subscription — with it. Identity is
    // the only observable that distinguishes the two shapes.
    expect(getCellRenderer('repeater')).toBe(getCellRenderer('repeater'));
  });

  it('control: the resolver really does rebuild its table each call', () => {
    // Without this, the pin above would also pass on a memoised resolver that
    // never rebuilt anything, and would then say nothing about the entry. The
    // `vector` entry is still an inline arrow — deliberately, it is fenced out
    // of this card and holds no hook — so it is the live proof of the rebuild.
    expect(getCellRenderer('vector')).not.toBe(getCellRenderer('vector'));
  });
});
