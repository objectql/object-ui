---
'@object-ui/plugin-gantt': minor
'@object-ui/plugin-tree': minor
---

`ObjectGantt` and `ObjectTree` resolve a relationship target only from the two
spellings a contract carries, dropping the third one no contract declares
(objectui#6837, second slice).

- `ObjectGantt`'s quick-filter option fetch was
  `fd?.reference_to ?? fd?.reference ?? fd?.referenceTo`; it is now
  `fd?.reference_to ?? fd?.reference`.
- `ObjectTree`'s `detectParentField` was
  `def?.reference || def?.reference_to || def?.referenceTo`; it is now
  `def?.reference || def?.reference_to`.

**Accept-set move — a def carrying ONLY `referenceTo` stops resolving a target
at these two seams.** Concretely: the gantt quick filter for that field falls
back to the distinct values present in the loaded rows instead of fetching the
referenced object's full domain, and the tree stops auto-detecting that field as
its parent pointer, so records render as a flat forest unless `parentField` is
configured explicitly. Nothing else changes; the two surviving arms are
untouched.

Two things bound that move:

- Any def that entered through the ingestion choke point is unaffected.
  `normalizeSchemaReferenceKeys` reads `reference_to ?? reference ??
  referenceTo` and stamps both snake_case keys, so a `referenceTo`-only def
  arriving via `MetadataProvider` or `ObjectStackAdapter.getObjectSchema`
  already carries `reference_to` before either component sees it. Only a def
  that bypassed that door entirely is affected — and that door is not total:
  `getObjectSchema` is a required member of the published `DataSource`
  interface, and both components call it on the generic `dataSource`.
- No contract declares the deleted spelling. `@objectstack/spec` 17.2.0's
  `FieldSchema` refuses `referenceTo` by name with `unrecognized_keys`, carrying
  its own "Did you mean `referenceTo` -> `reference`?" rename, and `referenceTo`
  is additionally a tombstone in `RETIRED_FIELD_KEY_TOMBSTONES` (objectui#6041)
  at all three strip sites, so the designer read door removes it before a draft
  round-trips.

A repo-wide structure-walk producer census found **0** emitters of `referenceTo`
reaching either seam, measured in the cell these components read (a value inside
an object schema's `fields` container) against controls `reference` (92 hits / 36
files) and `reference_to` (52 / 36) hot in the same pass over the same cells;
the only two in-cell hits are negative fixtures of the retirement machinery,
asserting the read door strips the key. Neither `plugin-gantt` nor `plugin-tree`
emits `referenceTo` anywhere, while both packages' own fixtures are hot on the
surviving spellings.

Pinned by `ObjectGantt.referenceArms-6837.test.tsx` and
`ObjectTree.referenceArms-6837.test.tsx`, which keep the live arms green beside a
named refusal for the deleted key.
