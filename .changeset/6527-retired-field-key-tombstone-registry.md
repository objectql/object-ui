---
'@object-ui/types': minor
'@object-ui/app-shell': patch
'@object-ui/plugin-designer': patch
---

One tombstone registry for the designer seam's retired field keys
(objectui#6527). Three independently maintained `RETIRED_FIELD_KEYS` literals
— the metadata-admin read door (`object-fields-io.ts`), `MetadataService`'s
carry-over and `MetadataFieldsPage`'s carry-over — become derivations from a
single registry in `@object-ui/types` (`RETIRED_FIELD_KEY_TOMBSTONES` +
`retiredFieldKeysFor(site)`), naming each retired key, the card that retired
it, and its PER-SITE applicability.

Per-site behaviour is unchanged — this is a consolidation, and each site's
effective strip set is pinned equal to its pre-consolidation literal. The two
deliberate asymmetries a naive union would have destroyed are now recorded as
data and pinned:

- `formula` stays stripped by the two write-side carry-overs and is NOT
  stripped by the read door — ruled on objectui#6526 (option B): the
  `ObjectFieldInspector` migration path (objectui#6043) stands, and the
  registry test makes that ruling mechanical.
- `sortOrder` stays a single-site strip at `MetadataService`'s carry-over,
  now explicitly recorded as the registry's one DEFENSIVE entry (objectui#6045
  measured that no shipped writer ever populated a field-level one).
