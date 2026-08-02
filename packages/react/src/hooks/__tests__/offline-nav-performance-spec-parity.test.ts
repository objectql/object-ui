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
 * against an installed spec of 17.0.0-rc.1.
 *
 * Five of the six colliding symbols are now the spec's bindings.
 * `ConflictResolutionStrategy` was renamed to the spec's OWN name for that union
 * (`ConflictResolution`), because the name it had belongs to a DIFFERENT spec
 * export. The sixth, `PerformanceConfig`, needed no fix at all: the spec retired
 * that name in 17.0.0-rc.1, so the collision ended on its own — pinned at the
 * bottom of this file, because "the spec dropped it" is a claim with an expiry
 * date.
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

import { useOffline } from '../useOffline';
import type {
  OfflineStrategy,
  ConflictResolution,
  OfflineCacheConfig,
  OfflineConfig,
  OfflineSyncConfig,
} from '../useOffline';
import type { NavigationConfig } from '../useNavigationOverlay';
import type { SpecAuthoredInput } from '../../spec-input';
import type {
  OfflineStrategy as SpecOfflineStrategy,
  ConflictResolution as SpecConflictResolution,
  OfflineCacheConfig as SpecOfflineCacheConfig,
  OfflineCacheConfigSchema,
  OfflineConfigSchema,
  NavigationConfigSchema,
  SyncConfigSchema,
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

/**
 * `PerformanceConfig` was the sixth symbol in this batch and needed NO fix: the
 * spec RETIRED `PerformanceConfigSchema` / `PerformanceConfig` from
 * `@objectstack/spec/ui` in 17.0.0-rc.1, so the collision is gone and the name
 * is objectui's own. Pinned because "the spec dropped it" is a claim with an
 * expiry date — if the spec re-adds the name, this fails and the symbol needs
 * triaging again rather than silently becoming a fork.
 */
describe('PerformanceConfig no longer collides — the spec retired the name', () => {
  it('the spec exports neither the type nor its schema', () => {
    for (const name of ['PerformanceConfig', 'PerformanceConfigSchema']) {
      expect(
        SPEC_NAMES.has(name),
        `@objectstack/spec exports \`${name}\` again. \`usePerformance\` declares its own ` +
          `\`PerformanceConfig\`, which is a fork the moment the spec owns the name. ` +
          `Re-triage it (objectstack#4115) — derive, rename, or ALLOW with a reason.`,
      ).toBe(false);
    }
  });
});

/**
 * `OfflineConfig` keeps the spec's name here, and that was a cross-package call:
 * `@object-ui/types` had an `OfflineConfig` too, but it turned out to be a
 * service-worker ROUTE cache and was renamed `PWAOfflineConfig` (objectui#3156).
 * This hook's config IS the spec's concept, key for key, so it takes the spec's
 * binding — a plain derivation, no dialect.
 */
describe('OfflineConfig and OfflineSyncConfig derive from the schema INPUT side', () => {
  it('is pinned at compile time', () => {
    type SpecOfflineInput = SpecAuthoredInput<typeof OfflineConfigSchema>;
    type SpecSyncInput = SpecAuthoredInput<typeof SyncConfigSchema>;
    type _SpecNotAny = Assert<Equal<IsAny<SpecOfflineInput>, false>>;
    type _SpecNotUnknown = Assert<Equal<IsUnknown<SpecOfflineInput>, false>>;

    type _IsTheSchemaInput = Assert<Equal<OfflineConfig, SpecOfflineInput>>;
    type _SyncIsTheSchemaInput = Assert<Equal<OfflineSyncConfig, SpecSyncInput>>;

    // Nothing invented, nothing dropped.
    type _NoLocalOnlyKeys = Assert<Equal<Exclude<keyof OfflineConfig, keyof SpecOfflineInput>, never>>;
    type _NoMissingKeys = Assert<Equal<Exclude<keyof SpecOfflineInput, keyof OfflineConfig>, never>>;

    expect(true).toBe(true);
  });

  /**
   * The concrete reason this is the input side: the hook's own signature is
   * `useOffline(config: OfflineConfig = {})`. `z.infer` would make `enabled`,
   * `strategy` and `offlineIndicator` required — i.e. would reject the default
   * the hook ships with. This is that check, written so it fails loudly rather
   * than as a puzzle about variance.
   */
  it('accepts the empty config the hook itself defaults to', () => {
    const empty: OfflineConfig = {};
    const authored: OfflineConfig = {
      enabled: true,
      strategy: 'cache_first',
      sync: { conflictResolution: 'last_write_wins' },
      cache: { ttl: 60 },
    };
    expect(useOffline).toBeTypeOf('function');
    expect([empty, authored]).toHaveLength(2);
  });
});
