---
'@object-ui/app-shell': patch
---

Ship explicit extensions on every relative import specifier, so plain Node can load the published entry

Node's ESM resolver does not extension-search relative specifiers, and `tsc` never rewrites them — so an extensionless `./Foo` in the source stayed extensionless in `dist`, and `import('@object-ui/app-shell')` under plain Node died with `ERR_MODULE_NOT_FOUND` on the package's own first re-export. Bundled consumers were unaffected, which is why nothing was red. 1271 specifiers now carry the extension they emit as (1227 `.js`, 44 `/index.js`), and `dist/` no longer emits a single extensionless one.

- Every specifier was identified by the TypeScript parser and resolved against the filesystem — the suffix follows whichever candidate file exists, never the shape of the string. Three strings that parse as imports live in prose comments and were left alone.
- `@object-ui/app-shell` is the last entry in the `SPECIFIER_DEBT` ledger of `scripts/check-node-esm-load.mjs`, so removing it empties the map: the specifier leg is no longer a ratchet with grandfathered names but a hard requirement for every published package that preserves specifiers.
- The entry still does not evaluate under plain Node, for a different and already-ledgered reason: it statically imports `@object-ui/plugin-dashboard`, whose module-scope `react-grid-layout` stylesheet Node cannot load at all. That failure was previously masked behind the specifier error and is now recorded in `LOAD_DEBT` beside the package it comes from.
