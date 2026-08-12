/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The three ungated `createSafeTranslation` defaults maps mirror the `en` pack —
 * objectui#4401, generalizing objectui#3440's collaboration-only precedent.
 *
 * ## The defect this pins
 *
 * `createSafeTranslation(defaults, testKey)` serves `defaults[key]` when no
 * `I18nProvider` is mounted and i18next's `en` pack when one is. Each path looks
 * correct in isolation, so a row that disagrees with the pack renders TWO
 * different labels for one control and no test sees it: the provider-less label
 * on standalone embeds, the preview gallery and the owning package's own unit
 * tests, the pack's label in the console. #4401 measured exactly one such row
 * across these three maps — `detail.editFieldsInline`, `'Edit fields inline'` in
 * the map against `'Edit fields'` in the pack.
 *
 * ## Why nothing else catches it
 *
 * - `check:i18n-keys` judges inline `t(key, { defaultValue })` options at call
 *   sites; it never reads a `createSafeTranslation` table.
 * - `check:i18n-drift` compares pack against pack across commits, not map
 *   against pack.
 * - #3440's "the collaboration defaults map mirrors the en pack" is the repo's
 *   only mechanical map-vs-pack assertion and covers `COLLAB_DEFAULT_TRANSLATIONS`
 *   only.
 *
 * ## Why this file lives in app-shell
 *
 * It cannot live in `@object-ui/i18n`: every map's package depends on that one,
 * so importing a map back into it inverts the dependency — the reason
 * `gantt-count-interpolation-4157.test.ts` states for asserting `en` values as
 * literals rather than importing `plugin-gantt`. `app-shell` is the package that
 * depends on all three plugins AND on `@object-ui/i18n`, so it is where one suite
 * can compare all three without inverting anything, and it already hosts
 * cross-package parity gates (`spec-symbol-parity.test.ts`) and already imports
 * a defaults map through a plugin barrel
 * (`views/RecordDetailView.feedRecordScope.test.tsx`).
 *
 * ## Shape: per-key over the intersection, NOT a whole-map `toEqual`
 *
 * #3440 could compare a whole namespace because the collaboration map is a
 * namespace slice. These three are not: they borrow rows from other namespaces
 * (below), and a map is deliberately a SUBSET of its namespace — a pack key with
 * no map row is not a defect here (that is #4396's family, and its own gate).
 * So the comparison runs key by key over `map ∩ pack`.
 *
 * ## The graded exceptions, as measured on this tree — none of them exempts a row
 *
 * | claimed exception | measured | grade |
 * |---|---|---|
 * | borrowed rows (`common.*` in detail/designer, `table.*`/`grid.*`/`detail.*` in list) | all 9 resolve in the pack | compared like any other row — they ARE pack keys; exempting them would blind the gate to 9 of 372 rows |
 * | `detail.showEmptyRelated{,_one,_other}` suffixed rows | all three in pack, all three agree | compared, AND their key-set mirror is pinned separately (see below) |
 * | a map row whose key the pack lacks | 0 rows, all three maps | not an allowed state: it fails, naming itself a finding to file |
 *
 * The suffixed `showEmptyRelated` rows exist for a reason stated in
 * `useDetailTranslation.ts`: `fallbackT` resolves `defaults[key]` LITERALLY and
 * never appends a plural suffix, so only the BASE row is reachable through the
 * provider-less path — the two suffixed rows are kept purely so the map's key set
 * still mirrors the packs'. That rationale is a key-set claim, so the gate
 * enforces it as one, on top of comparing all three values.
 *
 * ## Direction, predicted before running (#4118)
 *
 * Restoring `detail.editFieldsInline` to `'Edit fields inline'` turns exactly one
 * case red — plugin-detail's byte-identity case, naming that key and no other.
 * The list and designer maps, both absence cases, both non-vacuity cases and the
 * exception cases stay green, because the drift is one row in one map.
 */

import { describe, it, expect } from 'vitest';
import { en } from '@object-ui/i18n';
import { DETAIL_DEFAULT_TRANSLATIONS } from '@object-ui/plugin-detail';
import { LIST_DEFAULT_TRANSLATIONS } from '@object-ui/plugin-list';
import { DESIGNER_DEFAULT_TRANSLATIONS } from '@object-ui/plugin-designer';

/** Resolve a dotted i18n key against a pack. Returns `undefined` at any miss. */
const packValueAt = (key: string): unknown =>
  key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], en);

/** Codepoints, so a failure distinguishes `…` from `...` and NBSP from a space. */
const codepoints = (s: string) => [...s].map((c) => c.codePointAt(0)).join(',');

interface MapUnderGate {
  /** Name used in test titles and failure messages. */
  readonly name: string;
  /** The exported table `createSafeTranslation` reads on the provider-less path. */
  readonly map: Record<string, string>;
  /** Where the rows live, so a failure says which file to edit. */
  readonly source: string;
  /**
   * Rows that must be present for this map's comparison to be about anything.
   * Non-vacuity per the #4118 family standard: a broken import or an emptied
   * table would otherwise pass every "for each row" assertion below.
   */
  readonly sentinels: readonly string[];
}

