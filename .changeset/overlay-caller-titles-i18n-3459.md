---
'@object-ui/plugin-kanban': patch
'@object-ui/plugin-tree': patch
'@object-ui/plugin-view': patch
---

Localize the record-detail headings that `ObjectKanban`, `ObjectTree` and
`ObjectView` build themselves (objectui#3459)

#3426 / PR #3457 keyed `ListView` and `ObjectGrid`; a repo-wide grep found the
same pattern in three more hosts, each string-building an English heading in
TypeScript so the surrounding drawer/panel was fully localized with one English
phrase on top of it.

- `packages/plugin-kanban/src/ObjectKanban.tsx` — the object-derived heading of
  the card-detail drawer
- `packages/plugin-tree/src/ObjectTree.tsx` — the bare literal
  `"Record Details"` handed to `NavigationOverlay`
- `packages/plugin-view/src/ObjectView.tsx` — `` `${objectLabel} Detail` `` on
  the `mode: 'split'` panel

All three are user-reachable, each verified by a test that drives the real
interaction (render the block, click a card/row, read the heading), not by
inspection:

- `object-kanban` is a public page block whose `navigation` config DEFAULTS to
  `{ mode: 'drawer' }`, so a board needs no authoring at all to open this
  drawer on card click;
- `object-tree` needs `navigation: { mode: 'drawer' }` authored explicitly, and
  every row's click is wired to `navigation.handleClick`;
- `object-view` declares `navigation` as an authorable input and maps
  `mode: 'split'` onto the branch that renders this heading.

## What changed

Each call site now keys its heading through the existing `detail.*` pair —
`detail.recordDetailWithLabel` (`'{{label}} Detail'`) where an object label is
available, `detail.recordDetail` where none is. No new locale keys: both
already ship in all ten packs from #3457, and reusing them keeps one heading on
one control instead of minting per-plugin twins that drift.

Each plugin gains its own English defaults map, which is what
`createSafeTranslation` falls back to with no `I18nProvider` mounted;
`@object-ui/plugin-tree` gains a dependency on `@object-ui/i18n` for it.

## Visible English change

One, deliberate: the tree overlay's heading goes from the plural
`Record Details` to the singular `Record Detail` — the spelling the whole
`detail.*` family, including `NavigationOverlay`'s own default, already uses.
The maintainer ruled on normalizing the stray plurals rather than minting a
plural key; a repo-wide grep confirmed no `e2e/` spec and no unit test
addressed the old string.

Every other branch is byte-identical in English (`Contacts Detail`,
`Support cases Detail`, `Contacts Detail`), with and without a provider —
pinned by a provider-less test file per plugin, kept separate because
`initReactI18next` registers its instance as a module global that outlives
`cleanup()`.

The kanban's other former plural (`'Card Details'`) is NOT a visible change: it
sat on a branch that fires only when the board has no `objectName`, while the
drawer consuming it returns `null` on that very condition. It is keyed anyway
so the literal cannot leak if that guard ever relaxes, and it deliberately has
no test — an assertion there would pass because nothing renders.
