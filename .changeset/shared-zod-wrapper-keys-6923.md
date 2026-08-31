---
---

Internal only — no user-visible change, nothing to release.

objectui#6923: the Zod wrapper-key list that five test/gate sites each spelled
out by hand now lives once, in `packages/test-support` (a `private: true`,
never-published package), and is read by both the TypeScript suites and the
`.mjs` CI gates. Only test files, CI gate scripts and the private
`test-support` package change; no released package's runtime code is touched.
