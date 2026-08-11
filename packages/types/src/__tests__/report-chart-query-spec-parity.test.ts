/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Report / chart / query cluster ↔ `@objectstack/spec` drift guard
 * (objectui#3155, objectstack#4115).
 *
 * This file guards the eleven collisions of ledger batch 1, which resolved three
 * different ways — and the tests differ accordingly:
 *
 *  - **Derived** (`AppContextSelectorSchema`, `GlobalFilterSchema`,
 *    `DashboardWidgetSchema`): spec keys now flow in by reference, so the risk is
 *    no longer drift but SHADOWING — a local key quietly reclaiming a name the
 *    spec owns, or a divergence outliving the reason it was granted. Four-way
 *    parity, in the shape `select-option-spec-parity.test.ts` established.
 *  - **Renamed** (`ChartDataSeries`, `ChartDataSeriesSchema`, `SqlQueryAST`,
 *    `DriverQueryConfig`, `SqlDriverInterface`, `DatasourceRegistration`): the
 *    concepts genuinely differ from the spec exports whose names they were
 *    wearing. The risk is picking a new name the spec ALREADY owns — the
 *    `PageComponentSchema` mistake from objectui#3074 — so each new name is
 *    asserted absent from the spec's export set, types and values alike.
 *  - **Not burnable** (`JoinedReportBlock`): kept in the ledger behind an
 *    inverted pin, see the bottom of this file.
 */

import { describe, it, expect } from 'vitest';
// Needed to isolate the rc.6 `GlobalFilterSchema` refinement from the field type
// it hides behind — see the objectui#4165 pin below.
import { z } from 'zod';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';
import {
  AppContextSelectorSchema as SpecAppContextSelectorSchema,
  GlobalFilterSchema as SpecGlobalFilterSchema,
  DashboardWidgetSchema as SpecDashboardWidgetSchema,
} from '@objectstack/spec/ui';
import type { JoinedReportBlock as SpecJoinedReportBlock } from '@objectstack/spec/ui';
import { AppContextSelectorSchema } from '../zod/app.zod.js';
import { DashboardWidgetSchema, GlobalFilterSchema } from '../zod/complex.zod.js';

const shapeOf = (s: unknown) => (s as { shape: Record<string, unknown> }).shape;

// ─────────────────────────────────────────────────────────────────────────────
// AppContextSelectorSchema
// ─────────────────────────────────────────────────────────────────────────────

describe('AppContextSelectorSchema derives from the spec', () => {
  const specKeys = Object.keys(shapeOf(SpecAppContextSelectorSchema)).sort();
  const localKeys = Object.keys(shapeOf(AppContextSelectorSchema)).sort();

  it('carries every spec key', () => {
    for (const key of specKeys) {
      expect(localKeys, `spec key '${key}' missing locally`).toContain(key);
    }
  });

  it('adds no local key of its own', () => {
    // The only sanctioned divergence is a RETYPE of `label`, not an extension.
    // A new name appearing here means someone extended the selector locally
    // instead of promoting the field upstream.
    expect(localKeys.filter((k) => !specKeys.includes(k))).toEqual([]);
  });

  it('keeps the spec keys the old hand copy restated, defaults included', () => {
    const parsed = AppContextSelectorSchema.parse({
      id: 'active_package',
      label: 'Package',
      optionsSource: { endpoint: '/api/packages' },
    });
    expect(parsed.optionsSource.valueKey).toBe('id');
    expect(parsed.optionsSource.labelKey).toBe('name');
    expect(parsed.persist).toBe('query');
    // `includeAll` and `placement` were asserted here until spec 17.0.0
    // removed them (framework#4509 / objectui#3208). Both carried schema
    // defaults, which is exactly why the liveness lint could not flag them:
    // a materialised default is indistinguishable from an authored value.
    // Removal was the only channel that reaches the author.
  });
});

describe('AppContextSelectorSchema pinned divergence', () => {
  const base = { id: 'pkg', optionsSource: { endpoint: '/api/x' } };

  it('widens `label` to objectui\'s i18n envelope on purpose', () => {
    // `AppContextSelectors` (@object-ui/app-shell) renders the label through
    // `resolveI18nLabel`, so a localized selector must validate here…
    const i18n = { default: 'Package', translations: { 'zh-CN': '安装包' } };
    expect(AppContextSelectorSchema.safeParse({ ...base, label: i18n }).success).toBe(true);
    // …while the spec (plain `z.string()`) rejects it. If the spec ever widens
    // `label` itself, this flips and the local override is what to delete.
    expect(SpecAppContextSelectorSchema.safeParse({ ...base, label: i18n }).success).toBe(false);
  });

  it('still accepts the spec\'s plain-string label', () => {
    expect(AppContextSelectorSchema.safeParse({ ...base, label: 'Package' }).success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GlobalFilterSchema
// ─────────────────────────────────────────────────────────────────────────────

describe('GlobalFilterSchema derives from the spec', () => {
  const specKeys = Object.keys(shapeOf(SpecGlobalFilterSchema)).sort();
  const localKeys = Object.keys(shapeOf(GlobalFilterSchema)).sort();

  it('carries every spec key', () => {
    for (const key of specKeys) {
      expect(localKeys, `spec key '${key}' missing locally`).toContain(key);
    }
  });

  it('adds no local key of its own', () => {
    expect(localKeys.filter((k) => !specKeys.includes(k))).toEqual([]);
  });

  it('picks up the spec `scope` vocabulary by reference', () => {
    // Previously `z.string().optional()` — any typo validated. Nothing reads
    // `scope` at runtime, so adopting the spec enum costs nothing and closes it.
    const parsed = GlobalFilterSchema.parse({ field: 'stage', scope: 'dashboard' });
    expect(parsed.scope).toBe('dashboard');
    expect(GlobalFilterSchema.safeParse({ field: 'stage', scope: 'globl' }).success).toBe(false);
  });
});

describe('GlobalFilterSchema pinned divergences', () => {
  it('accepts the bare-string options shorthand the runtime normalizes', () => {
    // `normalizeFilterOptions` (@object-ui/core dashboard-filters.ts) folds both
    // spellings into the spec's `{ value, label }` form.
    expect(GlobalFilterSchema.safeParse({ field: 'region', options: ['EMEA', 'APAC'] }).success).toBe(true);
    expect(GlobalFilterSchema.safeParse({ field: 'region', options: [{ value: 'emea' }] }).success).toBe(true);
    // The spec requires objects WITH a label. If it ever relaxes, drop the override.
    expect(SpecGlobalFilterSchema.safeParse({ field: 'region', options: ['EMEA'] }).success).toBe(false);
    expect(SpecGlobalFilterSchema.safeParse({ field: 'region', options: [{ value: 'emea' }] }).success).toBe(false);
  });

  it('accepts the normalized date-preset default object', () => {
    // framework#4475: `normalizeDateDefault` lifts a preset NAME into `{ preset }`,
    // and stored dashboards carry that object form.
    expect(GlobalFilterSchema.safeParse({
      field: 'created_at', type: 'date', defaultValue: { preset: 'last_7_days' },
    }).success).toBe(true);
    expect(SpecGlobalFilterSchema.safeParse({
      field: 'created_at', type: 'date', defaultValue: { preset: 'last_7_days' },
    }).success).toBe(false);
  });

  /**
   * OPEN CONFLICT, pinned rather than resolved — objectui#4165.
   *
   * The divergence above used to be about a FIELD TYPE, and only that: the spec
   * typed `defaultValue` as `string | number | boolean`, objectui widened the key
   * to `z.any()`, and widening the key was ENOUGH — nothing else in the spec had
   * an opinion about the object form.
   *
   * @objectstack/spec 17.0.0-rc.6 added a whole-object refinement that refuses
   * `{ preset }` BY NAME, with a message enumerating the three spellings a
   * `type: 'date'` filter may use (a preset name, an ISO date, a date-macro
   * token). A refinement is not a field type, so widening the key no longer
   * escapes it: any derivation that CARRIES the refinement refuses the object
   * form regardless of how `defaultValue` is typed.
   *
   * Read the two assertions below in that light, because the obvious shorter
   * version is a trap. `SpecGlobalFilterSchema.safeParse({ …, defaultValue: {
   * preset } })` does fail — but it fails with `invalid_union` on the FIELD, the
   * same way it failed at rc.5, and the refinement never runs. Asserting that
   * would pin the OLD behaviour while reading like a pin on the new one. The
   * refinement is only observable once the field admits the object, so it is
   * isolated here by widening the key first — which is exactly the shape
   * objectui's own dialect has.
   *
   * The conflict this leaves is a producer/consumer one with three possible
   * answers (follow the spec and migrate stored dashboards; keep the divergence;
   * the spec's refinement is an upstream defect), and it is filed rather than
   * guessed — the deciding half belongs to the spec owner. Until it is ruled,
   * `GlobalFilterSchema` is composed by spreading the spec's `.shape`, carrying
   * the FIELDS by reference and leaving the refinement behind: the exact
   * behaviour this schema had before rc.6, so the bump changes nothing here. The
   * spread is not a preference — rc.6 closed both other doors (`.extend()`
   * throws at module load, `.safeExtend()` types the three overrides as `never`),
   * so some spelling had to change, and this is the one that decides nothing.
   *
   * This test is the tripwire on that standstill and goes red from EITHER side:
   * if objectui stops accepting the object form (resolved consumer-side), or if
   * the refinement is withdrawn or reworded upstream (resolved producer-side).
   */
  it('does NOT carry the spec rc.6 refinement that refuses `{ preset }` (objectui#4165)', () => {
    const stored = { field: 'created_at', type: 'date', defaultValue: { preset: 'last_7_days' } };

    // objectui side: still accepts what its own normalizer writes.
    expect(GlobalFilterSchema.safeParse(stored).success).toBe(true);

    // Spec side, refinement ISOLATED from the field type: widen `defaultValue`
    // exactly as objectui's dialect does, but keep the spec's checks (that is
    // what `.safeExtend` preserves). What refuses the value now can only be the
    // rc.6 refinement, and asserting its MESSAGE is what separates "the spec's
    // `defaultValue` is narrow" (true since forever) from "the spec has a rule
    // about this exact shape" (new in rc.6, and the reason #4165 exists).
    const specWithRefinement = SpecGlobalFilterSchema.safeExtend({
      defaultValue: z.any().optional(),
    });
    const refused = specWithRefinement.safeParse(stored);
    expect(refused.success).toBe(false);
    expect(
      refused.error?.issues?.some((i) => /is not a value a .*date.* filter can resolve/.test(i.message)),
      'the spec no longer refuses `{ preset }` with its rc.6 refinement message — ' +
        'either the refinement was withdrawn or its wording changed. Re-read objectui#4165 ' +
        'before touching this: the standstill it documents may be over.',
    ).toBe(true);

    // …and the bare preset NAME, which the refinement's message points authors
    // at, is already legal on both sides. That is why #4165's leading candidate
    // is a rewrite rather than a capability loss.
    const bare = { field: 'created_at', type: 'date', defaultValue: 'last_7_days' };
    expect(specWithRefinement.safeParse(bare).success).toBe(true);
    expect(SpecGlobalFilterSchema.safeParse(bare).success).toBe(true);
    expect(GlobalFilterSchema.safeParse(bare).success).toBe(true);
  });

  it('keeps `optionsFrom.labelField` optional', () => {
    expect(GlobalFilterSchema.safeParse({
      field: 'owner', optionsFrom: { object: 'users', valueField: 'id' },
    }).success).toBe(true);
    expect(SpecGlobalFilterSchema.safeParse({
      field: 'owner', optionsFrom: { object: 'users', valueField: 'id' },
    }).success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DashboardWidgetSchema
// ─────────────────────────────────────────────────────────────────────────────

describe('DashboardWidgetSchema derives from the spec', () => {
  const specKeys = Object.keys(shapeOf(SpecDashboardWidgetSchema)).sort();
  const localKeys = Object.keys(shapeOf(DashboardWidgetSchema)).sort();

  it('carries every spec key', () => {
    for (const key of specKeys) {
      expect(localKeys, `spec key '${key}' missing locally`).toContain(key);
    }
  });

  it('extends the spec by exactly the documented objectui-only key', () => {
    // If the spec ever claims `component`, the two meanings must be reconciled
    // rather than silently shadowed.
    expect(localKeys.filter((k) => !specKeys.includes(k))).toEqual(['component']);
  });

  it('stops stripping the spec keys the hand copy dropped', () => {
    // Every one of these survived `objectui validate` with its value deleted
    // before the derivation — including the capability gates, which the
    // dashboard renderer honours at runtime.
    //
    // Four of the original twelve are gone: `actionUrl` / `actionType` /
    // `actionIcon` and `aria` were retired in @objectstack/spec 17.0.0-rc.3
    // (objectstack#5010, ADR-0049 enforce-or-remove). A dashboard widget has no
    // action button and never had one — every action the dashboard dispatches
    // comes from `header.actions[]` — and no renderer ever applied the widget
    // `aria`, so it promised accessibility compliance it did not deliver. They
    // move to the negative-control block below: this fixture would now be
    // REFUSED rather than parsed, which is the opposite of what it asserts.
    const parsed = DashboardWidgetSchema.parse({
      id: 'w1',
      type: 'bar',
      description: 'Pipeline by stage',
      colorVariant: 'blue',
      requiresObject: 'opportunity',
      requiresService: 'analytics',
      suppressWarnings: ['no-data'],
      dataset: 'pipeline',
      dimensions: ['stage'],
      values: ['amount'],
      layout: { x: 0, y: 0, w: 6, h: 4 },
      filterBindings: { dateRange: 'closed_at' },
    });
    expect(parsed.description).toBe('Pipeline by stage');
    expect(parsed.colorVariant).toBe('blue');
    expect(parsed.requiresObject).toBe('opportunity');
    expect(parsed.requiresService).toBe('analytics');
    expect(parsed.suppressWarnings).toEqual(['no-data']);
    expect(parsed.layout).toEqual({ x: 0, y: 0, w: 6, h: 4 });
    expect(parsed.filterBindings).toEqual({ dateRange: 'closed_at' });
  });

  it('REFUSES the four keys objectstack#5010 retired, by name', () => {
    // Not "strips" — refuses. That distinction is the whole point of
    // ADR-0049 enforce-or-remove: a stale dashboard carrying `actionUrl` gets
    // told where the affordance moved (`header.actions[]`) instead of silently
    // losing it, which is what the pre-derivation hand copy did.
    for (const key of ['actionUrl', 'actionType', 'actionIcon', 'aria'] as const) {
      const result = DashboardWidgetSchema.safeParse({
        id: 'w1',
        type: 'bar',
        dataset: 'pipeline',
        dimensions: ['stage'],
        values: ['amount'],
        [key]: key === 'aria' ? { ariaLabel: 'Pipeline' } : 'x',
      });
      expect(result.success, `'${key}' must be refused, not accepted`).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path[0] === key)).toBe(true);
      }
    }
  });
});

describe('DashboardWidgetSchema pinned divergences', () => {
  it('keeps `id` optional — stored dashboards and legacy widgets omit it', () => {
    expect(DashboardWidgetSchema.safeParse({ type: 'metric' }).success).toBe(true);
    expect(SpecDashboardWidgetSchema.safeParse({ type: 'metric' }).success).toBe(false);
  });

  it('widens `type` for the objectui-only `list` / `custom` families', () => {
    for (const type of ['list', 'custom']) {
      expect(DashboardWidgetSchema.safeParse({ id: 'w', type }).success).toBe(true);
      // If the spec adopts either family, drop the widening and use its enum.
      expect(SpecDashboardWidgetSchema.safeParse({ id: 'w', type }).success).toBe(false);
    }
  });

  it('still accepts the legacy `component` envelope', () => {
    const parsed = DashboardWidgetSchema.parse({
      id: 'w', component: { type: 'chart' }, layout: { x: 0, y: 0, w: 4, h: 3 },
    });
    expect(parsed.component).toEqual({ type: 'chart' });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Rename tripwires — the new names must not be spec names
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Every export name `@objectstack/spec` publishes, per subpath — TYPES included.
 *
 * A runtime `import()` would only see values, and five of the six names below
 * are types, so a value-only check would pass vacuously on exactly the cases
 * that matter. This reads the compiler's view of each subpath's `.d.ts`, which
 * is the same source `scripts/check-spec-symbol-derivation.mjs` uses.
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
  const names = specExportNames(['@objectstack/spec/ui', '@objectstack/spec/data']);

  it('reads a plausible spec export set (guards the assertions below)', () => {
    expect(names.size).toBeGreaterThan(100);
    // The names these six were renamed OFF are still the spec's — that is why
    // the renames happened, and it keeps this test honest about what it reads.
    for (const owned of [
      'ChartSeries', 'ChartSeriesSchema', 'QueryAST', 'QuerySchema',
      'DriverInterface', 'DatasourceSchema',
    ]) {
      expect(names, `spec no longer owns '${owned}' — re-run the triage`).toContain(owned);
    }
  });

  it.each([
    ['ChartDataSeries', 'inline-data series of the objectui ChartSchema node'],
    ['ChartDataSeriesSchema', 'zod twin of ChartDataSeries'],
    ['SqlQueryAST', 'compiled SQL syntax tree, not the spec ObjectQL request'],
    ['DriverQueryConfig', 'high-level query config the SQL AST builder consumes'],
    ['SqlDriverInterface', "objectui's SQL-oriented client driver abstraction"],
    ['DatasourceRegistration', 'in-memory datasource registration record'],
  ])('the spec does not own `%s` (%s)', (name) => {
    expect(names).not.toContain(name);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// JoinedReportBlock — inverted pin, NOT burnable here
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `JoinedReportBlock` collides with a spec export that carries no type at all:
 * the spec declares `JoinedReportBlockSchema` as `z.ZodTypeAny`, so
 * `z.infer<typeof …>` — and therefore the exported `JoinedReportBlock` type —
 * resolves to `unknown`. Re-exporting it would replace objectui's precise block
 * interface (`name`/`columns`/`groupingsDown`/`groupingsAcross`/`filter`/`chart`)
 * with nothing at all: a type-safety regression wearing a burn-down's clothes.
 *
 * This is the objectstack#4171 failure mode, one variant wider than the three
 * already pinned in `spec-derived-unions.test.ts`. Those erase to `any`, which
 * the `0 extends (1 & T)` probe detects; this one erases to `unknown`, which
 * that probe reports as `false` while being just as empty. Any triage that only
 * screens for `any` will conclude this symbol is safely derivable. It is not.
 *
 * So it stays in the ledger with its local declaration intact. The day the spec
 * types the schema properly, `IsUnknown<…>` flips to `false`, `true satisfies
 * false` stops compiling, and the failure is the instruction: re-run the triage
 * and burn it down.
 */
type IsUnknown<T> = [unknown] extends [T] ? ([T] extends [unknown] ? true : false) : false;
type IsAny<T> = 0 extends 1 & T ? true : false;
const _specJoinedReportBlockIsStillUntyped = true satisfies IsUnknown<SpecJoinedReportBlock>;
const _specJoinedReportBlockIsNotEvenAny = false satisfies IsAny<SpecJoinedReportBlock>;
void _specJoinedReportBlockIsStillUntyped;
void _specJoinedReportBlockIsNotEvenAny;

describe('JoinedReportBlock stays in the ledger (objectstack#4171)', () => {
  it('documents why: the spec ships the schema untyped', () => {
    // The compile-time pins above are the real guard; this keeps the reason
    // visible in the test report rather than only in a comment.
    expect(true).toBe(true);
  });
});
