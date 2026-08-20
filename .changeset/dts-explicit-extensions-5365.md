---
'@object-ui/components': patch
'@object-ui/layout': patch
---

The typings both packages publish now carry an explicit extension on every relative specifier, so a consumer on `moduleResolution: nodenext` can follow them.

`vite-plugin-dts` emits one declaration file per source file, and TypeScript
copies a module specifier into the declaration verbatim. `export * from './ui'`
therefore shipped extensionless in `dist/index.d.ts` — 21 such re-exports in
`@object-ui/components`, 7 in `@object-ui/layout`, 128 across the two emitted
trees. Node16/NodeNext resolution does not extension-search a relative
specifier, so the compiler could follow none of the hops and every symbol they
carried read as absent from the package:

```
error TS2305: Module '"@object-ui/components"' has no exported member 'Badge'.
```

Measured on `@object-ui/app-shell`, the largest consumer and the one that pulls
in both packages: 880 TS2305 across 162 files (864 from `components`, 16 from
`layout`), plus 215 TS7006 as fallout from the imports that stopped resolving.
On `@object-ui/fields`, 178 TS2305 and 57 TS7006. Both are zero now.

The emitted `.js` never had the defect — rolldown resolves the same specifier
away — which is why `pnpm check:esm-specifiers`, whose verdict is about
specifier-preserving `.js` builds, correctly never scanned either package. The
fix is therefore in the declaration EMIT (`scripts/vite-dts-explicit-extensions.ts`,
shared by both `vite.config.ts` files), not in the sources: the same source line
produces a clean `.js` and a broken `.d.ts`, so no source edit can express the
difference. The rewriter resolves each specifier against the source tree the
output mirrors — a file hop becomes `./x.js`, a directory hop `./x/index.js` —
throws on anything it cannot resolve, and after the build re-parses the emitted
declarations to assert every relative specifier both carries an extension and
names a file the build really emitted.

`packages/fields` takes the `nodenext` pin as a result — the same two lines
`packages/react` has carried since objectui#4538 — so the property is enforced by
the compiler on the consumer side rather than by review. `packages/app-shell`
does not: it type-checks clean without the pin and still shows 23 errors with it,
none of them from these two packages. That residue is filed separately.
