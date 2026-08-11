---
"@object-ui/core": patch
"@object-ui/plugin-dashboard": patch
"@object-ui/plugin-report": patch
---

Pivot buckets encode an empty dimension value as JSON `null`, so it no longer collides with a row whose value is literally the placeholder character

objectstack#5473 / objectstack#5665 replaced the pivot's delimiter-joined ids
with `JSON.stringify`, because every delimiter that had been tried — an empty
string, a plain space, a control character — assumed the data would not contain
it, and each assumption failed on ordinary data. This closes the last place the
same assumption survived: the ids were JSON, but the VALUES fed into them were
spelled `String(row[d] ?? '∅')`, so an absent dimension value became the
ordinary string `"∅"` and shared a bucket with a row whose value literally is
that character (U+2205). One bucket, later row overwriting the earlier one — the
cell showed a different row's measure, the overwritten row was unreachable, and
drill-through followed the same wrong index into the wrong records, all without
an error. The trigger requires that character to appear as a dimension value, so
this is the assumption being removed rather than a defect users hit today.

An empty value now encodes as JSON `null`, which `JSON.stringify` renders as a
bare `null` that no string can spell. The normalization lives in
`@object-ui/core` as `pivotDimensionValue` (absent ⇒ `null`, everything else ⇒
its string form) rather than at each call site, because a placeholder spelled by
a caller is a placeholder that can collide again — which is exactly how this one
survived the previous fix. `pivotBucketId` accepts `Array<string | null>`
accordingly; that is a widening, so existing callers passing `string[]` are
unaffected.

Both renderers' bucket keys move together, which the fix requires: a bucket id
and the subtotal map keyed by it are built from the same expression, so changing
one alone would split the headers while the subtotal map still merged, landing
every column subtotal under the wrong header. In `plugin-dashboard`'s
`DatasetWidget` that is the row bucket id, the column bucket id, the cell key,
and both the `rowTotalById` and `colTotalById` lookups; in `plugin-report`'s
`DatasetReportRenderer` the single `bucketId` helper already feeds all five.

The dashboard's column bucket id also stops being a bare string and becomes a
one-element tuple through the same shared encoder. It was the one id in the
family still built by hand, on the reasoning that a single value needs no
boundary — true of the boundary, false of everything else the encoder does, and
it is why the across axis kept carrying this collision after the row ids were
fixed.

No display change: these placeholders only ever entered ids, never labels. An
unset dimension still renders through `formatDimensionValue` exactly as before,
and data containing neither an absent value nor that character buckets
identically — the ids are opaque lookup keys, never parsed back into a value,
never shown, never persisted.
