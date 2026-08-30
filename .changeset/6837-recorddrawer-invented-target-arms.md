---
'@object-ui/plugin-detail': minor
---

`RecordDetailDrawer` resolves a relationship target only from the two spellings
a contract carries, dropping the two no contract declares (objectui#6837, first
slice).

The chain was `def.reference_to ?? def.reference ?? def.referenceTo ??
def.target`; it is now `def.reference_to ?? def.reference`.

**Accept-set move — a def carrying ONLY `referenceTo`, or ONLY `target`, stops
resolving a target** and the field renders without one (the drawer already marks
every reference-bearing field readonly, so nothing becomes editable that was
not). Two things bound that:

- Any def that entered through the ingestion choke point is unaffected.
  `normalizeSchemaReferenceKeys` reads `reference_to ?? reference ??
  referenceTo` and stamps both snake_case keys, so a `referenceTo`-only def
  arriving via `MetadataProvider` or `ObjectStackAdapter.getObjectSchema`
  already carries `reference_to` before the drawer sees it. Only a def that
  bypassed that door entirely is affected.
- `target` was never read anywhere else in the stack — not by the normalizer,
  not by the spec. `@objectstack/spec`'s `FieldSchema` refuses both deleted
  spellings by name with `unrecognized_keys`, each carrying its own "did you
  mean `reference`" rename, and `referenceTo` is additionally stripped at the
  designer read door (`RETIRED_FIELD_KEYS`, objectui#6041 / #6519).

A repo-wide structure-walk producer census found **0** emitters of `target` and
**0** reaching this seam for `referenceTo`, measured in the cell the drawer
reads (a value inside an object schema's `fields` container) against controls
`reference` (92 hits / 36 files) and `reference_to` (52 / 36) hot in the same
pass over the same cells.

Pinned by `RecordDetailDrawer.referenceArms-6837.test.tsx`, which keeps the live
arms green beside a named refusal per deleted key.
