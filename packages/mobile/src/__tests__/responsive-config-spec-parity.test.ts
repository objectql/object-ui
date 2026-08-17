/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `@object-ui/mobile`'s `SpecResponsiveConfig` IS the schema's type (objectui#4598).
 *
 * The card: `useResponsiveConfig.ts` hand-declared an interface over the four
 * responsive keys, renamed off the schema's own symbol (`ResponsiveConfig` →
 * `SpecResponsiveConfig`), under a comment saying it mirrored
 * `ResponsiveConfigSchema`. Nothing tied the two together — no import, no
 * `z.infer`, no compile-time reference of any kind. It AGREED key-for-key when
 * it was filed, which is the whole point: the agreement was maintained by
 * nobody and checked by nothing, and the comment already told the next session
 * the copy was canonical. `ViewNavigationConfig` (objectui#4588) read exactly
 * like that until it had drifted on `mode`.
 *
 * The fix re-exports the type from `@object-ui/types` — this package's only
 * runtime dependency, which publishes it imported straight from
 * `@objectstack/spec/ui` — so no new dependency edge was needed and the
 * published name did not move.
 *
 * ── Why this file exists, given the fix is a re-export ──────────────────────
 *
 * `scripts/check-spec-symbol-derivation.mjs` stops reporting the declaration
 * because after the fix there is no declaration: rule 2 collects type aliases,
 * interfaces, enums and variables, and a bare `export type { … }` is none of
 * those. That is the right outcome — the hand copy is gone — but the gate got
 * there by seeing nothing, not by following the chain. It cannot: the binding
 * now runs mobile → `@object-ui/types` → `@objectstack/spec/ui`, and the gate
 * reads one package at a time.
 *
 * So the middle link is the part no gate covers, and it is the only place this
 * fix can still rot: if `@object-ui/types` ever replaces its re-export with a
 * hand copy of its own, mobile inherits the copy silently and every check in
 * the repo stays green. The assertions below are written against
 * `@objectstack/spec/ui` DIRECTLY for that reason — pinning against
 * `@object-ui/types` would compare the import to itself and pass no matter what
 * either package did.
 *
 * The type-level half runs under `tsc -p tsconfig.test.json` (this package's
 * `type-check`), so a re-grown copy fails the build rather than waiting for a
 * reviewer. `@objectstack/spec` is a devDependency here — a test may import it;
 * the published `.d.ts` may not, which is why the source re-exports through
 * `@object-ui/types` instead of reaching for the spec directly.
 */

import { describe, it, expect } from 'vitest';
import { ResponsiveConfigSchema, type ResponsiveConfig } from '@objectstack/spec/ui';
import type { SpecResponsiveConfig } from '../index';

/* ── Type-level helpers ──────────────────────────────────────────────────── */

/**
 * Invariant equality. `extends` in one direction — or a `satisfies` check —
 * would accept a NARROWING, so a copy that quietly dropped `order` would still
 * pass. That is the exact drift this card is about, so the pin has to be
 * invariant to say anything at all.
 */
type Equal< A, B > =
  (< T >() => T extends A ? 1 : 2) extends (< T >() => T extends B ? 1 : 2) ? true : false;
type Expect< T extends true > = T;

/* ── The binding itself ──────────────────────────────────────────────────── */

/**
 * The whole card in one line: what `@object-ui/mobile` publishes under
 * `SpecResponsiveConfig` and what the schema declares are ONE type. Red on the
 * day any link in mobile → `@object-ui/types` → `@objectstack/spec/ui` is
 * replaced by a copy, however byte-identical it starts out.
 */
type _IsExactlyTheSchemaType = Expect< Equal< SpecResponsiveConfig, ResponsiveConfig > >;

/**
 * The four keys `ResponsiveConfigSchema` declares. Adding one here to make a
 * local read compile is the defect rather than the fix: the key has to exist in
 * the schema first, or the platform refuses metadata that declares it.
 */
type SchemaDeclaredKeys = 'breakpoint' | 'hiddenOn' | 'columns' | 'order';

type _KeysAreExactlyTheSchemaFour = Expect< Equal< keyof SpecResponsiveConfig, SchemaDeclaredKeys > >;

/** Every key is optional on the authoring side — none of the four is required. */
type _AllFourAreOptional = Expect<
  Equal< SpecResponsiveConfig, Partial< SpecResponsiveConfig > >
>;

/**
 * The breakpoint vocabulary is the schema's six, reached through the same
 * chain. `NonNullable` keeps this pointed at which names exist rather than at
 * the `| undefined` the optionality puts there on purpose.
 */
type _BreakpointVocabularyIsTheSchemaSix = Expect<
  Equal<
    NonNullable< SpecResponsiveConfig['breakpoint'] >,
    'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  >
>;

/* ── Runtime half ────────────────────────────────────────────────────────── */

// The type-level assertions above are erased before anything runs, so the
// checks below re-ask the same questions of the schema VALUE. Without them this
// file could keep compiling while the runtime contract moved underneath it.
describe('SpecResponsiveConfig is the spec responsive config (objectui#4598)', () => {
  const schemaKeys = Object.keys(ResponsiveConfigSchema.shape).sort();

  it('reads the four declared keys off the schema itself', () => {
    expect(schemaKeys, 'could not read ResponsiveConfigSchema.shape').toEqual(
      ['breakpoint', 'columns', 'hiddenOn', 'order'],
    );
  });

  it('accepts a fully-populated config, and the schema agrees', () => {
    const full: SpecResponsiveConfig = {
      breakpoint: 'md',
      hiddenOn: ['xs', 'sm'],
      columns: { xs: 12, sm: 6, lg: 4 },
      order: { xs: 2, lg: 1 },
    };

    expect(Object.keys(full).sort()).toEqual(schemaKeys);
    expect(ResponsiveConfigSchema.parse(full)).toEqual(full);
  });

  it('accepts the empty config — every key is optional', () => {
    const empty: SpecResponsiveConfig = {};
    expect(ResponsiveConfigSchema.parse(empty)).toEqual({});
  });

  it('carries `2xl`, the breakpoint a five-name copy would be missing', () => {
    const widest: SpecResponsiveConfig = { breakpoint: '2xl', columns: { '2xl': 3 } };
    expect(ResponsiveConfigSchema.parse(widest)).toEqual(widest);
  });

  it('refuses a breakpoint outside the schema enum', () => {
    const bad: SpecResponsiveConfig = {
      // @ts-expect-error 'xxl' is not one of the six declared breakpoint names
      breakpoint: 'xxl',
    };
    expect(() => ResponsiveConfigSchema.parse(bad)).toThrow();
  });

  it('refuses a key the schema does not declare', () => {
    const bad: SpecResponsiveConfig = {
      breakpoint: 'lg',
      // @ts-expect-error `visibleOn` is not a declared responsive key
      visibleOn: ['xs'],
    };
    // The schema is strict, so the undeclared key is a runtime rejection too —
    // the type and the schema refuse the same authored metadata.
    expect(() => ResponsiveConfigSchema.parse(bad)).toThrow();
  });
});
