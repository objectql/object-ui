---
'@object-ui/types': minor
'@object-ui/fields': minor
'@object-ui/plugin-grid': minor
'@object-ui/app-shell': minor
'@object-ui/plugin-detail': minor
---

Converge the lookup/user widget metadata on the spec's camelCase — one concept, one
spelling (objectui#7155, maintainer ruling A′ of 2026-09-03, director decision batch #19).

**BREAKING, deliberately, with no deprecation window.**

Two published contracts declared OPPOSITE dialects for the same four lookup keys, and
`@object-ui/fields`' read chains served both — snake FIRST, so the dialect the object
contract *refuses* outranked the one it *declares*:

| | `@objectstack/spec` `FieldSchema` (object metadata) | `@object-ui/types` `LookupFieldMetadata` (widget metadata) |
|---|---|---|
| camelCase | **declared** | compile error (`TS2561`) |
| snake_case | refused (`unrecognized_keys`) | **declared** |

`LookupFieldMetadata` and `UserFieldMetadata` now declare the spec spellings, and the
snake members are **removed**:

| before (removed) | after |
|---|---|
| `display_field` | `displayField` |
| `description_field` | `descriptionField` |
| `lookup_filters` | `lookupFilters` |
| `id_field` | `idField` |

**Migration.** Rename those four keys wherever you author lookup or user field metadata
— `LookupFieldMetadata` / `UserFieldMetadata` objects, and any `DataSource.getObjectSchema`
that returns them. The old spellings are no longer read: a def still carrying
`display_field` falls back to the referenced record's generic name heuristic rather than
the field you named.

`idField` is kept as a **widget-contract** key. It carries objectstack#3508's machine-name
hydration — committing a record field other than the id as the lookup's stored value —
which is picker behaviour with no `FieldSchema` twin, and none owed.

**Not renamed** (outside this ruling's four keys, still snake on the widget bag):
`reference_to`, `title_format`, `lookup_columns`, `lookup_page_size`, `depends_on`,
`allow_create`, `avatar_field`. `reference_to` in particular **stays** — the adapter's
`normalizeSchemaReferenceKeys` choke point genuinely stamps it onto every def.

Also moved with the rename: `content/docs/fields/lookup.mdx` and `user.mdx` (whose
snippets CI compiles against the built `d.ts`), all seven in-repo producers, and the
inline-edit enrichment allow-list in `@object-ui/plugin-detail`. `plugin-grid`'s
`relationalMetaKeys.ts` drops the four `legacy-alias` verdicts and retires that verdict
class; its gate is restated to assert the class no longer exists rather than passing
vacuously.
