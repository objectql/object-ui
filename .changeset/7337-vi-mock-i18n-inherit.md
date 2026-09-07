---
---

Sweep the `vi.mock('@object-ui/i18n', …)` factories that hand-list the mock's
export surface over to the obtain-and-spread form, and fix the
`check-vi-mock-inherit` recogniser's nested-generic blind spot
(objectui#7337). Test and CI-script only; no package is released by this
change.
