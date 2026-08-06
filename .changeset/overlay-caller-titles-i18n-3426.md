---
'@object-ui/plugin-list': patch
'@object-ui/plugin-grid': patch
'@object-ui/i18n': patch
---

Localize the record-detail overlay heading that `ListView` and `ObjectGrid`
build themselves (objectui#3426)

#3423 gave `NavigationOverlay`'s `resolvedTitle` an i18n default
(`detail.recordDetail`), but two hosts never let that default run: they
string-built an English heading in TypeScript and passed it as the `title`
prop, so a zh/ja/de session got a fully localized drawer with one English
heading on it.

- `packages/plugin-list/src/ListView.tsx` — `` `${schema.label} Detail` ``
- `packages/plugin-grid/src/ObjectGrid.tsx` — the same template, plus a bare
  `'Record Detail'` literal for the no-label case

Both are user-reachable, not dead defaults. `list-view` / `object-grid` are
public page blocks and `navigation` is an authorable key on their schema, so a
page that authors `navigation: { mode: 'drawer' }` opens exactly this overlay
on row click. (`app-shell`'s `ObjectView` does suppress it — it passes its own
`onRowClick`, which takes priority inside `useNavigationOverlay`, and renders
its own overlay — but that is one host overriding a public block, not proof the
branch is unreachable.)

## What changed

Both call sites now key their heading instead of concatenating it:

- a new `detail.recordDetailWithLabel` (`'{{label}} Detail'`) carries the
  object label through interpolation, so a pack whose qualifier trails the noun
  (`de`) or that needs a possessive particle (`ja`/`zh`) can write its own
  arrangement rather than inherit English word order;
- the no-label branch reuses `detail.recordDetail` — the very key the overlay
  itself defaults to — so one heading on one control cannot drift into two
  translations.

The new key is added to all ten locale packs and to each plugin's English
defaults map (`LIST_DEFAULT_TRANSLATIONS` / `GRID_DEFAULT_TRANSLATIONS`), which
is what `createSafeTranslation` falls back to with no `I18nProvider` mounted.

English output is byte-identical in every branch (`Contacts Detail` /
`Contacts Detail` / `Record Detail`), with and without a provider — pinned by a
provider-less test file per plugin, kept separate because `initReactI18next`
registers its instance as a module global that outlives `cleanup()`.
