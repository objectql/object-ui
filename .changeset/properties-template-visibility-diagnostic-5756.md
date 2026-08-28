---
'@object-ui/react': patch
---

`SchemaRenderer`'s node visibility gate now also catches the `${…}`-templated
spelling of the objectui#5454/#5687 diagnostics when it is written inside
`properties`, e.g. `properties: { visible: "${data.status == 'draft'}" }`
(objectui#5756).

The `properties.*` evaluation loop runs, and interpolates every `${…}` template it
finds, **before** the visibility gate ever sees the value — so by the time the
existing diagnostics ran, a template-spelled predicate had already collapsed into a
plain boolean and there was no predicate text left to inspect. The bare-string
spelling of the exact same gate (`properties: { visible: "data.status == 'draft'"
}`) was unaffected — nothing interpolates a string with no `${` in it — and was
already reported; only the template spelling was structurally invisible.

Reached by moving the diagnostic check to inside the `properties` evaluation loop,
on the predicate's raw (pre-interpolation) text, gated on the key being one of the
six visibility keys the render chain consults (`visibleWhen` / `visible` /
`visibleOn` / `visibility` / `hidden` / `hiddenOn`) — a `properties.content`
interpolation, or any other non-visibility key, is untouched and stays silent.

Reports only the key that actually **decides** the node's visibility, mirroring
objectui#5454's own leg semantics (its reporter is likewise only ever invoked on
the leg the chain's early-return sequence actually reaches): a `properties.visible`
template that a co-declared `visibleWhen` outranks is not reported for deciding
nothing.

**No verdict changes and no interpolation changes.** The diagnostic call's return
value is discarded; the real verdict is still computed afterward, off the
post-evaluation, post-hoist schema, by the same code path as before this change.
Same two reporters as objectui#5454/#5687 (unresolvable-predicate / adapter-only-data
predicate), same dedupe `Set`, same `console.warn` severity, same dev-only gate —
only the silence moved, one render-step earlier.
