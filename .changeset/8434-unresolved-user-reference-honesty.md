---
'@object-ui/fields': patch
'@object-ui/i18n': patch
---

A `user` reference that resolved to nothing is no longer rendered as a person
(objectui#8434, routed from cloud#2074).

`UserCellRenderer`'s first branch printed any primitive as plain truncated text
under the comment *"Primitive value: just display the ID/username as text"*. On a
`user` field the premise of that comment is wrong: `user` is a lookup specialised
to `sys_user`, so a primitive arriving there means precisely that nothing turned
the reference into a person. Printing it as displayable text rendered
**"resolution failed" as "resolution succeeded"** — and, measured, the cell was
**byte-identical** to what a `text` cell prints for the same string. The only
difference from a resolved person was the *absence* of the avatar, which is a
subtractive signal; a user who has never seen the avatar has no reason to read
absence as failure.

Such a cell now keeps the raw value **visible** and adds a stated affordance
beside it: a muted marker glyph plus a sentence ("Unresolved reference: … was
not resolved to a user", keyed as `detail.unresolvedReference` in all ten locale
packs). The multi-value shape gets the same treatment, so a `user` field is not
honest on one input shape and silent on the other.

**The sentence is deliberately epistemic, not ontological.** This branch has two
populations and the renderer cannot tell them apart — it has no resolver at all,
unlike `LookupCellRenderer`: an unexpanded `sys_user` id is the *legitimate*
stored form (`packages/core/src/utils/expand-fields.ts`: "a `user` column that is
NOT requested for expansion comes back as a raw user id", objectui#2032), and a
name written into the column is dirty data. A "not found" claim would be false
for the first, so the affordance states only what is true of both: this screen
did not resolve it.

**Nothing else moves.** An expanded reference still renders avatar + name; a
reference object carrying only an id still draws its avatar; `{}` still prints
the coerced text (objectui#8596's boundary); the save-side `reference_not_found`
refusal and the edit form are untouched — this change is display-only.
