---
'@object-ui/plugin-grid': patch
---

`ObjectGrid`'s `editable` schema key now honours the caller's `update` permission.

A declaratively-authored `object-grid` block carrying `editable: true` opened
inline editing for every principal, including one with no `update` grant. The
component had already resolved that principal's verdict — `permissionUpdate =
can(objectName, 'update')`, sitting a few lines above — but consumed it only for
the row kebab; the three inline-edit props read `schema.editable` raw. One
component therefore gave two opposite answers to "may this user write these
records?" on the very same rows: the kebab correctly hid Edit, while a click on
a cell dropped the user into an editor whose save could only earn a server 403.
No data ever landed (the server gate is solid) — the cost was a round-trip the
UI walked the user through knowing it would fail.

`editable`, `renderCellEditor` and the save/cancel `rowActions` column now read
one resolved verdict: the authored key AND the object's resolved affordance
(ADR-0103 bucket, `userActions.edit`, and the server's effective API operations)
AND the principal's own grant. This is the conjunction objectui#4647 used to
close the same hole at the ListView layer; the SDUI-authored grid schema is a
second, independent door into that state which never passes through ListView.

Behaviour change, stated because it is one: a principal WITHOUT the `update`
grant no longer enters inline edit on such a grid, and no longer sees the
trailing save/cancel column that served it — that grid is now column-for-column
the non-editable grid, which is what it always effectively was. Everyone with
the grant is unaffected. The gate fails OPEN where there is no verdict to be
had: `can()` answers `true` with no `PermissionProvider`, and a grid with no
object name resolves the default-writable affordance, so standalone embeds, the
Studio designer canvas and pure inline-data grids keep today's behaviour.
