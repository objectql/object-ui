---
---

Internal test-support change, no user-visible behaviour (objectui#6924).

The 17 hand-written `(Schema as { options?: readonly string[] }).options` casts
across 16 spec-parity test files converge onto `@object-ui/test-support`'s
`enumOptions(node)` — a sibling entry point onto the wrapper walk
`shapeEnumOptions` already carried, which now delegates to it rather than
holding a second copy. Only test files, the private (never-published)
`@object-ui/test-support`, and `devDependencies` edges change; no package's
shipped `dist/` and no public type moves.
