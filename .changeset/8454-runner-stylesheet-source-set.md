---
'@object-ui/runner': patch
---

Fix every `@source` path in the runner's Tailwind entry, and keep test files out
of its published stylesheet (objectui#8454).

`packages/runner/src/index.css` is a published input: this package is
`private: false` with `files: ["dist"]`, so what it compiles to is bytes a
consumer downloads and serves. All five of its `@source` lines were wrong by one
path segment. Tailwind resolves a relative `@source` against the directory of the
entry CSS — `packages/runner/src/` — so `./src/**` meant
`packages/runner/src/src` and `../../packages/<pkg>/src` meant
`packages/packages/<pkg>/src`. A glob whose base directory does not exist scans
nothing and raises no error, so the file read as if it declared its inputs while
declaring none: deleting all five lines produced a byte-identical artifact.

What kept the sheet non-empty was Tailwind's automatic source detection, whose
base defaults to the process CWD — `packages/runner`, where `pnpm build` runs.
That covers this package's own tree and nothing else, so every utility belonging
to `@object-ui/components`, `@object-ui/react`, `@object-ui/plugin-kanban` and
`@object-ui/plugin-charts` was missing from the shipped app. Measured from the
package directory, repairing the four sibling paths takes the compiled sheet from
228 to 1456 selectors (21 kB to 136 kB): `bg-popover`, `bg-accent`,
`bg-destructive`, `animate-out` and 1224 more had no source anywhere.

The same automatic root also swept this package's own test files into the
published bytes. Two `@source not` lines — the spelling
`packages/plugin-kanban/src/index.css` already uses, anchored one level up
because this entry scans four sibling packages — remove nine test-sourced
classes, several of them ordinary English words lifted out of prose comments
(`paused`, `invert`, `flex-nowrap`).

`patch`: this package exposes no importable surface at all (no `main`, `module`,
`types` or `exports` — it publishes a built application under `dist`), so nothing
a consumer imports changes shape. The nine removed classes are unreachable from
the app's own markup by construction, which is why the scan never had a shipped
source for them.
