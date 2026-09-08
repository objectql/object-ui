---
---

Re-author the seven catalog `badge` nodes that carried their text under
`children` — a key `ui:badge` never reads — to `label`, the key 31 of the
other badge nodes already use (objectui#6829, arm A). Restores the three
`components-basic-span` demos that drew an empty pill and the two badges
`core-schema-renderer/nested-schema-example` silently dropped, and adds a
per-renderer pin that reads each pill's rendered text. Fixtures and tests only,
in the private `@object-ui/example-schema-catalog`; no published package
changes, so no version bump.
