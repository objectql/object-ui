---
---

objectui#4029 — no behavior change, so no version bump. Adds
`eslint-disable-next-line no-console` plus an explanatory comment to
`@object-ui/core`'s `debugLog`/`debugTime`/`debugTimeEnd` (the repo's opt-in
debug channel, gated behind `globalThis.OBJECTUI_DEBUG`) and
`@object-ui/data-objectstack`'s `createQuietHttpLogger` (a Logger-interface
implementation whose methods deliberately forward to the matching
`console.*` method), so the repo-root `no-console` lint rule added in this
same change does not flag infrastructure that exists specifically to call
`console.*`.
