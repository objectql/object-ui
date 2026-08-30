---
'@object-ui/app-shell': patch
---

Take the metadata-admin engine out of the console's eager closure (objectui#6776).

`AppContent` has declared six `lazy()` imports of `views/metadata-admin/index.ts`
for a long time, and none of them deferred anything: the module ran five
registrations at load, so the package's published `sideEffects` array named it,
an array entry is unshakeable, and the package barrel re-exported 25 runtime
values from it — an ordinary static edge from an entry every consumer imports.
Every page, preview and inspector under `views/metadata-admin/` was therefore
fetched and parsed before first render. Measured from
`apps/console/dist/eager-closure.json`: **3,254,230 → 3,222,314 gzipped bytes,
−31,916 B**, and the 172,945-byte `metadata-admin` chunk leaves the eager set
entirely.

**Published surface — two contract-bearing changes, no signature change:**

- `packages/app-shell/package.json`'s `sideEffects` array now names
  `views/metadata-admin/register-builtins` (the new leaf that performs the five
  registrations) instead of `views/metadata-admin/index`. The five
  registrations still run at package load, bare-imported by the package entry,
  so nothing a consumer could observe changes — but the array is a contract
  every consumer's bundler reads, so the swap is stated here rather than left
  to a diff.
- The package barrel's 25 metadata-admin runtime re-exports (and 11 type-only
  ones) now point at their leaf modules. **Same names, same types.** They are
  unreachable from outside the package by any other path — `exports` is
  root-only — so no import an out-of-package consumer can write is affected.

`registerAppComponent`'s signature is unchanged. `metadata:directory` and
`metadata:resource` are now registered as `lazy()` values, each wrapping itself
in its own `Suspense` boundary, which is the shape the already-lazy
registrations in `apps/console` use; no render site changes.

Also re-baselined `MAX_EAGER_CLOSURE_GZIP_BYTES` in the same change, from
3,300,000 to 3,268,000. Taking 31,916 bytes out without moving the ceiling would
leave 0.85x of the 89 KiB regression the gate exists to catch as headroom —
near-blind — so the ratchet advances with the win rather than after it.
