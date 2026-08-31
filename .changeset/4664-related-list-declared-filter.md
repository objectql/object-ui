---
'@object-ui/app-shell': minor
'@object-ui/plugin-detail': minor
'@object-ui/components': minor
---

Auto-derived related lists consume the field-level `relatedListFilter`
declaration — the list query AND-composed, the tab badge counting the same set
(objectui#4664).

A `lookup` / `master_detail` field may now declare `relatedListFilter`, a
canonical Query-DSL `FilterCondition` such as `{ status: { $ne: 'deleted' } }`
(`@objectstack/spec` 17.1.0 — objectstack#8704 / PR #8955). Until now this repo
accepted that key at every gate and consumed it nowhere: a record page's derived
related lists answered wider than the metadata asked, and the driving scenario —
soft-deleted child rows on auto-derived record pages — had no way to be
expressed at all.

What ships:

- `deriveRelatedLists` reads the key off the FK and carries it on the derived
  descriptor; `RecordDetailView` forwards it into the page synthesizer, which
  emits it onto the `record:related_list` node's **existing** `filter` key. That
  key already had a read site (objectstack#7118): `RelatedList` ANDs it with
  `{ [referenceField]: parentId }`. The declared filter is therefore an authored
  constraint that may only NARROW this parent's children — never a replacement,
  which would leak other parents' rows — and no second filter dialect appears
  for derived pages.
- The **tab badge honours the same composed filter**. `page:tabs` reads the
  `filter` off the `record:related_list` node it is badging and the count store
  composes it with the parent scope through the same `mergeFilterNodes` sink the
  row query uses, so the badge and the rows send one `$filter`. Badge-count
  parity is normative in the spec key's own contract text; without this half the
  feature would ship the defect it exists to prevent — a badge saying 7 above a
  list showing 3.
- Counts cache per (object, relationship, parent, **scope**), so a filtered and
  an unfiltered probe over the same relationship are separate entries rather
  than one wrong number.

With no `relatedListFilter` declared, the synthesized node, the row query and
the badge probe are byte-identical to before. Consumption only — this change
adds no authoring UI for the filter.
