---
'@object-ui/core': minor
---

Canonicalize the retired object-schema dialect once, at the ingestion choke point
(objectui#7650).

`normalizeSchemaReferenceKeys` now has two arms. The `reference` / `reference_to` pair
is unchanged. The new arm folds any key a served field def carries that
`@objectstack/spec`'s `FieldSchema` does **not** declare, but whose snake/camel twin it
does — `display_field` onto `displayField`, `description_field` onto `descriptionField`,
`lookup_filters` onto `lookupFilters`, and `lookup_columns` onto `lookupColumns`.

**Why this is needed at all.** The object-schema serve path never parses:
`ObjectStackAdapter.getObjectSchema` fetches the document, applies two mutations and
returns it, with no `ObjectSchema.parse` anywhere. `FieldSchema` strictness therefore
gates the metadata **write** door only. A document stored before a key was tightened is
served back verbatim, forever — it cannot be re-saved through the strict door, but nothing
ever asks it to be. objectui#7155, #7166 and #7435 narrowed the consumer reads to the
camelCase spelling on the strength of "no spec-compliant producer can emit this key",
which is a claim about authoring, not about serving. This restores the other half, the
same way objectui#6837 restored it for `reference_to`.

**How the fold is derived.** By the spec's own alias-probe rule — lowercase, strip `_`,
`-` and space — matched exactly against `FieldSchema`'s declared key set, read at runtime
off `FieldSchema.shape`. Not a hand-written table: a table has to be edited every time the
spec grows a camel key whose snake twin is still in stored documents, and the edit that
does not happen is the bug.

**What it deliberately does not do.** It never removes a key or a value — the legacy
spelling stays on the document exactly as served, because dropping it would make a stored
legacy document lose the value instead of arriving canonical. It never overwrites a
canonical key the producer already set. It folds nothing onto a probe two declared keys
share. And it does not "correct" anything: a key that probes onto no declared key is left
alone, so a typo (`sortible`) stays a typo and `id_field` — which has no declared
successor — stays as it is.

**Not covered.** `id_field` needs a `@objectstack/spec` release carrying the
`FIELD_KEY_GUIDANCE.id_field` row before its diagnostic can quote the contract rather than
a copy of it; that row is in no published version yet. `title_format` is out of scope
pending a separate maintainer ruling. Both land in the leave arm by the same rule, with no
special case.
