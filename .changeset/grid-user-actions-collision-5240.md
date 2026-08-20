---
'@object-ui/plugin-grid': patch
---

`object-grid` harvests row-action predicate fields from the OBJECT's `userActions` block only — a view's toolbar policy can no longer shadow it.

`userActions` names two different blocks. On a **view** it is toolbar policy —
the spec's `UserActionsConfigSchema` (`sort`, `search`, `filter`, `refresh`,
`rowHeight`, `addRecordForm`, `editInline`, `buttons`), which rejects `edit` by
name. On an **object** it is the CRUD-predicate block (`edit` / `delete` /
`create` carrying `visibleWhen` / `disabledWhen`, objectui#2614) — and that is
the only shape `listViewPredicates` can read, since its loop skips every
non-object value.

`ObjectGrid` read the key view-first when building the `$select` projection
(`(schema as any).userActions ?? resolvedSchema.userActions`). A view carrying a
perfectly legal toolbar block therefore shadowed the object's CRUD predicates,
the harvest found none, and the predicate's operand left the projection. CEL then
faults on the absent key, fails closed, and the row Edit/Delete button disappears
for everyone with nothing pointing at the projection — objectui#3501's failure,
reached with a success receipt at every step.

The view-level block is not hypothetical: `SpecBridge.transformListView` copies
it onto the `object-grid` node the renderer receives, and `app-shell`'s
`ObjectView` builds one unconditionally.

The harvest now reads the resolved object block only. Both `userActions` read
sites carry a comment naming the collision, and
`__tests__/gridNonAuthorKeys.test.tsx` pins each clause of it: the two shapes,
the producer that writes the view one, the harvest's blindness to it, and the
projection that must keep the object's operand with a toolbar block present.

Toolbar policy itself is untouched — it was never read through this path.
