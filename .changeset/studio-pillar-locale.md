---
'@object-ui/app-shell': patch
---

Studio pillars now follow the app's active locale instead of hardcoding Chinese.
`StudioDesignSurface` pinned `const locale = 'zh-CN'` in its Interfaces / Data /
Automations pillars, so the builder always rendered Chinese even when the console
ran in English (while the Home page and the rest of the app followed the active
locale). Every inline string across the design surface — package switcher,
publish/app-bridge header, the four pillars (Data, Automations, Interfaces,
Access), and the nav-item inspector — is now extracted into the metadata-admin
`engine.studio.*` catalog with English + Chinese entries, and a new
`useMetadataLocale()` hook threads the live `useObjectTranslation().language`
(the same source the LocaleSwitcher drives) so switching the console language
re-renders the Studio in lock-step. `AppNavCanvas` (used by the Studio and the
metadata-admin App preview) is likewise localized via `engine.appNav.*` — its
previously hardcoded English "NAVIGATION", "Add nav item", "Remove nav item", and
empty-state strings now follow the active locale.
