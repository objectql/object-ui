---
'@object-ui/types': minor
'@object-ui/app-shell': patch
'@object-ui/react': patch
---

`ObjectSchemaMetadata` is now derived from `@objectstack/spec`'s `ServiceObject`
instead of being a hand-written copy (objectui#5362; maintainer ruling
2026-08-20: the object document type belongs to the spec).

What changes on the published type surface:

- **Gained:** the full spec object-document surface, including the three keys
  the runtime already reads but the old interface rejected as excess
  properties: `icon`, `titleFormat`, `listViews` (plus `pluralLabel`,
  `nameField`, `displayNameField`, `managedBy` as a spec key, and the rest of
  the spec document).
- **Removed:** nine members the old interface declared that no objectui
  runtime code reads and the spec document does not know: `extends`,
  `triggers`, `primary_key`, `relationships`, `name_field` (the spec spelling
  is `nameField`), `soft_delete`, `audit_trail`, `version`, `cache`.
  `ObjectTrigger` and `ObjectRelationship` remain exported unchanged.
- **Kept:** `editMode` — the one measured client-side member the runtime reads
  (`recordFormNavigation` / `AppContent`) — now declared on the new
  `ObjectSchemaClientExtensions` interface, which the derivation intersects.
  Note the spec's strict parse rejects `editMode` on published documents
  (`unrecognized_keys`); it is a client-type member only.

Spelling settlement: `listViews` (camelCase) is canonical — `list_views`
appears nowhere in `@objectstack/spec` 17.2.0. Runtime read sites in
`@object-ui/app-shell` and `@object-ui/react` keep a documented snake-spelling
READ fallback for stored pre-settlement documents (that stock has never been
censused — objectstack#7917); the CRUD guide and its pinned transcription now
author the canonical spelling.
