---
'@object-ui/app-shell': minor
'@object-ui/plugin-detail': minor
---

An auto-derived related list now orders its rows by the CHILD object's default list view
`sort`, instead of falling to the server's primary-key order (objectui#5795). A task
version's "check items" tab whose child object declares `sort: [{ field: 'seq_no' }]`
renders 10/20/30/40; before this it rendered whatever order the ids happened to give —
20/30/10/40 in the reported case — while the child object's own list page obeyed the
declaration.

**Declared as user-visible, deliberately, even though no key was added.** The contract
question ("where does a derived related list's sort declaration live?") was ruled on
objectstack#11345 (maintainer, 2026-08-23) as **direction 1**: inherit the child's list
view sort, and add **no** new spec key — the field-level `relatedListSort` the issue also
proposed was explicitly not approved. So there is nothing new to author, and
`record:related_list.sort` was already declared, parsed and consumed; this fills it. What a
host observes is nonetheless new: a derived related-list descriptor gains a populated
`sort` where it had none, and the query it issues gains an `$orderby`. An app whose child
objects declare a default list order will see those tabs re-order on upgrade — which is the
point of the change, and is why this is not a patch.

Nothing is inherited where nothing was declared: a child object with no default list-view
sort produces the same descriptor, the same node and the same `$orderby`-free query as
before.

The two `sort` surfaces declare the same union and mean different things by its string arm
— a `ListView` string is the legacy space-separated `'seq_no desc'`, while the related
list's own reader takes `'field'` / `'-field'` — so the inherited value is normalized to
the array arm once, at the derivation, through `@object-ui/core`'s
`convertSortToQueryParams` (the repo's single definition of both authored dialects). An
un-normalized inherit would have ordered by a field literally named `seq_no desc`.

Known and unchanged: `$orderby` is only assembled while the related list is in windowed
(server-paged) mode, so a declared *or* inherited sort still disappears while the built-in
client text filter is active. That hole pre-dates this change and affects the authored prop
identically; it is now pinned as a recorded fact in
`plugin-detail/src/__tests__/RelatedList.sortDroppedOutsideWindowed.test.tsx` rather than
fixed here.
