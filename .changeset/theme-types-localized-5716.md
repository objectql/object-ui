---
'@object-ui/types': minor
'@object-ui/providers': minor
---

Localize the theme document types: `@object-ui/types` now owns `Theme`, `ThemeMode` and `ColorPalette` (objectui#5716 ruling, 2026-08-23). The spec retired its theme module (objectstack#10485) while ObjectUI retained the theme system, so the types are hand-written from the last-published `@objectstack/spec` 17.1.0 shapes instead of re-exported — a spec dependency refresh past the retirement no longer breaks these packages.

Published-name REMOVALS from `@object-ui/types` (zero in-repo readers, deleted under the same ruling's rider):

- `Typography` — the shape lives on as the inline `Theme['typography']` member.
- `BorderRadius` — lives on as inline `Theme['borderRadius']`.
- `Shadow` — lives on as inline `Theme['shadows']`.
- `ThemeDefinition` — the deprecated alias of `Theme`; use `Theme`.

Also added: `THEME_MODES`, a runtime tuple witness of the theme mode vocabulary (`['auto', 'light', 'dark']`).

The `UI` protocol namespace (`import { UI } from '@object-ui/types'`) now resolves `UI.Theme` / `UI.ThemeMode` / `UI.ColorPalette` to the local owners, so they survive the upcoming spec refresh; the rest of the namespace continues to track `@objectstack/spec/ui`. After that refresh, retired spec/ui members (`UI.ThemeSchema`, `UI.ThemeModeSchema`, `UI.ThemeParsed`, `UI.Typography`, `UI.BorderRadius`, `UI.Shadow`, `UI.defineTheme`) drop out of the namespace.

`@object-ui/providers`: `ThemePreference` is now derived from `@object-ui/types`' `ThemeMode` instead of the retired spec `ThemeModeSchema` (same union: `'auto' | 'light' | 'dark' | 'system'`).
