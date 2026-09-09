---
'@object-ui/plugin-grid': patch
---

`object-grid`: a `bulkActionDefs` member that is not a usable def is skipped and
diagnosed, instead of taking the whole selection bar down (objectui#8730).

`bulkActions` and `bulkActionDefs` are one affordance authored in two vocabularies —
`bulkActions` members are bare action NAMES resolved against `objectDef.actions`,
`bulkActionDefs` members are full `BulkActionDef` OBJECTS used as authored — and
nothing refused a member written in the other one. Both keys are registered
`type: 'array'` with no `of`, both spec rows are `z.array(z.unknown())`, and a JSON
view is invisible to `tsc`.

Writing a bare name into `bulkActionDefs` did not fail quietly, it crashed:
`Array.isArray(schema.bulkActionDefs)` is true, the string travelled into the authored
list untouched, `BulkActionBar` rendered a button for it, and
`def.label ?? formatActionLabel(def.name)` threw
`TypeError: Cannot read properties of undefined (reading 'replace')` **during render**.
The author's first multi-row selection lost the entire selection bar — count, Clear and
every well-formed sibling def with it. `key={def.name}` was `undefined` too, so React
logged a duplicate-key warning on the way down.

`resolveBulkActions` now skips any member that is not an object carrying a non-empty
string `name`. "Usable" is defined by what the renderer actually reads: `name` is both
the React `key` and `formatActionLabel`'s argument, so that one test covers the reported
bare string and, identically, `null`, a number, `{}` and `{ name: '' }`. The guard sits
at the single point where the authored array becomes the list the bar maps over, so the
`key` and the label are read off the same validated def.

The skip is not silent. `ObjectGrid` reports it once per authored array through the
channel it already uses for "you declared it, the renderer dropped it" — one
`console.warn` prefixed `[ObjectUI] ObjectGrid bulkActionDefs:` — naming the block, the
index, what was seen, and what to write instead:

```
[ObjectUI] ObjectGrid bulkActionDefs: object-grid (objectName: 'os_invoice') — 1 of 3
authored bulk-action defs cannot be rendered and is skipped (2 still render).
  • bulkActionDefs[0]: the entry is a string ('approve'), not a def object — this key's
    members are full `BulkActionDef` objects, used as authored. Write
    `{ name: 'approve', operation: 'custom' }` here, or move the bare name to
    `bulkActions`, which resolves it against the object's declared actions and promotes
    the match.
```

**Not a coercion, deliberately.** A bare `'approve'` is not lifted into
`{ name: 'approve' }` and resolved the way `bulkActions` is. That would make the two
vocabularies interchangeable — a product change to what a `bulkActionDefs` member means
(objectui#3002 / objectui#3139 made them distinct on purpose), not a crash fix.

**Behaviour changes for authors** beyond the crash: a `{ name: '' }` member used to
render a nameless, unlabelled button with an empty React key, and now renders nothing.
Well-formed defs are untouched — a mixed list renders exactly its usable members, in
order, and a clean array is still returned by reference. The mirror direction
(`bulkActions: [{ name: 'approve' }]`) keeps its existing silent skip.
