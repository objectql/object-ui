---
"@object-ui/plugin-grid": patch
"@object-ui/plugin-list": patch
"@object-ui/app-shell": patch
---

List row Edit/Delete, bulk delete and related-list CRUD now run the caller's own permission, not just the object's API exposure (objectui#4096)

The row kebab's built-in Edit/Delete rendered for every account, including ones
the server answers `403 PERMISSION_DENIED` on. Clicking Edit opened a fully
prefilled dialog that could only fail on save; Delete — a destructive entry —
sat one click away from users who could never perform it.

The gate intersected the object's resolved CRUD affordance with the server's
effective API operation set (`/me/permissions` `apiOperations`, objectui#3720),
and nothing else. `apiOperations` is the object's **API exposure surface** —
"which verbs does this object publish" — and the spec's own describe text says
so. It is principal-independent: the report measured two accounts with opposite
`allowEdit`, 30 shared objects, and **30/30 identical** `apiOperations`. A gate
made only of object-scoped layers therefore fails OPEN for every unprivileged
caller, which is why the same screen carried three different answers to "may
this user write this object": the toolbar's New was correctly hidden
(`affordances.create && can(obj, 'create')`), the record header's Edit/Delete
were correctly hidden (per-record write probe), and the row kebab was not.

Four surfaces now AND the principal's own verdict — `can(obj, 'update' |
'delete')`, i.e. `/me/permissions` `allowEdit` / `allowDelete`, the toolbar's
source — on top of the layers they already had:

- the grid row kebab's built-in Edit/Delete (`resolveRowCrudAffordances` gained
  `permissionUpdate` / `permissionDelete`, filled at the `ObjectGrid` call site);
- the grid's bulk-delete bar, which rides the same object-level delete verdict,
  so the row gate and the more destructive bulk entry move together;
- the non-grid (kanban / calendar / gallery) bulk bar `ListView` renders itself;
- the related-list Create/Edit/Delete on a child object
  (`RelatedRecordActionsBridge`), which had the same object-only gate.

**This is a tightening of the intersection, not a swap.** Every existing layer
stays: the ADR-0103 lifecycle bucket, `userActions.edit` / `delete`, and
`apiOperations`. A permission grant cannot re-open what any of them closed, and
none of them survives a permission denial.

Fail-open is preserved where it is the deliberate contract: `usePermissions()`
with no `PermissionProvider` answers `can: () => true`, so standalone embeds and
hosts that ship no permission source keep their Edit/Delete exactly as before.
Under `MePermissionsProvider` the semantics are the toolbar's, unchanged and now
shared: an authenticated principal whose object is absent from
`/me/permissions.objects` resolves fail-closed (objectui#2926 ④), an anonymous
session keeps the permissive default, and children never render while the
permission set is loading. Per-key absence is still permissive — an object entry
without `allowEdit` reads as allowed.

Server-side enforcement was already hard (403, DB unchanged), so this closes a
UI-affordance gap rather than an authorization hole.
