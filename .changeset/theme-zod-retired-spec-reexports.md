---
'@object-ui/types': minor
---

Remove the six retired `@objectstack/spec/ui` theme-schema re-exports from `@object-ui/types/zod` — `ColorPaletteSchema`, `TypographySchema`, `BorderRadiusSchema`, `ShadowSchema`, `ThemeModeSchema`, `ThemeDefinitionSchema` (the spec's `ThemeSchema`) — plus their `…SchemaType` inference helpers, and the `theme` / `mode` props of `ThemePreviewSchema` (zod and interface) that consumed them.

objectstack#10485 (ADR-0049 enforce-or-remove, PR objectstack#10695) retired the spec's whole `ui/theme.zod.ts` module, and the maintainer's ruling on objectstack#10856 (Options A + C) has objectui remove the dangling imports first so the Console Pin Gate can build objectui against the framework tree; restoring the spec exports (Option B) was explicitly not taken. Breaking in effect for anyone importing those six names from `@object-ui/types/zod`: there is no replacement — the validators retired upstream with no successor. The theme TYPE surface (`Theme`, `ThemeMode`, `ColorPalette`, … re-exported from `@object-ui/types`) and the ThemeEngine/ThemeProvider runtime are unchanged.
