---
'@object-ui/core': minor
'@object-ui/plugin-calendar': minor
'@object-ui/plugin-gantt': minor
'@object-ui/plugin-grid': minor
'@object-ui/plugin-map': minor
'@object-ui/plugin-tree': minor
'@object-ui/react': minor
---

`@object-ui/core` publishes `resolveRecordSourceObjectName`, the ONE reader for "which
object is this block bound to" (objectui#7627).

Six view plugins each spelled that resolution locally — `ObjectCalendar` twice,
`ObjectGantt`, `ObjectTree` twice, `ObjectMap`, `ObjectGrid` — and had drifted: three
wrote `?? schema.objectName`, one `|| ''`, one `: undefined`, one an `'object' in
dataConfig` test. They now delegate to one function that states the published
objectui#6939 record-source ladder (`data`, then `staticData`, then `objectName`) once.

**No behaviour changes.** Each site's pre-collapse expression is transcribed verbatim
into `record-source.behaviourNeutrality-7627.test.ts` and asserted equal to its
post-collapse spelling across the whole contract-valid input matrix — both bindings
present, data only, `objectName` only, empty `objectName`, empty `data.object`, the
`api` / `value` / `staticData` / array-shorthand providers, and nothing bound.

**Two questions stay two questions.** `normalizeListViewSchema`'s gap-fill (#7477,
ruling B of PR #7628) is untouched and is NOT re-pointed at the new reader: it answers
how `objectName` gets POPULATED when absent, where an already-present `objectName` wins.
The new reader answers which object a block RESOLVES, where the `data` block wins — the
order declared on both published faces in `@object-ui/types` and pinned by
`objectql-record-source-refinement-6939.test.ts`. Merging them would silently override
one standing ruling or the other.

**`ObjectGantt`'s `persistLayoutKey` is deliberately excluded** and keeps its inverted
order, with an in-place comment saying why: its receiver is a localStorage key
(`gantt-layout:KEY:filters`), not a record source, so re-pointing it would orphan every
saved layout and filter-chip set of a view carrying both bindings. Two more sites the
finding listed are not object-name readers at all and were struck: `ObjectGantt`'s
refresh-handler predicate (`object` OR `api`) and `plugin-dashboard`'s `isObjectProvider`
type-guard over a widget's `data`.

`useSettledSchema`'s doc comment stops prescribing the hand-written ladder at all four
lines that taught it, so the copies cannot re-seed from the hook that replaced them.
