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
 * Type-level assertions here are real gates: `tsconfig.test.json` compiles this
 * file, unlike the package build (see its header for why that distinction was
 * itself a bug once).
 */

import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';
import { NavigationAreaSchema as SpecNavigationAreaSchema } from '@objectstack/spec/ui';
import type {
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

  it('keeps `order` and `description`, the two keys the hand copy dropped', () => {
    // objectui#3088: an area authored with a sort weight or a description lost
    // both — `objectui validate` is strip-mode, so the loss was silent.
    const parsed = NavigationAreaSchema.parse({
      id: 'area_sales',
      label: 'Sales',
      order: 1,
      description: 'Pipeline and quotes',
      navigation: [{ id: 'nav_leads', type: 'object', label: 'Leads', objectName: 'lead' }],
    });
    expect(parsed.order).toBe(1);
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

  it('keeps the bare-predicate `visible` wire contract (input AND output)', () => {
    // The spec pipes `visible` through ExpressionInput and emits an
    // `{ dialect, source }` envelope. objectui's renderers read the bare
    // predicate, so comparing `_output` alone would miss the divergence that
    // matters here — the guard header's `_input` rule.
    const bool = NavigationAreaSchema.parse({ id: 'area_a', label: 'A', navigation: [], visible: true });
    expect(bool.visible).toBe(true);
    const cel = NavigationAreaSchema.parse({
      id: 'area_a', label: 'A', navigation: [], visible: 'user.isAdmin',
    });
    expect(cel.visible).toBe('user.isAdmin');
    expect(typeof cel.visible).toBe('string');
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
    const area: NavigationArea = {
      id: 'area_sales',
      label: 'Sales',
      icon: 'briefcase',
      order: 1,
      description: 'Pipeline and quotes',
      requiredPermissions: ['sales.read'],
      navigation: [],
    };
    expect(area.order).toBe(1);
  });

  it('keeps `navigation` precisely typed while the spec erases it', () => {
    // INVERTED PIN. The spec's own `NavigationArea['navigation']` is `any[]`
    // because `NavigationItemSchema` is declared `z.ZodType<any>`. The day the
    // spec types it (objectstack#4171), this assertion stops compiling — and
    // that failure is the signal to re-triage `NavigationItem` /
    // `NavigationItemSchema` out of batch 8 (objectui#3162) and collapse the
    // override below into a plain inheritance.
    const specErased: IsAny<SpecNavigationArea['navigation'][number]> = true;
    expect(specErased).toBe(true);

    const localTyped: IsAny<NavigationArea['navigation'][number]> = false;
    expect(localTyped).toBe(false);

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
    ['GestureType', 'TouchGestureType'],
    ['GestureConfig', 'TouchGestureConfig'],
    ['OfflineConfig', 'PWAOfflineConfig'],
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

  it.each([
    ['UploadedFileMetadata', 'file-field VALUE payload, not the storage file record'],
    ['TouchGestureType', 'direction-fused recognizer vocabulary (`swipe-left`, …)'],
    ['TouchGestureConfig', 'gesture→action binding, not the spec per-gesture tuning'],
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
