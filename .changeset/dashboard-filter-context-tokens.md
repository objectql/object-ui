---
"@object-ui/core": patch
"@object-ui/react": patch
"@object-ui/plugin-dashboard": patch
"@object-ui/plugin-charts": patch
"@object-ui/app-shell": patch
---

fix(dashboard,charts): resolve `{current_user_id}` in widget filters (framework #3574)

A dashboard widget filtered on `{current_user_id}` rendered `0`. The token
reached SQL as a literal, matched no row, and nothing was logged on the client
or the server — a silent zero that reads as "you have no work" rather than
"this filter did not resolve". The same token in a list-view filter resolved
correctly, so a user-scoped list and a user-scoped widget over the same data
disagreed.

There was no shared resolver. Three ad-hoc implementations had grown up
independently — `ObjectView` for list views, `ObjectDataPage` for URL filter
triples, `NavigationRenderer` for hrefs — and each understood only the filter
shape its own surface used. `ObjectView`'s opened with
`if (!Array.isArray(filter)) return filter`, so it could not have been reused
by dashboard widgets even in principle: widget filters are MongoDB-style
objects. Widgets therefore got no resolution at all — `DatasetWidget` called
`resolveDateMacros` and nothing else, which is why `{today}` worked in a widget
and `{current_user_id}` silently did not.

- **`@object-ui/core`** — new `utils/filter-tokens.ts` with
  `resolveContextTokens` and `resolveFilterPlaceholders`. The latter expands
  *every* placeholder vocabulary in one call and is what surfaces should use;
  resolving only some of them is the whole defect. The walk handles arrays and
  plain objects uniformly, so one resolver covers both platform filter shapes.
- **`@object-ui/react`** — new `FilterScopeProvider` / `useFilterScope`. The
  renderer packages deliberately do not depend on `@object-ui/auth`, so the
  shell supplies the session values. This is a separate context from
  `PredicateScopeContext`, which is the expression evaluation scope and carries
  no organization.
- **`@object-ui/plugin-dashboard` / `@object-ui/plugin-charts`** — all six
  widgets that previously resolved date macros only now resolve both
  vocabularies: `DatasetWidget`, `ObjectMetricWidget`, `ObjectDataTable`,
  `ObjectPivotTable`, and `ObjectChart` (dataset-bound and inline paths). The
  chart's `compareTo` comparison filter gets the session pass too — otherwise
  the overlay series silently ignored the owner clause the primary series
  honoured.
- **`@object-ui/app-shell`** — `ObjectView`'s local `substituteFilterTokens`
  and `ObjectDataPage`'s inline `=== '{current_user_id}'` ternary now delegate
  to the shared resolver, so both also gain `{current_org_id}` and date macros.
  Two of the three ad-hoc implementations are gone rather than joined by a
  fourth.

An unresolvable token is left intact rather than dropped: leaving it yields an
empty result, whereas dropping the clause would *widen* the result set and show
a signed-out viewer everyone's data. It is no longer silent — the resolver
warns, naming the token, and suggests the intended spelling for known
near-misses (`{current_user}`, `{user_id}`, `{organization_id}`). Authoring-time
enforcement lands separately as `filter-token-unknown` in `@objectstack/lint`.
