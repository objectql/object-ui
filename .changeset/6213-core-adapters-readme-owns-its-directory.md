---
'@object-ui/core': patch
'@object-ui/data-objectstack': patch
---

`packages/core/src/adapters/README.md` now documents the adapters that are actually in that
directory, and the ObjectStack material it carried moved to the package that owns the behaviour
(objectui#6213). Both files ship to consumers — `@object-ui/core` publishes its `src/`, and a
README rides every tarball — so this was published documentation describing the wrong package.

The page had been left behind when the ObjectStack adapter moved out to
`@object-ui/data-objectstack`: its headings, feature list, filter-operator table and
query-parameter table were all about that adapter, and its one-entry "Available Adapters" list
told a reader Object UI has exactly one adapter and that it comes from `@object-ui/core`.
`ApiDataSource`, `ValueDataSource`, `resolveDataSource`, `runBatchTransaction` and
`emulateBatchTransaction` — the five exports that directory really ships — were named nowhere.

- **`@object-ui/core`**: the page now opens with what the directory holds, gives each export a
  usage snippet and a `provider` mapping, and points at `@object-ui/data-objectstack` for the
  ObjectStack adapter. `## Creating Custom Adapters` is unchanged — it is the one section that was
  always about this directory.
- **`@object-ui/data-objectstack`**: gains a `## Query Translation` section carrying the
  filter-operator and query-parameter mapping tables, the AST conversion example and the sorting
  example. That material existed **only** in the `core` copy — this package's README documented
  query translation as a single feature bullet — so it is ported, not dropped.

No runtime behaviour changes; the duplicate copy of one package's documentation living under
another package is what goes away.
