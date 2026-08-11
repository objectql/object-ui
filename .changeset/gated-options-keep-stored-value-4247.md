---
'@object-ui/fields': patch
'@object-ui/components': patch
---

A dependency-gated option list no longer deletes the field's stored value on mount

The four fixed-option widgets (`SelectField`, `MultiSelectField`, `CheckboxesField`, `RadioField`) end their cascade resolution with a "drop what is no longer offered" effect, and the form renderer runs an equivalent clear of its own over every option field. Both read `resolveCascadingOptions`, which returns an **empty** offered set whenever the list is *gated* — a declared `dependsOn` parent is still empty. Nothing the field held could be "still offered" against an empty set, so both paths wrote the field empty **on mount, with no interaction**, while the control rendered "Select Country first" beside it: it told the user it could not offer anything, and deleted what they had.

Gated means **unknown**, not invalid. The cascade clear exists (ADR-0058) so a user-driven parent change prunes a now-invalid child; a withheld list on mount is missing information — the record simply arrived with its controlling field empty (a later-cleared parent, an import, a partially-migrated row) — and that is not a reason to destroy stored data. Both clears now skip while gated, reading the resolver's own `gated` flag rather than re-deriving it from an empty offered set, which would collide with the distinct never-configured case guarded separately in objectui#4220.

Convergence stays exactly where it belongs: once the parent **is** chosen and the resolved set genuinely excludes the stored value, the prune applies unchanged — including at the moment the gate lifts, so picking a parent whose list does not contain the old value still clears it on that transition. The three states are pinned apart (never-configured / gated / resolved-and-excludes) across all four widgets and the form host, so a future edit cannot collapse them back into one empty-set test.

Reachable on every host that mounts these widgets with a live record: the form renderer, the grid's inline cell editor, and the detail page's inline editor — where each `onChange` went straight into the record draft the save bar commits.
