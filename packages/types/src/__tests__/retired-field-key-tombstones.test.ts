/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#6527 — the retired-field-key tombstone registry's own pins.
 *
 * The registry replaced three independently maintained per-site literals
 * (`object-fields-io.ts`, `MetadataService.ts`, `MetadataFieldsPage.tsx`) that
 * had drifted. The sites derive their strip lists from it via
 * `retiredFieldKeysFor`, so what needs pinning HERE is the registry's own
 * contract — and above all the two decisions a naive union of the old lists
 * would have silently made in the wrong direction:
 *
 *   1. `formula` must NOT be stripped at the read door — RULED, objectui#6526
 *      option B (director seat, 2026-08-27): "keep the adjudicated migration
 *      path (objectui#6043) — do NOT strip `formula` at the read door."
 *      `ObjectFieldInspector` seeds its linting CEL editor from
 *      `def.expression ?? def.formula` and the first edit migrates the value;
 *      stripping on read empties that editor and destroys authored source.
 *   2. `sortOrder` has a recorded verdict, not a unioned entry: no shipped
 *      writer on this tree ever populated a field-level one (objectui#6045 —
 *      "the key never reached the wire"), so it stays a single-site DEFENSIVE
 *      strip and the registry says so in data.
 *
 * The per-site round-trip behaviour stays pinned where it always was, from the
 * consuming side: `object-fields-io.retiredKeys.test.ts` (the read door,
 * including `formula` and `sortOrder` carried through),
 * `MetadataService.fieldKeyCarryOver.test.ts` and the
 * `MetadataFieldsPage.retired*.test.tsx` / `specKey*.test.tsx` files (the
 * write doors, on captured PUT bytes). Those suites passing unchanged against
 * the derived lists is the consolidation's parity measurement.
 */

import { describe, expect, it } from 'vitest';
import { FieldSchema } from '@objectstack/spec/data';

import {
  RETIRED_FIELD_KEY_SITES,
  RETIRED_FIELD_KEY_TOMBSTONES,
  retiredFieldKeysFor,
  type RetiredFieldKey,
} from '../internal/retired-field-keys.js';
// The bare-specifier subpath, exercised the way the three real consuming
// sites reach the registry — objectui#6527 option B (maintainer ruling,
// 2026-08-28): the registry is DELIBERATELY off the package's main barrel.
import {
  RETIRED_FIELD_KEY_TOMBSTONES as fromSubpath,
  retiredFieldKeysFor as retiredFieldKeysForFromSubpath,
} from '@object-ui/types/internal/retired-field-keys';

/** An otherwise-green field — the positive control every probe rides on. */
const BASE_FIELD = { name: 'amount', type: 'number', label: 'Amount' } as const;

/**
 * A representative value per registry key, as the retiring card measured the
 * key on the wire. `Record<RetiredFieldKey, …>` makes adding a tombstone
 * without a probe value a compile error.
 */
const SAMPLE: Record<RetiredFieldKey, unknown> = {
  indexed: true,
  referenceTo: 'account',
  formula: 'price * quantity',
  isSystem: true,
  sortOrder: 3,
};

/**
 * A representative value per recorded `specEquivalent`, so the "the concept
 * lives HERE today" claim is probed against the installed schema rather than
 * trusted.
 */
const SPEC_EQUIVALENT_SAMPLE: Record<string, unknown> = {
  reference: 'account',
  system: true,
  expression: 'price * quantity',
};

describe('retired-field-key registry · membership criterion (the instrument)', () => {
  it('accepts the base field — the control that makes the refusals a result', () => {
    expect(FieldSchema.safeParse(BASE_FIELD).success).toBe(true);
  });

  it('every registry key is refused BY NAME by the installed FieldSchema', () => {
    // The membership criterion: stripping is safe exactly because the server
    // refuses to store these values. A key the schema ACCEPTS in this loop is
    // a registry entry that would make the strips delete authored metadata.
    for (const { key } of RETIRED_FIELD_KEY_TOMBSTONES) {
      const r = FieldSchema.safeParse({ ...BASE_FIELD, [key]: SAMPLE[key] });
      expect({ key, success: r.success }).toEqual({ key, success: false });
      expect(r.success ? [] : r.error.issues.map((i) => i.code)).toContain('unrecognized_keys');
    }
  });

  it('every recorded specEquivalent is a key the installed FieldSchema ACCEPTS', () => {
    // `specEquivalent` documents where the CONCEPT lives today. Recording a
    // spelling the schema refuses would send the next resolver to a dead key.
    for (const { key, specEquivalent } of RETIRED_FIELD_KEY_TOMBSTONES) {
      if (specEquivalent === null) continue;
      expect(specEquivalent in SPEC_EQUIVALENT_SAMPLE).toBe(true);
      const r = FieldSchema.safeParse({
        ...BASE_FIELD,
        [specEquivalent]: SPEC_EQUIVALENT_SAMPLE[specEquivalent],
      });
      expect({ key, specEquivalent, success: r.success }).toEqual({ key, specEquivalent, success: true });
    }
  });
});

describe('retired-field-key registry · the ruled asymmetry (objectui#6526, option B)', () => {
  it('⭐ `formula` is NOT applicable at the read door — the ruling made mechanical', () => {
    // Ruled 2026-08-27 on objectui#6526 (option B): the read door reads drafts
    // `ObjectFieldInspector`'s linting CEL editor also MIGRATES — it seeds
    // from `def.expression ?? def.formula`, the first edit commits
    // `expression` and clears the alias (objectui#6043), and the client-side
    // 422 diagnostic points the author at that editor (PR #6624). Flipping
    // this flag strips the draft before the editor sees it: the editor seeds
    // `""` and the authored expression text is destroyed on the next save.
    // This pin going red means someone is overturning a maintainer ruling —
    // that needs a new ruling, not a "consistency" edit.
    const formula = RETIRED_FIELD_KEY_TOMBSTONES.find((t) => t.key === 'formula');
    expect(formula?.sites).toEqual({
      metadataAdminFieldsReadDoor: false,
      metadataServiceCarryOver: true,
      metadataFieldsPageCarryOver: true,
    });
    expect(retiredFieldKeysFor('metadataAdminFieldsReadDoor')).not.toContain('formula');
  });

  it('`sortOrder` carries its recorded verdict: defensive, and at ONE site only', () => {
    // objectui#6045 measured that no shipped writer ever populated a
    // field-level `sortOrder`, so the entry is insurance, not a measured fix —
    // kept at `MetadataService`'s carry-over with the measurement recorded
    // (objectui#6527) rather than silently unioned into the other sites.
    // Red here means either the entry spread without evidence, or the verdict
    // was erased without recording a new one.
    const sortOrder = RETIRED_FIELD_KEY_TOMBSTONES.find((t) => t.key === 'sortOrder');
    expect(sortOrder?.defensive).toBe(true);
    expect(sortOrder?.sites).toEqual({
      metadataAdminFieldsReadDoor: false,
      metadataServiceCarryOver: true,
      metadataFieldsPageCarryOver: false,
    });
  });

  it('`sortOrder` is the ONLY defensive entry — every other strip is measured', () => {
    // Adding a defensive entry is a recorded decision, not a default. If this
    // list grows, the new entry's tombstone must carry its own verdict the way
    // `sortOrder`'s does.
    expect(RETIRED_FIELD_KEY_TOMBSTONES.filter((t) => t.defensive).map((t) => t.key)).toEqual([
      'sortOrder',
    ]);
  });
});

describe('retired-field-key registry · per-site parity with the pre-consolidation literals', () => {
  // objectui#6527 is a consolidation, so behaviour parity per site is the
  // claim. These are the three literals the sites carried before deriving from
  // the registry (re-taken on the merged ref at dispatch time). The read door
  // is also pinned from the consuming side in
  // `object-fields-io.retiredKeys.test.ts`; the write doors are pinned on
  // captured PUT bytes in their own suites.

  it('read door — exactly the objectui#6519 list, in the same order', () => {
    expect([...retiredFieldKeysFor('metadataAdminFieldsReadDoor')]).toEqual([
      'indexed',
      'referenceTo',
      'isSystem',
    ]);
  });

  it("MetadataService carry-over — exactly objectui#6488's five, in the same order", () => {
    expect([...retiredFieldKeysFor('metadataServiceCarryOver')]).toEqual([
      'indexed',
      'referenceTo',
      'formula',
      'isSystem',
      'sortOrder',
    ]);
  });

  it("MetadataFieldsPage carry-over — exactly its four; registry (retirement) order", () => {
    // The pre-consolidation literal read ['indexed', 'referenceTo',
    // 'isSystem', 'formula']; the derived list is the same SET in registry
    // order (formula's card objectui#6043 predates isSystem's objectui#6044).
    // The site's strip is a delete loop, so the set is the behaviour.
    expect([...retiredFieldKeysFor('metadataFieldsPageCarryOver')]).toEqual([
      'indexed',
      'referenceTo',
      'formula',
      'isSystem',
    ]);
  });
});

describe('retired-field-key registry · hygiene', () => {
  it('keys are unique', () => {
    const keys = RETIRED_FIELD_KEY_TOMBSTONES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every tombstone names its retiring card as `objectui#<n>`', () => {
    // The template-literal type enforces this at compile time for TS readers;
    // this runtime pin holds the same line for JS readers (the parity gate is
    // an .mjs script and the follow-up pins it on this registry).
    for (const { key, retiredBy } of RETIRED_FIELD_KEY_TOMBSTONES) {
      expect({ key, ok: /^objectui#\d+$/.test(retiredBy) }).toEqual({ key, ok: true });
    }
  });

  it('every tombstone answers every site — no column is left implicit', () => {
    for (const { key, sites } of RETIRED_FIELD_KEY_TOMBSTONES) {
      expect({ key, sites: Object.keys(sites).sort() }).toEqual({
        key,
        sites: [...RETIRED_FIELD_KEY_SITES].sort(),
      });
    }
  });

  it('every tombstone applies at at least one site — no dead entries', () => {
    for (const { key, sites } of RETIRED_FIELD_KEY_TOMBSTONES) {
      expect({ key, applied: Object.values(sites).some(Boolean) }).toEqual({
        key,
        applied: true,
      });
    }
  });

  it('the registry and its derivation are exported from the dedicated internal subpath', () => {
    // The three strip sites import `@object-ui/types/internal/retired-field-keys`
    // directly; a registry whose wiring fell off that subpath would break them
    // at build time, but this pin makes the wiring a stated fact rather than
    // an accident.
    expect(fromSubpath).toBe(RETIRED_FIELD_KEY_TOMBSTONES);
    expect(retiredFieldKeysForFromSubpath).toBe(retiredFieldKeysFor);
  });

  it('the registry is NOT exported from the main package barrel', async () => {
    // objectui#6527 option B (maintainer ruling, 2026-08-28): the registry was
    // deliberately un-exported from `@object-ui/types`'s main barrel. Importing
    // that barrel eagerly evaluates every other module it re-exports —
    // including `spec-report.ts`'s read of `@objectstack/spec/ui` — which is
    // what widened an unrelated consumer's partial spec mock into a failed
    // suite under the prior (option A) shape. This pin guards the regression:
    // re-adding the re-export to `index.ts` turns it red.
    // Type-only exports (`RetiredFieldKeySite` etc.) erase at runtime and
    // cannot be probed this way; the compile-time half of this guard is the
    // three consuming sites' own subpath imports failing to typecheck if the
    // subpath's types ever moved, which is not this pin's job to duplicate.
    const barrel: Record<string, unknown> = await import('../index.js');
    expect('RETIRED_FIELD_KEY_TOMBSTONES' in barrel).toBe(false);
    expect('retiredFieldKeysFor' in barrel).toBe(false);
  });
});
