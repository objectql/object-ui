---
'@object-ui/plugin-view': patch
---

`ObjectView` forwards the canonical `table` keys — `pagination` / `selection` / `filter` / `sort` now take effect, and the deprecated spellings keep working as aliases.

`ObjectViewSchema.table` is documented as inheriting from `ObjectGridSchema`,
but `ObjectView` does not spread it: it forwards a hand-written whitelist of
keys, and that whitelist carried only the **deprecated** half of four pairs.
`pageSize`, `selectable`, `defaultFilters` and `defaultSort` were forwarded;
their canonical successors `pagination`, `selection`, `filter` and `sort` had
**no read point at all** in the file.

So an author who wrote the shape the type recommends — `table: { pagination:
{ pageSize: 25 } }`, having read `@deprecated Use pagination.pageSize instead`
on the key they were avoiding — got a view that compiled, read correctly, and
did nothing. There was no failure signal at any layer: the key is declared on
`ObjectGridSchema`, `ObjectGrid` already reads it, and only this forwarding hop
dropped it. That silent success is the defect being closed.

All four canonical keys are now forwarded at every site that forwarded their
deprecated counterpart: the grid schema, the non-grid data fetch
(kanban / gallery / calendar / timeline / gantt / map), and the delegated
`renderListView` schema. When an author writes both spellings the **canonical
key wins** — it is read first in the chains `ObjectView` resolves itself, and on
the grid path both slots are forwarded so `ObjectGrid`'s existing canonical-first
resolution decides, keeping the two layers in agreement.

Nothing that worked before changes. The deprecated spellings are still read and
are still the value used when they are the only one written; no canonical value
is synthesised from a deprecated one, so `ObjectGrid`'s `pagination`-keyed
behaviour is untouched for views that only ever wrote `pageSize`. The two
precedence segments ahead of `table` — a named `listViews` entry, then the
active view — are untouched, and a named view still outranks a `table` default.

Declaration-surface note: `table` remains `Partial< Omit< ObjectGridSchema, … > >`,
which the `BaseSchema` index signature collapses to zero declared members, so
editor completion still offers no keys and a misspelling is still accepted
silently. That half is deferred to the structural track and is not addressed
here.
