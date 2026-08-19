---
"@object-ui/plugin-grid": patch
---

`ObjectGrid`'s inline add-record row now honours `can(object, 'create')` (objectui#5148).

The `create` face of the shape #5143 closed for `update`. `ObjectGrid` resolves
`permissionUpdate` / `permissionDelete` through `perms.can(...)` and ANDs each
into the affordance it governs, but the Airtable-style add-record row was gated
on the author-declared `operations.create` **alone** — a flag that says whether
the affordance was *wired*, never a permission grant. There was no
`permissionCreate` in the component at all.

The symptom is the one #5143 and #4646 each closed on a neighbouring surface: a
principal with no `create` grant was offered the add row, filled it in, and was
stopped only by the server's 403 — while the toolbar's New button on the very
same screen had already hidden itself for that principal. No data ever landed
(the server gate is solid); the cost was a round-trip the UI guaranteed would
fail, and one component answering "may this user create records here?" two
opposite ways at once.

`showAddRow` is now the authored request **∧** the principal's verdict, the same
conjunction #4646 / PR #5145 spelled for the related-list "+ New"
(`affordances.create ∧ can(obj, 'create')`) with the operation moved to
`create`. The authored key stays the gate's left half, so this narrows and never
widens: no verdict turns the add row on for a grid that did not ask for it, and
a grid declaring no `operations` block keeps falling through the
`{ update: !!onEdit, delete: !!onDelete }` default that carries no `create` key.

Fail-open is preserved, and is load-bearing rather than incidental here:
`can()` answers `true` with no `PermissionProvider` mounted, and the verdict is
skipped entirely when no object name resolves. `plugin-designer`'s
`FieldDesigner` and `ObjectManager` both build grids with
`operations: { create: true, update: true, delete: true }` when not read-only
and typically render with no provider, so those surfaces are untouched — pinned
by a dedicated test rather than left to inspection.
