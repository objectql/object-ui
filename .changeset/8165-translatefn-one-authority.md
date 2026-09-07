---
---

Re-point `saveAdvisoryToast`'s `TranslateFn` at its one authority,
`writeWarningToast` (objectui#8165), and shrink the `KNOWN_COLLISIONS` baseline
in `scripts/__tests__/one-authority-per-exported-name-6273.test.ts` by that
site. Type-level only: the declaration was byte-identical to the one it now
re-exports, the name is on no package's published face, and `export type { X }
from '…'` erases at build — so no package is released by this change.
