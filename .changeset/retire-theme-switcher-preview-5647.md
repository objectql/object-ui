---
'@object-ui/types': minor
---

Retire `ThemeSwitcherSchema` (`type: 'theme-switcher'`) and
`ThemePreviewSchema` (`type: 'theme-preview'`) — the two remaining theme
component kinds, which no renderer implemented — together with
`ThemeUnionSchema`, the union that after objectui#5489 held only these two
members (objectui#5647).

`packages/types/src/theme.ts` declared a theme-switcher control (`variant`,
`showMode`, `showThemes`, `lightIcon`, `darkIcon`) and a theme-preview panel
(`showColors`, `showTypography`, `showComponents`), and
`packages/types/src/zod/theme.zod.ts` published the matching Zod objects as
the two members of `ThemeUnionSchema` and therefore of `AnyComponentSchema`.
Nothing rendered either: neither literal appears at any
`ComponentRegistry.register(...)` / `registerLazy(...)` site in
`packages/*/src` (202 registered keys enumerated; positive control on the same
pipeline: `tooltip` → 1), nor in `PROTOCOL_COMPONENTS` /
`PALETTE_PLACEHOLDER_BLOCKS`
(`packages/components/src/renderers/placeholders.tsx`), and no fixture
declares either kind (control: `"type": "form"` → 81) — so a page declaring
one got the registry's "Unknown component type" panel (OBJUI-001), never a
switcher or a preview. Declared-but-unenforced, removed under the 2026-08-21
maintainer ruling (option B) on objectstack#10485, extended to these siblings
by inheritance on identical evidence (objectui#5647).

Removed from the published surface: the `ThemeSwitcherSchema` /
`ThemePreviewSchema` types (`@object-ui/types`), the matching Zod objects and
`ThemeUnionSchema` (`@object-ui/types/zod`), and the `ThemeSwitcherSchemaType`
/ `ThemePreviewSchemaType` inference aliases. `zod/theme.zod.ts` now exports
nothing and stands as the tombstone module. A schema spelling
`type: 'theme-switcher'` or `type: 'theme-preview'` is now REFUSED by
`AnyComponentSchema.safeParse` rather than accepted and then rendered as an
error panel, which is pinned by a test.

**The theme system is unchanged.** `Theme` (the theme document vocabulary,
owned by `@object-ui/types` since objectui#5716), `ThemeEngine`
(`@object-ui/core`) and `ThemeProvider` (`@object-ui/react`) are retained and
untouched — the rulings retain them explicitly. Author a theme as a document
handed to `ThemeProvider`; that path never went through the removed component
kinds.
