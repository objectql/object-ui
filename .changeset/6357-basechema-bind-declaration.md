---
'@object-ui/types': minor
'@object-ui/plugin-dashboard': patch
---

`BaseSchema` declares `bind`, the data-scope binding path, on both halves — the TypeScript
interface and its Zod mirror (objectui#6357).

`bind` was read by ten production sites and declared by no schema shape. It resolved as `any`
through `BaseSchema`'s index signature and rode `.passthrough()` on the validator, while three
separate documents taught it as an authorable key of *every* node: this repo's own `AGENTS.md`
§4 ("Every node in the UI tree follows this shape (`@object-ui/types`)"), the published
agent-facing `skills/objectui/rules/protocol.md` ("Every UI component node MUST follow this
shape"), and `content/docs/fields/grid.mdx`. So the agent-facing protocol told authors to write
a key the published types did not know existed.

The census chose the home rather than guessing it. Nine reads go through
`useDataScope(schema.bind)` — `list` and `tree-view` in `@object-ui/components`, and the
`object-*` widgets in `plugin-charts`, `plugin-dashboard` (×2), `plugin-grid`, `plugin-kanban`,
`plugin-list`, `plugin-timeline`. A tenth is `plugin-grid`'s `gridNeedsDataSource` predicate,
where a present `bind` is one of the escape hatches that makes a missing data-source adapter
legitimate. Two more sites destructure the key out so `SchemaRenderer`'s prop spread cannot
write `bind="data.revenue"` onto the DOM. Per-component declaration was measured and rejected:
it costs nine copies of one key and buys nothing extra, because neither half can refuse the key
on a non-reader either way. `placeholder` is the standing precedent for a cross-cutting key
declared on `BaseSchema` and honoured only by a subset.

**Accept-set narrowing, on the value and not the key.** `bind: 42` type-checked and parsed green
before this change and is refused by both halves now. It only refuses what already crashed:
`useDataScope` is `(path?: string)` and resolves via `path.split('.')`, so a non-string `bind`
threw a `TypeError` at render time. Every `bind` authored in this repo is a string, and the
declaration is optional, so nothing that renders today stops.

**What this does NOT change**, stated because the pin would otherwise be read as more than it is:
an *undeclared* key is still accepted by both halves, so this did not buy rejection of a
misspelling such as `bindTo` (objectui#5155 / objectui#6269 own that ceiling). And `data-table`
still does not call `useDataScope`, so a `bind` on it is still ignored and still renders a header
over an empty body with no error — a documented silent failure that this declaration neither
causes nor cures, since the key was accepted on every node before it existed.

`ObjectPivotTable` drops its local `bind?: string`: its `PivotTableSchema & {…}` intersection
extends `BaseSchema`, so the member was a true duplicate. Two other local declarations are left
in place and ratcheted rather than removed — their containing types never reference `BaseSchema`,
so deleting the member would delete the declaration rather than inherit it.
