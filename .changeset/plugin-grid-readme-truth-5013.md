---
'@object-ui/plugin-grid': patch
---

plugin-grid README: replace the fictional `gridComponents` manual-registration
snippet and the `GridSchema` / `GridColumn` type names with this package's real
export surface and the real data-grid types.

Three assertions the README made about identifiers were not true of this package
(objectui#5013):

- `gridComponents` had zero hits anywhere in the repo. The snippet's
  `Object.entries(gridComponents).forEach(…)` threw `TypeError` on the first
  copied line. Registration here is a side effect of importing the entry, so the
  section is replaced by what actually happens: the keys the three real
  `ComponentRegistry.register(…)` calls claim, the 49-name export surface, and —
  for the case the snippet was reaching for — registering the exported
  `ObjectGridRenderer` under a caller's own key.
- `GridSchema` and `GridColumn` were imported from `@object-ui/plugin-grid` as
  the data-grid schema and column types. Neither is on this package's export
  surface, and both names denote something else where they do exist:
  `GridSchema` in `@object-ui/types` is the **CSS Grid layout** container
  (`columns` there is a column count, not a column list), and `GridColumn` in
  `@object-ui/fields` is the **form line-items** widget's column (keyed `name`).
  The example is rewritten on the real types, `ObjectGridSchema` and
  `ListColumn` from `@object-ui/types`, with the component-props type
  `ObjectGridComponentProps` named as the thing row callbacks belong to.
- The in-prose `interface GridColumn { header; accessorKey; … }` reference block
  made that absent name read like a real export, and contradicted this README's
  own Column Summaries section, which already documented columns as `field` +
  `summary`. It is replaced by the 14 keys of `ListColumn`, whose Zod
  declaration is strict — `accessorKey` / `header` are rejected, not ignored.

Documentation only: no code, type or runtime change. `patch` because `README.md`
is in the package's published `files`.
