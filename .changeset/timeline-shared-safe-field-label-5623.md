---
---

Internal dedup: `ObjectTimeline` now uses the shared `useSafeFieldLabel` from
`@object-ui/react` instead of its own local `useSafeObjectLabel` wrapper /
`OBJECT_LABEL_FALLBACK` (objectui#5623). No exported symbol changed and the
timeline's `fieldOptionLabel` call site behaves identically on both the
bound and unbound i18n paths — no published behaviour changes.
