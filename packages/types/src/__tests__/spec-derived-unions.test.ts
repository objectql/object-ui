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
 * The `satisfies` checks below are the real enforcement: they stop compiling if
 * the objectui alias stops covering the spec vocabulary. The runtime assertions
 * guard against the spec's own enum being emptied or renamed underneath us.
 */
import { describe, it, expect } from 'vitest';
import {
  ChartTypeSchema as SpecChartTypeSchema,
  ReportType as SpecReportType,
  ActionType as SpecActionType,
  PageTypeSchema as SpecPageTypeSchema,
} from '@objectstack/spec/ui';
import type { ChartType } from '../data-display';
import type { ReportType } from '../reports';
import type { ActionType } from '../ui-action';
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
// The sanctioned local extension is still part of the union.
const _vizCovers = null as unknown as PageVisualizationAlias satisfies PageType;
void _chartCovers; void _reportCovers; void _actionCovers; void _pageCovers; void _vizCovers;

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

  it('the page visualization names are NOT spec page types', () => {
    // `ui/page.zod.ts` says so explicitly; they survive only as the sanctioned
    // local extension in `layout.ts`. If the spec ever adopts one, drop it there.
    const spec = optionsOf(SpecPageTypeSchema, 'PageTypeSchema');
    const local = ['grid', 'gallery', 'kanban', 'calendar', 'timeline'];
    expect(local.filter((v) => spec.includes(v))).toEqual([]);
  });
});
