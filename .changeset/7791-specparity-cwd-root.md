---
---

Test-only: the `CapabilityMultiSelectField` spec-parity pin
(`packages/fields/src/widgets/CapabilityMultiSelectField.specParity-6285.test.tsx`)
resolved the source it reads against `process.cwd()`, so it failed under the
package-level `test` script (objectui#7791). Nothing ships — no runtime source
changed, and no package is released by this change.

The root is now derived from the test file's own `import.meta.url` instead of
from the cwd, so the pin reaches the same verdict under every invocation. Both
readings are 133 files / 2178 tests green after the change; the package-level
one was 1 file / 2 tests red before it.
