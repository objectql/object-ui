---
"@object-ui/core": patch
"@object-ui/react": patch
"@object-ui/plugin-list": patch
"@object-ui/app-shell": patch
---

`PageComponentSchema.dataSource` is now consumed instead of discarded — a
`list-view` page component can reference a **saved view by name** for the first
time, and writing the binding no longer breaks the component
(objectstack#5576).

The spec declares a per-element data binding on every page component —
`dataSource: { object, view?, filter?, sort?, limit? }` — and objectui read none
of it. `ViewDataProvider.resolveElementDataSource` forwarded
`filter`/`sort`/`limit` and dropped `view` entirely, and had no caller outside its
own test; nothing mapped `object` onto the `objectName` a list actually reads. So
"reference a saved view by name" was published, validated and inert, and every
page that wanted a saved view's columns/filter/sort had to inline a second copy of
them — the drift the binding exists to remove.

Writing the binding also **broke** the block, for a reason unrelated to `view`:
`SchemaRenderer` spread the schema's `dataSource` metadata onto the component as a
React prop, and that is the prop name the host uses to inject the data-source
ADAPTER. The plain `{ object, view }` object shadowed the adapter, so the first
`dataSource.find(…)` threw `dataSource.find is not a function` and `list-view`
rendered "Couldn't load records" — a spec-compliant component failing next to
identical ones that omitted the binding.

- `@object-ui/react` — `SchemaRenderer` no longer spreads `schema.dataSource` as a
  prop (it is metadata, like `visibleWhen`); renderers read it off `schema`. An
  explicit React `dataSource` prop is unaffected. New
  `useElementDataSource(schema, dataSource?)` hook resolves a binding, fetching
  the named saved view from the object definition's `listViews` and the metadata
  overlay's `listViews()`.
- `@object-ui/core` — new `isElementDataSourceConfig` / `collectSavedViews` /
  `resolveSavedView` / `composeElementDataSource`, and `resolveElementDataSource`
  now honours `view` through an optional `DataFetcher.fetchViews`, reporting an
  unresolvable view as an error instead of silently returning every record.
  `resolveViewId` moved here from `@object-ui/app-shell` (re-exported there) so
  one matcher serves both the object page and a page component.
- `@object-ui/plugin-list` — `list-view` maps the binding onto the props
  `ListView` reads. `dataSource.*` keys are authoritative, view-supplied values
  are a baseline the component's own keys override, and `filter` AND-combines at
  every level (the spec calls the binding's filter "additional criteria"), so a
  binding can narrow a saved view but never widen it. A `view` name that does not
  resolve renders a configuration error naming the object's actual views and
  issues no query — it never falls back to the object's default view, because that
  turns a typo into a silently wider answer.
