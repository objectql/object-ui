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
  BorderRadiusSchema as SpecBorderRadiusSchema,
  ShadowSchema as SpecShadowSchema,
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
 * Border Radius Schema — `@objectstack/spec/ui` schema re-exported by reference
 * (issue #2231; formerly a hand-written mirror).
 */
export const BorderRadiusSchema = SpecBorderRadiusSchema;

/**
 * Shadow Schema — `@objectstack/spec/ui` schema re-exported by reference
 * (issue #2231; formerly a hand-written mirror).
 */
export const ShadowSchema = SpecShadowSchema;

// `AnimationSchema` / `ZIndexSchema` RETIRED in @objectstack/spec 17.0.0-rc.3
// (objectstack#5021 option 2, PR objectstack#5289). `theme.animation` and
// `theme.zIndex` are tombstones now and the spec deleted both value schemas
// outright; `theme.customVars` is the declared door. See `../theme.ts`.

/**
 * Theme Mode Schema — `@objectstack/spec/ui` schema re-exported by reference
 * (issue #2231; formerly a hand-written mirror).
 */
export const ThemeModeSchema = SpecThemeModeSchema;

/**
 * Theme Definition Schema — `@objectstack/spec/ui` `ThemeSchema` re-exported by
 * reference (issue #2231; formerly a hand-written mirror). `mode` defaults to the
 * spec's `'light'` (the old mirror had drifted to `'auto'`). The TS type side
 * (`Theme` in `../theme.ts`) is the spec's too, so validator and type agree.
 *
 * spec v17 (#3494) pruned the never-enforced `spacing`/`breakpoints`/`logo`/
 * `density`/`wcagContrast`/`rtl`/`touchTarget`/`keyboardNavigation` keys; they are
 * gone from this schema by reference, and their sub-schema re-exports went with
 * them rather than surviving here as an objectui-only mirror.
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
 * Union of all theme component schemas (for AnyComponentSchema union).
 */
export const ThemeUnionSchema = z.discriminatedUnion('type', [
  ThemeComponentSchema,
  ThemeSwitcherSchema,
  ThemePreviewSchema,
]);

/**
 * Export type inference helpers
 */
export type ColorPaletteSchemaType = z.infer<typeof ColorPaletteSchema>;
export type TypographySchemaType = z.infer<typeof TypographySchema>;
export type BorderRadiusSchemaType = z.infer<typeof BorderRadiusSchema>;
export type ShadowSchemaType = z.infer<typeof ShadowSchema>;
export type ThemeModeSchemaType = z.infer<typeof ThemeModeSchema>;
export type ThemeDefinitionSchemaType = z.infer<typeof ThemeDefinitionSchema>;
export type ThemeComponentSchemaType = z.infer<typeof ThemeComponentSchema>;
export type ThemeSwitcherSchemaType = z.infer<typeof ThemeSwitcherSchema>;
export type ThemePreviewSchemaType = z.infer<typeof ThemePreviewSchema>;
