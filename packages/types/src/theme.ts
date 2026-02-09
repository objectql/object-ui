/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types - Theme Schema
 *
 * Defines theme configuration aligned with @objectstack/spec.
 * Provides the complete design token system: colors, typography,
 * spacing, borders, shadows, breakpoints, animation, z-index.
 *
 * @module theme
 * @packageDocumentation
 */

import type { BaseSchema } from './base';

// ============================================================================
// Spec-Canonical Theme Sub-types — imported from @objectstack/spec/ui
// Rule: "Never Redefine Types. ALWAYS import them."
// ============================================================================

/**
 * Color Palette Definition
 * Canonical definition from @objectstack/spec/ui.
 */
export type { ColorPalette } from '@objectstack/spec/ui';

/**
 * Typography Configuration
 * Canonical definition from @objectstack/spec/ui.
 */
export type { Typography } from '@objectstack/spec/ui';

/**
 * Spacing Scale Configuration
 * Canonical definition from @objectstack/spec/ui.
 */
export type { Spacing } from '@objectstack/spec/ui';

/**
 * Border Radius Configuration
 * Canonical definition from @objectstack/spec/ui.
 */
export type { BorderRadius } from '@objectstack/spec/ui';

/**
 * Shadow Configuration
 * Canonical definition from @objectstack/spec/ui.
 */
export type { Shadow } from '@objectstack/spec/ui';

/**
 * Responsive Breakpoints Configuration
 * Canonical definition from @objectstack/spec/ui.
 */
export type { Breakpoints } from '@objectstack/spec/ui';

/**
 * Animation Configuration
 * Canonical definition from @objectstack/spec/ui.
 */
export type { Animation } from '@objectstack/spec/ui';

/**
 * Z-Index Layer Configuration
 * Canonical definition from @objectstack/spec/ui.
 */
export type { ZIndex } from '@objectstack/spec/ui';

/**
 * Theme Mode
 * Canonical definition from @objectstack/spec/ui.
 */
export type { ThemeMode } from '@objectstack/spec/ui';

// Import spec types for local use in interfaces below
import type {
  ColorPalette,
  Typography,
  Spacing,
  BorderRadius,
  Shadow,
  Breakpoints,
  Animation,
  ZIndex,
  ThemeMode,
} from '@objectstack/spec/ui';

/**
 * Logo / Branding Assets
 * ObjectUI-specific convenience type matching the inline logo object
 * in @objectstack/spec ThemeSchema.
 */
export interface ThemeLogo {
  /** Logo URL for light mode */
  light?: string;
  /** Logo URL for dark mode */
  dark?: string;
  /** Favicon URL */
  favicon?: string;
}

/**
 * Complete Theme Definition
 * Compatible with @objectstack/spec Theme (input shape).
 *
 * Note: The spec's z.infer<Theme> has `mode` required (via ZodDefault).
 * ObjectUI uses the input shape where `mode` is optional (defaults to 'auto').
 *
 * This is the canonical JSON shape for a theme.
 * It can be serialized, stored, and applied at runtime via ThemeProvider.
 */
export interface Theme {
  /** Theme identifier (required) */
  name: string;
  /** Display label (required) */
  label: string;
  /** Human-readable description */
  description?: string;
  /** Theme mode: light, dark, or auto (default: 'auto') */
  mode?: ThemeMode;
  /** Semantic color palette (primary is required) */
  colors: ColorPalette;
  /** Typography design tokens */
  typography?: Typography;
  /** Spacing scale */
  spacing?: Spacing;
  /** Border radius scale */
  borderRadius?: BorderRadius;
  /** Shadow scale */
  shadows?: Shadow;
  /** Responsive breakpoint definitions */
  breakpoints?: Breakpoints;
  /** Animation duration and timing */
  animation?: Animation;
  /** Z-index layering system */
  zIndex?: ZIndex;
  /** Arbitrary CSS custom properties */
  customVars?: Record<string, string>;
  /** Logo/branding assets */
  logo?: ThemeLogo;
  /** Extend another theme by name */
  extends?: string;
}

// ============================================================================
// ObjectUI Component Schemas (UI rendering)
// ============================================================================

/**
 * Theme Component Schema
 *
 * Used by SchemaRenderer to render a theme manager component.
 */
export interface ThemeSchema extends BaseSchema {
  type: 'theme';

  /** Current theme mode */
  mode?: ThemeMode;

  /** Available themes */
  themes?: Theme[];

  /** Active theme name */
  activeTheme?: string;

  /** Allow user theme switching */
  allowSwitching?: boolean;

  /** Persist theme preference to storage */
  persistPreference?: boolean;

  /** Storage key for persisting theme */
  storageKey?: string;
}

/**
 * Theme Switcher Component Schema
 */
export interface ThemeSwitcherSchema extends BaseSchema {
  type: 'theme-switcher';

  /** Switcher variant */
  variant?: 'dropdown' | 'toggle' | 'buttons';

  /** Show mode selector (light/dark) */
  showMode?: boolean;

  /** Show theme selector */
  showThemes?: boolean;

  /** Icon for light mode */
  lightIcon?: string;

  /** Icon for dark mode */
  darkIcon?: string;
}

/**
 * Theme Preview Component Schema
 */
export interface ThemePreviewSchema extends BaseSchema {
  type: 'theme-preview';

  /** Theme to preview */
  theme?: Theme;

  /** Preview mode */
  mode?: ThemeMode;

  /** Show color palette */
  showColors?: boolean;

  /** Show typography samples */
  showTypography?: boolean;

  /** Show component samples */
  showComponents?: boolean;
}

// ============================================================================
// Legacy Aliases (Backward Compatibility)
// ============================================================================

/**
 * @deprecated Use `Theme` instead. Kept for backward compatibility.
 */
export type ThemeDefinition = Theme;

/**
 * @deprecated Use `Spacing` instead. Kept for backward compatibility.
 */
export type SpacingScale = Spacing;
