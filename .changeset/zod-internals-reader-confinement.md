---
---

Test-only change. Four spec-parity suites each carried a byte-for-byte identical
hand-written walk into Zod's internals to read a key's enum vocabulary; they now
import one `shapeEnumOptions` reader from the private, never-published
`@object-ui/test-support`. No published package's runtime behaviour changes —
the only edits to released packages are a `devDependencies` entry each.
