---
"@object-ui/app-shell": minor
---

feat(studio): a page button created in Studio can be given an action

`element:button` renders inert without an `action`, and Studio had no way to add
one. The inspector's curated `BLOCK_CONFIG` entry listed `label`, `variant`,
`size`, `icon` — no `action` — and the generic "Advanced" section is not a
fallback for that, because it enumerates the keys the block **already has**
(`Object.keys(blockProps)`). So it could edit an `action` authored in source, and
never add one to a button dragged from the palette.

Adds a `json` field kind — the same `InspectorJsonField` editor Advanced uses,
reachable for a property that does not exist yet — and an `action` field on
`element:button` carrying `{ "type": "url", "target": "/environments" }` as its
placeholder. An empty JSON textarea is otherwise the whole affordance, so
`placeholder` is now threaded through to the textarea and asserted for every
`json` field.

Raw JSON rather than typed sub-fields deliberately: the spec declares the prop as
`InlineActionSchema` (objectstack-ai/objectstack#4135), and the inspector cannot
render a nested schema as fields yet. A JSON box the author can actually use
beats a curated form that models a fraction of the shape.

Refs objectstack-ai/objectui#2997
