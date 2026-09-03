---
'@object-ui/app-shell': minor
'@object-ui/core': minor
'@object-ui/fields': minor
'@object-ui/plugin-charts': minor
'@object-ui/plugin-detail': minor
'@object-ui/plugin-gantt': minor
'@object-ui/plugin-list': minor
'@object-ui/plugin-tree': minor
---

Relationship-target readers resolve a lookup's target from `reference` alone,
dropping the `reference_to` fallback arm (objectui#6837, half 2).

Maintainer ruling, 2026-08-31, 原文照录: 「objectui不是前端的项目吗?后端的元数据只要
对,前端按协议执行就行了呀」. Protocol normalization belongs on the SERVER; the front
end just executes the protocol. objectstack#13847 landed the server half — a
`field-reference-to-alias` conversion rewrites stored `reference_to` to
`reference` on the serve path and in `os migrate meta`.

`reference` is the only target spelling `@objectstack/spec`'s `FieldSchema`
declares. Measured on the installed 17.2.0: it refuses `reference_to`,
`referenceTo` and `target` with `unrecognized_keys`, each carrying its own
"Did you mean -> `reference`?" rename, while a nonsense key gets the same
refusal with NO rename hint and `reference` parses clean.

## ⚠️ BREAKING for a hand-written schema that spells `reference_to` — read this

**This is a behaviour change for BYO consumers, and it is being stated rather
than shipped silently.** ObjectUI is usable without an ObjectStack backend
(`examples/byo-backend-console`), and a hand-written TypeScript schema passes
through no zod door, so nothing rejects the legacy spelling at authoring time.

**The break surface is narrower than "all BYO consumers", and this is the
measurement rather than a blanket claim.** Two ingestion choke points stamp both
snake_case keys from whichever spelling arrived — `MetadataProvider`'s type
cache for metadata type `object`, and `ObjectStackAdapter.getObjectSchema`. Any
def that passed either one already carries `reference` and is **completely
unaffected**. What is affected is exactly:

- **A `DataSource` implementation other than `ObjectStackAdapter`.**
  `getObjectSchema` is a required member of the published `DataSource`
  interface, and the readers call it on the generic `dataSource` (through
  `useSettledSchema` and directly), so a host adapter's object schema reaches
  them raw. Every in-repo example of one is on this path:
  `ApiDataSource`, `ValueDataSource`, `packages/types/examples/rest-data-source.ts`,
  `examples/byo-backend-console/src/mockDataSource.ts`,
  `packages/runner/src/lib/mockDataSource.ts`,
  `apps/site/app/components/galleryDataSource.ts`.

**Measured on this tree, none of those six emits a relationship target at all** —
`reference_to` and `reference` are both zero in each, and
`examples/byo-backend-console` carries no lookup or master_detail field
anywhere (its only `reference` hits are a vite triple-slash directive and a
tsconfig `references` array). The single in-repo producer that WAS on this
surface, `packages/plugin-gantt/demo/main.tsx`, is fixed here at the producer.

⇒ **If you author object metadata by hand and spell a lookup's target
`reference_to`, rename that key to `reference`.** Symptom if you do not: the
target silently fails to resolve, and the affected surface degrades rather than
erroring — a related list is not derived, a gantt quick filter falls back to the
distinct values in the loaded rows instead of the referenced object's full
domain, a tree stops auto-detecting its parent pointer, a lookup cell shows a
raw id, a chart's group-by labels stay unresolved.

To make that failure audible instead of silent, the choke point now emits a
**dev-mode warning, once per (field, spelling)**, when a def arrives carrying
only `reference_to` or `referenceTo` and no `reference`. It names the field,
names the offending key and points at this ruling. The stamping behaviour is
deliberately unchanged, so nothing that worked stops working at the choke point
— keys outside the protocol are still not parsed, but no longer silently.

## What did NOT change

**Every key these readers EMIT is byte-identical.** Six of the sixteen sites
write a target onto a bag whose own contract spells it `reference_to` (or
camelCase `referenceTo`) — `RecordDetailDrawer`, `RelatedList`,
`buildDefaultPageSchema`, `ListView`, `FilterConditionField`,
`resolveActionParams`. Only the right-hand read narrowed; the emitted key is
what its target contract declares and renaming it would be a separate change.

**Three readers were deliberately left alone.** `LookupCellRenderer`
(`fields/src/index.tsx`), `LookupField` and `UserField` read `FieldMetadata` —
ObjectUI's OWN contract, whose `LookupFieldMetadata` declares `reference_to` and
never declares `reference`. They are fed by the emitters above and by published
example schemas (`examples/schema-catalog/src/schemas/fields-lookup/*.json`), so
narrowing them would break in-repo producers, and `plugin-grid`'s
`relationalMetaCopySet.derivation.test.ts` re-derives its read set from exactly
those three sources — where `reference_to` is recorded with verdict
`adapter-stamped`. `DetailViewFieldSchema` is likewise untouched.
