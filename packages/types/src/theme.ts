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
 * Border Radius Configuration
 * Canonical definition from @objectstack/spec/ui.
 */
export type { BorderRadius } from '@objectstack/spec/ui';

/**
 * Shadow Configuration
 * Canonical definition from @objectstack/spec/ui.
 */
export type { Shadow } from '@objectstack/spec/ui';

// `Animation` / `ZIndex` RETIRED in @objectstack/spec 17.0.0-rc.3
// (objectstack#5021 option 2, PR objectstack#5289). `ThemeSchema.animation` and
// `ThemeSchema.zIndex` became tombstones whose prescription points at
// `customVars`, and the spec DELETED the two value schemas outright rather than
// leave them standing beside the tombstones — an exported value schema with no
// consumer reads as a capability to whoever finds it. A `--z-modal` or a
// `--duration-fast` is authored through `theme.customVars` now.
//
// Removing the DEAD EMISSION side in `ThemeEngine.generateThemeVars()` is
// objectui#3361 and deliberately NOT done here; this is only the type surface
// that stopped compiling, which that card pre-declared would ride with the
// dependency refresh.

/**
 * Theme Mode
 * Canonical definition from @objectstack/spec/ui.
 */
export type { ThemeMode } from '@objectstack/spec/ui';

// `ThemeModeSchema` (the zod value) is intentionally not re-exported — under
// `export type` it was value-erased (#2561); import it from
// `@objectstack/spec/ui` directly when the runtime validator is needed.

// Import spec types for local use in interfaces below
import type {
  ThemeMode,
} from '@objectstack/spec/ui';

/**
 * Complete Theme Definition — the spec's **authoring** theme shape, re-exported
 * by reference (objectstack#4115) rather than restated.
 *
 * The interface this replaces was member-for-member identical to the spec's
 * authoring theme shape (verified by the mutual-assignability probe in
 * `__tests__/page-nav-misc-spec-parity.test.ts`), so the only thing the copy
 * added was a second place to drift from — under the spec's own symbol name,
 * which is what makes such a copy read as canonical to the next reader.
 *
 * **The `z.input` shape, not the parsed one**, and in `@objectstack/spec`
 * 17.0.0-rc.6 that shape is spelled `Theme`. Up to rc.5 the spec published
 * three names — `Theme` (= `z.infer`), `ThemeParsed` (= `z.infer`) and
 * `ThemeInput` (= `z.input`) — and this binding took `ThemeInput`. rc.6 retired
 * every `…Input` alias and made the bare name the input: `Theme` is now
 * `z.input<typeof ThemeSchema>` and `ThemeParsed` is the `z.infer` side. So
 * `ThemeInput` → `Theme` is a rename that preserves this binding's meaning
 * exactly; re-pointing at `ThemeParsed` would be the silent semantic change.
 * The reason the input side is the true one here is unchanged: `mode` is
 * required in the parsed shape because `.default('auto')` has already run, and
 * everything in objectui that carries a `Theme` is on the authoring side —
 * theme JSON as stored, edited and handed to `ThemeProvider`. This is the
 * `.default()`/`z.input` rule from objectui#3169: writing side → input type.
 *
 * This is the canonical JSON shape for a theme. It can be serialized, stored,
 * and applied at runtime via ThemeProvider.
 */
export type { Theme } from '@objectstack/spec/ui';

import type { Theme } from '@objectstack/spec/ui';

// ============================================================================
// ObjectUI Component Schemas (UI rendering)
// ============================================================================

/**
 * Theme Component Schema
 *
 * Used by SchemaRenderer to render a theme manager component.
 */
export interface ThemeComponentSchema extends BaseSchema {
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
