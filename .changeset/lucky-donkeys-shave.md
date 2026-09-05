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
   `unrecognized_keys` exactly as it refuses `id_field` — on `FieldSchema` neither
   spelling of the id key is declared, so the `id_field` reads have no `FieldSchema`
   spelling to gain a leg for and their only route is the ingestion choke point
   (objectui#7650, option A). That is a `FieldSchema` statement only: the widget
   contract `@object-ui/types` `LookupFieldMetadata` DOES declare `idField` (kept by
   PR #7641 as a widget-contract key), and `LookupField` reads it off the same runtime
   object finding 3 describes.
3. The object-schema field def and the widget bag are the same object at runtime.
   `ObjectForm` builds its fields from `getObjectSchema` and threads each def to the
   widget, `@object-ui/fields` `LookupField`. What that widget reads moved while this
   census was under review, so this record is dated. At this branch's base (`1ec291c0`,
   2026-09-04) `LookupField` read `display_field` / `description_field` / `id_field` /
   `lookup_filters` SNAKE-FIRST, the published `@object-ui/types` `LookupFieldMetadata`
   declared all four snake members, and `content/docs/fields/lookup.mdx` documented
   three of them as authorable (`description_field`, `id_field`, `lookup_filters`;
   `display_field` 0 hits in all of `content/docs`, which documented `reference_field`
   instead). PR #7641 (merged 2026-09-04T15:01:32Z as `351eb318`) then converged the
   widget contract on the spec's camelCase. Measured on `origin/main` (`a3eb5d07`):
   `LookupField` reads `displayField` / `descriptionField` / `idField` / `lookupFilters`
   ONLY (its `reference_field` fallback is kept), `LookupFieldMetadata` declares the
   camel members only, and `content/docs` has 0 hits for all four snake keys (controls
   in the same run: `reference_field` 4, `lookupFilters` 3). On the tree this census
   lands in, the split therefore runs the OTHER way: it is KEEPING these six snake
   legs, while the form widget reads camel-only, that lets one stored pre-strict
   document render one way in the form and another in the chart, list, filters and
   action dialogs. KEEP still stands — on findings 1-2 (the serve path delivers the
   stored key, and five sites have no camel leg, so retiring the read deletes the only
   read) and on the ruling that refused option B and made the ingestion choke point
   (option A, objectui#7650) the prerequisite for any retirement. The way to close the
   split is A (canonicalise once at ingestion) plus the additive camel legs tracked on
   objectui#7435, not a consumer-side deletion.

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

One live bug found during the census and deliberately NOT filed as a card, not
addressed here: at this branch's base the designer (`ObjectFieldInspector`,
`readLookupFilters`) read `lookupFilters ?? lookup_filters` (camel first) while the
runtime `LookupField` read `lookup_filters ?? lookupFilters` (snake first), so a
document carrying both keys with different values was displayed one way and honoured
the other. It is RETIRED on `main`: PR #7641 (merged 2026-09-04T15:01:32Z, `351eb318`)
made `LookupField` read `lookupFilters` only, so both halves now honour the camel key
and there is nothing left to file. The fallback the PM recorded on objectui#7642 (a
card the moment #7641 stopped being its fix) is moot — #7641 landed. The designer's
snake leg survives as a read of a STORED pre-strict document, which is the ground of
its KEEP above, not as one side of a competing read order.
