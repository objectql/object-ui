---
"@object-ui/app-shell": minor
---

feat(studio): visualize loop / parallel / try_catch nested regions on the flow designer canvas (#2670)

The flow designer rendered ADR-0031 structured control-flow containers
(`loop` / `parallel` / `try_catch`) as opaque single node cards — their nested
regions (`config.body` / `config.branches[]` / `config.try`/`catch`) were only
visible, and only editable, as raw JSON in the inspector's Advanced block.

A container card now carries a **"show nested regions"** control that opens a
read-only popover rendering the region(s) as a mini-canvas — the same
top-to-bottom node/edge layout as the parent graph, produced by the shared
`computeLayout` and scaled to fit — with a header per region (a named branch or
`Branch N`, and `Try` / `Catch`; a loop body has none). Legacy flat loops (a
`loop` with no `config.body`) and all ordinary nodes render exactly as before.

Read-only for now (Phase 1 of #2670): the region renders in a floating popover,
so it needs **no change to the canvas layout or edge routing** — zero regression
risk to existing flows. Inline push-down nesting on the canvas and nested editing
are tracked as the next increments on #2670.
