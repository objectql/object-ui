/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * @object-ui/types/zod - Theme Component Zod Validators
 *
 * Zod validation schemas for the theme COMPONENT nodes (`theme-switcher` /
 * `theme-preview`) — objectui-local declarations, recorded for triage as
 * objectui#5647.
 *
 * The six `@objectstack/spec/ui` theme-schema re-exports that used to live
 * here (`ColorPaletteSchema`, `TypographySchema`, `BorderRadiusSchema`,
 * `ShadowSchema`, `ThemeModeSchema`, `ThemeDefinitionSchema` — the spec's
 * `ThemeSchema`) are RETIRED. objectstack#10485 (ADR-0049 enforce-or-remove,
 * PR objectstack#10695) deleted the spec's whole `ui/theme.zod.ts` module —
 * values AND types, `AnimationSchema`/`ZIndexSchema` having gone earlier in
 * 17.0.0-rc.3 (objectstack#5021) — and the maintainer's ruling on
 * objectstack#10856 (2026-08-22, Options A + C) has objectui REMOVE these
 * dangling imports; restoring the spec exports (Option B) was explicitly not
 * taken. Executed as objectui#5710.
 *
 * The theme SYSTEM is retained by the same rulings: the `Theme` TYPE surface
 * lives in `../theme.ts`, `ThemeEngine` turns a theme document into CSS
 * variables, and `ThemeProvider` applies it — none of them consumed these
 * runtime validators (measured at objectui#5710). Do NOT hand-write local
 * mirrors of the retired schemas here: that localization is a contract
 * decision no ruling has taken, and `__tests__/spec-subschema-parity.test.ts`
 * pins the retired names out of this module.
 *
 * @module zod/theme
 * @packageDocumentation
 */

import { z } from 'zod';
import { BaseSchema } from './base.zod.js';

// `ThemeComponentSchema` (`type: 'theme'`) RETIRED in objectui#5489 — the value
// side of the interface retired in `../theme.ts`, where the ruling and the
// unregistered-kind measurement are recorded. Its former retention note kept
// `ThemeDefinitionSchema` / `ThemeModeSchema` exported here "for the engine and
// the provider" — measured stale at objectui#5710: the engine and the provider
// consume the `Theme` / `ThemePreference` TYPES, and no package imported either
// validator. Both left with the spec's theme module (see the header).

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
 *
 * The `theme` / `mode` props RETIRED with the spec's theme module (see the
 * header): their validators (`ThemeDefinitionSchema` / `ThemeModeSchema`) no
 * longer exist upstream, and hand-writing local mirrors is the localization
 * branch the objectstack#10856 ruling left untaken. `BaseSchema` is
 * `.passthrough()`, so an authored `theme:` / `mode:` key now passes through
 * unvalidated rather than being checked — tolerable only because no renderer
 * registers `theme-preview` at all (objectui#5647 measured the kind itself as
 * declared-but-unenforced and holds it for triage).
 */
export const ThemePreviewSchema = BaseSchema.extend({
  type: z.literal('theme-preview'),
  showColors: z.boolean().optional().describe('Show color palette'),
  showTypography: z.boolean().optional().describe('Show typography samples'),
  showComponents: z.boolean().optional().describe('Show component samples'),
});

/**
 * Union of all theme component schemas (for AnyComponentSchema union).
 */
export const ThemeUnionSchema = z.discriminatedUnion('type', [
  ThemeSwitcherSchema,
  ThemePreviewSchema,
]);

/**
 * Export type inference helpers
 */
export type ThemeSwitcherSchemaType = z.infer<typeof ThemeSwitcherSchema>;
export type ThemePreviewSchemaType = z.infer<typeof ThemePreviewSchema>;
