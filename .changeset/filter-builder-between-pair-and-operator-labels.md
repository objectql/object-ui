---
'@object-ui/components': patch
'@object-ui/plugin-list': patch
'@object-ui/app-shell': patch
'@object-ui/i18n': patch
---

Console list filters: a `between` range is submitted only when both bounds are filled, and six operator labels stop rendering as raw i18n keys.

Two defects in the list-view filter panel (objectstack#8815), both in the Console
render layer, with no workaround available downstream.

**A half-filled range no longer refuses the whole view.** Picking a date column
and 「介于」 draws two inputs — that part landed in objectui#3958 — but typing
only one bound produced `["2024-01-01", ""]`, and both write paths read "is this
row filled in?" with one shape-blind predicate (`null` / `''` / empty array).
An array of length 2 passed it, so the empty bound went to the server, which
refuses the query outright (`400 INVALID_FILTER`): the list showed
「该视图的查询被拒绝」 and the filters the user had already applied stopped
applying too. The saved-view fold persisted the same half-range, so the refusal
came back on every later read of that view, for every user of it.

The spec cannot intercept this — `ViewFilterRuleSchema` accepts
`["2024-01-01", ""]` because it counts the two slots rather than what is in
them, while refusing a scalar or a one-element array. Authoring validation is
therefore green on exactly the shape that fails at query time, which makes not
emitting it the producer's job. `@object-ui/components` now exports
`isFilterValueComplete(operator, value)` — arity-aware, so a `pair` row needs
both bounds — and the two consumers that had each kept a copy of the old
predicate (`plugin-list`'s `convertFilterGroupToAST`, `app-shell`'s
`foldFilterGroupToSpecRules`) read it instead. A half-filled range is now
dropped exactly as a half-typed `equals` row already was: no filter, rather than
a filter the server will reject. Bounds of `0` and `false` stay real bounds.

**Six operator labels are translated in all ten locale packs.**
`startsWith`, `endsWith`, `isNull`, `isNotNull`, `exists` and `notExists` were
missing from every pack, so i18next resolved them to the raw key and the dropdown
showed `filterBuilder.operators.isNull` beside translated entries. The
component's own defaults table could not cover it: that table serves only the
no-provider path, and the Console mounts a provider. The report named four —
a `date` column's bucket offers the four nullness operators; a `text` column
showed all six.

Because the label key is built dynamically (`t(\`filterBuilder.operators.${op}\`)`),
no existing gate could see the gap: the call-site checker classifies a template
key as `missing-prefix` and only asks whether the prefix resolves, and
cross-pack parity is satisfied when all ten packs are missing a key together.
A new parity test pins the packs against `FILTER_BUILDER_OPERATORS` in both
directions, so an operator added to the dropdown now fails loudly until every
pack labels it.
