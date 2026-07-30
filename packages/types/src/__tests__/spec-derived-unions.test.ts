/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Hand-written unions that shadowed a spec vocabulary. (#2944, #2901)
 *
 * `spec-subschema-parity.test.ts` pins zod schemas by REFERENCE, which is the
 * strongest possible check — a faithful copy fails, because a copy is a fork.
 * TS type aliases cannot be pinned that way: they erase at runtime, and a
 * restated union that happens to match is indistinguishable from a derived one.
 *
 * So these assert the runtime vocabulary instead, which is what a restated union
 * would have drifted from. Each of these WAS drifted:
 *
 *  - `ChartType` carried 7 of the spec's 19 values. Because the sibling zod
 *    schema was re-exported under the spec's own symbol name, #2901 was filed
 *    reading this copy as the protocol and concluding the renderer had outgrown
 *    it — the premise was backwards.
 *  - `ReportType` was missing `joined`.
 *  - `ActionType` was missing `form`, under a doc comment claiming to be "the
 *    canonical definition from @objectstack/spec". `ActionRunner.executeForm`
 *    implements it, so a host app typing against @object-ui/types got an error
 *    on working code.
 *
 * The `satisfies` checks below ARE enforcement — but only since #3005 added
 * `packages/types/tsconfig.test.json` and chained it from this package's
 * `type-check` script.
 *
 * For the whole interval before that they were decorative, and an earlier version
 * of this comment asserting they were "the real enforcement" was simply false:
 * `tsconfig.json` excludes test files (it is the package build, with `rootDir`,
 * `composite` and `declaration`, so tests would emit into dist), and no other
 * `tsc` invocation read this file. Measured at the time: reverting a derived alias
 * to its old hand-written fork produced ZERO type errors. It now produces
 * `TS1360` pointing at the `satisfies` line below.
 *
 * The runtime assertions further down are still the stronger check for anything
 * with a runtime witness — a type alias erases, so only reference identity
 * distinguishes a re-export from a faithful copy. Keep both.
 *
 * The last case is the inverse: `navigation` is a name objectui runs that the
 * spec does NOT have. It is asserted absent from the spec so that the day the
 * spec adopts it, this file fails and names the alias to retire.
 */
import { describe, it, expect } from 'vitest';
import {
  ChartTypeSchema as SpecChartTypeSchema,
  ReportType as SpecReportType,
  ActionType as SpecActionType,
  PageTypeSchema as SpecPageTypeSchema,
  ACTION_LOCATIONS as SpecACTION_LOCATIONS,
  ActionLocationSchema as SpecActionLocationSchema,
  ActionSchema as SpecActionSchema,
} from '@objectstack/spec/ui';
import { FieldType as SpecFieldType } from '@objectstack/spec/data';
import {
  OBJECTUI_LOCAL_ACTION_TYPES,
  OBJECTUI_LOCAL_PARAM_FIELD_TYPES,
  ACTION_LOCATIONS,
  ActionLocationSchema,
  ACTION_PARAM_FIELD_TYPES,
} from '../ui-action';
import type { ChartType } from '../data-display';
import type { ReportType } from '../reports';
import type {
  ActionType,
  RunnableActionType,
  ActionComponent,
  ActionParamFieldType,
  ResolvableParamFieldType,
} from '../ui-action';
import type { PageType, PageVisualizationAlias } from '../layout';

/**
 * Compile-time coverage: every spec member must be assignable to the objectui
 * alias. A restated union that drops a value fails to compile here.
 */
type SpecChart = typeof SpecChartTypeSchema extends { options: readonly (infer T)[] } ? T : never;
const _chartCovers = null as unknown as SpecChart satisfies ChartType;
const _reportCovers = null as unknown as 'tabular' | 'summary' | 'matrix' | 'joined' satisfies ReportType;
const _actionCovers = null as unknown as 'script' | 'url' | 'modal' | 'flow' | 'api' | 'form' satisfies ActionType;
const _pageCovers = null as unknown as 'record' | 'home' | 'app' | 'utility' | 'list' satisfies PageType;
// The sanctioned local extensions are still part of their unions.
const _vizCovers = null as unknown as PageVisualizationAlias satisfies PageType;
const _runnableCovers = null as unknown as ActionType satisfies RunnableActionType;
// #4074: the action sub-vocabularies that were restated rather than derived.
const _componentCovers = null as unknown as
  | 'action:button'
  | 'action:icon'
  | 'action:menu'
  | 'action:group' satisfies ActionComponent;
// `ActionParamFieldType` is now the spec's `FieldType`, so every spec field type
// must be assignable — the old 16-member subset fails here.
type SpecField = typeof SpecFieldType extends { options: readonly (infer T)[] } ? T : never;
const _paramFieldCovers = null as unknown as SpecField satisfies ActionParamFieldType;
const _resolvableCovers = null as unknown as ActionParamFieldType satisfies ResolvableParamFieldType;
void _chartCovers; void _reportCovers; void _actionCovers; void _pageCovers; void _vizCovers;
void _runnableCovers; void _componentCovers; void _paramFieldCovers; void _resolvableCovers;

/** Read a spec enum's members, failing loudly if the shape ever changes. */
const optionsOf = (schema: unknown, name: string): string[] => {
  const raw = (schema as { options?: readonly string[] })?.options;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(`could not read ${name}.options from @objectstack/spec`);
  }
  return [...raw];
};

