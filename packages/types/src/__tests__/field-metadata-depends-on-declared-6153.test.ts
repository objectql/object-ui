// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * objectui#6153, instance 1 — `dependsOn` is a DECLARED member of the
 * field-metadata face (maintainer ruling A, recorded on the card 2026-09-02,
 * verbatim 「同意」; it amends the 2026-09-01 ruling whose premise — that the
 * snake_case spelling was the declared one — was false on the spec side).
 *
 *   1. `BaseFieldMetadata.dependsOn?: FieldDependsOn`, where `FieldDependsOn`
 *      is DERIVED from `@objectstack/spec/data`'s `Field` — the spec's
 *      field-level cascade key, in the spec's shape: an array of controlling
 *      field names or `{ field, param }` entries. Every field type inherits it.
 *   2. The five reader widgets (`SelectField`, `MultiSelectField`, `RadioField`,
 *      `CheckboxesField`, `LookupField`) read it THROUGH the declared type; the
 *      `as any` the card measured at the read is gone.
 *   3. The fence the shape draws: a bare parent name is the FORM-level shape
 *      (`FormField.dependsOn` / the widget prop, both `DependsOnInput`), and the
 *      installed spec refuses it on a field document — so the metadata type
 *      refuses it too, rather than letting an author write metadata the publish
 *      door rejects.
 *   4. The ordering the ruling set up: `LookupField` keeps BOTH arms of its
 *      two-spelling read until objectui#7357 retires `depends_on`; both are
 *      declared today. That card, not this one, drops the snake_case arm.
 *
 * ## Why membership pins are type-level here
 *
 * Plain interfaces, no index signature, no zod mirror (`src/zod/` has no
 * field-types mirror, so no parity-ledger row moves) — an undeclared member read
 * is a compile error and `Equal` cannot be satisfied by an index-signature
 * fallback. The pins bite under `tsc -p tsconfig.test.json` (the package's
 * `type-check` chain), not under the vitest RUNTIME, which is why the runtime
 * half below pins the READ SITES (house form of
 * `undeclared-but-consumed-keys-6150.test.ts`) and the installed spec's answer.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { FieldSchema } from '@objectstack/spec/data';

import type {
  BaseFieldMetadata,
  FieldDependsOn,
  LookupFieldMetadata,
  SelectFieldMetadata,
} from '../field-types';
import type { DependsOnInput } from '../form';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..', '..');

/* ── Type-level helpers (invariant equality, house form) ─────────────────── */

type Equal< A, B > =
  (< T >() => T extends A ? 1 : 2) extends (< T >() => T extends B ? 1 : 2) ? true : false;
type Expect< T extends true > = T;

/* ── 1. The declared member, in the spec's shape ─────────────────────────── */

export type _DependsOnIsDeclaredInSpecShape = Expect< Equal< NonNullable< BaseFieldMetadata['dependsOn'] >, FieldDependsOn > >;
// The derived shape is exactly what the installed spec declares at field level
// (`z.array(z.union([z.string(), z.strictObject({ field, param? })]))`) — if a
// spec release widens or narrows it, this line moves with it and says so.
export type _SpecShapeIsArrayOfNameOrEntry = Expect< Equal< FieldDependsOn, Array< string | { field: string; param?: string | undefined } > > >;
// Inherited, not restated: the select and lookup faces carry the SAME member.
export type _SelectInherits = Expect< Equal< SelectFieldMetadata['dependsOn'], BaseFieldMetadata['dependsOn'] > >;
export type _LookupInherits = Expect< Equal< LookupFieldMetadata['dependsOn'], BaseFieldMetadata['dependsOn'] > >;

// Every runtime reader (`useCascadingOptions`, `resolveCascadingOptions`,
// `isOptionGroupGated`) takes `DependsOnInput`; the declared shape flows into
// it without a cast. Compiling at all is the assertion.
export const _readerAccepts: DependsOnInput = [] as FieldDependsOn;

/* ── 3. The fence: a bare parent name is not the field-level shape ───────── */

export const _bareStringRefusedAtTheType: SelectFieldMetadata = {
  type: 'select',
  name: 'province',
  // @ts-expect-error — `dependsOn: 'country'` is `FormField.dependsOn`'s shape; the spec's `FieldSchema` answers invalid_type to it on a field document (pinned at runtime below)
  dependsOn: 'country',
};

/* ── The authoring proof: annotated literals carry the key ───────────────── */
// These assignments are the excess-property check that FAILED before the
// declaration landed — an author (human or AI) could not legally write what the
// running widgets honoured. Compiling at all is the assertion. The literals are
// the ones `content/docs/fields/select.mdx` and `lookup.mdx` teach.

export const _selectWithDependsOn: SelectFieldMetadata = {
  type: 'select',
  name: 'province',
  label: 'Province',
  dependsOn: ['country'],
  options: [
    { label: 'Zhejiang', value: 'zj', visibleWhen: "record.country == 'cn'" },
    { label: 'California', value: 'ca', visibleWhen: "record.country == 'us'" },
  ],
};

export const _multiSelectWithDependsOn: SelectFieldMetadata = {
  ..._selectWithDependsOn,
  name: 'provinces',
  multiple: true,
};

