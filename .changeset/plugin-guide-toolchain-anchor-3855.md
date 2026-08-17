---
---

Docs + test-only (objectui#3855). `content/docs/guide/plugins.md`'s plugin `package.json`
skeleton taught `typescript` `^5.0.0` and `vite` `^5.0.0` — one major and three majors
behind a workspace whose 19 plugin packages unanimously declare `^6.0.3` and `^8.2.1`. The
block is an in-workspace plugin (all three `@object-ui` dependencies at `workspace:*`, a
`vite build && tsc --emitDeclarationOnly` build script), so a reader scaffolding from it
builds against this repo's toolchain and hits the mismatch as "my plugin will not build".

The durable half is the answer to why the version-claims ratchet
(`scripts/__tests__/doc-version-claims.test.ts`, objectui#3711) reported green over it for
months: it did not miss the lines. Both matched the scan and both were inventoried — as
`kind: 'sample'`, a class that records a literal without checking it, on the stated reason
that "the plugin author picks their own bundler version after copying it". That is true of a
standalone plugin and false of a `workspace:*` manifest. The two entries are now `anchored`
and carry a new `skeletonDep` field, and a new assertion reads the range off the skeleton
line and compares it against what the in-repo plugin manifests declare, so the next
toolchain bump turns the gate red naming that page instead of re-fossilising it. The same
block's `peerDependencies` `react` range deliberately stays `sample`: a peer range is what
a copied plugin accepts from its host, which its author owns.
