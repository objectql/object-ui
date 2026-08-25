---
---

The doc version-literal ledger can now see a version written behind a
`<toolchain>-version:` key — `node-version: 20`, the shape every workflow example in
these docs uses (objectui#6409). Test-only: `scripts/__tests__/doc-version-claims.test.ts`
gains a second recogniser for that shape, plus the permanent fixture that rebuilds the
pre-fix recogniser and asserts it fails on the same line the new one matches. No
published package source changes.
