---
'@object-ui/core': patch
'@object-ui/data-objectstack': patch
---

`@object-ui/core` and `@object-ui/data-objectstack` now declare
`"@objectstack/spec": "^17.2.0"` rather than `^17.0.0`, which is the lowest published
spec that carries every symbol each package's own build output references
(objectui#6361).

`packages/core/dist/utils/column-sortability.d.ts` references
`FIELD_SORTABLE_UNPROVISIONED_ANCHOR`, `FIELD_UNSORTABLE_VIRTUAL_TYPE`,
`FieldSortability` and `ObjectSortability` from `@objectstack/spec/api`, and
`packages/data-objectstack/dist/index.js` references the first two — none of which
`@objectstack/spec@17.0.0` exports. Measured against the published tarballs rather than
the installed tree, by `scripts/check-spec-range-floors.mjs`: six `floor-too-low`
findings across the two packages, and `^17.2.0` is that gate's own computed answer for
both. So the old range was a claim neither package could honour: any consumer
resolution that lands 17.0.0 — a sibling pinning it exactly, an `overrides` entry, a
mirror two minors behind — satisfied `^17.0.0` and got a dangling reference.

Nothing a consumer installs today changes: normal resolution already picks the newest
17.x, and `pnpm-lock.yaml` still resolves `17.2.0` on both edges after the bump — only
the recorded `specifier:` moves. No source and no behaviour changes, which is why this
is scored `patch`, on the reasoning objectui#5793 used for the same remediation on
`@object-ui/plugin-detail`.

The bump is release-blocking rather than cosmetic. `check:spec-floors` is deliberately
not a `pull_request` job, so every PR stayed green while its blocking copy on the
publish path — `pnpm changeset:publish` runs it before a single tarball reaches npm —
would have cancelled the next release.
