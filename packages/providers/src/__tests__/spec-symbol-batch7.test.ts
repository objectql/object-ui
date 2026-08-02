/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `@object-ui/providers` ↔ `@objectstack/spec` symbol-collision guard
 * (objectui#3161, objectstack#4115 ledger batch 7).
 *
 * `Theme` → `ThemePreference`, derived from the spec's `ThemeMode` plus the one
 * legacy spelling this provider still honours.
 *
 * The triage note on objectstack#4115 asked whether this `Theme` was the parsed
 * runtime theme or the authored JSON. It was neither: it was
 * `Theme['mode']` wearing `Theme`'s name — a string union standing where the
 * spec has a whole document (`name`, `label`, `colors`, `typography`, …). That
 * is the more misleading of the two failure shapes, because a session reading
 * it would conclude an ObjectStack theme IS a string. `ThemeMode`, the spec's
 * own name for what this really is, could not be taken either: the spec exports
 * that too (the objectui#3169 rule — run the candidate past the guard first),
 * and `'system'` would have made it a lie anyway.
 */

import { describe, it, expect } from 'vitest';
import { ThemeModeSchema } from '@objectstack/spec/ui';
import type { Theme as SpecTheme, ThemeModeSchema as SpecThemeModeSchema } from '@objectstack/spec/ui';

import type { ThemePreference } from '../types';

const specModes = (ThemeModeSchema as unknown as { options: readonly string[] }).options;

describe("'system' is this package's own legacy spelling, not the spec's", () => {
  it('reads a non-empty mode enum from the spec (the probe is not vacuous)', () => {
    expect(Array.isArray(specModes) && specModes.length > 0).toBe(true);
  });

  it('the spec never declared `system` — it spells the OS-following mode `auto`', () => {
    expect(specModes).toContain('auto');
    expect(
      specModes.includes('system'),
      "the spec now declares `system` too — drop the extra union member in types.ts, it is no longer a local alias",
    ).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* Compile-time pins — compiled by tsconfig.test.json, chained off type-check. */
/* -------------------------------------------------------------------------- */

type Assert<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type IsAny<T> = 0 extends 1 & T ? true : false;
type HasKey<T, K extends string> = K extends keyof T ? true : false;

type SpecThemeMode = (typeof SpecThemeModeSchema)['_zod']['input'];

describe('ThemePreference is the spec mode vocabulary plus one legacy member', () => {
  it('is pinned at compile time', () => {
    // Load-bearing import: if the spec retires `Theme`, this stops compiling
    // and the rename is up for re-triage.
    type _SpecIsReal = Assert<Equal<IsAny<SpecTheme>, false>>;

    // The spec's `Theme` is a DOCUMENT — that is the whole reason this union
    // could not keep the name.
    type _SpecThemeIsADocument = Assert<HasKey<SpecTheme, 'colors'>>;
    type _AndItHasAModeOfItsOwn = Assert<HasKey<SpecTheme, 'mode'>>;

    // …and this is exactly that mode, plus `system`. Derived, so a mode the
    // spec adds appears here (and `ThemeProvider`'s branch must handle it —
    // `theme-mode-spec-parity.test.tsx` fails at runtime if it does not).
    type _IsTheSpecModePlusLegacy = Assert<Equal<ThemePreference, SpecThemeMode | 'system'>>;
    type _NothingElseIsLocal = Assert<Equal<Exclude<ThemePreference, SpecThemeMode>, 'system'>>;

    expect(true).toBe(true);
  });
});
