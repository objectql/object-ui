---
'@object-ui/app-shell': patch
---

Delete the dead `src/utils/metadataConverters.ts` module. It had zero importers, was not
re-exported from the package barrel, and no `exports` subpath reached it — `toObjectDefinition`,
`toFieldDefinition`, `MetadataObject` and `MetadataField` were never part of the published
surface, so nothing external can break. The module was removed rather than left alone because it
carried two patterns the live code no longer uses: a name-heuristic `isSystem` (the server's real
`system` flag is the source of truth) and a three-way `referenceTo` tolerance for a target the
spec spells `reference`. A dead copy that disagrees with the live one is what a future author
copies from.
