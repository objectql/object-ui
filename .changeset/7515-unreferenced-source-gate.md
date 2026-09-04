---
"@object-ui/components": patch
---

Remove `src/ui/toast.tsx`, an unreferenced primitive, and the dependency only it imported

The file was reachable from nothing: no importer anywhere under
`packages/components/src`, and `ui/index.ts` never carried it, so the barrel's
`export * from './ui'` did not reach it either. It shipped all the same —
`dist/ui/toast.d.ts` was in the published tarball — while contributing nothing to
`dist/index.js` and nothing to the package's export surface. `ui/sonner.tsx`
(`Toaster`) is the live implementation and is unaffected.

`@radix-ui/react-toast` is dropped from `dependencies` in the same change: the
removed file was its only importer anywhere in the repository, so it would
otherwise have stayed a declared dependency of every install with nothing to
resolve it.

No exported name changes. A consumer who was resolving `@radix-ui/react-toast`
through this package's dependency was relying on hoisting rather than on a
declaration, and should declare it directly.
