---
---

Internal only — a test and a test-only tsconfig, no source change, so no release.

#4325 asked what `@object-ui/fields` publishes. `packages/fields/package.json`
exports exactly `.` and `./style.css`, but
`plugin-detail`'s `RelatedList.longFormColumns.test.tsx` side-effect-imported a
third path, `@object-ui/fields/widgets/MarkdownContent`, to pre-resolve the lazy
markdown chunk before asserting a column's ABSENCE. That specifier resolved only
through this repo's vitest source alias — under Node's own resolution it is
`ERR_PACKAGE_PATH_NOT_EXPORTED`, and under `tsc` with the standard `paths: {}`
template it was TS2882, which is why `plugin-detail/tsconfig.test.json` carried
the repo's only source-tree `paths` entry to restate the alias.

The ruling was to NOT publish the subpath: the package's surface is its index,
and one test's preload does not justify minting permanent public API plus a
matching `dist` layout to maintain forever. So the import is gone, the tsconfig's
`paths` is now `{}` like every other wired-up package's, and the test's anti-race
guarantee was rebuilt rather than dropped.

Preloading through the sanctioned entry was measured, not assumed, and does not
work: importing `@object-ui/fields` only evaluates the module that DECLARES
`React.lazy(() => import('./widgets/MarkdownContent'))` — the factory does not
run, the chunk stays cold, and a probe waited 321.8ms for it on an idle
container (AGENTS.md records up to 976ms under load, against RTL's 1000ms
default). The race is therefore removed instead of won: the cases now assert on
a witness present in every state of the lazy boundary — the Suspense fallback's
raw value, the resolved markup, and the data-table cell wrapper's `title=`.

Measured three ways with the `#4250` derivation scratch-broken: the new witness
reports 2 document cells and goes red; the OLD assertions
(`queryByText('Heading')`, `td h1`) pass all 5 cases against that same broken
derivation once the preload is gone — the green-for-wrong-reason trap the issue
predicted, now pinned shut.
