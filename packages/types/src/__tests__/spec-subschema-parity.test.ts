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
  BorderRadiusSchema as SpecBorderRadiusSchema,
  ShadowSchema as SpecShadowSchema,
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
  BorderRadiusSchema,
  ShadowSchema,
  AnimationSchema,
  ZIndexSchema,
  ThemeModeSchema,
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
    ['BorderRadiusSchema', BorderRadiusSchema, SpecBorderRadiusSchema],
    ['ShadowSchema', ShadowSchema, SpecShadowSchema],
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

/**
 * spec v17 (#3494) pruned the never-enforced Theme keys. They were re-exported
 * here by reference, so they left with the spec rather than surviving as an
 * objectui-only mirror — the second de-facto contract AGENTS.md #0.1 forbids.
 * This guards both ends: the keys stay gone from the spec schema, and objectui
 * does not quietly grow its own replacements.
 */
describe('spec v17 pruned Theme keys stay pruned (#3494)', () => {
  const PRUNED = [
    'spacing',
    'breakpoints',
    'logo',
    'density',
    'wcagContrast',
    'rtl',
    'touchTarget',
    'keyboardNavigation',
  ];

  it.each(PRUNED)('the spec Theme schema has no `%s` key', (key) => {
    const shape = (SpecThemeSchema as unknown as { shape: Record<string, unknown> }).shape;
    expect(
      key in shape,
      `spec v17 pruned Theme.${key}; if the spec brought it back, re-export it ` +
        `by reference instead of hand-writing a mirror`,
    ).toBe(false);
  });

  it('objectui does not re-add a mirror of the pruned sub-schemas', async () => {
    const themeZod = await import('../zod/theme.zod.js');
    for (const name of ['SpacingSchema', 'SpacingScaleSchema', 'BreakpointsSchema', 'ThemeLogoSchema']) {
      expect(
        name in themeZod,
        `'${name}' is gone from @objectstack/spec/ui — do not reintroduce it as an objectui-local schema`,
      ).toBe(false);
    }
  });
});

/**
 * spec v17 promoted objectui's last two local ListColumn extensions upstream
 * (objectui#2231), so the `.extend()` collapsed into a plain re-export. These
 * assertions now guard that collapse: the schema stays the spec object itself,
 * and the `summary` / `prefix` shapes the grid renderer depends on keep working
 * through it.
 */
describe('ListColumnSchema is the spec schema (the extension collapsed)', () => {
  const specShape = (SpecListColumnSchema as unknown as { shape: Record<string, unknown> }).shape;
  const ouiShape = (ListColumnSchema as unknown as { shape: Record<string, unknown> }).shape;

  it('is the spec schema itself, not a copy or an extension', () => {
    expect(
      ListColumnSchema,
      'ListColumnSchema must be SpecListColumnSchema by reference — if a local field ' +
        'is needed again, promote it into @objectstack/spec instead of re-extending here',
    ).toBe(SpecListColumnSchema);
  });

  it('carries no objectui-only fields', () => {
    const localOnly = Object.keys(ouiShape).filter((k) => !(k in specShape));
    expect(localOnly.sort()).toEqual([]);
  });

  it('summary keeps the spec enum as its by-reference base arm', () => {
    // ZodOptional<ZodUnion<[SpecColumnSummarySchema, ZodObject]>>
    const summary = ouiShape.summary as { unwrap(): { def: { options: unknown[] } } };
    const arms = summary.unwrap().def.options;
    expect(arms[0], 'summary union arm 0 must be the spec ColumnSummarySchema by reference').toBe(
      SpecColumnSummarySchema,
    );
  });

  it('the object arm accepts exactly the same aggregation vocabulary', () => {
    // Both arms must accept the same vocabulary: a name valid as the string
    // shorthand but rejected in the `{ type, field }` form (or vice versa)
    // means the per-column `field` override is unavailable for that
    // aggregation for no reason the author can see.
    //
    // Asserted behaviorally rather than by identity: the spec builds the object
    // arm through `lazySchema`, whose Proxy resolves `.shape.type` to the inner
    // enum instead of the exported schema object, so a `toBe` check would test
    // the wrapper rather than the vocabulary it is meant to protect.
    const vocabulary = (SpecColumnSummarySchema as unknown as { options: string[] }).options;
    expect(vocabulary.length, 'spec ColumnSummarySchema should be a non-empty enum').toBeGreaterThan(0);

    for (const agg of vocabulary) {
      expect(
        ListColumnSchema.shape.summary.safeParse(agg).success,
        `summary shorthand "${agg}" must parse`,
      ).toBe(true);
      expect(
        ListColumnSchema.shape.summary.safeParse({ type: agg, field: 'amount' }).success,
        `summary object form { type: "${agg}" } must parse — both arms share one vocabulary`,
      ).toBe(true);
    }

    // …and neither arm accepts a name outside it.
    expect(ListColumnSchema.shape.summary.safeParse('median').success).toBe(false);
    expect(ListColumnSchema.shape.summary.safeParse({ type: 'median' }).success).toBe(false);
  });

  it('summary accepts every spec aggregation and the renderer object form', () => {
    for (const agg of ['none', 'count', 'count_unique', 'percent_filled', 'sum', 'avg', 'min', 'max']) {
      expect(ListColumnSchema.shape.summary.safeParse(agg).success, `summary "${agg}"`).toBe(true);
    }
    expect(ListColumnSchema.shape.summary.safeParse({ type: 'sum', field: 'amount' }).success).toBe(true);
    // The old mirror's free-string arm is gone — unknown aggregations fail loudly.
    expect(ListColumnSchema.shape.summary.safeParse('median').success).toBe(false);
  });

  it('prefix parses the compound-cell form and defaults `type` to text', () => {
    const parsed = ListColumnSchema.shape.prefix.parse({ field: 'status' });
    // spec v17 made `type` a ZodDefault, so ObjectGrid's cell renderer always
    // gets a value where the old objectui-local schema left it undefined.
    expect(parsed).toEqual({ field: 'status', type: 'text' });
    expect(ListColumnSchema.shape.prefix.safeParse({ field: 'status', type: 'badge' }).success).toBe(true);
    expect(ListColumnSchema.shape.prefix.safeParse({ field: 'status', type: 'pill' }).success).toBe(false);
  });
});
