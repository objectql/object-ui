---
'@object-ui/plugin-list': patch
---

`ListView`'s toolbar sort picker no longer persists a sort the platform refuses to order by.

The picker keeps a platform-refused field listed while the CURRENT sort names it
(#6108). That exception is deliberate and stays: it is the only way a user can
REMOVE a sort the server answers `400 INVALID_SORT` for — withholding the option
unconditionally renders a blank row nobody can delete, and drops the sort silently
on the next edit.

What was wrong is that the picker rendered and emitted from the same array. Editing
anything ELSE in that popover — adding a second sort key, resetting to the view's
default — re-emitted the whole array with the refused entry still in it, and the
host's `onSortChange` turned that into `persistViewPatch({ sort })`: a
personalization PUT storing a refused column, written by a user who never touched
that row. A view stored before the sortability signal existed therefore kept
re-persisting its refused `$orderby` indefinitely.

Every `onSortChange` this component emits — the builder, the column-header sort and
"reset to default" — now crosses one boundary that drops what the served projection
refuses, while `currentSort` keeps the array whole. So what the picker LISTS and
what it PERSISTS are separate: the refused entry stays visible and removable,
removing it persists the removal, and no write carries it. This is the separation
#5729 already made at the grid seam (`ObjectGrid`'s `manualSort` /
`manualOnSortChange` pair); the picker was the second door onto the same stored
view state.

Only under a served sortability projection (objectstack#10235 ruling A). `undefined`
means NO SIGNAL SERVED — an older deployment, an inline/mock data source — not
"nothing is sortable", and that branch is byte-identical in behaviour to before.
