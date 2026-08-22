---
'@object-ui/types': minor
---

Retire `ThemeComponentSchema` (`type: 'theme'`) — a component kind no renderer
implemented (objectui#5489).

`packages/types/src/theme.ts` declared a theme-manager **component** carrying
`themes[]`, `activeTheme`, `allowSwitching`, `persistPreference` and
`storageKey`, and `packages/types/src/zod/theme.zod.ts` published the matching
Zod object as a member of `ThemeUnionSchema` and therefore of
`AnyComponentSchema`. Nothing rendered it: `'theme'` appears at no
`ComponentRegistry.register(...)` / `registerLazy(...)` site in `packages/*/src`,
and in neither `PROTOCOL_COMPONENTS` nor `PALETTE_PLACEHOLDER_BLOCKS`
(`packages/components/src/renderers/placeholders.tsx`), so it did not even
resolve to a placeholder — a page declaring one got the registry's "Unknown
component type" panel (OBJUI-001) instead of a theme manager. Declared-but-
unenforced, removed under the maintainer ruling of 2026-08-21 on
objectstack#10485 (option B).

Removed from the published surface: the `ThemeComponentSchema` type
(`@object-ui/types`), the `ThemeComponentSchema` Zod object
(`@object-ui/types/zod`), the `ThemeComponentSchemaType` inference alias, and the
`'theme'` member of `ThemeUnionSchema` / `AnyComponentSchema`. A schema spelling
`type: 'theme'` is now REFUSED by `AnyComponentSchema.safeParse` rather than
accepted and then rendered as an error panel, which is pinned by a test.

**The theme system is unchanged.** `Theme` (the spec's authoring theme
document), `ThemeDefinitionSchema`, `ThemeModeSchema`, `ThemeEngine`
(`@object-ui/core`) and `ThemeProvider` (`@object-ui/react`) are all retained and
untouched — the same ruling retains them explicitly. Author a theme as a
document handed to `ThemeProvider`; that path never went through the removed
component kind.
