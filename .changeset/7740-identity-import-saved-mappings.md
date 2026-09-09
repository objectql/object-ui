---
'@object-ui/app-shell': patch
---

Identity import (`sys_user`) offers the saved-mapping selector again
(objectui#7740, director seat decision batch #68, ledger objectstack#12708).

`createIdentityImportDataSource` builds the wizard's data source by spreading the
base adapter and then explicitly clearing the six async-job and undo methods —
the file's stated design is "hide by explicit `undefined`, because the wizard
feature-detects these methods".

An object spread copies **own enumerable properties only**. `ObjectStackAdapter`
declares `listImportMappings` in its class body, so it lives on the prototype and
the spread never copied it. On `sys_user` the wizard's `typeof … === 'function'`
probe therefore failed and the saved-mapping selector was hidden — not by the
design the file describes, but by a language rule nobody had expressed. The
adapter degrades a missing method to an empty list, so nothing anywhere said so.

That hiding was also self-contradictory: `importRecords` in the same wrapper
already forwards `mappingName` to an identity endpoint that honours it, so the
one control that could ever set that field was the one control that could never
render.

The method is now forwarded explicitly, one line beside the six deliberate
`undefined`s, bound to the base. The spread idiom is unchanged and the six job
surfaces stay withheld — widening the spread would bring back every prototype
method of the base adapter without a census.

Scope note: on this endpoint a saved mapping renames columns and nothing more.
`writeMode`, `matchFields`, `runAutomations` and `skipBlankMatchKey` are all sent
explicitly by the identity import path, and the platform applies an artifact's
write semantics only as defaults, so those guards never open here.
