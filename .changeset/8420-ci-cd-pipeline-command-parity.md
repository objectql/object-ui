---
---

Pin the `Inert vi.mock Specifiers` and `Shadcn Component Check` sections of
`content/docs/guide/ci-cd-pipeline.md` to the commands their jobs actually run
(objectui#8420). The first section named one of `vi-mock-specifiers.yml`'s two
gates — the omitted `check-vi-mock-inherit.mjs` is a blocking step of a required
context — and the second named none of its job's three commands. Documentation
and test only; no package is released by this change.
