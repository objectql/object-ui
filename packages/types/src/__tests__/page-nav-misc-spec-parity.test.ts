/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Page / navigation / misc cluster ↔ `@objectstack/spec` drift guard
 * (objectui#3156, objectstack#4115).
 *
 * The sixteen collisions of ledger batch 2 resolved two ways, so this file has
 * two kinds of test:
 *
 *  - **Derived** (`ActionParam`, `CreateExportJobRequest`,
 *    `CreateExportJobResult`, `ImportRowResult`, `NavigationArea`,
 *    `NavigationAreaSchema`, `Theme`): the spec now supplies the keys, so the
 *    risk is no longer drift but a divergence outliving its reason, or a local
 *    key quietly reclaiming a name the spec owns. Asserted in both directions.
 *  - **Renamed** (`FileMetadata`, `GestureConfig`, `GestureType`,
 *    `OfflineConfig`, `PageRegion`, `PageRegionSchema`, `ResponsiveConfig`,
 *    `WidgetManifest`, `WidgetSource`): nine genuine coincidences — same word,
 *    different concept. The risk is picking a new name the spec ALREADY owns
 *    (the `PageComponentSchema` mistake of objectui#3074, which recurred three
 *    times in objectui#3169), so every new name is asserted absent from the
 *    spec's export set, and every OLD name asserted still present — a rename
 *    whose reason has evaporated should give the natural name back.
 *
 * Two of those nine have since been given back: `GestureType` and
 * `GestureConfig` were reclaimed in objectui#3363 after objectstack#4988
 * deleted `ui/touch`. A third, `OfflineConfig`, was vacated by the spec too but
 * deliberately NOT reclaimed — `@object-ui/react` owns that name in-repo, and
 * that reason is pinned below rather than left as prose.
 *
 * Type-level assertions here are real gates: `tsconfig.test.json` compiles this
 * file, unlike the package build (see its header for why that distinction was
 * itself a bug once).
 */

import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import type { z } from 'zod';
import { NavigationAreaSchema as SpecNavigationAreaSchema } from '@objectstack/spec/ui';
import type {
  ActionParamSchema as SpecActionParamSchema,
  I18nLabel as SpecI18nLabel,
  NavigationArea as SpecNavigationArea,
  Theme as SpecTheme,
  ThemeInput as SpecThemeInput,
} from '@objectstack/spec/ui';
import { NavigationAreaSchema } from '../zod/app.zod.js';
import type { NavigationArea, NavigationItem } from '../app.js';
import type { ActionParam } from '../ui-action.js';
import type { CreateExportJobRequest, CreateExportJobResult, ImportRowResult } from '../data.js';
import type { Theme } from '../theme.js';

const shapeOf = (s: unknown) => (s as { shape: Record<string, unknown> }).shape;

/** `true` when `T` is exactly `any` — the case-1/2 probe from the guard header. */
type IsAny<T> = 0 extends 1 & T ? true : false;

// ─────────────────────────────────────────────────────────────────────────────
// NavigationAreaSchema — derived (zod)
// ─────────────────────────────────────────────────────────────────────────────

describe('NavigationAreaSchema derives from the spec', () => {
  const specKeys = Object.keys(shapeOf(SpecNavigationAreaSchema)).sort();
  const localKeys = Object.keys(shapeOf(NavigationAreaSchema)).sort();

  it('carries every spec key', () => {
    for (const key of specKeys) {
      expect(localKeys, `spec key '${key}' missing locally`).toContain(key);
    }
  });

  it('adds no local key of its own', () => {
    // `navigation` and `visible` are RETYPES of spec keys, not extensions, so
    // this list staying empty is the whole claim: the area vocabulary is the
    // spec's. A new name here means someone extended the area locally instead
    // of promoting the field upstream.
    expect(localKeys.filter((k) => !specKeys.includes(k))).toEqual([]);
  });

  it('holds the spec sub-schemas BY REFERENCE, not by copy', () => {
    // The load-bearing assertion of this block, and the one a value comparison
    // cannot make (objectui#3003, re-proved on `isAggregatedViewContainer` in
    // objectui#3169): a faithful hand copy satisfies every key-set and parse
    // check above while being a fork. Only identity distinguishes them — so
    // re-forking this schema fails HERE as well as in the derivation guard.
    // One `.unwrap()` deep: `specFieldsExcept` ends in `.partial()`, which wraps
    // each carried field in a fresh `ZodOptional` around the spec's own object.
    // That wrapper is the only new allocation — what it holds must be identical.
    // `order` and `requiredPermissions` were in this list until spec 17.0.0
    // retired them at AREA level (see the retirement block below).
    for (const key of ['icon', 'description'] as const) {
      const local = shapeOf(NavigationAreaSchema)[key] as { unwrap(): unknown };
      expect(
        local.unwrap(),
        `'${key}' is a copy of the spec's sub-schema, not the spec's own`,
      ).toBe(shapeOf(SpecNavigationAreaSchema)[key]);
    }
  });

  it('keeps `description`, one of the two keys the hand copy dropped', () => {
    // objectui#3088: an area authored with a sort weight or a description lost
    // both — `objectui validate` is strip-mode, so the loss was silent. `order`
    // was the other one; spec 17.0.0 retired it at area level, so only
    // `description` is still a spec key this can be asserted about.
    const parsed = NavigationAreaSchema.parse({
      id: 'area_sales',
      label: 'Sales',
      description: 'Pipeline and quotes',
      navigation: [{ id: 'nav_leads', type: 'object', label: 'Leads', objectName: 'lead' }],
    });
    expect(parsed.description).toBe('Pipeline and quotes');
  });

  it('keeps `id` and `label` REQUIRED on the authoring side', () => {
    // `specFieldsExcept` .partial()s what it carries — deliberately, so no
    // future spec field can become required and invalidate stored apps. These
    // two are therefore taken from the spec's shape and re-stated as required;
    // if that re-statement is ever dropped they would silently go optional.
    expect(NavigationAreaSchema.safeParse({ label: 'Sales', navigation: [] }).success).toBe(false);
    expect(NavigationAreaSchema.safeParse({ id: 'area_a', navigation: [] }).success).toBe(false);
  });

  it('follows the AREA-level retirement of `visible` / `order` / `requiredPermissions`', () => {
    // Spec 17.0.0 (`AREA_VISIBLE_RETIRED` / `AREA_REQUIRED_PERMISSIONS_RETIRED`)
    // removed all three from `NavigationAreaSchema`: an area is a layout
    // grouping, not an access boundary, so gating belongs on the navigation
    // ITEM (`visible` / `requiredPermissions` — both still there) or on the app.
    //
    // This block replaces the old "keeps the bare-predicate `visible` wire
    // contract" pin. That pin existed because objectui re-typed the spec's
    // `visible`; with the spec key gone there is nothing to re-type, and
    // re-adding it locally would be a FORK — objectui would accept areas the
    // platform's `.strict()` schema rejects. So the assertion is inverted: the
    // three names must be absent from both sides, and a local re-add fails here.
    for (const key of ['visible', 'order', 'requiredPermissions'] as const) {
      expect(
        Object.keys(shapeOf(SpecNavigationAreaSchema)),
        `spec re-added area-level '${key}' — re-check the retirement`,
      ).not.toContain(key);
      expect(
        Object.keys(shapeOf(NavigationAreaSchema)),
        `'${key}' was re-added locally; gate the nav ITEM or the app instead`,
      ).not.toContain(key);
    }
  });

  it('gates on the navigation ITEM, which is where the spec kept the keys', () => {
    // The other half of the retirement: what moved is the LAYER, not the
    // capability. If these ever stop parsing, the retirement lost its migration
    // path and areas have no gating story at all.
    const parsed = NavigationAreaSchema.parse({
      id: 'area_a',
      label: 'A',
      navigation: [
        {
          id: 'nav_forecast',
          type: 'object',
          label: 'Forecast',
          objectName: 'forecast',
          visible: 'user.isAdmin',
          requiredPermissions: ['sales.admin'],
        },
      ],
    });
    expect(parsed.navigation[0].visible).toBe('user.isAdmin');
    expect(parsed.navigation[0].requiredPermissions).toEqual(['sales.admin']);
  });

  it('validates navigation items, which inheriting the spec key would not', () => {
    // The spec's `NavigationAreaSchema.navigation` is `z.ZodType<any>[]`
    // (objectstack#4171). Pinning the local item schema is what keeps this a
    // real check rather than a rubber stamp.
    expect(
      NavigationAreaSchema.safeParse({
        id: 'area_a', label: 'A', navigation: [{ type: 'object' }],
      }).success,
      'an id-less object nav item must not validate',
    ).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// NavigationArea — derived (TS)
// ─────────────────────────────────────────────────────────────────────────────

describe('NavigationArea derives from the spec', () => {
  it('inherits the spec keys', () => {
    // `order` / `requiredPermissions` / `visible` were here until spec 17.0.0
    // retired them at area level; the zod block above pins their absence.
    const area: NavigationArea = {
      id: 'area_sales',
      label: 'Sales',
      icon: 'briefcase',
      description: 'Pipeline and quotes',
      navigation: [],
    };
    expect(area.description).toBe('Pipeline and quotes');
  });

  it('does NOT re-add the retired area-level keys on the TS side either', () => {
    const area: NavigationArea = { id: 'area_sales', label: 'Sales', navigation: [] };
    // @ts-expect-error `visible` was retired at AREA level in spec 17.0.0 —
    // gate the navigation item or the app instead.
    area.visible = true;
    // @ts-expect-error `order` was retired at AREA level in spec 17.0.0.
    area.order = 1;
    // @ts-expect-error `requiredPermissions` was retired at AREA level in
    // spec 17.0.0 — an area is a layout grouping, not an access boundary.
    area.requiredPermissions = ['sales.read'];
    expect(area.id).toBe('area_sales');
  });

  it('holds objectui navigation items, which the spec type cannot express', () => {
    // INVERTED PIN, retargeted at its real blocker (the objectui#3177 lesson).
    // This used to assert the spec's element was `any` — true under spec
    // 17.0.0-rc.0, and it stopped compiling the moment rc.1 typed
    // `NavigationItem`. But "no longer `any`" was never the same as "safe to
    // bind": the element is now precise and describes a DIFFERENT shape (a
    // nine-variant discriminated union vs objectui's flat one), which is case
    // 2c in the guard's header.
    //
    // So the pin now asks the question that actually gates the override —
    // whether an objectui area's items still carry semantics the spec's type
    // rejects. `visible: boolean` is the sharpest of the three blockers
    // (`menuItemToNavigationItem` MANUFACTURES one from legacy
    // `MenuItem.hidden`), and it is the one that fails first if someone tries
    // to inherit `navigation`. The umbrella verdict and the other two blockers
    // are pinned per-key in `spec-derived-unions.test.ts`; when they lift,
    // that file fails and sends the reader back here.
    const spec: IsAny<SpecNavigationArea['navigation'][number]> = false;
    expect(spec, 'the spec element is typed now — re-read the case-2c note').toBe(false);

    const booleanVisible: NavigationArea = {
      id: 'area_sales',
      label: 'Sales',
      navigation: [{ id: 'nav_leads', type: 'object', label: 'Leads', visible: false }],
    };
    expect(booleanVisible.navigation[0]?.visible).toBe(false);

    const rejected: SpecNavigationArea['navigation'] = [
      {
        id: 'nav_leads',
        type: 'object',
        label: 'Leads',
        objectName: 'lead',
        // @ts-expect-error the spec's item takes a CEL string / Expression
        // envelope at every tier, never a boolean — binding `navigation`
        // would delete the spelling `menuItemToNavigationItem` manufactures.
        visible: false,
      },
    ];
    expect(rejected).toBeTruthy();

    // …and the local element really is the navigation item, not a lookalike.
    const item: NavigationItem = { id: 'nav_leads', type: 'object', label: 'Leads' };
    const area: NavigationArea = { id: 'area_a', label: 'A', navigation: [item] };
    expect(area.navigation[0]?.id).toBe('nav_leads');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Theme — derived (re-export of the spec's AUTHORING shape)
// ─────────────────────────────────────────────────────────────────────────────

describe('Theme is the spec ThemeInput, not the parsed Theme', () => {
  it('accepts a theme with no `mode` (the authoring side)', () => {
    const authored: Theme = { name: 'acme', label: 'Acme', colors: { primary: '#0af' } };
    expect(authored.mode).toBeUndefined();

    // Mutual assignability with the spec's authoring type: this is what makes
    // the re-export a re-export rather than a coincidence.
    const asSpecInput: SpecThemeInput = authored;
    const back: Theme = asSpecInput;
    expect(back.name).toBe('acme');
  });

  it('is NOT the spec parsed Theme, whose `mode` is required', () => {
    // `.default('auto')` has already run in `z.infer`, so the parsed type would
    // make `mode` mandatory and every stored objectui theme unrepresentable.
    // If the spec ever drops that default the two collapse and this pin fails,
    // which is the moment to re-read the derivation comment in `theme.ts`.
    type ModeOfParsed = undefined extends SpecTheme['mode'] ? 'optional' : 'required';
    const parsedModeIs: ModeOfParsed = 'required';
    expect(parsedModeIs).toBe('required');

    type ModeOfLocal = undefined extends Theme['mode'] ? 'optional' : 'required';
    const localModeIs: ModeOfLocal = 'optional';
    expect(localModeIs).toBe('optional');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ActionParam — derived from the spec's authoring input
// ─────────────────────────────────────────────────────────────────────────────

describe('ActionParam derives from the spec ActionParamSchema input', () => {
  it('declares the three spec keys the hand copy omitted', () => {
    // `reference` is the one `resolveActionParams()` actually reads for an
    // inline lookup target (objectui#3174); `defaultFromRow` is written by the
    // metadata designer's own inspector; `requiresFeature` gates the param.
    const param: ActionParam = {
      name: 'account_id',
      type: 'lookup',
      reference: 'account',
      defaultFromRow: true,
      requiresFeature: 'organization',
    };
    expect(param.reference).toBe('account');
  });

  it('accepts both spellings of `visible`, as the resolver always has', () => {
    const bare: ActionParam = { name: 'p', visible: 'features.phoneNumber' };
    const envelope: ActionParam = { name: 'p', visible: { dialect: 'cel', source: 'a' } };
    expect(bare.visible).toBe('features.phoneNumber');
    expect(envelope.visible).toBeTruthy();
  });

  it('keeps `required` optional — the authoring side, before `.default()`', () => {
    type RequiredOf = undefined extends ActionParam['required'] ? 'optional' : 'required';
    const is: RequiredOf = 'optional';
    expect(is).toBe('optional');
  });

  it('keeps the one pinned widening: objectui legacy `type` spellings', () => {
    const legacySpelling: ActionParam = { name: 'p', type: 'datetime-local' };
    expect(legacySpelling.type).toBe('datetime-local');
  });

  it('inherits `label` — spec 17 made `I18nLabel` a plain string', () => {
    // INVERTED PIN. The local override on `label`/`options[].label` was
    // justified as a widening to "a string or a per-locale record"; spec 17
    // dropped inline i18n objects, so `I18nLabelSchema` is `z.ZodString` and
    // the override had become a restatement claiming to be wider than it was.
    // If the spec re-widens `I18nLabel`, this stops compiling — which is the
    // signal to re-decide, rather than inherit the old justification.
    const label: SpecI18nLabel = 'Priority';
    expect(label).toBe('Priority');

    const param: ActionParam = {
      name: 'p',
      label: 'Priority',
      options: [{ label: 'High', value: 'high' }],
    };
    expect(param.options?.[0]?.label).toBe('High');
  });

  it('still expresses the field-backed form (framework#4074)', () => {
    const fieldBacked: ActionParam = { field: 'status' };
    expect(fieldBacked.field).toBe('status');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ActionParam — authoring keys ONLY (objectui#3174)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The keys an author may write on a param, straight off the spec. `z.input`
 * because `ActionParamSchema` ends in a `.transform()` and this is the
 * pre-parse, as-written side (objectui#3169).
 */
type SpecAuthorableParamKey = keyof z.input<typeof SpecActionParamSchema>;

/** Every key `ActionParam` adds on top of the spec's set. */
type LocalOnlyParamKey = Exclude<keyof ActionParam, SpecAuthorableParamKey>;

describe('ActionParam declares ONLY authorable keys (objectui#3174)', () => {
  it('does not declare the resolved-side picker group', () => {
    // These nine live on `@object-ui/core`'s RESOLVED `ActionParamDef`, which
    // `resolveActionParams()` EMITS. Declaring them on the authoring type made
    // `{ type: 'lookup', referenceTo: 'account' }` compile, lose its picker
    // target in the resolver, and render as a record-id text box — while the
    // dialog's own warning told the author to use `reference`, a key this type
    // did not have. `ActionParamSchema` is `.strict()`, so the server rejects
    // every one of them at parse time too; the type was the half that lied.
    const authored: ActionParam = {
      name: 'account_id',
      type: 'lookup',
      // @ts-expect-error `referenceTo` is resolved-side; author `reference`
      referenceTo: 'account',
    };
    expect(authored.name).toBe('account_id');

    // @ts-expect-error inherited from the referenced field, not authored
    const withDisplayField: ActionParam = { name: 'p', displayField: 'name' };
    // @ts-expect-error inherited from the referenced field, not authored
    const withIdField: ActionParam = { name: 'p', idField: 'id' };
    // @ts-expect-error inherited from the referenced field, not authored
    const withDescriptionField: ActionParam = { name: 'p', descriptionField: 'email' };
    // @ts-expect-error inherited from the referenced field, not authored
    const withTitleFormat: ActionParam = { name: 'p', titleFormat: '{name}' };
    // @ts-expect-error inherited from the referenced field, not authored
    const withLookupColumns: ActionParam = { name: 'p', lookupColumns: [] };
    // @ts-expect-error inherited from the referenced field, not authored
    const withLookupFilters: ActionParam = { name: 'p', lookupFilters: [] };
    // @ts-expect-error inherited from the referenced field, not authored
    const withLookupPageSize: ActionParam = { name: 'p', lookupPageSize: 20 };
    // @ts-expect-error inherited from the referenced field, not authored
    const withDependsOn: ActionParam = { name: 'p', dependsOn: [] };

    expect([
      withDisplayField, withIdField, withDescriptionField, withTitleFormat,
      withLookupColumns, withLookupFilters, withLookupPageSize, withDependsOn,
    ]).toHaveLength(8);
  });

  it('keeps `reference` as the one authorable picker spelling', () => {
    // The positive half of the pin above: what the resolver reads must stay
    // writable, or the removal would have closed the capability instead of
    // pointing at it.
    const authored: ActionParam = { name: 'account_id', type: 'lookup', reference: 'account' };
    expect(authored.reference).toBe('account');
  });

  it('adds NO key to the spec set — the exception is gone (objectui#3201)', () => {
    // The rule objectui#3174 left behind, now with nothing carved out of it:
    // the authoring type declares EXACTLY the spec's authorable keys, so a
    // capability the resolved shape has and this one lacks is a spec change or
    // a field-backed param, never a key added here.
    //
    // This used to read `const theOneException: LocalOnlyParamKey = 'validation'`
    // — an inverted pin whose reverse direction said "the day `validation` is
    // retired this line stops compiling and the exception is deleted rather
    // than inherited". objectui#3201 retired it (declared on both halves of the
    // contract, read by neither, and a hard `.strict()` parse rejection on the
    // server), so the exception is deleted, not re-pointed at some other key.
    //
    // `[T] extends [never]` deliberately, not a naked `T extends never`: the
    // naked form distributes and evaluates to `never` — not `true` — for the
    // empty union, which is exactly the case being asserted, so it would fail
    // to compile the moment it started being satisfied. The tuple wrapper
    // defeats distribution and lets `never` be tested as a value.
    type NoLocalOnlyKeys = [LocalOnlyParamKey] extends [never] ? true : false;
    const noLocalOnlyKeys: NoLocalOnlyKeys = true;
    expect(noLocalOnlyKeys).toBe(true);

    // Forward direction, made runtime-visible: adding any key not in the spec's
    // set has to fail here, so the assertion above cannot quietly become
    // vacuous. `type` is the one key `ActionParam` restates, and it restates a
    // key the spec already declares (a NARROWING to `ResolvableParamFieldType`),
    // so it is not local-only and does not belong in this set either.
    const localOnlyKeys: LocalOnlyParamKey[] = [];
    expect(localOnlyKeys).toEqual([]);

    // And the retired key specifically is no longer authorable: an authored
    // `validation` is now the `tsc` error it always should have been, matching
    // the server, which answers it with
    // "Unrecognized key(s) on this action param: `validation`".
    // @ts-expect-error retired by objectui#3201 — inert, and rejected by `ActionParamSchema`
    const retired: ActionParam = { name: 'p', validation: 'value > 0' };
    expect(retired.name).toBe('p');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Export / import job contracts — derived
// ─────────────────────────────────────────────────────────────────────────────

describe('export/import job types derive from the spec contracts', () => {
  it('omits `object` from the request — it is the method argument', () => {
    const request: CreateExportJobRequest = { format: 'csv', fields: ['name'] };
    expect(request.format).toBe('csv');
    // @ts-expect-error `object` is `createExportJob(resource, …)`, not a payload key
    const doubled: CreateExportJobRequest = { object: 'account', format: 'csv' };
    expect(doubled).toBeTruthy();
  });

  it('keeps the request on the AUTHORING side (defaults not yet applied)', () => {
    // `format`/`includeHeaders`/`encoding` all carry `.default()`. Deriving from
    // the parsed type would make a caller supply all three.
    const minimal: CreateExportJobRequest = {};
    expect(minimal).toEqual({});
  });

  it('makes `createdAt` required on the job result, as the server sends it', () => {
    type CreatedAtOf = undefined extends CreateExportJobResult['createdAt'] ? 'optional' : 'required';
    const is: CreatedAtOf = 'required';
    expect(is).toBe('required');
  });

  it('makes `action` required on a row result, as the route schema does', () => {
    type ActionOf = undefined extends ImportRowResult['action'] ? 'optional' : 'required';
    const is: ActionOf = 'required';
    expect(is).toBe('required');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Renamed dialects — tripwires
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Every `@objectstack/spec` export name on the given subpaths, read through the
 * TypeScript checker rather than a runtime `import *`.
 *
 * That distinction is load-bearing: all but two of the names below are TYPES,
 * and a runtime namespace import cannot see a type. A tripwire built on
 * `import * as spec` would pass for every one of them while proving nothing —
 * the same trap recorded in the first comment on objectstack#4115 and again in
 * objectui#3169. (Duplicated from `report-chart-query-spec-parity.test.ts`
 * deliberately: a shared helper in a test util is one more file to keep in sync
 * with the spec's packaging, and each guard should stand alone.)
 */
function specExportNames(subpaths: readonly string[]): Set<string> {
  const require = createRequire(import.meta.url);
  const pkgPath = require.resolve('@objectstack/spec/package.json');
  const pkgDir = dirname(pkgPath);
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
    exports?: Record<string, { import?: { types?: string }; require?: { types?: string } }>;
  };

  const files: string[] = [];
  for (const [sub, cond] of Object.entries(pkg.exports ?? {})) {
    const name = sub === '.' ? '@objectstack/spec' : `@objectstack/spec${sub.slice(1)}`;
    if (!subpaths.includes(name)) continue;
    const dts = cond?.import?.types ?? cond?.require?.types;
    if (dts) files.push(resolve(pkgDir, dts));
  }
  if (files.length !== subpaths.length) {
    throw new Error(`could not resolve type entrypoints for ${subpaths.join(', ')}`);
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
    const moduleSymbol = sf && checker.getSymbolAtLocation(sf);
    if (!moduleSymbol) throw new Error(`no module symbol for ${file}`);
    for (const exported of checker.getExportsOfModule(moduleSymbol)) names.add(exported.getName());
  }
  return names;
}

describe('renamed local dialects do not collide with a spec export (objectui#3074 lesson)', () => {
  const names = specExportNames(['@objectstack/spec/ui', '@objectstack/spec/system']);

  it('reads a plausible spec export set (guards the assertions below)', () => {
    expect(names.size).toBeGreaterThan(100);
  });

  it.each([
    ['FileMetadata', 'UploadedFileMetadata'],
    ['PageRegion', 'PageNodeRegion'],
    ['PageRegionSchema', 'PageNodeRegionSchema'],
    ['ResponsiveConfig', 'MobileResponsiveConfig'],
    ['WidgetManifest', 'RuntimeWidgetManifest'],
    ['WidgetSource', 'RuntimeWidgetSource'],
  ])('the spec still owns `%s`, which is why the rename to `%s` happened', (owned) => {
    // The other direction of the tripwire: if the spec RETIRES one of these,
    // the local dialect can take the natural name back. A workaround should not
    // outlive its reason (objectui#3169).
    expect(names, `spec no longer owns '${owned}' — re-run the triage`).toContain(owned);
  });

  /**
   * THE TRIPWIRE FIRED, exactly as designed, and objectui#3363 acted on it.
   * `@objectstack/spec` 17.0.0-rc.3 deleted the whole `ui/touch` and
   * `ui/offline` modules (objectstack#4988, PR objectstack#5321), so
   * `GestureType`, `GestureConfig` and `OfflineConfig` moved from the first
   * list to this one: the spec stopped owning all three.
   *
   * Two of the three were then RECLAIMED — `TouchGestureType` → `GestureType`
   * and `TouchGestureConfig` → `GestureConfig` now carry the natural names in
   * `@object-ui/types`' `mobile` module, so a workaround does not outlive its
   * reason (objectui#3169). These rows keep asserting the same thing they did
   * before the reclaim, and that is the point: they are now what makes the
   * reclaimed names SAFE, not merely available.
   *
   * The third did not move — see the `OfflineConfig` block below.
   */
  it.each([
    ['GestureType', 'TouchGestureType'],
    ['GestureConfig', 'TouchGestureConfig'],
  ])(
    'the spec still does not own `%s`, reclaimed from `%s` (objectui#3363)',
    (reclaimed) => {
      expect(
        names,
        `spec owns '${reclaimed}' again, and @object-ui/types now exports that ` +
          `exact name — this is a live collision, not a latent one. Re-triage ` +
          `(objectstack#4115): derive from the spec, or rename the local dialect back.`,
      ).not.toContain(reclaimed);
    },
  );

  /**
   * `OfflineConfig` is the one the spec vacated that objectui did NOT reclaim,
   * and the reason is worth pinning rather than remembering: **the spec was
   * never the only claimant**. That rename was a cross-package arbitration
   * between two objectui packages, and `@object-ui/react` won it — its
   * `useOffline` config IS the offline data/sync model, key for key, so it
   * holds the bare name while this package's service-worker route cache stays
   * `PWAOfflineConfig` (objectui#3156 / objectui#3159).
   *
   * Before objectui#3560 that name reached `@object-ui/react` from the spec, so
   * the spec-side assertion above covered it by accident. Since the retirement
   * it is declared locally, which is exactly why it needs its own pin: the
   * spec's vacancy no longer says anything about whether the name is free. If
   * `@object-ui/react` ever drops or renames `OfflineConfig`, this goes red and
   * the reclaim genuinely IS available — that is the unlock signal, and it now
   * points at the right repository instead of at the spec.
   */
  it('`@object-ui/react` still owns `OfflineConfig`, so `PWAOfflineConfig` keeps its prefix (objectui#3363)', () => {
    // A source read, not an import: `@object-ui/types` has zero deps and must
    // not take one on `@object-ui/react`. Same instrument the sibling
    // `spec-ui-schema-reexports.test.ts` uses to inspect source it cannot load.
    const useOfflinePath = resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../../../react/src/hooks/useOffline.ts',
    );
    const src = readFileSync(useOfflinePath, 'utf8');
    expect(
      /^export interface OfflineConfig\b/m.test(src),
      `${useOfflinePath} no longer declares 'export interface OfflineConfig'. If the ` +
        `name was dropped or moved, the cross-package reason for 'PWAOfflineConfig' is ` +
        `gone — the spec vacated 'OfflineConfig' back in objectstack#4988, so the ` +
        `natural name is now free and @object-ui/types' mobile module may reclaim it ` +
        `(objectui#3363 reclaimed 'GestureType'/'GestureConfig' the same way).`,
    ).toBe(true);
  });

  it.each([
    ['UploadedFileMetadata', 'file-field VALUE payload, not the storage file record'],
    ['PWAOfflineConfig', 'service-worker route caching, not the offline data model'],
    ['PageNodeRegion', 'region of the objectui page NODE, holding renderer nodes'],
    ['PageNodeRegionSchema', 'zod twin of PageNodeRegion'],
    ['MobileResponsiveConfig', 'mobile box config, not the spec SDUI grid contract'],
    ['RuntimeWidgetManifest', 'SDUI component manifest, not the field-widget plugin'],
    ['RuntimeWidgetSource', 'objectui module/inline/registry loader union'],
  ])('the spec does not own `%s` (%s)', (name) => {
    expect(names).not.toContain(name);
  });
});