describe('unions derived from a spec vocabulary stay derived (#2944)', () => {
  it('the spec still exposes each enum', () => {
    // Guards every assertion below from passing on an empty list.
    expect(optionsOf(SpecChartTypeSchema, 'ChartTypeSchema').length).toBeGreaterThan(0);
    expect(optionsOf(SpecReportType, 'ReportType').length).toBeGreaterThan(0);
    expect(optionsOf(SpecActionType, 'ActionType').length).toBeGreaterThan(0);
    expect(optionsOf(SpecPageTypeSchema, 'PageTypeSchema').length).toBeGreaterThan(0);
  });

  it('ActionType includes `form` — the member the fork dropped', () => {
    expect(optionsOf(SpecActionType, 'ActionType')).toContain('form');
  });

  it('`navigation` is objectui\'s declared alias, not a spec action type', () => {
    // #2944 item 3 asked for a decision: promote `navigation` upstream or delete
    // the `ActionRunner` case. Neither, as stated. The spec already has `url` for
    // "go to a location" (with `openIn`), so a seventh type would be a second
    // spec name for one operation — the exact failure this audit is named after.
    // And deleting the case is silent, not loud: the action falls into
    // `executeActionSchema`, which returns success without navigating (#2960).
    //
    // So it stays as a NAMED local alias sharing `url`'s navigator. This test is
    // the tripwire: if the spec ever does adopt `navigation`, it fails and the
    // alias is the thing to retire.
    expect(optionsOf(SpecActionType, 'ActionType')).not.toContain('navigation');
    expect([...OBJECTUI_LOCAL_ACTION_TYPES]).toEqual(['navigation']);
  });

  it('ReportType includes `joined` — the member the fork dropped', () => {
    expect(optionsOf(SpecReportType, 'ReportType')).toContain('joined');
  });

  it('PageTypeSchema includes `list` — the member the fork dropped', () => {
    expect(optionsOf(SpecPageTypeSchema, 'PageTypeSchema')).toContain('list');
  });

  it('ChartTypeSchema is far wider than the 7 the fork carried', () => {
    const spec = optionsOf(SpecChartTypeSchema, 'ChartTypeSchema');
    const forked = ['line', 'bar', 'area', 'pie', 'donut', 'radar', 'scatter'];
    expect(spec.length).toBeGreaterThan(forked.length);
    // Everything the fork had is still real, so no consumer of the old union breaks.
    expect(forked.filter((v) => !spec.includes(v))).toEqual([]);
  });

  it('ACTION_LOCATIONS / ActionLocationSchema ARE the spec\'s, by reference (#4074)', () => {
    // The doc comment claimed "re-export" while the code re-declared a parallel
    // union + `as const` tuple + `z.enum`. Identity is the only check that tells
    // a re-export from a faithful copy — a copy passes any value comparison.
    expect(ACTION_LOCATIONS).toBe(SpecACTION_LOCATIONS);
    expect(ActionLocationSchema).toBe(SpecActionLocationSchema);
    // #2561 decision (a) drops spec/ui's `…Schema` names from this package, but
    // these two are explicitly kept — so they must still be defined VALUES, not
    // type-erased to undefined.
    expect(ActionLocationSchema).toBeDefined();
    expect(optionsOf(ActionLocationSchema, 'ActionLocationSchema')).toContain('record_header');
  });

  it('the spec still accepts every ActionComponent value (#4074)', () => {
    // `ActionSchema` is a lazySchema proxy that does not forward `.shape`, so the
    // enum is asserted behaviorally through parse — stronger than reading
    // `.options` anyway, since it proves the value is accepted end-to-end.
    const base = { name: 'act', label: 'Act', type: 'script' as const, target: 'run' };
    for (const component of ['action:button', 'action:icon', 'action:menu', 'action:group']) {
      const parsed = SpecActionSchema.safeParse({ ...base, component });
      expect(parsed.success, `spec rejected component '${component}'`).toBe(true);
    }
    // Negative control: the whitelist is a whitelist.
    expect(SpecActionSchema.safeParse({ ...base, component: 'action:carousel' }).success).toBe(false);
  });

  it('ACTION_PARAM_FIELD_TYPES IS the spec\'s FieldType list, by reference (#4074)', () => {
    // `ActionParamFieldType` is a type alias, so it erases — nothing at runtime
    // stops a future edit from restating it as a literal union, which is how the
    // 16-member fork got there. This array is the witness: identity fails against
    // a hand-listed copy.
    expect(ACTION_PARAM_FIELD_TYPES).toBe(SpecFieldType.options);
  });

  it('ActionParamFieldType covers the spec vocabulary the 16-member fork dropped (#4074)', () => {
    const spec = optionsOf(SpecFieldType, 'FieldType');
    const forked = [
      'text', 'textarea', 'number', 'boolean', 'date', 'datetime', 'time',
      'select', 'email', 'phone', 'url', 'password', 'file', 'color', 'slider', 'rating',
    ];
    // Everything the fork had is still real, so no consumer of the old union breaks.
    expect(forked.filter((v) => !spec.includes(v))).toEqual([]);
    // And it was a strict subset — these are the ones that failed `tsc` while
    // `ActionParamDialog` rendered them.
    expect(spec.length).toBeGreaterThan(forked.length);
    for (const missed of ['lookup', 'multiselect', 'currency', 'user', 'tags', 'json']) {
      expect(spec).toContain(missed);
      expect(forked).not.toContain(missed);
    }
  });

  it('the param-only type aliases are NOT spec field types (#4074)', () => {
    // Same contract as `navigation` above: these are objectui dialect
    // (`PARAM_TYPE_ALIASES` in app-shell's `paramToField.ts`), folded onto a
    // canonical widget type. If the spec adopts one, this fails and names the
    // alias to retire.
    const spec = optionsOf(SpecFieldType, 'FieldType');
    expect([...OBJECTUI_LOCAL_PARAM_FIELD_TYPES]).toEqual(['checkbox', 'reference', 'datetime-local']);
    expect(OBJECTUI_LOCAL_PARAM_FIELD_TYPES.filter((v) => spec.includes(v))).toEqual([]);
  });

  it('the page visualization names are NOT spec page types', () => {
    // `ui/page.zod.ts` says so explicitly; they survive only as the sanctioned
    // local extension in `layout.ts`. If the spec ever adopts one, drop it there.
    const spec = optionsOf(SpecPageTypeSchema, 'PageTypeSchema');
    const local = ['grid', 'gallery', 'kanban', 'calendar', 'timeline'];
    expect(local.filter((v) => spec.includes(v))).toEqual([]);
  });
});
