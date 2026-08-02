/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * app-shell ↔ `@objectstack/spec` symbol-collision tripwires
 * (objectui#3157, objectstack#4115 burn-down batch 3).
 *
 * Twenty-eight app-shell symbols used to be declared under names the spec
 * already owns. Twenty were burned down by importing or deriving the spec's own
 * type (nineteen plain re-exports — `DecisionOutputDef` joined them once the
 * spec adopted `required`, objectstack#4562 — plus `ScreenSpec`, still derived
 * structurally with one documented divergence); eight were renamed because they
 * model something the spec's same-named export does not.
 *
 * One symbol is in both camps: the object designer's `FieldGroup` was renamed to
 * `ObjectFieldGroup` AND derived — the spec owns that exact shape, just under
 * the other name, while its `FieldGroup` is the Studio field-editor's group
 * config. Renaming to the spec's own name was the fix.
 *
 * A rename only stays a fix for as long as the new name is genuinely free. If
 * the spec later ships a `FlowDesignerNode`, this package would quietly be back
 * where it started — a local declaration under a spec export's name, read by
 * the next agent as the spec's own definition. These tests are that tripwire.
 *
 * ## Why the spec's names are read through the compiler, not `import * as`
 *
 * A runtime namespace import sees VALUES only, and almost every symbol in this
 * burn-down is a TYPE (`FieldInput`, `RuntimeConfig`, `ConversationSummary`, …).
 * A tripwire built on `Object.keys(await import('@objectstack/spec/ui'))` would
 * pass for every one of them while proving nothing — the same mistake the
 * guard's own header records having made in its first draft. So this reads each
 * subpath's `.d.ts` through the TypeScript checker, exactly as
 * `scripts/check-spec-symbol-derivation.mjs` does, and gets types and values
 * alike.
 *
 * ## What compiles the `type _X = Assert<…>` lines below (objectui#3181)
 *
 * Nothing did, for the first stretch of this file's life. `tsconfig.json` here
 * is the package BUILD config and excludes `**\/*.test.ts`; CI's only type gate
 * drives that config (`pnpm type-check` -> turbo -> per-package `tsc --noEmit`),
 * and types are erased before vitest ever runs. Appending a provably-false
 * `Assert<Equal<1, 2>>` to this file therefore passed `pnpm type-check` at exit
 * 0 — the type half of this "tripwire" was, literally, commentary. Which is the
 * same landmine this file's own header cites objectui#3009 for.
 *
 * They are now compiled by `packages/app-shell/tsconfig.typetests.json`, chained
 * from this package's `type-check` script, i.e. run by the CI `Type Check` job.
 * That project lists its files EXPLICITLY (app-shell's wider test tree still has
 * a pre-existing error backlog, tracked as TEST_DEBT), so **a new
 * type-assertion test file is unchecked until it is added to that include
 * list** — and `scripts/check-type-check-coverage.mjs` fails if the chaining is
 * ever dropped, so the gate cannot go quiet again the way it did here.
 */

import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

import { isAggregatedViewContainer } from '../views/metadata-admin/view-item-normalize';

import type { ScreenSpec } from '../views/ScreenView';
import type { DecisionOutputDef } from '../utils/decisionOutputParams';
import type { ObjectFieldGroup } from '../views/metadata-admin/previews/object-fields-io';
import type {
  ScreenSpec as SpecScreenSpec,
  ScreenFieldSpec as SpecScreenFieldSpec,
} from '@objectstack/spec/contracts';
import type { DecisionOutputDef as SpecDecisionOutputDef } from '@objectstack/spec/automation';

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

/**
 * Sanity: if this set came back empty (bad resolve, changed `exports` map), every
 * "the spec does not own X" assertion below would pass vacuously.
 */
describe('the spec export-name probe itself works', () => {
  it('reads a non-trivial number of names', () => {
    expect(SPEC_NAMES.size).toBeGreaterThan(1000);
  });

  it('sees TYPE-only exports, not just runtime values', () => {
    // `FieldInput` is `Omit<Partial<Field>, 'type'>` — invisible to `import()`.
    expect(SPEC_NAMES.has('FieldInput')).toBe(true);
  });
});

/**
 * The ten renames. Each entry is `[local dialect name, the spec name it used to
 * collide with]`, with a one-line note on what the spec's symbol actually means
 * — the thing the old name falsely claimed.
 */
const RENAMES: Array<[local: string, formerly: string, specMeaning: string]> = [
  ['ScreenFieldInput', 'FieldInput', "the authoring shape of an object FIELD (Omit<Partial<Field>, 'type'>)"],
  ['ConversationListItem', 'ConversationSummary', 'the AI context-COMPACTION record (keyPoints, tokensSaved, …)'],
  ['AppShellRuntimeConfig', 'RuntimeConfig', 'the ENGINE runtime config (engine, engineConfig, resourceLimits)'],
  ['PageHeaderComponentProps', 'PageHeaderProps', 'the AUTHORED SDUI page-header node schema (strings, action ids)'],
  ['FlowDesignerNode', 'FlowNode', 'a COMPLETE authored flow node (label required)'],
  ['FlowDesignerEdge', 'FlowEdge', 'a COMPLETE authored flow edge (id required, condition needs `dialect`)'],
  ['PackageManifestRow', 'PackageManifest', 'the full authored package manifest (~40 keys)'],
  ['InstalledPackageRow', 'InstalledPackage', 'the full install record (installedAt, upgradeHistory, …)'],
];

describe('renamed local dialects do not collide with a spec export', () => {
  it.each(RENAMES)('the spec does not own `%s`', (local) => {
    expect(
      SPEC_NAMES.has(local),
      `@objectstack/spec now exports \`${local}\`. This package declares its own ` +
        `\`${local}\`, so the rename that fixed objectstack#4115 has re-created the ` +
        `collision under the new name. Rename again (and check the new name here ` +
        `FIRST — objectui#3074 landed a rename onto another spec export exactly ` +
        `this way), or derive from the spec if the two really are the same thing.`,
    ).toBe(false);
  });

  /**
   * The other half of the ratchet. If the spec ever RETIRES the name that forced
   * a rename, the rename is no longer load-bearing and the local dialect can go
   * back to the natural name — this fails and says so, so the workaround cannot
   * outlive its reason.
   */
  it.each(RENAMES)('the spec still owns `%s` (second value: %s)', (_local, formerly) => {
    expect(
      SPEC_NAMES.has(formerly),
      `@objectstack/spec no longer exports \`${formerly}\`, which is the only ` +
        `reason this package renamed it. Either the spec dropped it (then take the ` +
        `plain name back) or it moved (then re-check what it means now).`,
    ).toBe(true);
  });
});

/**
 * `FlowCanvasNode` / `FlowCanvasEdge` are the names one would naturally reach for
 * when renaming the designer's node/edge types. They are already spec exports —
 * and they mean the pure VISUAL OVERLAY (`{ nodeId, x, y, collapsed, … }`), not
 * the node. Pinned so a future rename does not walk into them.
 */
describe('the obvious alternative flow names are already taken', () => {
  it.each(['FlowCanvasNode', 'FlowCanvasEdge'])('`%s` belongs to the spec', (name) => {
    expect(SPEC_NAMES.has(name)).toBe(true);
  });
});

/**
 * Re-exports must be the spec's own binding, not a copy that happens to agree.
 * Reference identity is the only check that can tell those apart — a faithful
 * copy passes every value comparison (objectui#3003).
 */
describe('re-exported values are the spec binding itself', () => {
  it('isAggregatedViewContainer IS the spec function', async () => {
    const spec = await import('@objectstack/spec');
    expect(isAggregatedViewContainer).toBe(spec.isAggregatedViewContainer);
  });

  it('still behaves as the metadata list needs', () => {
    expect(isAggregatedViewContainer({ list: {} })).toBe(true);
    expect(isAggregatedViewContainer({ listViews: {} })).toBe(true);
    // An already-expanded ViewItem carries the discriminant and is NOT a container.
    expect(isAggregatedViewContainer({ viewKind: 'list', list: {} })).toBe(false);
    expect(isAggregatedViewContainer({ name: 'x' })).toBe(false);
    expect(isAggregatedViewContainer(null)).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* Structural derivations — the three symbols that are neither a plain          */
/* re-export nor a rename. Each pins its ONE documented divergence, so the      */
/* divergence cannot silently grow and cannot silently outlive its reason.      */
/* -------------------------------------------------------------------------- */

/**
 * Compile-time assertions. A violation is a `tsc` error, not a runtime failure —
 * so it surfaces only under `tsconfig.typetests.json` (see the file header), not
 * under vitest.
 */
type Assert<T extends true> = T;
type Extends<A, B> = [A] extends [B] ? true : false;
type IsAny<T> = 0 extends 1 & T ? true : false;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false;

describe('ScreenSpec derives from the spec, widening only `fields`', () => {
  it('is pinned at compile time', () => {
    // Guard against the probe lying: if either side erased to `any`, every
    // assignability assertion below would pass while proving nothing
    // (objectstack#4171 is exactly that failure for other symbols).
    type _NotAny = Assert<Equal<IsAny<SpecScreenSpec>, false>>;
    type _LocalNotAny = Assert<Equal<IsAny<ScreenSpec>, false>>;

    // The spec's screen is always a valid local screen: widening only ever adds.
    type _SpecIsUsableHere = Assert<Extends<SpecScreenSpec, ScreenSpec>>;

    // …but not the reverse, and for exactly one reason: `fields` is optional
    // here. If this ever becomes `true`, the spec has made `fields` optional
    // itself and this alias should collapse to a plain re-export.
    type _StillWidened = Assert<Equal<Extends<ScreenSpec, SpecScreenSpec>, false>>;

    // The widening is confined to `fields` — every other key is the spec's.
    type _OnlyFieldsDiffers = Assert<
      Extends<Omit<ScreenSpec, 'fields'>, Omit<SpecScreenSpec, 'fields'>>
    >;
    type _FieldsIsSpecFields = Assert<
      Equal<NonNullable<ScreenSpec['fields']>, SpecScreenFieldSpec[]>
    >;

    // No key was invented locally, and none of the spec's was dropped.
    type _NoLocalOnlyKeys = Assert<Equal<Exclude<keyof ScreenSpec, keyof SpecScreenSpec>, never>>;
    type _NoMissingKeys = Assert<Equal<Exclude<keyof SpecScreenSpec, keyof ScreenSpec>, never>>;

    expect(true).toBe(true);
  });
});

describe('DecisionOutputDef is the spec type, with no local divergence left', () => {
  it('is pinned at compile time', () => {
    type _NotAny = Assert<Equal<IsAny<SpecDecisionOutputDef>, false>>;

    // Every spec decision output is usable here.
    type _SpecIsUsableHere = Assert<Extends<SpecDecisionOutputDef, DecisionOutputDef>>;

    // …and the reverse, because this is now a plain re-export rather than a
    // structural derivation. `required` used to be the ONE local addition; the
    // spec adopted it (cd6b9f202, pinned by objectstack#4561), so the interface
    // collapsed (objectstack#4562) and the exclusion set is empty. If a key ever
    // reappears here, this fails and the divergence has to be documented again.
    type _NoLocalAdditions = Assert<
      Equal<Exclude<keyof DecisionOutputDef, keyof SpecDecisionOutputDef>, never>
    >;
    type _IsExactlyTheSpecType = Assert<Equal<DecisionOutputDef, SpecDecisionOutputDef>>;

    // Deriving NARROWED `type` from the bare `string` this file used to declare
    // to the spec's closed enum — that narrowing is the point, so pin it.
    type _TypeIsClosed = Assert<
      Equal<DecisionOutputDef['type'], 'user' | 'department' | 'position' | 'team' | 'text' | undefined>
    >;

    expect(true).toBe(true);
  });
});

describe('ObjectFieldGroup derives from the spec schema INPUT side', () => {
  it('keeps `collapse` authorable (the z.input vs z.infer trap)', () => {
    // `collapse` carries `.default('none')`, so it is optional to AUTHOR and
    // required after parsing. This designer authors — `addGroup` emits
    // `{ key, label }` — so the output type would make its own new-group shape
    // unrepresentable. If this flips, someone swapped z.input for z.infer.
    type _CollapseOptional = Assert<Extends<{ key: string; label: string }, ObjectFieldGroup>>;

    // Still the real spec vocabulary, not a hand copy that merely agrees.
    type _HasSpecKeys = Assert<
      Extends<
        'key' | 'label' | 'icon' | 'description' | 'collapse' | 'collapsible' | 'collapsed' | 'defaultExpanded',
        keyof ObjectFieldGroup
      >
    >;
    type _NoInventedKeys = Assert<
      Equal<
        Exclude<
          keyof ObjectFieldGroup,
          'key' | 'label' | 'icon' | 'description' | 'collapse' | 'collapsible' | 'collapsed' | 'defaultExpanded'
        >,
        never
      >
    >;

    expect(true).toBe(true);
  });
});
