---
---

Docs and pin only — no published behaviour changes.

`packages/components/README_SHADCN_SYNC.md` no longer restates the component
classification that `shadcn-components.json` owns (objectui#3881). The page's two
prose censuses contradicted the manifest three ways — `resizable` was listed as
registry-updatable although the manifest records that re-syncing it breaks the
build, `chart` was missing entirely, and the custom heading said 14 against the
manifest's 15 — while the `(46)` total still matched, because the two membership
errors cancelled out.

The censuses are deleted rather than corrected: the page now states what the two
categories mean and points at `pnpm shadcn:list`, which prints both from the
manifest, offline. The one enumeration that survives is the diverged set, whose
misreading is what breaks the build, and it is held to the manifest by
`packages/components/src/__tests__/readme-shadcn-sync-categories.test.ts` as
member sets — deliberately not as counts.
