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
 * They are now compiled by `packages/app-shell/tsconfig.test.json`, chained from
 * this package's `type-check` script (`tsc --noEmit && tsc -p tsconfig.test.json`),
 * i.e. run by the CI `Type Check` job. That project takes the whole test tree by
 * GLOB — `src/**\/*.test.ts` and `src/**\/*.test.tsx` — so **a new type-assertion
 * test file under `src/` is checked from the moment it is written**, with nothing
 * to register anywhere.
 *
 * That last sentence used to say the opposite, and the opposite used to be true:
 * a narrow `tsconfig.typetests.json` named its files one at a time while the rest
 * of this tree sat in TEST_DEBT, and a file was decoration until someone added it
 * to that list. The package graduated in objectui#4040 and the narrow project was
 * retired with it (objectui#4291 retired the last of them repo-wide; the debt
 * table is now empty). `scripts/check-type-check-coverage.mjs` fails if the
 * chaining is ever dropped, so the gate cannot go quiet again the way it did here.
 */

import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

import { isAggregatedViewContainer } from '../views/metadata-admin/view-item-normalize';

import { FlowNodeSchema } from '@objectstack/spec/automation';

import type { ScreenSpec } from '../views/ScreenView';
import type { DecisionOutputDef } from '../utils/decisionOutputParams';
import type { ObjectFieldGroup } from '../views/metadata-admin/previews/object-fields-io';
import type {
  FlowNodePosition,
  FlowDesignerNode,
} from '../views/metadata-admin/previews/flow-canvas-layout';
import type {
  ScreenSpec as SpecScreenSpec,
  ScreenFieldSpec as SpecScreenFieldSpec,
} from '@objectstack/spec/contracts';
import type {
  DecisionOutputDef as SpecDecisionOutputDef,
  FlowNode as SpecFlowNode,
  FlowNodeParsed as SpecFlowNodeParsed,
} from '@objectstack/spec/automation';

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
 * The renames. Each entry is `[local dialect name, the spec name it used to
 * collide with]`, with a one-line note on what the spec's symbol actually means
 * — the thing the old name falsely claimed.
 *
 * Split in two by WHEN the spec took the name (objectui#4650): this table holds
 * the names the PINNED spec already owns, `RENAMES_PENDING_GA` below holds the
 * ones 17.0.0 GA introduces. Both halves get the "does not collide" ratchet; the
 * "spec still owns it" ratchet cannot run against a pre-GA pin, so it arms
 * itself when the pin is raised.
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

/**
 * Renames forced by a name `@objectstack/spec` starts owning in **17.0.0 GA**,
 * which this repo is not pinned to yet (`^17.0.0-rc.6`; #4636 / PR #4639 raises
 * it). They are listed apart because the second ratchet below — "the spec still
 * owns the old name" — is FALSE against the pinned rc and true against GA, so
 * running it unconditionally would fail today's `main` over a rename that is
 * exactly what makes the GA tree green (`check:spec-symbols`, objectui#4650).
 *
 * `SECRET_MASK` is the one case here where the spec's symbol and this package's
 * are the SAME thing rather than two layers under one word: the protocol moved
 * the ADR-0100 credential mask into `spec` (objectstack#7572) so its two readers
 * stop each declaring a byte-identical literal. The doctrine's preferred arm is
 * therefore to IMPORT it, and this rename is the pre-bump stand-in — see the
 * declaration in `views/metadata-admin/widgets.tsx`, which carries the one-line
 * burn-down. Nothing published breaks either way: the constant is not re-exported
 * from this package's barrel.
 */
const RENAMES_PENDING_GA: Array<[local: string, formerly: string, specMeaning: string]> = [
  [
    'OBJECTUI_SECRET_MASK',
    'SECRET_MASK',
    'the ADR-0100 credential read mask — the same eight-bullet constant, in `@objectstack/spec/data`',
  ],
];

/**
 * Is the installed spec a pre-release? Read from the package the tests actually
 * resolve, not from a range in `package.json`: the range is what we asked for,
 * this is what is on disk, and only the second one decides what the ratchet
 * below can see.
 */
const SPEC_IS_PRERELEASE = ((): boolean => {
  const require = createRequire(import.meta.url);
  const { version } = JSON.parse(
    readFileSync(require.resolve('@objectstack/spec/package.json'), 'utf8'),
  ) as { version: string };
  return version.includes('-');
})();

describe('renamed local dialects do not collide with a spec export', () => {
  it.each([...RENAMES, ...RENAMES_PENDING_GA])('the spec does not own `%s`', (local) => {
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

  /**
   * The same ratchet for the GA-introduced names, armed by the pin rather than
   * skipped forever: it is inert while the installed spec is a pre-release and
   * asserts the moment #4636 lands. Written as a runtime branch rather than
   * `it.skipIf` so the pre-GA half still says out loud which mode it ran in.
   */
  it.each(RENAMES_PENDING_GA)(
    'the spec owns `%s` once the pin reaches GA (second value: %s)',
    (_local, formerly) => {
      if (SPEC_IS_PRERELEASE) {
        expect(
          SPEC_NAMES.size,
          'the spec export probe came back empty, so this branch proves nothing',
        ).toBeGreaterThan(1000);
        return;
      }
      expect(
        SPEC_NAMES.has(formerly),
        `@objectstack/spec no longer exports \`${formerly}\`, which is the only ` +
          `reason this package renamed it. Either the spec dropped it (then take ` +
          `the plain name back) or it moved (then re-check what it means now).`,
      ).toBe(true);
    },
  );
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
/* Structural derivations — the symbols that are neither a plain re-export nor  */
/* a rename. Each pins its ONE documented divergence, so the divergence cannot  */
/* silently grow and cannot silently outlive its reason. `FlowNodePosition`     */
/* (objectui#3172) pins the opposite: a derivation with NO divergence at all.   */
/* -------------------------------------------------------------------------- */

/**
 * Compile-time assertions. A violation is a `tsc` error, not a runtime failure —
 * so it surfaces only under `tsconfig.test.json` (see the file header), not
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

/**
 * The flow designer's node GEOMETRY is the spec's `FlowNode.position`, taken by
 * reference (objectui#3172). This is the positive half of the pin above: the
 * canvas's node type is deliberately NOT the spec's node (it holds mid-edit
 * state the spec cannot represent), but its geometry has no such excuse — it is
 * the same object, so it is the same type.
 *
 * The runtime half asserts what makes this a behaviour fix and not a rename: the
 * spec's node schema is `.strict()`, so the designer's retired `ui: { x, y }`
 * spelling is REJECTED (`unrecognized_keys` in the live client validation, 422
 * on save). If that ever stops being true, the migration in
 * `withCanonicalGeometry` is no longer load-bearing and should be re-argued.
 */
describe('flow node geometry IS the spec `FlowNode.position` (#3172)', () => {
  it('is pinned at compile time', () => {
    type _NotAny = Assert<Equal<IsAny<SpecFlowNode>, false>>;
    type _LocalNotAny = Assert<Equal<IsAny<FlowNodePosition>, false>>;

    // The local geometry type IS the spec's `position`, not a copy that agrees.
    type _IsSpecPosition = Assert<Equal<FlowNodePosition, NonNullable<SpecFlowNode['position']>>>;
    // `position` carries no `.default()`, so authoring and parsed agree — the
    // z.input/z.infer trap that bites `ObjectFieldGroup` cannot bite here.
    type _InputEqualsParsed = Assert<
      Equal<NonNullable<SpecFlowNode['position']>, NonNullable<SpecFlowNodeParsed['position']>>
    >;
    // Both coordinates required: a half-position is not representable.
    type _BothRequired = Assert<Equal<FlowNodePosition, { x: number; y: number }>>;
    type _HalfIsNotAPosition = Assert<Equal<Extends<{ x: number }, FlowNodePosition>, false>>;

    // …and the designer's node carries exactly that key, optional exactly as the
    // spec's is (an un-dragged node is auto-laid, in both vocabularies).
    type _NodeCarriesSpecPosition = Assert<
      Equal<FlowDesignerNode['position'], SpecFlowNode['position']>
    >;

    expect(true).toBe(true);
  });

  it('the spec still spells it `position` with both coordinates required', () => {
    const base = { id: 'n1', type: 'script', label: 'Do the thing' };
    expect(FlowNodeSchema.safeParse({ ...base, position: { x: 12, y: 34 } }).success).toBe(true);
    expect(FlowNodeSchema.safeParse({ ...base, position: { x: 12 } }).success).toBe(false);
    // No position at all is fine — the designer auto-lays those out.
    expect(FlowNodeSchema.safeParse(base).success).toBe(true);
  });

  it('the spec REJECTS the designer’s retired `ui` spelling (the 422 gate)', () => {
    const parsed = FlowNodeSchema.safeParse({
      id: 'n1',
      type: 'script',
      label: 'Do the thing',
      ui: { x: 12, y: 34 },
    });
    expect(parsed.success).toBe(false);
    expect(JSON.stringify(parsed.error?.issues)).toContain('unrecognized_keys');
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
        'key' | 'label' | 'icon' | 'description' | 'visibleWhen' | 'collapse' | 'collapsible' | 'collapsed' | 'defaultExpanded',
        keyof ObjectFieldGroup
      >
    >;
    type _NoInventedKeys = Assert<
      Equal<
        Exclude<
          keyof ObjectFieldGroup,
          'key' | 'label' | 'icon' | 'description' | 'visibleWhen' | 'collapse' | 'collapsible' | 'collapsed' | 'defaultExpanded'
        >,
        never
      >
    >;

    expect(true).toBe(true);
  });
});
