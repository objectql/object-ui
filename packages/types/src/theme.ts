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

import type { BaseSchema } from './base.js';

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
// `export type` it was value-erased (#2561). It can no longer be imported from
// `@objectstack/spec/ui` either: objectstack#10485 (PR objectstack#10695)
// retired the spec's whole `ui/theme.zod.ts` module, and the objectstack#10856
// ruling had objectui remove its dangling re-exports (objectui#5710). The
// installed `@objectstack/spec` pin still publishes the type re-exports in
// this file; re-homing the theme TYPE surface once the pin moves past the
// retirement is a separate, un-ruled decision — see the tripwire note in
// `packages/providers/src/__tests__/spec-symbol-batch7.test.ts`.

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

// `ThemeComponentSchema` (`type: 'theme'`) RETIRED in objectui#5489, under the
// maintainer ruling of 2026-08-21 on objectstack#10485 (option B, quoted
// verbatim and untranslated):
//
//   「B：退役授权面 —— 收掉 `themes` 载体键与 schema，`app.branding` 留作唯一颜色面；
//   objectui 引擎代码与单测保留」
//
// It declared a COMPONENT kind — a theme-manager node carrying `themes[]`,
// `activeTheme`, `allowSwitching`, `persistPreference` and `storageKey`. No
// renderer ever implemented `'theme'`: the literal is absent from every
// `ComponentRegistry.register(...)` / `registerLazy(...)` site in
// `packages/*/src`, and from both `PROTOCOL_COMPONENTS` and
// `PALETTE_PLACEHOLDER_BLOCKS` in
// `packages/components/src/renderers/placeholders.tsx` — so it did not even
// resolve to a placeholder. A page declaring one got the registry's "Unknown
// component type" panel (OBJUI-001), never a theme manager. Declared-but-
// unenforced, the ADR-0078 class.
//
// The theme SYSTEM is untouched and is explicitly RETAINED by the same ruling:
// `Theme` above is the spec's authoring theme document, `ThemeEngine`
// (`packages/core/src/theme/ThemeEngine.ts`) turns it into CSS variables, and
// `ThemeProvider` (`packages/react/src/context/ThemeContext.tsx`) applies it.
// Retiring the dead component kind is not retiring theming.
//
// The two siblings below — `ThemeSwitcherSchema` / `ThemePreviewSchema` — are
// unregistered in exactly the same way but were NOT named by the ruling; they
// are recorded as objectui#5647 rather than removed here.

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
 *
 * The `theme` / `mode` members RETIRED with the spec's theme module
 * (objectstack#10485; removal ruled on objectstack#10856, executed as
 * objectui#5710): their zod validators no longer exist upstream, so keeping
 * the members here while `zod/theme.zod.ts` cannot check them would be
 * declared-without-enforcement. The kind itself is unregistered and held for
 * triage as objectui#5647.
 */
export interface ThemePreviewSchema extends BaseSchema {
  type: 'theme-preview';

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
