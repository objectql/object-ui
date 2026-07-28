---
"@object-ui/core": patch
"@object-ui/types": patch
"@object-ui/fields": patch
"@object-ui/i18n": patch
"@object-ui/components": patch
"@object-ui/plugin-detail": patch
"@object-ui/permissions": patch
---

fix(core,fields): a string `$orderby` is a clause, not a character array — and localize the sharing-rule widgets (objectstack#3821)

**The recipient picker listed nothing, ever.** `QueryParams['$orderby']` was
typed as `Record | string[] | SortObject[]`, so `queryParamsToRecord` sent any
non-array value through `Object.entries`. Handed the clause string `'name asc'`
— which callers do build by hand — it walked the string index by index and
emitted `$orderby=0 n,1 a,2 m,3 e,4 ,5 a,6 s,7 c`. The server sorted by columns
that don't exist and every row was filtered out, so
`sys_sharing_rule.recipient_id` rendered "No matches" for every recipient type
and no sharing rule could be created from the Console. `ObjectGrid` builds the
same shape from a schema-level `sort` in three places, so grids with a string
sort silently showed an empty table.

A string `$orderby` is now passed through verbatim (the server's OData
normalizer has always parsed `'name asc'`), and the type admits `string`.
`RecipientPickerField` additionally switched to the structured
`{ name: 'asc' }` form so it can't regress this way against any data source.

**The three sharing-rule authoring widgets never had translations.**
`ObjectRefField`, `RecipientPickerField` and `FilterConditionField` hardcoded
their English copy — a Chinese Console showed "Select an object", "Select a
user", "Search…", "No matches", "Edit as JSON". They now go through
`useFieldTranslation` like every other widget, with keys added under `fields.*`
in all ten locales.

The recipient placeholder was the interesting one: it read
`` `Select a ${recipientType.replace(/_/g,' ')}` ``, interpolating the enum
value into an English sentence — a shape no locale can translate. It is now a
per-type key (`fields.recipient.selectUser`, `…selectBusinessUnit`, …), so
"选择业务单元" and "Select a business unit" no longer have to share a structure.

**Editing a rule silently dropped its recipient.** The picker resets the stored
id when `recipient_type` changes, because an id valid for a user is meaningless
for a team. It treated the edit form's `'' → 'user'` hydration as such a change:
opening any saved rule blanked the recipient, and saving persisted the blank.
Only a non-empty predecessor now counts as a type switch.

**Building a filter submitted the surrounding form.** None of `FilterBuilder`'s
controls declared `type="button"`, and a bare `<button>` inside a `<form>`
defaults to `type="submit"`. Adding, removing or clearing a condition therefore
submitted the sharing-rule dialog — firing validation mid-edit, and on an
already-valid form saving the record before the admin was done.

**A rejected write showed the user raw server diagnostics.** The form rendered
`error.message` verbatim, so a sharing / RLS denial reached the dialog and the
toast as `FORBIDDEN: insufficient privileges to update showcase_private_note
pi-TgoJ4_DM55Fqz` — untranslated, and leaking the object's machine name and the
record id to whoever hit it. Permission failures now render localized copy
(`form.noPermissionToSave`, added in all ten locales), with the server text kept
on the console for debugging; other failures still show the server's message,
which is the useful part, and fall back to `form.submitFailed` when there is
none — replacing the previously hardcoded English "An error occurred during
submission".

**The detail header offered "Edit" on records the user may only read.** Object
permissions can't express "this one record is read-only" — a read-only sharing
grant sits inside an object the user may otherwise edit — so the header showed
the primary Edit CTA, opened the form, and let the user retype a field before
the server rejected the save. `DetailView` now gates Edit / Delete on the
object-level check AND on the explain engine's record-grained verdict
(`POST /api/v1/security/explain` with a `recordId`, ADR-0090 D6 / ADR-0095 C2 —
the same pipeline the enforcement middleware runs, so button and server cannot
disagree). Explaining oneself needs no special permission. The probe is one
cached request per record, skipped entirely when the object-level check already
says no, and **fails open** on every uncertainty — an unanswered hint must never
be the reason a permitted user cannot act; the server stays the authority
(ADR-0057 D10).

Hardens `evaluatePermission` while there: a role config carrying only
`fieldPermissions` (no `actions`) made `check()` throw a TypeError that
propagated out of the render. A permission check must not be able to crash a
view.

Browser-verified against the framework showcase Console in Chinese: object /
criteria / recipient copy is fully localized, the recipient dropdown lists real
users, business units and positions, a saved rule reopens with its recipient and
criteria intact, editing the filter no longer submits, and a rule created
end-to-end stores a real record id rather than free text. The criteria authored
in the builder is honored by the evaluator: `{"pinned":true}` on an owner-private
object granted the recipient exactly the matching records and nothing else.