const MAPS: readonly MapUnderGate[] = [
  {
    name: 'plugin-detail DETAIL_DEFAULT_TRANSLATIONS',
    map: DETAIL_DEFAULT_TRANSLATIONS,
    source: 'packages/plugin-detail/src/useDetailTranslation.ts',
    // `editFieldsInline` is the row #4401 fixed — pinned so the gate cannot be
    // made vacuous by deleting the row it was written for.
    sentinels: ['detail.editFieldsInline', 'detail.back', 'common.resizeDrawer'],
  },
  {
    name: 'plugin-list LIST_DEFAULT_TRANSLATIONS',
    map: LIST_DEFAULT_TRANSLATIONS,
    source: 'packages/plugin-list/src/ListView.tsx',
    // `sortRelationalHint` is #4294's hand-pinned paragraph: the case that
    // motivated a gate, kept as a sentinel now that one exists.
    sentinels: ['list.sortRelationalHint', 'list.recordCount', 'table.search'],
  },
  {
    name: 'plugin-designer DESIGNER_DEFAULT_TRANSLATIONS',
    map: DESIGNER_DEFAULT_TRANSLATIONS,
    source: 'packages/plugin-designer/src/hooks/useDesignerTranslation.ts',
    sentinels: ['appDesigner.basicInfo', 'appDesigner.addWidget', 'common.delete'],
  },
];

describe('the plugin defaults maps mirror the en pack (objectui#4401)', () => {
  it('gates all three maps — guards the table from emptying', () => {
    expect(MAPS).toHaveLength(3);
    expect(MAPS.map((m) => m.name)).toEqual([
      'plugin-detail DETAIL_DEFAULT_TRANSLATIONS',
      'plugin-list LIST_DEFAULT_TRANSLATIONS',
      'plugin-designer DESIGNER_DEFAULT_TRANSLATIONS',
    ]);
  });

  describe.each(MAPS)('$name', ({ map, source, sentinels }) => {
    it('carries rows to compare, including the sentinels', () => {
      // Non-vacuity, #4118 family standard. Every assertion below iterates the
      // map, so an empty or unresolved import is green without this.
      expect(Object.keys(map).length).toBeGreaterThan(0);
      for (const key of sentinels) {
        expect(typeof map[key], `${source} lost its sentinel row ${key}`).toBe('string');
      }
    });

    it('every row names a key the en pack actually defines', () => {
      // Not an exception, a finding: a row whose key the pack lacks means the
      // provider path cannot serve this string at all (i18next answers with the
      // call site's `defaultValue`, or the raw key), so the two paths disagree by
      // construction. Measured 0 across all three maps when this gate landed —
      // if this goes red, file it rather than adding the key to an allow-list.
      const missing = Object.keys(map)
        .filter((key) => typeof packValueAt(key) !== 'string')
        .map((key) => `${key} (row in ${source}, absent from the en pack — FINDING, file it)`);

      expect(missing).toEqual([]);
    });

    it('every row that the pack also defines is byte-identical to it', () => {
      // THE gate. Per-key over `map ∩ pack`, never a whole-map `toEqual`: these
      // maps are deliberate subsets of their namespaces and borrow rows from
      // others, so equality of the whole table is a different (false) claim.
      const drifted: string[] = [];
      let compared = 0;

      for (const [key, mapValue] of Object.entries(map)) {
        const packValue = packValueAt(key);
        if (typeof packValue !== 'string') continue; // reported by the case above
        compared += 1;
        if (packValue !== mapValue) {
          drifted.push(
            `${key}\n  map  (${source}) = ${JSON.stringify(mapValue)} [${codepoints(mapValue)}]` +
              `\n  pack (en)          = ${JSON.stringify(packValue)} [${codepoints(packValue)}]`,
          );
        }
      }

      // The intersection is what this case asserts over, so it is what has to be
      // non-empty — `Object.keys(map).length > 0` above would not catch a pack
      // rename that emptied the intersection while leaving the rows in place.
      expect(compared, `no row of ${source} intersects the en pack`).toBeGreaterThan(0);
      expect(drifted).toEqual([]);
    });
  });

  it('the borrowed rows are compared, not exempted', () => {
    // The exception the card anticipated, graded: rows these maps borrow from
    // another namespace are pack keys like any other, so they are covered by the
    // comparison above rather than skipped. This case pins that they resolve —
    // the moment one does not, it becomes an absence finding rather than a
    // silently uncompared row. (`table.*` and `grid.*` in the list map are the
    // same borrowing as `common.*`, just from different namespaces.)
    const borrowed = [
      'common.resizeDrawer', // detail — shares NavigationOverlay's key by design
      'table.search',
      'table.rowsPerPage', // list
      'common.cancel',
      'common.back',
      'common.next',
      'common.close',
      'common.edit',
      'common.delete', // designer
    ];

    const unresolved = borrowed.filter((key) => typeof packValueAt(key) !== 'string');
    expect(unresolved, 'a borrowed row stopped resolving in the en pack').toEqual([]);

    // …and each one is genuinely a row of the map it is claimed for, so this
    // list cannot rot into a set of keys nobody borrows any more.
    const everyRow = new Set(MAPS.flatMap(({ map }) => Object.keys(map)));
    expect(borrowed.filter((key) => !everyRow.has(key))).toEqual([]);
  });

  it('the showEmptyRelated family keeps mirroring the packs’ key set', () => {
    // `useDetailTranslation.ts` keeps two rows it can never serve: `fallbackT`
    // indexes `defaults[key]` literally and never appends a plural suffix, so
    // only the base row is reachable without a provider (objectui#3863). Their
    // stated reason is that the map's key set still mirrors the packs' — a claim
    // about KEYS, pinned here as one. Their values are compared by the
    // byte-identity case above like every other row.
    for (const key of [
      'detail.showEmptyRelated',
      'detail.showEmptyRelated_one',
      'detail.showEmptyRelated_other',
    ]) {
      expect(typeof packValueAt(key), `en pack lost ${key}`).toBe('string');
      expect(
        typeof DETAIL_DEFAULT_TRANSLATIONS[key],
        `the detail map stopped mirroring ${key}`,
      ).toBe('string');
    }
  });
});
