---
'@object-ui/cli': patch
---

Inside a pnpm workspace, `objectui dev` / `serve` / `build` now resolve every platform package
from workspace source (objectui#3890).

The temp app these commands generate installs nothing inside a workspace — it resolves by
hoisting, and the repo root declares no `@object-ui/*` — so a Vite alias table is the only thing
that resolves a platform package there. That table was a hand-kept list of eleven names in
`dev`, which is not a list of what the app imports but of what it imports *transitively*:
measured on the reported commit, the generated entry closes over 21 packages, ten were unlisted,
and every module whose transform hit one of them answered 500 with a blank page behind it. Vite's
dependency scan named only four of the ten, because a scan stops at the first layer it cannot
resolve.

The table is now derived from `pnpm-workspace.yaml` — every scoped workspace package that exposes
a source barrel, targeting its `src` directory — and a test reconciles it against the manifest so
it cannot drift again. `serve` and `build` had no workspace branch at all (no aliases, and an
unconditional `npm install` against a manifest that is empty here); all three commands now share
one helper. The `lucide-react` entry moved from a resolved entry file to the package root, so
subpath imports of it stop being rewritten into a path that cannot exist.

Measured with the reported repro, from the repo root: 8 of the first 400 modules a browser walk
reaches answered 500 before, 0 of 2498 after, and the page renders its schema instead of nothing.
