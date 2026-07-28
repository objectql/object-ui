/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types/zod - Theme Schema Zod Validators
 *
 * Zod validation schemas for theme configuration.
 * Aligned with @objectstack/spec UI specification.
 *
 * @module zod/theme
 * @packageDocumentation
 */

import { z } from 'zod';
import {
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
import { BaseSchema } from './base.zod.js';

/**
 * Color Palette Schema — `@objectstack/spec/ui` schema re-exported by reference
 * (issue #2231; formerly a hand-written mirror).
 */
export const ColorPaletteSchema = SpecColorPaletteSchema;

/**
 * Typography Schema — `@objectstack/spec/ui` schema re-exported by reference
 * (issue #2231; formerly a hand-written mirror).
 */
export const TypographySchema = SpecTypographySchema;

/**
 * Spacing Scale Schema — `@objectstack/spec/ui` schema re-exported by reference
 * (issue #2231; formerly a hand-written mirror).
 */
export const SpacingSchema = SpecSpacingSchema;

/**
 * Border Radius Schema — `@objectstack/spec/ui` schema re-exported by reference
 * (issue #2231; formerly a hand-written mirror).
 */
export const BorderRadiusSchema = SpecBorderRadiusSchema;

/**
 * Shadow Schema — `@objectstack/spec/ui` schema re-exported by reference
 * (issue #2231; formerly a hand-written mirror).
 */
export const ShadowSchema = SpecShadowSchema;

/**
 * Breakpoints Schema — `@objectstack/spec/ui` schema re-exported by reference
 * (issue #2231; formerly a hand-written mirror).
 */
export const BreakpointsSchema = SpecBreakpointsSchema;

/**
 * Animation Schema — `@objectstack/spec/ui` schema re-exported by reference
 * (issue #2231; formerly a hand-written mirror). The mirror's `timing` keys had
 * drifted to camelCase (`easeIn`); the spec — and the runtime consumer
 * (`usePageTransition`) — use snake_case (`ease_in`), which now applies here too.
 */
export const AnimationSchema = SpecAnimationSchema;

/**
 * Z-Index Schema — `@objectstack/spec/ui` schema re-exported by reference
 * (issue #2231; formerly a hand-written mirror).
 */
export const ZIndexSchema = SpecZIndexSchema;

/**
 * Theme Mode Schema — `@objectstack/spec/ui` schema re-exported by reference
 * (issue #2231; formerly a hand-written mirror).
 */
export const ThemeModeSchema = SpecThemeModeSchema;

/**
 * Theme Logo Schema — the inline `logo` object of `@objectstack/spec/ui`
 * `ThemeSchema`, unwrapped by reference so it cannot drift (issue #2231).
 */
export const ThemeLogoSchema = SpecThemeSchema.shape.logo.unwrap();

/**
 * Theme Definition Schema — `@objectstack/spec/ui` `ThemeSchema` re-exported by
 * reference (issue #2231; formerly a hand-written mirror). Differences vs the old
 * mirror: gains the spec's `density`/`wcagContrast`/`rtl`/`touchTarget`/
 * `keyboardNavigation` fields, and `mode` now defaults to the spec's `'light'`
 * (the mirror had drifted to `'auto'`). The TS type side (`Theme` in `../theme.ts`)
 * was already the spec's — this aligns the runtime validator with it.
 */
export const ThemeDefinitionSchema = SpecThemeSchema;

/**
 * Theme Component Schema (ObjectUI rendering)
 */
export const ThemeComponentSchema = BaseSchema.extend({
  type: z.literal('theme'),
  mode: ThemeModeSchema.optional().describe('Current theme mode'),
  themes: z.array(ThemeDefinitionSchema).optional().describe('Available themes'),
  activeTheme: z.string().optional().describe('Active theme name'),
  allowSwitching: z.boolean().optional().describe('Allow user theme switching'),
  persistPreference: z.boolean().optional().describe('Persist theme preference'),
  storageKey: z.string().optional().describe('Storage key for persisting theme'),
});

/**
 * Theme Switcher Schema
 */
export const ThemeSwitcherSchema = BaseSchema.extend({
  type: z.literal('theme-switcher'),
  variant: z.enum(['dropdown', 'toggle', 'buttons']).optional().describe('Switcher variant'),
  showMode: z.boolean().optional().describe('Show mode selector (light/dark)'),
  showThemes: z.boolean().optional().describe('Show theme selector'),
  lightIcon: z.string().optional().describe('Icon for light mode'),
  darkIcon: z.string().optional().describe('Icon for dark mode'),
});

/**
 * Theme Preview Schema
 */
export const ThemePreviewSchema = BaseSchema.extend({
  type: z.literal('theme-preview'),
  theme: ThemeDefinitionSchema.optional().describe('Theme to preview'),
  mode: ThemeModeSchema.optional().describe('Preview mode'),
  showColors: z.boolean().optional().describe('Show color palette'),
  showTypography: z.boolean().optional().describe('Show typography samples'),
  showComponents: z.boolean().optional().describe('Show component samples'),
});

/**
 * Legacy alias — use ThemeComponentSchema
 * @deprecated
 */
export const ThemeSchema = ThemeComponentSchema;

/**
 * Union of all theme component schemas (for AnyComponentSchema union).
 */
export const ThemeUnionSchema = z.discriminatedUnion('type', [
  ThemeComponentSchema,
  ThemeSwitcherSchema,
  ThemePreviewSchema,
]);

/**
 * Legacy alias — use SpacingSchema
 * @deprecated
 */
export const SpacingScaleSchema = SpacingSchema;

/**
 * Export type inference helpers
 */
export type ColorPaletteSchemaType = z.infer<typeof ColorPaletteSchema>;
export type TypographySchemaType = z.infer<typeof TypographySchema>;
export type SpacingSchemaType = z.infer<typeof SpacingSchema>;
export type BorderRadiusSchemaType = z.infer<typeof BorderRadiusSchema>;
export type ShadowSchemaType = z.infer<typeof ShadowSchema>;
export type BreakpointsSchemaType = z.infer<typeof BreakpointsSchema>;
export type AnimationSchemaType = z.infer<typeof AnimationSchema>;
export type ZIndexSchemaType = z.infer<typeof ZIndexSchema>;
export type ThemeModeSchemaType = z.infer<typeof ThemeModeSchema>;
export type ThemeDefinitionSchemaType = z.infer<typeof ThemeDefinitionSchema>;
export type ThemeSchemaType = z.infer<typeof ThemeSchema>;
export type ThemeSwitcherSchemaType = z.infer<typeof ThemeSwitcherSchema>;
export type ThemePreviewSchemaType = z.infer<typeof ThemePreviewSchema>;
