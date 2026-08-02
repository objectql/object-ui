/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `@object-ui/react` ↔ `@objectstack/spec` symbol-collision guards
 * (objectui#3159, objectstack#4115 burn-down batch 5).
 *
 * `useOffline`, `useNavigationOverlay` and `usePerformance` each opened with a
 * comment claiming their types were "aligned with @objectstack/spec v2.0.7" —
 * against an installed spec of 17.0.0-rc.0. Five of the six colliding symbols
 * are now the spec's bindings; `ConflictResolutionStrategy` was renamed to the
 * spec's OWN name for that union (`ConflictResolution`), because the name it
 * had belongs to a different spec export.
 *
 * ## Two traps this batch had to walk around, pinned below
 *
 * 1. `ConflictResolutionStrategy` IS a spec export — in `@objectstack/spec/api`,
 *    where it means the metadata-MERGE policy (`error | priority | first-wins |
 *    last-wins`). Deriving under the old name would have produced a symbol whose
 *    name points at one union and whose value is another.
 * 2. These configs are AUTHORED, so they derive from each schema's input side.
 *    `z.infer` would make every `.default()`ed key required and quietly forbid
 *    the omissions the defaults exist for — the `_input`/`_output` trap the
 *    guard's header names and objectui#3169 hit for real.
 */

import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

import type {
  OfflineStrategy,
  ConflictResolution,
  OfflineCacheConfig,
  OfflineConfig,
} from '../useOffline';
import type { NavigationConfig } from '../useNavigationOverlay';
import type { PerformanceConfig, VirtualScrollConfig } from '../usePerformance';
import type { SpecAuthoredInput } from '../../spec-input';
import type {
  OfflineStrategy as SpecOfflineStrategy,
  ConflictResolution as SpecConflictResolution,
  OfflineCacheConfig as SpecOfflineCacheConfig,
  OfflineCacheConfigSchema,
  OfflineConfigSchema,
  NavigationConfigSchema,
  PerformanceConfigSchema,
} from '@objectstack/spec/ui';
import type { ConflictResolutionStrategy as SpecMergeConflictStrategy } from '@objectstack/spec/api';

/** Every name `@objectstack/spec` exports from any subpath — types AND values. */
function specExportNames(): Set<string> {
  const require = createRequire(import.meta.url);
  const pkgPath = require.resolve('@objectstack/spec/package.json');
  const pkgDir = dirname(pkgPath);
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
    exports?: Record<string, { import?: { types?: string }; require?: { types?: string } }>;
  };

  const files: string[] = [];
  for (const cond of Object.values(pkg.exports ?? {})) {
    if (typeof cond !== 'object' || cond === null) continue;
    const dts = cond.import?.types ?? cond.require?.types;
    if (dts) files.push(resolve(pkgDir, dts));
  }

  const program = ts.createProgram(files, {
    noEmit: true,
    skipLibCheck: true,
    strict: false,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
  });
  const checker = program.getTypeChecker();

  const names = new Set<string>();
  for (const file of files) {
    const sf = program.getSourceFile(file);
    if (!sf) continue;
    const moduleSymbol = checker.getSymbolAtLocation(sf);
    if (!moduleSymbol) continue;
    for (const exported of checker.getExportsOfModule(moduleSymbol)) names.add(exported.getName());
  }
  return names;
}

const SPEC_NAMES = specExportNames();

describe('the spec export-name probe itself works', () => {
  it('reads a non-trivial number of names', () => {
    expect(SPEC_NAMES.size).toBeGreaterThan(1000);
  });

  it('sees TYPE-only exports, not just runtime values', () => {
    // `OfflineCacheConfig` is a type alias — invisible to a runtime `import()`.
    expect(SPEC_NAMES.has('OfflineCacheConfig')).toBe(true);
  });
});

/**
 * The rename here is unusual: the local symbol did not move to a LOCAL dialect
 * name, it moved to the spec's own name for the union it always was. So the
 * ratchet is the other way round — `ConflictResolution` must stay a spec export
 * (it is a re-export), while the name it left must stay taken by something else.
 */
