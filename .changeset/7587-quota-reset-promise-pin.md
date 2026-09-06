---
---

Pin what a free-plan 429 actually renders after cloud PR #1852 inverted
`error.details.resetsTonight` and added a sibling `resetsAt` (objectui#7587).
Measured: `resetsTonight` has no reader past `parseAiQuotaError`, so the
inversion changes nothing on screen and the banner is the server's own sentence
verbatim — pinned as an exact accounting of the rendered text, and as the flag
being inert. Tests plus one field comment; no package is released by this
change.
