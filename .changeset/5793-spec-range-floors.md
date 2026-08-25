---
'@object-ui/plugin-detail': patch
---

`@object-ui/plugin-detail` now declares `"@objectstack/spec": "^17.1.0"` rather than
`^17.0.0`, which is the lowest published spec that carries the symbol its own build
output re-exports (objectui#5793).

`dist/renderers/record-reference-rail.d.ts` reads
`export type { ReferenceRailEntry } from '@objectstack/spec/ui'`, and
`ReferenceRailEntry` first appears in `@objectstack/spec@17.1.0` — measured against the
published tarballs, not the installed tree: the name is absent from 17.0.0's
`dist/ui/index.d.mts` (425 exported names) and present in 17.1.0's (442). So the old
range was a claim the package could not honour. Any consumer resolution that lands
17.0.0 — a sibling pinning it exactly, an `overrides` entry, a mirror a minor behind —
satisfied `^17.0.0` and got a dangling type re-export.

Nothing a consumer installs today changes: normal resolution already picks the newest
17.x, and `pnpm-lock.yaml` still resolves 17.2.0 on this edge after the bump. The change
is to the declared floor only, which is why it is scored `patch` rather than `minor` —
the same reasoning objectui#5753 used for the other direction on this dependency.

The bump is one instance; the durable half is `scripts/check-spec-range-floors.mjs`, a
gate that compares every published package's `dist` imports of `@objectstack/spec/*`
against the export set of that package's own declared minimum. It runs on the publish
path (`pnpm changeset:publish`) and nightly, and it names the symbol behind every range
it asks for. No other package's floor is touched: the gate finds nothing else to justify
one across the 19 packages that declare the spec in a consumer-facing field.
