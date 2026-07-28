/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Sub-schema ↔ @objectstack/spec drift guard (issue #2231, phase 2).
 *
 * The former hand-written mirrors in `zod/objectql.zod.ts` and `zod/theme.zod.ts`
 * are now the spec's schemas **by reference** — re-forking one (replacing the
 * re-export with a local copy that can drift) is exactly the failure mode that
 * produced the original ListViewSchema divergence. These tests pin:
 *
 *   1. Reference identity for every direct re-export. `toBe` — not structural
 *      equality — so a "faithful copy" fails too: a copy is a fork.
 *   2. The one *derived* schema (`ListColumnSchema`): every spec field flows in,
 *      the local-extension set is exactly the sanctioned one, and the `summary`
 *      broadening keeps the spec enum as its first (by-reference) union arm.
 *
 * When one of these fails, do NOT fork the schema back to make it green — the
 * schema belongs upstream in `@objectstack/spec`. Extend locally via `.extend()`
 * on the spec base (and sanction the field here) only for genuinely
 * objectui-only renderer concerns. See #2231.
 */
import { describe, it, expect } from 'vitest';
import {
  HttpMethodSchema as SpecHttpMethodSchema,
  HttpRequestSchema as SpecHttpRequestSchema,
  ViewDataSchema as SpecViewDataSchema,
  ListColumnSchema as SpecListColumnSchema,
  ColumnSummarySchema as SpecColumnSummarySchema,
  SelectionConfigSchema as SpecSelectionConfigSchema,
  PaginationConfigSchema as SpecPaginationConfigSchema,
  ColorPaletteSchema as SpecColorPaletteSchema,
  TypographySchema as SpecTypographySchema,
  SpacingSchema as SpecSpacingSchema,
  BorderRadiusSchema as SpecBorderRadiusSchema,
  ShadowSchema as SpecShadowSchema,
  BreakpointsSchema as SpecBreakpointsSchema,
  AnimationSchema as SpecAnimationSchema,
  ZIndexSchema as SpecZIndexSchema,
  ThemeModeSchema as SpecThemeModeSchema,
  ThemeSchema as SpecThemeSchema,
} from '@objectstack/spec/ui';
import {
  HttpMethodSchema,
  HttpRequestSchema,
  ViewDataSchema,
  ListColumnSchema,
  SelectionConfigSchema,
  PaginationConfigSchema,
} from '../zod/objectql.zod.js';
import {
  ColorPaletteSchema,
  TypographySchema,
  SpacingSchema,
  BorderRadiusSchema,
  ShadowSchema,
  BreakpointsSchema,
  AnimationSchema,
  ZIndexSchema,
  ThemeModeSchema,
  ThemeLogoSchema,
  ThemeDefinitionSchema,
} from '../zod/theme.zod.js';

describe('spec sub-schema re-exports are the spec objects (by reference)', () => {
  const pairs: Array<[string, unknown, unknown]> = [
    ['HttpMethodSchema', HttpMethodSchema, SpecHttpMethodSchema],
    ['HttpRequestSchema', HttpRequestSchema, SpecHttpRequestSchema],
    ['ViewDataSchema', ViewDataSchema, SpecViewDataSchema],
    ['SelectionConfigSchema', SelectionConfigSchema, SpecSelectionConfigSchema],
    ['PaginationConfigSchema', PaginationConfigSchema, SpecPaginationConfigSchema],
    ['ColorPaletteSchema', ColorPaletteSchema, SpecColorPaletteSchema],
    ['TypographySchema', TypographySchema, SpecTypographySchema],
    ['SpacingSchema', SpacingSchema, SpecSpacingSchema],
    ['BorderRadiusSchema', BorderRadiusSchema, SpecBorderRadiusSchema],
    ['ShadowSchema', ShadowSchema, SpecShadowSchema],
    ['BreakpointsSchema', BreakpointsSchema, SpecBreakpointsSchema],
    ['AnimationSchema', AnimationSchema, SpecAnimationSchema],
    ['ZIndexSchema', ZIndexSchema, SpecZIndexSchema],
    ['ThemeModeSchema', ThemeModeSchema, SpecThemeModeSchema],
    ['ThemeDefinitionSchema', ThemeDefinitionSchema, SpecThemeSchema],
  ];

  it.each(pairs.map(([name]) => [name] as const))('%s', (name) => {
    const [, oui, spec] = pairs.find(([n]) => n === name)!;
    expect(oui, `${name} must be the spec schema itself, not a copy`).toBe(spec);
  });
});

