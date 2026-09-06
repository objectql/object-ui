---
---

Test-only change: pin the `openNativePicker` click path through `DateField` — that
clicking the field invokes the helper on its own input, and that a host-supplied
`onClick` arriving through DOM props is not swallowed (objectui#7570). No published
behaviour changes.
