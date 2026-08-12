---
---

Test-only (objectui#4434): the DOM-leak attribute judge — `isKnownAttribute`,
`findLeaks`, `leakReport`, the happy-dom IDL gap table, the SVG presentation
list and the open attribute families — is now one shared module in the new
`@object-ui/test-support` package, instead of two already-diverged copies
defined inline in the `@object-ui/fields` and `@object-ui/app-shell` DOM-leak
gates. Its calibration fixtures moved with it and prove it once, for both.

Nothing published changes. `@object-ui/test-support` is `private: true` and is
never released; the two consumers gain a `devDependency` on it and no runtime
dependency, no `exports` map entry and no public API were added or altered.
