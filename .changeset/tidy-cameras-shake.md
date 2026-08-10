---
'@object-ui/app-shell': patch
---

metadata-admin: wire client-side Zod validation for `sharing_rule`, `translation` and `connector` (objectui#3561)

These three metadata types opted out of live client-side validation on recorded
reasons that no longer held against the resolved `@objectstack/spec` 17.0.0-rc.5:
`SharingRuleSchema` was described as having an empty shape (it is a `.strict()`
object of nine keys), `translation` was judged by `TranslationBundleSchema` (the
bundle map, not the kind's schema — it rejects a valid translation item), and
`connector` was blocked on a required `id` field that does not exist in
`ConnectorSchema`.

Each loader now names the schema the platform actually binds — `SharingRuleSchema`,
`TranslationItemSchema` and `DeclarativeConnectorEntrySchema`. Behaviour change:
drafts of these types are now rejected in the editor before save, through the same
diagnostics banner every other wired type already uses. Most notably a `connector`
draft that inlines credentials or authors provider-derived `actions` is caught at
authoring time by the ADR-0097 rules the bare `ConnectorSchema` does not carry.

`sharing_rule` is gated on the **create** door only: its schema is `.strict()` and
declares none of the ADR-0010 envelope keys that a stored body carries, so judging
a stored body with it would make the client stricter than the server.
`hasClientValidator(type, mode)` takes the door as a second argument for that
reason — without it the editor would have read a type with no gate on the edit
path as "clean" and suppressed the server's own diagnostics.
