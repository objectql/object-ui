---
'@object-ui/core': patch
---

`packages/core/src/adapters/README.md` no longer teaches an import that does not exist.
Both of its snippets read `import { createObjectStackAdapter } from '@object-ui/core'` and
`import { ObjectStackAdapter } from '@object-ui/core'`; neither symbol is exported by
`@object-ui/core` — both live in `@object-ui/data-objectstack`, whose own JSDoc example
spells the correct path. The adapter moved out of `packages/core/src/adapters/` and the
README that documents it was left behind pointing at the old home, so a reader who copied
either snippet got TS2305 at build time. The name was right; the path was wrong, so the
path is what changed.

This README is inside `packages/core`, which ships its `src/` in the npm tarball, so the
wrong import shipped to consumers rather than staying an internal note.

Found by `pnpm check:readme-exports` (objectui#5043) on its first run over the tree — the
gate added in the same change, which reads each package's real export surface out of its
declared type entry with the TypeScript checker and fails on any README self-import naming
something the package does not export. Nothing else in this change is published: the gate,
its pin tests and its workflow are repository tooling.
