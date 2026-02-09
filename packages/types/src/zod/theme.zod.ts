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
import { BaseSchema } from './base.zod.js';

/**
 * Color Palette Schema
 * Mirrors @objectstack/spec/ui ColorPaletteSchema.
 */
export const ColorPaletteSchema = z.object({
  primary: z.string().describe('Primary brand color'),
  secondary: z.string().optional().describe('Secondary color'),
  accent: z.string().optional().describe('Accent color'),
  success: z.string().optional().describe('Success color'),
  warning: z.string().optional().describe('Warning color'),
  error: z.string().optional().describe('Error color'),
  info: z.string().optional().describe('Informational color'),
  background: z.string().optional().describe('Background color'),
  surface: z.string().optional().describe('Surface/card background color'),
  text: z.string().optional().describe('Primary text color'),
  textSecondary: z.string().optional().describe('Secondary text color'),
  border: z.string().optional().describe('Border color'),
  disabled: z.string().optional().describe('Disabled state color'),
  primaryLight: z.string().optional().describe('Lighter primary variant'),
  primaryDark: z.string().optional().describe('Darker primary variant'),
  secondaryLight: z.string().optional().describe('Lighter secondary variant'),
  secondaryDark: z.string().optional().describe('Darker secondary variant'),
});

/**
 * Typography Schema
 * Mirrors @objectstack/spec/ui TypographySchema.
 */
export const TypographySchema = z.object({
  fontFamily: z.object({
    base: z.string().optional().describe('Base body font family'),
    heading: z.string().optional().describe('Heading font family'),
    mono: z.string().optional().describe('Monospace font family'),
  }).optional().describe('Font family definitions'),
  fontSize: z.object({
    xs: z.string().optional(),
    sm: z.string().optional(),
    base: z.string().optional(),
    lg: z.string().optional(),
    xl: z.string().optional(),
    '2xl': z.string().optional(),
    '3xl': z.string().optional(),
    '4xl': z.string().optional(),
  }).optional().describe('Font size scale'),
  fontWeight: z.object({
    light: z.number().optional(),
    normal: z.number().optional(),
    medium: z.number().optional(),
    semibold: z.number().optional(),
    bold: z.number().optional(),
  }).optional().describe('Font weight scale'),
  lineHeight: z.object({
    tight: z.string().optional(),
    normal: z.string().optional(),
    relaxed: z.string().optional(),
    loose: z.string().optional(),
  }).optional().describe('Line height scale'),
  letterSpacing: z.object({
    tighter: z.string().optional(),
    tight: z.string().optional(),
    normal: z.string().optional(),
    wide: z.string().optional(),
    wider: z.string().optional(),
  }).optional().describe('Letter spacing scale'),
});

/**
 * Spacing Scale Schema
 * Mirrors @objectstack/spec/ui SpacingSchema.
 */
export const SpacingSchema = z.object({
  '0': z.string().optional(),
  '1': z.string().optional(),
  '2': z.string().optional(),
  '3': z.string().optional(),
  '4': z.string().optional(),
  '5': z.string().optional(),
  '6': z.string().optional(),
  '8': z.string().optional(),
  '10': z.string().optional(),
  '12': z.string().optional(),
  '16': z.string().optional(),
  '20': z.string().optional(),
  '24': z.string().optional(),
});

/**
 * Border Radius Schema
 * Mirrors @objectstack/spec/ui BorderRadiusSchema.
 */
export const BorderRadiusSchema = z.object({
  none: z.string().optional(),
  sm: z.string().optional(),
  base: z.string().optional(),
  md: z.string().optional(),
  lg: z.string().optional(),
  xl: z.string().optional(),
  '2xl': z.string().optional(),
  full: z.string().optional(),
});

/**
 * Shadow Schema
 * Mirrors @objectstack/spec/ui ShadowSchema.
 */
export const ShadowSchema = z.object({
  none: z.string().optional(),
  sm: z.string().optional(),
  base: z.string().optional(),
  md: z.string().optional(),
  lg: z.string().optional(),
  xl: z.string().optional(),
  '2xl': z.string().optional(),
  inner: z.string().optional(),
});

/**
 * Breakpoints Schema
 * Mirrors @objectstack/spec/ui BreakpointsSchema.
 */
export const BreakpointsSchema = z.object({
  xs: z.string().optional(),
  sm: z.string().optional(),
  md: z.string().optional(),
  lg: z.string().optional(),
  xl: z.string().optional(),
  '2xl': z.string().optional(),
});

/**
 * Animation Schema
 * Mirrors @objectstack/spec/ui AnimationSchema.
 */
export const AnimationSchema = z.object({
  duration: z.object({
    fast: z.string().optional(),
    base: z.string().optional(),
    slow: z.string().optional(),
  }).optional().describe('Duration presets'),
  timing: z.object({
    linear: z.string().optional(),
    ease: z.string().optional(),
    easeIn: z.string().optional(),
    easeOut: z.string().optional(),
    easeInOut: z.string().optional(),
  }).optional().describe('Timing function presets'),
});

/**
 * Z-Index Schema
 * Mirrors @objectstack/spec/ui ZIndexSchema.
 */
export const ZIndexSchema = z.object({
  base: z.number().optional(),
  dropdown: z.number().optional(),
  sticky: z.number().optional(),
  fixed: z.number().optional(),
  modalBackdrop: z.number().optional(),
  modal: z.number().optional(),
  popover: z.number().optional(),
  tooltip: z.number().optional(),
});

/**
 * Theme Mode Schema
 * Mirrors @objectstack/spec/ui ThemeMode.
 */
export const ThemeModeSchema = z.enum(['light', 'dark', 'auto']).describe('Theme mode');

/**
 * Theme Logo Schema
 * Mirrors the inline logo object in @objectstack/spec ThemeSchema.
 */
export const ThemeLogoSchema = z.object({
  light: z.string().optional().describe('Logo URL for light mode'),
  dark: z.string().optional().describe('Logo URL for dark mode'),
  favicon: z.string().optional().describe('Favicon URL'),
});

/**
 * Theme Definition Schema
 * Mirrors @objectstack/spec/ui ThemeSchema.
 */
export const ThemeDefinitionSchema = z.object({
  name: z.string().describe('Theme identifier'),
  label: z.string().describe('Display label'),
  description: z.string().optional().describe('Human-readable description'),
  mode: ThemeModeSchema.default('auto').describe('Theme mode'),
  colors: ColorPaletteSchema.describe('Semantic color palette'),
  typography: TypographySchema.optional().describe('Typography design tokens'),
  spacing: SpacingSchema.optional().describe('Spacing scale'),
  borderRadius: BorderRadiusSchema.optional().describe('Border radius scale'),
  shadows: ShadowSchema.optional().describe('Shadow scale'),
  breakpoints: BreakpointsSchema.optional().describe('Responsive breakpoints'),
  animation: AnimationSchema.optional().describe('Animation presets'),
  zIndex: ZIndexSchema.optional().describe('Z-index layering'),
  customVars: z.record(z.string(), z.string()).optional().describe('Custom CSS variables'),
  logo: ThemeLogoSchema.optional().describe('Logo/branding assets'),
  extends: z.string().optional().describe('Extend another theme by name'),
});

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
export const ThemeUnionSchema = z.union([
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