export const _lookupWithDependsOnEntry: LookupFieldMetadata = {
  type: 'lookup',
  name: 'contact',
  label: 'Contact',
  reference_to: 'contacts',
  dependsOn: [{ field: 'account', param: 'account_id' }],
};

export const _lookupWithDependsOnShorthand: LookupFieldMetadata = {
  ..._lookupWithDependsOnEntry,
  dependsOn: ['account'],
};

/* ── 4. The ordering: the legacy twin is still declared until #7357 ──────── */
// objectui#7357 retires `depends_on` and deletes this literal in the same
// stroke — until then both spellings are declared, and `LookupField` reads both.

export const _legacyTwinStillDeclaredUntil7357: LookupFieldMetadata = {
  type: 'lookup',
  name: 'contact',
  reference_to: 'contacts',
  depends_on: ['account'],
};

/* ── The installed spec's answer (the two-control probe) ─────────────────── */

/** Pull the `unrecognized_keys` issue naming `key`, or undefined. */
function refusedByName(res: ReturnType<typeof FieldSchema.safeParse>, key: string) {
  if (res.success) return undefined;
  return res.error.issues.find(
    (i) => i.code === 'unrecognized_keys' && ((i as { keys?: string[] }).keys ?? []).includes(key),
  );
}

const provinceDocument = {
  name: 'province',
  type: 'select',
  label: 'Province',
  options: [{ label: 'Zhejiang', value: 'zj' }],
  dependsOn: ['country', { field: 'region', param: 'region_id' }],
};

describe('installed @objectstack/spec — the field-level `dependsOn` that FieldDependsOn derives', () => {
  it('control: a canonical select carrying both entry shapes draws NO issue', () => {
    expect(FieldSchema.safeParse(provinceDocument).success).toBe(true);
  });

  it('control: a bogus key on the same document is refused BY NAME — the door is strict', () => {
    const res = FieldSchema.safeParse({ ...provinceDocument, dependsOnBogusKey6153: true });
    expect(refusedByName(res, 'dependsOnBogusKey6153')).toBeDefined();
  });

  it('a bare parent name is refused as invalid_type at `dependsOn` — why the declared shape is array-only', () => {
    const res = FieldSchema.safeParse({ ...provinceDocument, dependsOn: 'country' });
    expect(res.success).toBe(false);
    if (res.success) return;
    expect(res.error.issues.some((i) => i.code === 'invalid_type' && i.path.join('.') === 'dependsOn')).toBe(true);
  });

  it('the legacy snake_case twin is refused BY NAME — it was never a spec key (objectui#7357 retires it)', () => {
    const { dependsOn, ...rest } = provinceDocument;
    void dependsOn;
    const res = FieldSchema.safeParse({ ...rest, depends_on: ['country'] });
    expect(refusedByName(res, 'depends_on')).toBeDefined();
  });
});

/* ── Read-site pins ──────────────────────────────────────────────────────── */

const OPTION_WIDGETS = [
  'packages/fields/src/widgets/SelectField.tsx',
  'packages/fields/src/widgets/MultiSelectField.tsx',
  'packages/fields/src/widgets/RadioField.tsx',
  'packages/fields/src/widgets/CheckboxesField.tsx',
] as const;

const readSites: Array<{ file: string; text: string; why: string }> = [
  ...OPTION_WIDGETS.map((file) => ({
    file,
    text: 'const dependsOn = field?.dependsOn ?? dependsOnProp;',
    why: 'the cascade key is read off the TYPED `field` prop (`BaseFieldMetadata.dependsOn`); metadata wins over the prop',
  })),
  {
    file: 'packages/fields/src/widgets/LookupField.tsx',
    text: 'const cascadeMeta: LookupFieldMetadata | undefined = fieldMeta;',
    why: 'the DECLARED carrier the lookup reads its cascade key through',
  },
  {
    file: 'packages/fields/src/widgets/LookupField.tsx',
    text: 'const raw = cascadeMeta?.depends_on ?? cascadeMeta?.dependsOn;',
    why: 'BOTH arms, through the declared type — objectui#7357 drops the snake_case one, not this card',
  },
];

describe('objectui#6153 — `dependsOn` read through the declared type at every reader', () => {
  describe.each(readSites.map((s) => [`${s.file} — ${s.why}`, s] as const))('%s', (_title, s) => {
    it('the read site still exists — the fact the declaration records', () => {
      const src = readFileSync(join(REPO_ROOT, s.file), 'utf8');
      expect(src, `${s.file} no longer contains \`${s.text}\``).toContain(s.text);
    });
  });

  it('no reader reaches `dependsOn` through an `as any` any more', () => {
    for (const file of [...OPTION_WIDGETS, 'packages/fields/src/widgets/LookupField.tsx']) {
      const src = readFileSync(join(REPO_ROOT, file), 'utf8');
      expect(src, `${file} launders the cascade key through a cast again`).not.toMatch(
        /as any\)\??\.dependsOn\b/,
      );
      expect(src, `${file} reads the cascade key off the untyped carrier again`).not.toMatch(
        /\bconfig\??\.dependsOn\b/,
      );
    }
  });
});
