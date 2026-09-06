---
'@object-ui/types': minor
---

**Breaking for authored metadata:** `ObjectViewSchema.viewTabBar` is RETIRED
(objectui#7779, maintainer ruling B of 2026-09-06; ADR-0049 enforce-or-remove).
An `object-view` node that authors `viewTabBar` no longer validates: the parse
fails loudly on the `viewTabBar` path with the explanation in the message, and
the TS member is a `?: never` tombstone so the same document is refused at
compile time. Nothing ever read the key off the node — the tab-bar UX config
(`ViewTabBarConfig`, still exported) is the `config` prop of the `ViewTabBar`
component, composed by the host, not authored metadata. Remove the key.

In the same change, eight `ObjectViewSchema` keys the TypeScript interface
declared and the Zod mirror never did are now ENFORCED. Until now a document
authoring any of them passed the validator unexamined through `BaseSchema`'s
passthrough while the published type invited the author to write it — declared
but not enforced (objectui#7279's `UnmirroredDeclared` reading). Each key now
admits exactly what the declaration promises and refuses a wrong-typed value at
its own path; a correctly typed document is untouched.

| key | disposition | how |
| --- | --- | --- |
| `navigation` | mirrored | the spec's `ListViewSchema.navigation` slot by reference (`NavigationConfigSchema`, optional) |
| `searchableFields` | mirrored | the spec's `ListViewSchema.searchableFields` slot by reference (`string[]`, optional) |
| `filterableFields` | mirrored | the spec's `ListViewSchema.filterableFields` slot by reference (`string[]`, optional; the spec marks it a legacy shorthand for `userFilters.fields`) |
| `allowCreateView` | mirrored | the sibling `ViewSwitcherSchema.allowCreateView` slot by reference — the renderer forwards the value verbatim into the `view-switcher` node it composes |
| `viewActions` | mirrored | the sibling `ViewSwitcherSchema.viewActions` slot by reference, for the same reason |
| `defaultViewType` | mirrored | local literal: the declaration's seven-value union (`grid`, `kanban`, `gallery`, `calendar`, `timeline`, `gantt`, `map`) — read as `schema.defaultViewType \|\| 'grid'` |
| `defaultListView` | mirrored | local literal: `string` — read as `namedListViews?.[schema.defaultListView]` |
| `showViewSwitcher` | mirrored | local literal: `boolean` — read as `schema.showViewSwitcher === true` |
| `viewTabBar` | RETIRED | `?: never` + `retirementTombstone()` — zero reads on the node |
| `listViews` | unchanged (still unmirrored) | see below |

**What was measured.** Every reading was taken on the `object-view` node
renderer (`packages/plugin-view/src/ObjectView.tsx`, registered by
`plugin-view/src/index.tsx`) with `schema.objectName` / `schema.layout` as the
positive controls of the same `schema.KEY` query, so each zero is a reading;
the repo-wide census of `viewTabBar` finds the key in no source file outside
`@object-ui/types` (two doc tables listed it as authorable and are corrected
here). The spec side was read through the installed pin
(`@objectstack/spec@17.2.0`, `ui` entry, 117 exported object schemas walked;
control keys `objectName` / `columns` / `navigation` / `listViews` hit): the
three spec-modelled keys are optional slots on `ListViewSchema` and
`ObjectListViewSchema`; the six local keys have no spec slot anywhere.

**`listViews` stays unmirrored, on the ruling's own fallback clause.** The
declaration's value is the local `NamedListView` (about 52 members, of which the
renderer reads seven — `label`, `type`, `columns`, `filter`, `sort`, `options`,
`data`); the spec's `ViewSchema.listViews` is a record of the STRICT
`ObjectListViewSchema`, which requires `columns` and refuses `options`, ObjectQL
tuple filters and `default` — that is, it refuses the named views this package's
own README and `content/docs/api/schema-reference.md` teach (`{ label: 'All
Users' }` fails at `columns`; `filter: [["owner", "=", "..."]]` fails at
`filter.0`). Mirroring the spec value would lose documented behaviour; mirroring
the local value would enforce roughly 45 unread members into the contract — the
very thing ruling B refused for the six local keys. The key therefore stays in
the parity ledger with that measurement, pinned, until the maintainer decides its
value type. It is not papered over with `z.any()`.

**Who is affected:** an author who wrote `viewTabBar` on an `object-view` node
(remove it), or who wrote a wrong-typed value for one of the eight keys — e.g.
`defaultViewType: 'tree'` (host-composition-only, objectui#5321),
`navigation: 'page'` (write `navigation: { mode: 'page' }`),
`searchableFields: 'name'` (write an array), `viewActions: 'share'` (write
`[{ type: 'share' }]`). Such documents used to pass validation and render with
the key ignored; they now fail at the key with the reason.

**Who is NOT affected:** every correctly typed document, and every document
that never wrote these keys — `absent` stays valid on all nine. No renderer
changed. The parity ledger (`zod-mirror-parity.test.ts`) records the move:
`UnmirroredDeclared` 14 entries / 96 keys to 14 / 87, the `ObjectViewSchema`
entry re-derived into the SPEC-DERIVED half because the mirror now references
the spec in code.

Graded `minor`, not `patch`: this narrows the accepted input set, which is
breaking for any author who wrote the tolerated spellings. It is not `major`
per this repo's fixed-group convention (objectui's own breaking changes ship as
`minor`; the group's major tracks `@objectstack` — AGENTS.md 版本号策略,
mechanically enforced by `scripts/check-changeset-no-major.mjs`).
