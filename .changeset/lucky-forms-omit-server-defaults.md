---
'@object-ui/console': patch
---

Console form pages no longer submit a cleared server-owned field as a blank.

A field whose declared `defaultValue` is an instruction the server resolves per
insert (a `NOW()` / `current_user` token, or a CEL expression envelope) opens
with an empty control on a create form, and its key stays out of the payload
while nothing touches it. But a submitter who typed into that control and then
cleared it put the key back holding `''` — and `ObjectQL.applyFieldDefaults`
resolves a declared default only for a field arriving absent or null, so the
blank was stored and the declaration silently defeated.

Such a key is now dropped from a CREATE submit on both the internal
`/forms/:name` and the anonymous `/f/:slug` route. A blank cleared from a field
with no runtime default — or with a static one — is still submitted, because
that is the user removing a value; and an edit submit is untouched, where a
cleared column is a deliberate removal.
