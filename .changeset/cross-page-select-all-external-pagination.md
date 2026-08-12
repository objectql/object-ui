---
'@object-ui/plugin-grid': patch
---

fix(plugin-grid): the cross-page "Select all N matching" banner works under external pagination

`BulkActionBar`'s cross-page affordance was gated on ObjectGrid's `totalMatching`
state, whose only writer is the component's own data loader. Under a host that
fetches the rows itself — ListView passing `manualPagination` + `rowCount`, which
is what the console does — that loader never runs, so the total stayed
`undefined` and the banner was permanently absent for any match-set size, even
though the pager two lines away was already rendering the correct page count from
the host's total.

The pager's derivation is now hoisted to a single `resolvedTotalMatching` value
that both the pager and `BulkActionBar` consume, so the affordance reports the
real server total on both paths. The `selection.type: 'single'` suppression is
unchanged.
