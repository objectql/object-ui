---
'@object-ui/plugin-detail': patch
---

`@object-ui/plugin-detail` now declares `react-router-dom` as a peer dependency (`^6.0.0 || ^7.0.0`), the range its three siblings already use.

It has been importing the router all along — `PermissionFacetLink.tsx` and `record-reference-rail.tsx` both take `Link` and `useParams` from it — while its manifest named it in no field at all. That resolved locally for a reason that does not travel: the workspace root declares `react-router-dom` in its own `devDependencies`, so a `node_modules/react-router-dom` symlink exists at the root of this repository and Node's upward directory walk reaches it from every package directory. A consumer's install has no such root, and this package's rollup config externalises every bare specifier, so the published `dist/index.js` carried an import of a package the manifest never asked for.

Consumers already installing `@object-ui/app-shell`, `@object-ui/layout` or `@object-ui/plugin-designer` were unaffected — all three declare the same peer — so this closes the case of a consumer that pulls `plugin-detail` on its own.

A new repository gate, `pnpm check:phantom-deps`, now asserts that every bare specifier a released package imports under `src/` is declared by that package rather than merely resolvable from it, so the next one of these fails on the pull request that introduces it (objectui#4394).
