---
'@object-ui/app-shell': minor
---

The metadata designer's View column inspector now reads a column's identity —
field key and label — in the ObjectStack canonical spelling only: `field` and
`label`. The legacy TanStack aliases `accessorKey` / `header` are no longer
consulted (objectui#5344).

Why this is a behaviour change and not a tidy-up: `ListColumn` refuses both
legacy keys by name (`unrecognized_keys`), so a column carrying them has no
field key the spec recognises. The inspector nevertheless read them and
displayed `accessorKey`'s value in the field-key box, presenting a spec-refused
key as though it were a valid column identity — the same consumer-side
tolerance alias `ObjectGrid` retired in objectui#5068, surviving one layer up in
the authoring tool, which is the surface that is supposed to teach the correct
shape.

**What an author sees:** a stored column shaped `{ accessorKey, header }` now
shows an EMPTY field key and an empty header, and is re-authored rather than
silently carried. Canonical `{ field, label }` columns and bare-string columns
are untouched.

**What is deliberately NOT changed:** the writeback. `patchIdentity` still
re-emits whichever spelling it was handed, so no stored document is rewritten
by the act of editing it. Normalising on write was ruled out once the
maintainer confirmed there is no population of legacy stored documents to
migrate; such a column stays unsaveable against the spec both before and after
an edit, exactly as it did before this change. What this removes is the
invisibility of that state, not the state itself.
