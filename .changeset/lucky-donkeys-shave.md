---
---

Census only (objectui#7642): record, at each of the six sites, which contract types
the field-def bag it reads. No runtime behaviour changes — every snake leg is kept,
so this declares no release.

The card proposed retiring `display_field` / `description_field` / `lookup_filters` /
`id_field` reads on the ground that `@objectstack/spec`'s `FieldSchema` is strict and
refuses them. Measured against the installed spec, that is true — of the AUTHORING
path. Three findings moved every site to KEEP:

1. The SERVE path runs no parse. `ObjectStackAdapter.getObjectSchema` returns the
   server document verbatim plus exactly two rewrites (`normalizeSchemaReferenceKeys`,
   `applyFieldWidgetOverrides`); there is no `ObjectSchema.parse`/`safeParse` on that
   path. The `resolveActionParams` site is served by a different path —
   `useMetadata().objects`, filled by `client.meta.getItems('object')` in `app-shell`'s
   `MetadataProvider` — and that path runs no schema parse either (the provider's only
   `parse` is `JSON.parse` of its session cache; the pinned `@objectstack/client`'s
   three `safeParse` calls are all event-payload schemas, none on `getItems`). A
   stored pre-strict document therefore still delivers these keys to every consumer.
   The legs are not unreachable.
2. Five of the six sites have NO camelCase leg. They read the refused spelling and
   nothing else, so retiring it does not re-point the read to the declared spelling —
   it deletes the only read of the value. The corollary is the real user-facing gap:
   on fully spec-compliant metadata those five sites already ignore a configured
   `displayField` / `descriptionField` / `lookupFilters` today. `idField` is NOT in
   that list: measured on the pinned spec 17.2.0, `FieldSchema` refuses `idField` with
   `unrecognized_keys` exactly as it refuses `id_field` — neither spelling of the id
   key is declared, so the `id_field` reads have no camel leg to gain and their only
   route is the ingestion choke point (objectui#7650, option A).
3. The object-schema field def and the widget bag are the same object at runtime.
   `ObjectForm` builds its fields from `getObjectSchema` and threads each def to the
   widget, where `@object-ui/fields` `LookupField` reads `display_field` /
   `description_field` / `id_field` / `lookup_filters` SNAKE-FIRST, and
   `@object-ui/types`' `LookupFieldMetadata` (published) declares all four —
   `content/docs/fields/lookup.mdx` documents three of them as authorable
   (`description_field`, `id_field`, `lookup_filters`; `display_field` has zero hits in
   all of `content/docs`, which document `reference_field` instead). Retiring the legs at the
   object-schema consumers while the form widget keeps reading snake-first off the
   same def would make one stored document render one way in the form and another in
   the chart, list, filters and action dialogs.

Per site, which way the value would have flipped had the leg been retired:

- `plugin-charts` `ObjectChart` (`id_field`, `display_field`) — bag proved to be the
  object-schema def (`ds.getObjectSchema`). No camel leg: the value would have
  collapsed to the constants `'id'` and `'name'` for every host, spec-compliant or not.
- `plugin-form` `deriveMasterDetail` (`display_field`) — object-schema def in-repo,
  but `deriveColumns` is a public export, so external callers' bags are untraceable.
  No camel leg: `col.displayField` would have become `undefined`.
- `plugin-list` `ListView`, columns branch — NOT the object-schema def. The bag is a
  list-view column (`ListColumnSchema`), which refuses BOTH castings of all three keys.
  A third contract, filed separately rather than half-retired.
- `plugin-list` `ListView`, object-def branch — object-schema def proved. No camel leg:
  the branch's output `displayField` and `idField` (its own descriptor keys, not spec
  spellings) would have gone `undefined`.
- `plugin-list` `UserFilters` — `objectDef` is a public prop typed `any` on a publicly
  exported component; the bag cannot be traced past this package. No camel leg.
- `app-shell` `resolveActionParams` — the in-file provenance note is correct; this is
  the object-schema def. No camel leg for any of its four reads.
- `app-shell` `ObjectFieldInspector` (`lookup_filters`) — the only camel-first site,
  and it writes camel back. Its snake leg reads a stored pre-strict document, so
  retiring it would show an admin an empty filter list and let a save strand the real
  filters.

One live bug found and deliberately NOT filed as a card (open PR #7641 flips the
runtime half and retires it on its own; the PM recorded it on objectui#7642 so it
becomes a card the moment #7641 stops being its fix), not addressed here: the designer reads
`lookupFilters ?? lookup_filters` (camel first) while the runtime `LookupField` reads
`lookup_filters ?? lookupFilters` (snake first), so a document carrying both keys with
different values is displayed one way and honoured the other.
