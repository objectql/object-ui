---
'@object-ui/plugin-list': patch
---

`list-view` harvests row-action predicate fields from the OBJECT's `userActions` block only — a view's toolbar policy can no longer shadow it.

`userActions` names two different blocks. On a **view** it is toolbar policy —
the spec's `UserActionsConfigSchema` (`sort`, `search`, `filter`, `refresh`,
`rowHeight`, `addRecordForm`, `editInline`, `buttons`), which rejects `edit` by
name. On an **object** it is the CRUD-predicate block (`edit` / `delete` /
`create` carrying `visibleWhen` / `disabledWhen`, objectui#2614) — and that is
the only shape `listViewPredicates` can read, since its loop skips every
non-object value.

`ListView` read the key view-first when building the `$select` projection
(`(schema as any).userActions ?? (objectDef as any)?.userActions`). A view
carrying a perfectly legal toolbar block therefore shadowed the object's CRUD
predicates, the harvest found none, and the predicate's operand left the
projection. CEL then faults on the absent key, fails closed, and the row
Edit/Delete button disappears for everyone with nothing pointing at the
projection — objectui#3501's failure, reached with a success receipt at every
step.

This is the sibling of the `plugin-grid` read site fixed in objectui#5426, and
it was the worse of the two: `app-shell`'s `ObjectView` builds the view-level
`userActions` it hands down as an object literal of two spreads, so the left
operand was `{}` at worst — never nullish. The `??` never fell through, and the
object's CRUD predicates were never consumed at all on that path, whether or
not an author wrote any toolbar policy.

The harvest now reads the object block only. Both `userActions` read sites in
`ListView.tsx` carry a comment naming the collision, and
`__tests__/ListView.userActionsCollision.test.tsx` pins each clause of it: the
two shapes, a producer that manufactures the view one, the harvest's blindness
to it, and the projection that must keep the object's operand with a toolbar
block — or an empty block — present on the view.

Toolbar policy itself is untouched — it was never read through this path.