describe('ThemeLogoSchema is the spec Theme logo shape (unwrapped by reference)', () => {
  it('accepts and round-trips the spec logo keys', () => {
    const logo = { light: '/l.svg', dark: '/d.svg', favicon: '/f.ico' };
    expect(ThemeLogoSchema.parse(logo)).toEqual(logo);
  });

  it('has exactly the spec inline-logo key set', () => {
    const specLogoShape = (SpecThemeSchema.shape.logo.unwrap() as { shape: Record<string, unknown> }).shape;
    const ouiLogoShape = (ThemeLogoSchema as unknown as { shape: Record<string, unknown> }).shape;
    expect(Object.keys(ouiLogoShape).sort()).toEqual(Object.keys(specLogoShape).sort());
  });
});

describe('ListColumnSchema derives from the spec (extend, not fork)', () => {
  const specShape = (SpecListColumnSchema as unknown as { shape: Record<string, unknown> }).shape;
  const ouiShape = (ListColumnSchema as unknown as { shape: Record<string, unknown> }).shape;

  /**
   * objectui-only ListColumn fields — sanctioned local extensions. Each should be
   * promoted into `@objectstack/spec` rather than grown here.
   */
  const SANCTIONED_LOCAL = new Set<string>([
    // Airtable-style compound-cell prefix — read by ObjectGrid's cell renderer.
    'prefix',
  ]);
  // `summary` is intentionally overridden (spec enum ∪ { type, field } object form
  // supported by plugin-grid's useColumnSummary) — asserted separately below.
  const OVERRIDDEN = new Set<string>(['summary']);

  it('every spec field is present (spec fields flow in by reference)', () => {
    const missing = Object.keys(specShape).filter((k) => !(k in ouiShape));
    expect(missing, 'spec ListColumn fields missing from objectui — the derivation dropped them').toEqual([]);
  });

  it('spec fields are the spec schemas by reference (except sanctioned overrides)', () => {
    for (const k of Object.keys(specShape)) {
      if (OVERRIDDEN.has(k)) continue;
      expect(ouiShape[k], `ListColumnSchema.${k} must flow in from the spec by reference`).toBe(specShape[k]);
    }
  });

  it('objectui-only fields are exactly the sanctioned set', () => {
    const localOnly = Object.keys(ouiShape).filter((k) => !(k in specShape));
    expect(localOnly.sort()).toEqual([...SANCTIONED_LOCAL].sort());
  });

  it('summary keeps the spec enum as its by-reference base arm', () => {
    // ZodOptional<ZodUnion<[SpecColumnSummarySchema, ZodObject]>>
    const summary = ouiShape.summary as { unwrap(): { def: { options: unknown[] } } };
    const arms = summary.unwrap().def.options;
    expect(arms[0], 'summary union arm 0 must be the spec ColumnSummarySchema by reference').toBe(
      SpecColumnSummarySchema,
    );
  });

  it('summary accepts every spec aggregation and the renderer object form', () => {
    for (const agg of ['none', 'count', 'count_unique', 'percent_filled', 'sum', 'avg', 'min', 'max']) {
      expect(ListColumnSchema.shape.summary.safeParse(agg).success, `summary "${agg}"`).toBe(true);
    }
    expect(ListColumnSchema.shape.summary.safeParse({ type: 'sum', field: 'amount' }).success).toBe(true);
    // The old mirror's free-string arm is gone — unknown aggregations fail loudly.
    expect(ListColumnSchema.shape.summary.safeParse('median').success).toBe(false);
  });
});
