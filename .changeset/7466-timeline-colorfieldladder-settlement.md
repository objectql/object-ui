---
---

Test-only: `colorsFor` in the timeline `colorField` ladder fixture now returns the
`lastItems` array its own readiness predicate accepted, instead of re-reading the
module-level global on the next line. No published behaviour changes — the shared
`createFieldColorResolver` ladder is untouched.
