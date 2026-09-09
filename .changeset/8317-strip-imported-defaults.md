---
'@object-ui/types': minor
---

The validator stops writing values into an author's document on the keys it imports —
**this mirror authors no default, imported subschemas included** (objectui#8317,
director ruling, decision batch #90, 2026-09-08, under the maintainer's standing
delegation).

Decision batch #69 (objectui#7735) ruled a principle: *a validator validates; it does
not write values into an author's document.* PR #8299 delivered it for the 41
`.default()` call sites written in this package's own mirrors. Measured afterwards, **57
`ZodDefault` nodes were still reachable from the published `@object-ui/types/zod`
barrel**, every one inside a subschema imported by reference from `@objectstack/spec` —
so `safeValidateSchema` went on substituting on those keys, with 41 stripped and 57 not
and no way to tell which was which from the document. Batch #90 ruled that the
principle holds for **every** key the validator answers, and those 57 are now stripped
where the spec enters this package (`.removeDefault()`, the established local pattern,
applied through `zod/imported-defaults.ts`).

**What changes.** `safeValidateSchema` / `validateSchema` return the author's document
instead of the author's document plus keys they did not write:

```js
safeValidateSchema({ type: 'object-view', objectName: 'account', navigation: {} })
// before → navigation: { mode: 'page', preventNavigation: false, openNewTab: false, size: 'auto' }
// after  → navigation: {}
```

The affected families: `app`'s `active` / `isDefault` · `object-view`'s
`navigation.{mode, preventNavigation, openNewTab, size}` · `list-view`'s `sharing.type`,
`userActions.*`, `addRecord.*`, `appearance.*`, `chart.chartType`, `tabs[].*`,
`timeline.scale` · `kanban`'s `grouping.fields[].{order, collapsed}` · `page`'s `kind`
and the whole `interfaceConfig` subtree · dashboard `chartConfig.*`, `header.*` and
`globalFilters[].scope` · `object-gallery`'s `gallery.*` · `contextSelectors[].*` ·
`prefix.type`, `pagination.pageSize`, `selection.type` and the HTTP `method`.

**The accept set does not move, and that is measured, not asserted.** Every one of these
keys stays omissible — `.default(v)` carries optionality as well as a value, so the
boundary re-optionalises what `.removeDefault()` hands back. A differential against the
raw `@objectstack/spec` schemas (a permanent pin, since both sides are importable) plus
a run over this repository's own 1,077-document corpus found **zero** documents whose
acceptance changed, on the tolerant face and on the strict authoring face alike. Keys,
value vocabularies and every `.refine()` / `.superRefine()` the spec installed are
carried through unchanged.

**Migration.** If you read a value off `result.data` and relied on it being present
without having written it, read it off your own fallback instead — batch #69 already
ruled that the renderer's fallback is *the* authoritative default, and the renderers in
this workspace already carry theirs (`navigation?.mode ?? 'page'`,
`userActions.search !== false`). A census of every consumer of this barrel found no such
read: three production importers, one of which reads `result.data` at all, and it reads
only `type` / `id` / `label` / `title` / `children` — none of which carries a default on
any of the 107 component arms.

⛔ **Not taken:** changing `@objectstack/spec` itself (1,546 call sites on another
repository's release train). This is reversible into it — every strip becomes a no-op
the day the spec adopts the same principle, because the boundary is the identity
function on a subtree with nothing to strip.
