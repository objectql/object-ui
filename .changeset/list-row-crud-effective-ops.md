---
"@object-ui/plugin-grid": minor
"@object-ui/plugin-list": minor
---

feat: gate list row Edit/Delete and bulk delete on the server's effective operation set (#3720)

The **fourth** surface #3391 left open. The three earlier rounds — the toolbar
(objectui#2823), detail/form (#3546, objectui#2832 + #2876) and related lists
(#3546) — all route through `resolveCrudAffordances`. The main list's **row
CRUD** does not: it has its own resolver (`plugin-grid`'s
`resolveRowCrudAffordances`), so none of those rounds ever reached it.

Its gate was `operations ?? { update: !!onEdit, delete: !!onDelete }` — and
`ObjectView` wires `onEdit`/`onDelete` unconditionally while view JSON rarely
declares `operations`, so it was effectively always-on. A caller whose effective
set carried neither `update` nor `delete` still got the row kebab's Edit/Delete
**and** the bulk delete, the most destructive affordance on the list.

- **plugin-grid** `resolveRowCrudAffordances` now takes `managedBy` and
  `effectiveApiOperations` and resolves the object verdict through the shared
  `resolveCrudAffordances` policy — so the row gate is the SAME decision the
  toolbar, record header, form and related lists make. It also returns
  `objectCanDelete`, the object-level delete verdict that bulk delete gates on
  (bulk rides `onBulkDelete`, a different callback from the row `onDelete`).
- **plugin-grid** `ObjectGrid` threads its existing `effectiveApiOps` — until
  now fed only to Export — into the row gate, and applies the delete verdict to
  bulk delete: the implicit `['delete']`, an author-declared
  `bulkActions: ['delete']`, and any `bulkActionDefs` entry with
  `operation: 'delete'`. A declared bulk action is a *wiring* declaration, not a
  permission grant. Custom action ids and non-delete operations pass through
  untouched.
- **plugin-list** `ListView`'s own bulk bar (the non-grid views — kanban /
  calendar / gallery; the grid path delegates to `ObjectGrid`) drops its
  built-in `delete` under the same verdict.

Also closes the ADR-0103 gap on this chain: `rowCrudAffordances` documented the
bucket lock as "applied upstream via the view's `operations.*`", but the
all-open default meant it never was — an engine-owned `system` / `append-only` /
`better-auth` object leaked a generic row Edit/Delete that the engine rejects
(`assertEngineOwnedWriteAllowed`). Running the shared policy applies it, and a
`userActions` opt-in still re-opens it (e.g. `sys_user`'s `edit`).

Same semantics as the earlier rounds: **intersection, never union** — a server
grant cannot re-open what the bucket or `userActions` closed, and a
`userActions` opt-in cannot survive a server denial. A missing effective set
(unrestricted object, older backend, or no `PermissionProvider`) preserves the
current behavior.
