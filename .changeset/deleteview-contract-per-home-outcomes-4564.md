---
'@object-ui/types': minor
'@object-ui/data-objectstack': minor
---

The `DataSource` contract carries `deleteView`'s per-home outcomes (#4564)

#4479 / PR #4562 widened the ObjectStack adapter's `deleteView` to return
`DeleteViewResult { deleted, draft?, published? }`, so a caller could finally tell a
partial delete ("draft gone, published overlay left") from a complete one. The shared
interface did not follow: `DataSource.deleteView?` still declared the narrow
`Promise<{ deleted: boolean }>`.

Nothing failed to compile, and that is exactly what made the gap invisible — a wider
return is assignable to a narrower declaration, so the adapter satisfied the interface
while every consumer reaching it **through** `DataSource` was handed a type with the
per-home outcomes already discarded. The one real call site today (app-shell's
`ObjectView` delete handler) awaits the call and reads nothing off the receipt, so the
loss was latent rather than broken.

`DeleteViewResult` and `ViewHomeDeleteOutcome` now live in `@object-ui/types`, beside
the `DataSource` interface that returns them, and `deleteView?`'s declared return is
`Promise<DeleteViewResult>`. The direction was forced: the dependency runs
`@object-ui/data-objectstack` to `@object-ui/types` and never the other way, so the
shapes could not be imported downward — moving them was the alternative to re-declaring
a structural twin in `types`, which the one-resolver rule rejects because a copy is
mutually assignable with the original for exactly as long as it takes to drift.

`@object-ui/data-objectstack` re-exports both names unchanged, so every importer PR
#4562 left pointing at it keeps compiling — and now resolves to the same declaration the
shared contract speaks rather than a look-alike. A repo-wide census before the move
found zero importers of either name outside the declaring file itself, PR #4562's own
suite included, so the re-export is insurance rather than a load-bearing shim.

`deleteView` stays **optional** on the interface and keeps both parameters; the growth is
to the return type only, and `deleted` is untouched, so a consumer reading only `deleted`
needs no edit.

Grading, per this repository's version-alignment convention (the major tracks
`@objectstack`, never an API-break count):

- `@object-ui/types` — **minor**: entry-reachable growth. Two new exported interfaces
  plus a widened method return on `DataSource`, all reachable from the package entry.
- `@object-ui/data-objectstack` — **minor**, measured rather than assumed. Its emitted
  `dist/index.d.ts` is **not** byte-identical after the swap: the two `interface` blocks
  leave the file and are replaced by a re-export from `@object-ui/types` (121.61 KB to
  120.25 KB). Both names remain in the public export list, so no importer breaks, but the
  declaration genuinely moved and the emitted types now depend on `@object-ui/types` for
  it — that is a minor, not a patch.