describe('the ConflictResolutionStrategy rename is load-bearing', () => {
  it('the spec owns `ConflictResolution` — this package re-exports it', () => {
    expect(SPEC_NAMES.has('ConflictResolution')).toBe(true);
  });

  it('`ConflictResolutionStrategy` is still a DIFFERENT spec export', () => {
    expect(
      SPEC_NAMES.has('ConflictResolutionStrategy'),
      '@objectstack/spec no longer exports `ConflictResolutionStrategy`. That collision ' +
        'is the only reason this hook stopped using the name. If the spec dropped it, the ' +
        'old name is free again — but check what it means now before taking it back.',
    ).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* Compile-time pins. A violation is a `tsc` error, not a runtime failure.      */
/* Checked by `tsconfig.spec-parity.json` at the repo root.                    */
/* -------------------------------------------------------------------------- */

type Assert<T extends true> = T;
type Extends<A, B> = [A] extends [B] ? true : false;
type IsAny<T> = 0 extends 1 & T ? true : false;
/** The `unknown` erasure the `any` probe reports `false` for (objectui#3155). */
type IsUnknown<T> = [unknown] extends [T] ? ([T] extends [unknown] ? true : false) : false;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false;

describe('the offline unions ARE the spec bindings', () => {
  it('is pinned at compile time', () => {
    type _StrategyNotAny = Assert<Equal<IsAny<SpecOfflineStrategy>, false>>;
    type _ResolutionNotAny = Assert<Equal<IsAny<SpecConflictResolution>, false>>;

    type _StrategyIsSpec = Assert<Equal<OfflineStrategy, SpecOfflineStrategy>>;
    type _ResolutionIsSpec = Assert<Equal<ConflictResolution, SpecConflictResolution>>;

    // The union this hook uses is NOT the one the old name pointed at. If these
    // ever became the same, the rename would no longer be load-bearing.
    type _NotTheMergePolicy = Assert<
      Equal<Equal<SpecConflictResolution, SpecMergeConflictStrategy>, false>
    >;
    type _NoOverlapAtAll = Assert<
      Equal<Extract<SpecConflictResolution, SpecMergeConflictStrategy>, never>
    >;

    expect(true).toBe(true);
  });

  it('still carries the five strategies the hook dispatches on', () => {
    const all: OfflineStrategy[] = [
      'cache_first',
      'network_first',
      'stale_while_revalidate',
      'network_only',
      'cache_only',
    ];
    expect(all).toHaveLength(5);
  });
});

describe('OfflineCacheConfig derives from the schema INPUT side', () => {
  it('keeps the defaulted keys authorable (the z.input vs z.infer trap)', () => {
    type _SpecNotAny = Assert<Equal<IsAny<SpecOfflineCacheConfig>, false>>;

    // `persistStorage` / `evictionPolicy` carry `.default()`, so the OUTPUT type
    // makes them required. Deriving from `z.infer` would forbid omitting them —
    // i.e. forbid using the defaults at all.
    type _OutputRequiresThem = Assert<
      Equal<undefined extends SpecOfflineCacheConfig['persistStorage'] ? true : false, false>
    >;
    type _WeKeepThemOptional = Assert<
      Equal<undefined extends OfflineCacheConfig['persistStorage'] ? true : false, true>
    >;

    // …while still being the spec's vocabulary, not a copy of the members.
    type _SameMembers = Assert<
      Equal<NonNullable<OfflineCacheConfig['persistStorage']>, SpecOfflineCacheConfig['persistStorage']>
    >;
    type _IsTheSchemaInput = Assert<
      Equal<OfflineCacheConfig, SpecAuthoredInput<typeof OfflineCacheConfigSchema>>
    >;

    expect(true).toBe(true);
  });
});

describe('NavigationConfig derives from the spec, requiring only `mode`', () => {
  it('is pinned at compile time', () => {
    type SpecNavigationInput = SpecAuthoredInput<typeof NavigationConfigSchema>;
    type _SpecNotAny = Assert<Equal<IsAny<SpecNavigationInput>, false>>;
    type _SpecNotUnknown = Assert<Equal<IsUnknown<SpecNavigationInput>, false>>;

    // Every local config is a valid authored spec config: narrowing only ever
    // removes `undefined`.
    type _LocalIsASpecConfig = Assert<Extends<NavigationConfig, SpecNavigationInput>>;

    // No key invented locally, none of the spec's dropped.
    type _NoLocalOnlyKeys = Assert<Equal<Exclude<keyof NavigationConfig, keyof SpecNavigationInput>, never>>;
    type _NoMissingKeys = Assert<Equal<Exclude<keyof SpecNavigationInput, keyof NavigationConfig>, never>>;

    // `mode` is the ONE narrowing, and it is required here. If the spec ever
    // makes `mode` required itself, `_StillNarrowed` fails and this alias
    // should collapse to `SpecAuthoredInput<typeof NavigationConfigSchema>`.
    type _ModeIsRequired = Assert<Equal<undefined extends NavigationConfig['mode'] ? true : false, false>>;
    type _StillNarrowed = Assert<Equal<Extends<SpecNavigationInput, NavigationConfig>, false>>;
    type _EverythingElseMatches = Assert<
      Extends<Omit<SpecNavigationInput, 'mode'>, Omit<NavigationConfig, 'mode'>>
    >;

    // The overlay buckets the hook maps to pixel widths are the spec's, and
    // `size` is the key #2578 added — the deprecated `width` is still here too.
    type _SizeIsSpecSize = Assert<Equal<NavigationConfig['size'], SpecNavigationInput['size']>>;
    type _WidthIsSpecWidth = Assert<Equal<NavigationConfig['width'], SpecNavigationInput['width']>>;

    expect(true).toBe(true);
  });

  it('still carries every overlay mode the hook switches on', () => {
    const all: NavigationConfig['mode'][] = [
      'page',
      'drawer',
      'modal',
      'split',
      'popover',
      'new_window',
      'none',
    ];
    expect(all).toHaveLength(7);
  });
});

describe('PerformanceConfig derives from the schema INPUT side', () => {
  it('is pinned at compile time', () => {
    type SpecPerformanceInput = SpecAuthoredInput<typeof PerformanceConfigSchema>;
    type _SpecNotAny = Assert<Equal<IsAny<SpecPerformanceInput>, false>>;

    type _IsTheSchemaInput = Assert<Equal<PerformanceConfig, SpecPerformanceInput>>;

    // `virtualScroll.enabled` is `.default()`ed — the reason this is the input
    // side and not `z.infer`. Authors write `{ virtualScroll: { itemHeight } }`.
    type _EnabledStaysOptional = Assert<
      Equal<undefined extends VirtualScrollConfig['enabled'] ? true : false, true>
    >;

    expect(true).toBe(true);
  });
});

/**
 * `OfflineConfig` is deliberately NOT burned down in this batch: `@object-ui/types`
 * declares its own, and that package is the repo's vocabulary root, so the name
 * is objectui#3156's call to make. It stays on the ledger until then. This pins
 * that the deferral is still real work — if the collision disappears on its own,
 * the ledger entry goes stale and the guard says so.
 */
describe('OfflineConfig is deferred to the types-package decision', () => {
  it('is still a local declaration under a spec name', () => {
    expect(SPEC_NAMES.has('OfflineConfig')).toBe(true);
  });

  it('its members are already spec bindings, so only the envelope is left', () => {
    type SpecOfflineInput = SpecAuthoredInput<typeof OfflineConfigSchema>;
    type _CacheIsSpec = Assert<Equal<OfflineConfig['cache'], SpecOfflineInput['cache']>>;
    type _StrategyIsSpec = Assert<Equal<OfflineConfig['strategy'], SpecOfflineInput['strategy']>>;
    expect(true).toBe(true);
  });
});
