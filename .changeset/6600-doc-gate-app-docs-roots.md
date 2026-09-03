---
---

Doc gate scan roots only, no published package source changed.

`check:doc-fences`, `check:doc-snippets` and `check:doc-types` now walk
`apps/<app>/docs/**` in addition to `content/docs`, the root `README.md` and
(for the first two) the package READMEs. The three console operator guides were
previously read by no documentation gate at all — `check:control-bytes` was the
only check whose surface contained them.
