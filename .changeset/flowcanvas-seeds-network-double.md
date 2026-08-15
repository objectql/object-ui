---
---

Test-only: stub `fetch` for the `automation/actions` endpoint in
`flow-canvas-seeds.spec-parse.test.tsx` so the suite no longer escapes to the
real network (`ECONNRESET`/"socket hang up" noise from happy-dom's own
`http`-backed fetch polyfill); no published behaviour changes.
