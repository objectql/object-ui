---
---

Test-only (objectui#6524): the `__proto__` instrument fixture in
`MetadataService.objectPayloadFieldsMap.test.ts` was spelled as a plain object
literal, which per Annex B.3.1 sets the prototype instead of adding a key — so
the assertion parsed an empty `fields` map and would have stayed green if the
spec began refusing the name. Respelled as a computed key and pinned with the
literal-versus-computed control. No published behaviour changes.
